import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections } from '../../services/firestore';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiText } from '../../services/coaching/gemini.client';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import { parseBody } from '../../utils/validate';
import { containsForbiddenTerms } from '../../services/coaching/forbidden.filter';

const DiaryBodySchema = z.object({
  childId: z.string().min(1).max(128),
  locale: z.enum(['ko', 'ja', 'zh-Hant']).optional(),
});

// ── 로케일별 폴백 문구 (AI 미사용/실패 시에도 사용자에게 한국어가 노출되지 않도록) ──
const NO_RECORDS_MESSAGE: Record<'ko' | 'ja' | 'zh-Hant', string> = {
  ko: '오늘은 아직 기록이 없어요. 아이와의 하루를 기록하면 AI가 따뜻한 일기를 만들어드려요!',
  ja: '今日はまだ記録がありません。お子さんとの一日を記録すると、AIが温かい日記を作ってくれますよ！',
  'zh-Hant': '今天還沒有記錄喔。記錄下與孩子的一天，AI 就會幫你寫出溫暖的日記！',
};

/**
 * 사용자 입력이 prompt 의 일부로 들어가는 경우(e.g. 이전 세션 메시지),
 * instruction-style markers 를 제거해 prompt injection 방어.
 */
function sanitizeForPrompt(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let s = raw.slice(0, 200);
  s = s.replace(/\[\/?INST\]/gi, '');
  s = s.replace(/<\/?(system|assistant|user)>/gi, '');
  s = s.replace(/<\|[^|>]*\|>/g, '');
  s = s.replace(/(^|\n)\s*(BEGIN|END)\s+(SYSTEM|USER|PROMPT)/gi, '');
  return s.trim();
}

function buildTrackingText(data: Record<string, unknown>): string {
  // 실제 아기시간 기록은 babyTrackerDays 의 records 배열 형식 (type/subType/time/duration ...)
  const records = Array.isArray(data.records) ? (data.records as Array<Record<string, unknown>>) : null;
  if (records) {
    let feeding = 0, sleepMin = 0, poop = 0, pee = 0, med = 0;
    const feed: Record<string, number> = { breast: 0, formula: 0, baby_food: 0, snack: 0 };
    for (const r of records) {
      const type = r.type as string;
      const sub = r.subType as string;
      if (type === 'feeding') { feeding++; if (sub in feed) feed[sub]++; }
      else if (type === 'sleep') { sleepMin += typeof r.duration === 'number' ? r.duration : 0; }
      else if (type === 'diaper') {
        if (sub === 'poop' || sub === 'both') poop++;
        if (sub === 'pee' || sub === 'both') pee++;
      } else if (type === 'medication') { med++; }
    }
    const parts: string[] = [];
    if (feeding) {
      const detail = [
        feed.breast ? `모유 ${feed.breast}` : '',
        feed.formula ? `분유 ${feed.formula}` : '',
        feed.baby_food ? `이유식 ${feed.baby_food}` : '',
        feed.snack ? `간식 ${feed.snack}` : '',
      ].filter(Boolean).join('·');
      parts.push(`수유/식사 ${feeding}회${detail ? ` (${detail})` : ''}`);
    }
    if (sleepMin > 0) parts.push(`수면 ${Math.floor(sleepMin / 60)}시간 ${sleepMin % 60}분`);
    if (poop) parts.push(`대변 ${poop}회`);
    if (pee) parts.push(`소변 ${pee}회`);
    if (med) parts.push(`투약 ${med}회`);
    return parts.length > 0 ? parts.join(', ') : '기록 없음';
  }
  // legacy dailyTracking 형식 하위호환
  const parts: string[] = [];
  if (data.sleepHours) parts.push(`수면 ${data.sleepHours}시간`);
  if (data.meals) parts.push(`식사 ${data.meals}회`);
  if (data.poopCount) parts.push(`대변 ${data.poopCount}회`);
  if (data.mood) parts.push(`기분: ${data.mood}`);
  if (data.note) parts.push(`메모: ${(data.note as string).slice(0, 50)}`);
  return parts.length > 0 ? parts.join(', ') : '기록 없음';
}

// 목업 폴백 문장에만 쓰이는 최소 매핑 — child.temperament 는 로케일과 무관하게
// 항상 한국어 고정 라벨(탐구형 등)로 들어오므로, ja/zh 문장에 그대로 섞이지 않도록 변환.
const TEMPERAMENT_LABEL: Record<'ja' | 'zh-Hant', Record<string, string>> = {
  ja: { 탐구형: '探求タイプ', 활동형: '活動タイプ', 조화형: '調和タイプ', 분석형: '分析タイプ', 감성형: '感性タイプ' },
  'zh-Hant': { 탐구형: '探索型', 활동형: '活動型', 조화형: '協調型', 분석형: '分析型', 감성형: '感性型' },
};
function localizeTemperament(temperament: string, locale?: string): string {
  if (locale === 'ja' || locale === 'zh-Hant') {
    return TEMPERAMENT_LABEL[locale][temperament] ?? temperament;
  }
  return temperament;
}

function buildMockDiary(name: string, temperamentRaw: string, sessionCount: number, locale?: string): string {
  const temperament = localizeTemperament(temperamentRaw, locale);
  if (locale === 'ja') {
    if (sessionCount === 0) {
      return `今日は${name}と静かな一日を過ごした。${temperament}らしく自分なりのやり方で世界を探索する姿が頼もしかった。明日はどんな姿を見せてくれるか楽しみだ。`;
    }
    return `今日は${name}について${sessionCount}件のことを考えた。${temperament}の子育てをしながら毎日新しいことを学んでいる。心配もあるけど、${name}が元気に育つ姿を見ると悩みが消えていく。明日も一緒に成長しよう。`;
  }
  if (locale === 'zh-Hant') {
    if (sessionCount === 0) {
      return `今天和${name}度過了安靜的一天。展現出${temperament}特有的方式探索世界，讓人感到欣慰。很期待明天又會看到什麼樣的一面。`;
    }
    return `今天為${name}想了${sessionCount}件事。養育${temperament}的孩子每天都在學習新的東西。雖然會擔心，但看到${name}健康成長，所有煩惱都消失了。明天也要一起成長。`;
  }
  if (sessionCount === 0) {
    return `오늘 ${name}이와 조용한 하루를 보냈다. ${temperament} 기질답게 자기만의 방식으로 세상을 탐색하는 모습이 대견했다. 내일은 어떤 모습을 보여줄지 기대된다.`;
  }
  return `오늘 ${name}이에 대해 ${sessionCount}가지를 고민했다. ${temperament} 기질의 아이를 키우면서 매일 새로운 것을 배운다. 걱정도 되지만, ${name}이가 건강하게 자라는 모습을 보면 모든 고민이 사라진다. 내일도 함께 성장하자.`;
}

export function registerDailyDiaryHandler(router: Router): void {
  // ─── POST /api/coaching/daily-diary ───

  router.post('/daily-diary', authMiddleware, async (req: Request, res: Response) => {
    try {
      const body = parseBody(req, res, DiaryBodySchema);
      if (!body) return;
      const { childId, locale } = body;

      const child = await buildChildContext(childId, req.userId!);
      if (!child) { error(res, '자녀 정보 없음', 404); return; }

      // 일기 대상 날짜 결정 (KST 기준).
      // 오늘 우선, 오늘 기록이 없으면 최근 2일 내 기록 있는 날로 폴백 —
      // 밤에 기록하고 자정 넘겨 일기를 만들 때 '오늘'엔 기록이 없어 '기록 없음' 뜨던 문제 보완.
      // 실제 아기시간 기록은 babyTrackerDays/{childId}_{date} 에 저장됨
      // (이전엔 미사용 컬렉션 dailyTracking 을 조회해 항상 '기록 없음' 으로 떴던 버그도 함께 수정).
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const ymd = (offsetDays: number): string => {
        const d = new Date(kstNow.getTime() + offsetDays * 24 * 60 * 60 * 1000);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      };
      const todayStr = ymd(0);

      let diaryDate = todayStr;
      let dayRecords: unknown[] = [];
      for (const off of [0, -1, -2]) {
        const ds = ymd(off);
        const doc = await collections.babyTrackerDays.doc(`${childId}_${ds}`).get();
        const recs = doc.exists ? ((doc.data()?.records as unknown[] | undefined) ?? []) : [];
        if (recs.length > 0) { diaryDate = ds; dayRecords = recs; break; }
      }
      const trackingData = dayRecords.length > 0 ? { records: dayRecords } : undefined;

      // 상담 내역 — 일기 대상 날짜가 오늘일 때만 포함 (과거 일기에 오늘 상담을 섞지 않음)
      let sessions: Record<string, unknown>[] = [];
      if (diaryDate === todayStr) {
        const today0 = new Date();
        today0.setHours(0, 0, 0, 0);
        const sessionsSnap = await collections.coachingSessions
          .where('userId', '==', req.userId)
          .where('childId', '==', childId)
          .where('createdAt', '>=', today0.toISOString())
          .orderBy('createdAt', 'asc')
          .get();
        sessions = sessionsSnap.docs
          .map((d) => d.data() as Record<string, unknown>)
          .filter((s) => s.source !== 'filter' && s.source !== 'limit');
      }

      if (sessions.length === 0 && !trackingData) {
        success(res, {
          childName: child.name,
          date: todayStr,
          diary: NO_RECORDS_MESSAGE[(locale ?? 'ko') as 'ko' | 'ja' | 'zh-Hant'] ?? NO_RECORDS_MESSAGE.ko,
        });
        return;
      }

      // 세션 요약 텍스트 — sanitize 로 prompt injection 차단 (#9 보안)
      const sessionTexts = sessions.slice(0, 8).map((s) => {
        const cat = sanitizeForPrompt(s.category).slice(0, 16);
        const q = sanitizeForPrompt(s.message).slice(0, 40);
        const a = sanitizeForPrompt(s.answer).slice(0, 60);
        return `[${cat}] Q: ${q} / A: ${a}`;
      }).join('\n');

      // 추적 데이터 요약
      const trackingSummaryText = trackingData
        ? buildTrackingText(trackingData)
        : '추적 데이터 없음';

      if (!isGeminiAvailable()) {
        success(res, {
          childName: child.name,
          date: diaryDate,
          diary: buildMockDiary(child.name, child.temperament, sessions.length, locale),
        });
        return;
      }

      try {
        const basePrompt = `너는 따뜻한 육아일기 작가야. 부모가 아이와 보낸 그날 기록을 바탕으로 짧고 따뜻한 육아일기를 한국어로 작성해.

아이: ${child.ageInfo}, ${child.gender}, ${child.temperament}
날짜: ${diaryDate}

상담 내역:
${sessionTexts || '없음'}

그날 기록:
${trackingSummaryText}

규칙:
- 길이: 3~4문장, 한 문단으로 짧게 (장황하게 늘리지 마)
- 부모 시점(1인칭)으로 작성
- 아이를 반드시 [[NAME]] 토큰으로만 지칭 (다른 이름·대괄호·"아이" 등 금지, [[NAME]] 그대로 사용)
- 사주/오행 용어 절대 금지
- 따뜻하고 일상적인 톤으로
- JSON 없이 일기 텍스트만 출력`;

        // 비한국어 로케일이면 응답 언어 힌트만 추가(추가형) — 위 한국어 프롬프트 본문은 그대로 유지
        const localeHint = locale === 'ja'
          ? '\n\n[重要] 上記の「韓国語で作成して」という指示は無視し、必ず自然な日本語で日記を書け。[[NAME]] トークンはそのまま維持しろ。'
          : locale === 'zh-Hant'
            ? '\n\n[重要] 請忽略上方「用韓文寫」的指示，務必以自然的繁體中文書寫日記。[[NAME]] 標記請維持原樣。'
            : '';
        const prompt = basePrompt + localeHint;

        const aiText = await callGeminiText(prompt, {
          temperature: 0.7,
          maxTokens: 240,
        });

        // 응답 후처리: 사주/오행 등 금지 용어 검출 시 fallback
        const raw = containsForbiddenTerms(aiText)
          ? buildMockDiary(child.name, child.temperament, sessions.length, locale)
          : aiText.trim();
        // 마스킹 복원: [[NAME]] 토큰 + 모델이 임의로 넣은 placeholder 를 실명으로 치환
        const safeText = raw
          .replace(/\[\[NAME\]\]/g, child.name)
          .replace(/\[아이\s*이름\]/g, child.name)
          .replace(/\{\{?\s*NAME\s*\}?\}/gi, child.name);

        success(res, {
          childName: child.name,
          date: diaryDate,
          diary: safeText || buildMockDiary(child.name, child.temperament, sessions.length, locale),
        });
      } catch {
        success(res, {
          childName: child.name,
          date: diaryDate,
          diary: buildMockDiary(child.name, child.temperament, sessions.length, locale),
        });
      }
    } catch (err: unknown) {
      logger.error('coaching/daily-diary', err);
      error(res, '육아일기 생성 중 오류', 500);
    }
  });
}

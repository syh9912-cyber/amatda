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
});

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

function buildMockDiary(name: string, temperament: string, sessionCount: number): string {
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
      const { childId } = body;

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
          diary: '오늘은 아직 기록이 없어요. 아이와의 하루를 기록하면 AI가 따뜻한 일기를 만들어드려요!',
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
          diary: buildMockDiary('아이', child.temperament, sessions.length),
        });
        return;
      }

      try {
        const prompt = `너는 따뜻한 육아일기 작가야. 오늘 하루 부모가 아이와 보낸 기록을 바탕으로 감성적이고 개인적인 육아일기를 한국어로 2~3문단 작성해.

아이: 아이 (${child.ageInfo}, ${child.gender}, ${child.temperament})
날짜: ${diaryDate}

상담 내역:
${sessionTexts || '없음'}

그날 기록:
${trackingSummaryText}

규칙:
- 부모 시점(1인칭)으로 작성
- 사주/오행 용어 절대 금지
- 따뜻하고 일상적인 톤으로
- 아이 이름을 자연스럽게 포함
- JSON 없이 일기 텍스트만 출력`;

        const aiText = await callGeminiText(prompt, {
          temperature: 0.7,
          maxTokens: 500,
        });

        // 응답 후처리: 사주/오행 등 금지 용어 검출 시 fallback
        const safeText = containsForbiddenTerms(aiText)
          ? buildMockDiary('아이', child.temperament, sessions.length)
          : aiText.trim();

        success(res, {
          childName: child.name,
          date: diaryDate,
          diary: safeText || buildMockDiary('아이', child.temperament, sessions.length),
        });
      } catch {
        success(res, {
          childName: child.name,
          date: diaryDate,
          diary: buildMockDiary('아이', child.temperament, sessions.length),
        });
      }
    } catch (err: unknown) {
      logger.error('coaching/daily-diary', err);
      error(res, '육아일기 생성 중 오류', 500);
    }
  });
}

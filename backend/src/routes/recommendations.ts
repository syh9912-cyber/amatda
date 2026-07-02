import { Router, Request, Response } from 'express';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { authMiddleware } from '../middleware/auth';
import { RECOMMENDATION_SEEDS, RecommendationSeedTemplate } from '../data/recommendation-seeds';

const router = Router();

/* ------------------------------------------------------------------ */
/*  Firestore document structure for recommendationCache               */
/* ------------------------------------------------------------------ */
/*
  {
    category: string,
    title: string,
    ageGroup: string,
    temperament: string,
    answer: string,
    reasons: string[],
    actions: string[],
    personalNote: string,
    source: 'seed' | 'ai',
    createdAt: string,
  }
*/

/* ------------------------------------------------------------------ */
/*  GET /api/recommendations                                           */
/*  DB 우선 검색 → 없으면 AI 호출 → 결과 DB 저장                      */
/* ------------------------------------------------------------------ */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, ageGroup, temperament, childId, locale } = req.query as Record<string, string>;
    // 비한국어 로케일은 캐시 조회/저장 시 locale 필드로 구분(추가형) — 기존 한국어(locale 미지정) 캐시와 절대 섞이지 않음
    const isNonKo = locale === 'ja' || locale === 'zh-Hant';

    if (!title || !ageGroup || !temperament) {
      error(res, 'title, ageGroup, temperament 파라미터가 필요합니다');
      return;
    }

    // 1. DB에서 검색 (정확 매칭)
    let cacheQuery = collections.recommendationCache
      .where('title', '==', title)
      .where('ageGroup', '==', ageGroup)
      .where('temperament', '==', temperament);
    if (isNonKo) cacheQuery = cacheQuery.where('locale', '==', locale);
    const snap = await cacheQuery.limit(1).get();

    if (!snap.empty) {
      const cached = snap.docs[0].data();
      success(res, {
        answer: cached.answer,
        reasons: cached.reasons ?? [],
        actions: cached.actions ?? [],
        personalNote: cached.personalNote ?? '',
        source: 'cache',
      });
      return;
    }

    // 2. DB에 없으면 — 같은 ageGroup의 다른 temperament라도 있는지 확인
    //    (base 내용이라도 활용, 단 같은 locale 내에서만)
    let fallbackQuery = collections.recommendationCache
      .where('title', '==', title)
      .where('ageGroup', '==', ageGroup);
    if (isNonKo) fallbackQuery = fallbackQuery.where('locale', '==', locale);
    const fallbackSnap = await fallbackQuery.limit(1).get();

    // 3. AI 호출 (coaching API 내부 사용)
    if (childId) {
      try {
        const { callGeminiText } = await import('../services/coaching/gemini.client');

        const prompt = buildRecommendationPrompt(title, ageGroup, temperament,
          fallbackSnap.empty ? null : fallbackSnap.docs[0].data() as Record<string, unknown>, locale);

        const aiResult = await callGeminiText(prompt, { maxTokens: 800, temperature: 0.5 });
        const parsed = parseAIResponse(aiResult);

        // 4. AI 응답을 DB에 저장 (다음에 같은 조합이면 바로 사용)
        const docId = genId();
        await collections.recommendationCache.doc(docId).set({
          category: req.query.category ?? '',
          title,
          ageGroup,
          temperament,
          answer: parsed.answer,
          reasons: parsed.reasons,
          actions: parsed.actions,
          personalNote: parsed.personalNote,
          source: 'ai',
          createdAt: new Date().toISOString(),
          ...(isNonKo ? { locale } : {}),
        });

        success(res, { ...parsed, source: 'ai_generated' });
        return;
      } catch (aiErr) {
        // AI 실패 시 fallback 데이터라도 반환
        if (!fallbackSnap.empty) {
          const fb = fallbackSnap.docs[0].data();
          success(res, {
            answer: fb.answer,
            reasons: fb.reasons ?? [],
            actions: fb.actions ?? [],
            personalNote: fb.personalNote ?? '',
            source: 'fallback',
          });
          return;
        }
        const msg = aiErr instanceof Error ? aiErr.message : 'AI 호출 실패';
        error(res, msg, 500);
        return;
      }
    }

    // childId 없고 DB에도 없으면 빈 응답
    error(res, '해당 주제의 추천 정보가 아직 준비되지 않았습니다', 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '추천 조회 중 오류';
    error(res, msg, 500);
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/recommendations/list — 카테고리별 항목 목록 반환           */
/* ------------------------------------------------------------------ */
router.get('/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { category, ageGroup, temperament, locale } = req.query as Record<string, string>;
    const isNonKo = locale === 'ja' || locale === 'zh-Hant';

    if (!category || !ageGroup) {
      error(res, 'category, ageGroup 파라미터가 필요합니다');
      return;
    }

    // 1. DB(캐시)에서 해당 카테고리 항목 검색 (비한국어는 locale 필드로 캐시 분리)
    let query = collections.recommendationCache
      .where('category', '==', category)
      .where('ageGroup', '==', ageGroup);

    if (temperament) {
      query = query.where('temperament', '==', temperament);
    }
    if (isNonKo) {
      query = query.where('locale', '==', locale);
    }

    const snap = await query.get();

    if (!snap.empty) {
      const items = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          title: d.title as string,
          answer: d.answer as string,
          reasons: (d.reasons ?? []) as string[],
          actions: (d.actions ?? []) as string[],
          personalNote: (d.personalNote ?? '') as string,
        };
      });

      // 제목 기준 중복 제거
      const uniqueMap = new Map<string, typeof items[0]>();
      for (const item of items) {
        if (!uniqueMap.has(item.title)) uniqueMap.set(item.title, item);
      }

      success(res, { items: Array.from(uniqueMap.values()), source: 'cache' });
      return;
    }

    // 2. DB에 없으면 시드 데이터에서 직접 검색
    //    시드 데이터는 아직 한국어만 있음 — 비한국어는 원문 노출 대신 빈 목록 반환(추후 AI 캐시로 채워짐)
    if (isNonKo) {
      success(res, { items: [], source: 'empty' });
      return;
    }

    const seedItems = RECOMMENDATION_SEEDS
      .filter((s) => s.category === category && s.ageGroup === ageGroup)
      .map((s) => ({
        title: s.title,
        answer: s.answer,
        reasons: s.reasons,
        actions: s.actions,
        personalNote: temperament ? (s.temperamentNotes[temperament] ?? '') : '',
      }));

    if (seedItems.length > 0) {
      success(res, { items: seedItems, source: 'seed' });
      return;
    }

    success(res, { items: [], source: 'empty' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '목록 조회 중 오류';
    error(res, msg, 500);
  }
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildRecommendationPrompt(
  title: string,
  ageGroup: string,
  temperament: string,
  fallbackData: Record<string, unknown> | null,
  locale?: string,
): string {
  const AGE_LABELS: Record<string, string> = {
    infant: '영아(0~3세)',
    toddler: '유아(3~6세, 미취학)',
    elementary_low: '초등 저학년(7~9세)',
    elementary_high: '초등 고학년(10~12세)',
  };
  const ageLabel = AGE_LABELS[ageGroup] ?? '영유아(0~6세)';

  let reference = '';
  if (fallbackData) {
    reference = `\n\n참고 (다른 성향 아이 기준 내용):\n${fallbackData.answer as string}\n`;
  }

  const basePrompt = `당신은 한국의 전문 육아 상담사입니다.
아래 주제에 대해 ${ageLabel}, ${temperament} 기질 아이에게 맞는 맞춤 육아 조언을 작성해 주세요.
${reference}
주제: ${title}
연령대: ${ageLabel}
아이 기질: ${temperament}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "answer": "메인 답변 (3~5문장, 따뜻하고 실용적인 톤)",
  "reasons": ["이유1", "이유2", "이유3"],
  "actions": ["실천방법1", "실천방법2", "실천방법3", "실천방법4"],
  "personalNote": "${temperament} 기질 아이에게 맞는 맞춤 조언 (1~2문장)"
}`;

  const localeHint = locale === 'ja'
    ? '\n\n[重要] 「韓国の」という前提は無視し、一般的な育児相談専門家として答えろ。JSON の全ての値(answer, reasons[], actions[], personalNote)は自然な日本語で作成しろ。JSON のキー名は英語のまま維持しろ。'
    : locale === 'zh-Hant'
      ? '\n\n[重要] 請忽略「韓國的」這個設定，以一般育兒諮詢專家的身份回答。JSON 中所有的值(answer, reasons[], actions[], personalNote)請以自然的繁體中文書寫。JSON 的鍵名請保持英文原樣。'
      : undefined;

  return localeHint ? basePrompt + localeHint : basePrompt;
}

function parseAIResponse(raw: string): {
  answer: string;
  reasons: string[];
  actions: string[];
  personalNote: string;
} {
  try {
    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        answer: String(parsed.answer ?? ''),
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions.map(String) : [],
        personalNote: String(parsed.personalNote ?? ''),
      };
    }
  } catch {
    // JSON parse failed
  }

  // Fallback: use raw text as answer
  return {
    answer: raw.slice(0, 500),
    reasons: [],
    actions: [],
    personalNote: '',
  };
}

export default router;

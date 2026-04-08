import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections } from '../../services/firestore';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiJSON } from '../../services/coaching/gemini.client';

interface StressSignals {
  level: 'low' | 'medium' | 'high';
  lateNightCount: number;
  negativeWords: number;
  repeatedCategory: string | null;
}

function analyzeStressPatterns(sessions: Array<Record<string, unknown>>): StressSignals {
  let lateNightCount = 0;
  let negativeWords = 0;
  const negativeKeywords = ['힘들', '지치', '못', '안', '울', '짜증', '화', '포기', '한계', '미치', '죽겠'];
  const categoryCounts: Record<string, number> = {};

  for (const s of sessions) {
    // 야간 사용 체크
    const createdAt = s.createdAt as string | undefined;
    if (createdAt) {
      const hour = parseInt(createdAt.slice(11, 13), 10);
      if (hour >= 22 || hour < 6) lateNightCount++;
    }

    // 부정 키워드
    const msg = (s.message as string) || '';
    for (const kw of negativeKeywords) {
      if (msg.includes(kw)) negativeWords++;
    }

    // 카테고리 반복
    const cat = s.category as string;
    if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const repeatedEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const repeatedCategory = repeatedEntry && repeatedEntry[1] >= 3 ? repeatedEntry[0] : null;

  let level: 'low' | 'medium' | 'high' = 'low';
  const score = lateNightCount * 2 + negativeWords + (repeatedCategory ? 3 : 0);
  if (score >= 8) level = 'high';
  else if (score >= 4) level = 'medium';

  return { level, lateNightCount, negativeWords, repeatedCategory };
}

function buildMockMentalResult(
  childName: string, temperament: string, signals: StressSignals
): { stressLevel: string; message: string; encouragement: string; analysisData: Record<string, unknown> } {
  const messages: Record<string, string> = {
    low: `${childName}이 육아를 잘 해내고 계시네요! 상담 패턴이 안정적이에요.`,
    medium: `${childName}이 때문에 고민이 좀 있으셨군요. ${temperament} 기질의 아이를 키우다 보면 당연한 거예요.`,
    high: `최근 많이 힘드셨을 것 같아요. ${childName}이를 위해 이렇게 노력하는 모습 자체가 훌륭한 부모의 증거에요.`,
  };
  const encouragements: Record<string, string> = {
    low: '이 페이스 그대로 유지하시면 돼요. 부모님도 충분히 쉬어가세요!',
    medium: '잠깐 쉬어가도 괜찮아요. 완벽한 부모보다 행복한 부모가 아이에게 더 좋답니다.',
    high: '오늘 하루, 딱 한 가지만 잘하면 돼요. 그리고 그건 이미 하고 계세요 - 아이를 사랑하는 것.',
  };

  return {
    stressLevel: signals.level,
    message: messages[signals.level],
    encouragement: encouragements[signals.level],
    analysisData: {
      totalSessions: 0,
      lateNightCount: signals.lateNightCount,
      negativeWords: signals.negativeWords,
    },
  };
}

export function registerParentMentalHandler(router: Router): void {
  // ─── POST /api/coaching/parent-mental ───

  router.post('/parent-mental', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { childId } = req.body as { childId: string };
      if (!childId) { error(res, 'childId 필수'); return; }

      const child = await buildChildContext(childId, req.userId!);
      if (!child) { error(res, '자녀 정보 없음', 404); return; }

      // 최근 7일 상담 내역
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const sessionsSnap = await collections.coachingSessions
        .where('userId', '==', req.userId)
        .where('childId', '==', childId)
        .where('createdAt', '>=', weekAgo.toISOString())
        .orderBy('createdAt', 'desc')
        .get();

      const sessions = sessionsSnap.docs
        .map((d) => d.data() as Record<string, unknown>)
        .filter((s) => s.source !== 'filter' && s.source !== 'limit');

      // 스트레스 패턴 분석
      const stressSignals = analyzeStressPatterns(sessions);

      if (!isGeminiAvailable()) {
        success(res, buildMockMentalResult(child.name, child.temperament, stressSignals));
        return;
      }

      try {
        const sessionTexts = sessions.slice(0, 10).map((s) =>
          `[${s.category}] ${(s.message as string)?.slice(0, 50)} (${(s.createdAt as string)?.slice(11, 16)})`
        ).join('\n');

        const prompt = `너는 부모 멘탈 케어 전문가야. 최근 7일 상담 내역을 분석해서 부모의 스트레스 수준을 판단하고 응원 메시지를 작성해.

부모 상담 패턴:
- 총 상담 횟수: ${sessions.length}건
- 야간 상담(22시~6시): ${stressSignals.lateNightCount}건
- 부정 키워드 감지: ${stressSignals.negativeWords}개
- 같은 카테고리 반복: ${stressSignals.repeatedCategory || '없음'}

상담 내역:
${sessionTexts || '없음'}

아이: ${child.name} (${child.ageInfo}, ${child.temperament})

반드시 아래 JSON만 출력해:
{
  "stressLevel": "low" 또는 "medium" 또는 "high",
  "message": "현재 부모 상태에 대한 공감 + 분석 2~3문장",
  "encouragement": "진심 어린 응원 메시지 1~2문장"
}`;

        const parsed = await callGeminiJSON<Record<string, string>>(prompt, {
          temperature: 0.5,
          maxTokens: 400,
        });

        success(res, {
          stressLevel: parsed.stressLevel || stressSignals.level,
          message: parsed.message || '',
          encouragement: parsed.encouragement || '',
          analysisData: {
            totalSessions: sessions.length,
            lateNightCount: stressSignals.lateNightCount,
            negativeWords: stressSignals.negativeWords,
          },
        });
      } catch {
        success(res, buildMockMentalResult(child.name, child.temperament, stressSignals));
      }
    } catch {
      error(res, '부모 멘탈 분석 중 오류', 500);
    }
  });
}

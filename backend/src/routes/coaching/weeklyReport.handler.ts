import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections } from '../../services/firestore';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiJSON } from '../../services/coaching/gemini.client';
import { logger } from '../../utils/logger';

function getMostFrequent(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const item of arr) counts[item] = (counts[item] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function registerWeeklyReportHandler(router: Router): void {
  // ─── POST /api/coaching/weekly-report ───

  router.post('/weekly-report', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { childId } = req.body as { childId: string };
      if (!childId) { error(res, 'childId 필수'); return; }

      const child = await buildChildContext(childId, req.userId!);
      if (!child) { error(res, '자녀 정보 없음', 404); return; }

      // 이번 주 상담 내역 조회
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const sessionsSnap = await collections.coachingSessions
        .where('userId', '==', req.userId)
        .where('childId', '==', childId)
        .where('createdAt', '>=', weekAgo.toISOString())
        .orderBy('createdAt', 'desc')
        .get();

      const sessions = sessionsSnap.docs.map((d) => d.data() as Record<string, unknown>);
      const totalCount = sessions.filter((s) => s.source !== 'filter' && s.source !== 'limit').length;
      const categories = sessions.map((s) => s.category as string).filter(Boolean);
      const topCategory = getMostFrequent(categories) || '없음';

      // 요약 텍스트
      const sessionSummary = sessions
        .filter((s) => s.source !== 'filter')
        .slice(0, 5)
        .map((s) => `- ${s.category}: ${(s.message as string)?.slice(0, 30)}`)
        .join('\n') || '이번 주 상담 내역이 없습니다.';

      if (!isGeminiAvailable() || totalCount === 0) {
        success(res, {
          childName: child.name,
          ageInfo: child.ageInfo,
          period: `${weekAgo.toISOString().slice(0, 10)} ~ ${new Date().toISOString().slice(0, 10)}`,
          totalSessions: totalCount,
          topCategory,
          report: totalCount === 0
            ? `이번 주에는 ${child.name}이에 대한 상담이 없었어요. 궁금한 점이 있으면 언제든 물어봐주세요!`
            : `이번 주 ${child.name}이에 대해 ${totalCount}건의 상담을 하셨어요. 주로 ${topCategory} 관련 고민이 많으셨네요. 꾸준히 아이를 관찰하고 계신 모습이 훌륭합니다!`,
          tip: `${child.temperament} 기질의 ${child.ageInfo} 아이에게는 일관된 루틴과 따뜻한 반응이 가장 중요해요.`,
        });
        return;
      }

      // AI 주간 리포트
      try {
        const prompt = `아래 육아 상담 내역을 보고 부모님께 주간 리포트를 작성해줘.

아이: ${child.name} (${child.ageInfo}, ${child.gender}, ${child.temperament})
이번 주 상담 ${totalCount}건, 주요 카테고리: ${topCategory}

상담 내역:
${sessionSummary}

JSON만 출력해:
{
  "report": "이번 주 상담을 종합한 2~3문장 요약",
  "improvement": "좋아진 점이나 칭찬할 점 1문장",
  "nextWeekTip": "다음 주에 시도해볼 한 가지 1문장"
}`;

        const report = await callGeminiJSON<Record<string, string>>(prompt, {
          temperature: 0.4,
          maxTokens: 300,
        });

        success(res, {
          childName: child.name,
          ageInfo: child.ageInfo,
          period: `${weekAgo.toISOString().slice(0, 10)} ~ ${new Date().toISOString().slice(0, 10)}`,
          totalSessions: totalCount,
          topCategory,
          report: report?.report ?? `이번 주 ${totalCount}건 상담하셨어요.`,
          improvement: report?.improvement ?? '',
          nextWeekTip: report?.nextWeekTip ?? '',
        });
      } catch {
        success(res, {
          childName: child.name,
          period: `${weekAgo.toISOString().slice(0, 10)} ~ ${new Date().toISOString().slice(0, 10)}`,
          totalSessions: totalCount,
          topCategory,
          report: `이번 주 ${child.name}이에 대해 ${totalCount}건 상담하셨어요.`,
        });
      }
    } catch (err) {
      logger.error('coaching/weekly-report', err);
      error(res, '주간 리포트 생성 중 오류', 500);
    }
  });
}

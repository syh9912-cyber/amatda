import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { buildChildContext } from '../../services/coaching/context.builder';
import { generateDailyInsights } from '../../services/coaching/proactive.insight';
import { checkDailyLimit, incrementDailyUsage } from '../../utils/rateLimit';
import { logger } from '../../utils/logger';

const INSIGHT_FREE_DAILY_LIMIT = 3;

export function registerDailyInsightHandler(router: Router): void {
  router.get('/daily-insight', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
      const childId = req.query.childId as string;
      if (!childId) {
        error(res, 'childId가 필요합니다', 400);
        return;
      }

      const userId = req.userId!;
      const limit = await checkDailyLimit(userId, 'daily_insight', INSIGHT_FREE_DAILY_LIMIT);
      if (!limit.allowed) {
        success(res, {
          insights: [],
          limitReached: true,
          message: `무료 플랜은 하루 ${limit.limit}회까지 육아 패턴 분석을 제공해요. 프리미엄에서 무제한 이용 가능합니다.`,
        });
        return;
      }

      const child = await buildChildContext(childId, userId);
      if (!child) {
        error(res, '자녀 정보를 찾을 수 없습니다', 404);
        return;
      }

      const insights = await generateDailyInsights(childId, {
        id: childId,
        name: child.name,
        ageMonths: child.ageMonths,
        temperament: child.temperament,
        temperamentDetail: child.temperamentDetail,
        gender: child.gender,
        isPregnant: child.isPregnant,
        pregnancyWeeks: child.pregnancyWeeks,
      });

      await incrementDailyUsage(userId, 'daily_insight');
      success(res, { insights });
    } catch (err) {
      logger.error('coaching/daily-insight', err);
      error(res, '인사이트 생성에 실패했습니다', 500);
    }
  });
}

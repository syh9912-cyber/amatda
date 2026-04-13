import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { buildChildContext } from '../../services/coaching/context.builder';
import { generateDailyInsights } from '../../services/coaching/proactive.insight';

export function registerDailyInsightHandler(router: Router): void {
  router.get('/daily-insight', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
      const childId = req.query.childId as string;
      if (!childId) {
        error(res, 'childId가 필요합니다', 400);
        return;
      }

      const child = await buildChildContext(childId, req.userId!);
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

      success(res, { insights });
    } catch (err) {
      console.error('Daily insight error:', err);
      error(res, '인사이트 생성에 실패했습니다', 500);
    }
  });
}

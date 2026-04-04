import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ageMonths = parseInt(req.query.ageMonths as string, 10);
    const type = req.query.type as string | undefined;
    if (isNaN(ageMonths)) { error(res, 'ageMonths 파라미터가 필요합니다'); return; }

    const snap = await collections.foodGuides
      .where('targetAgeMin', '<=', ageMonths).get();

    const filtered = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((g: Record<string, unknown>) =>
        (g.targetAgeMax as number) >= ageMonths &&
        (!type || g.suitableType === type)
      )
      .map((g: Record<string, unknown>) => ({
        id: g.id, targetAgeMin: g.targetAgeMin, targetAgeMax: g.targetAgeMax,
        suitableType: g.suitableType,
        foods: typeof g.foods === 'string' ? JSON.parse(g.foods as string) : g.foods,
      }));

    success(res, filtered);
  } catch { error(res, '영양 가이드 조회 중 오류가 발생했습니다', 500); }
});

export default router;

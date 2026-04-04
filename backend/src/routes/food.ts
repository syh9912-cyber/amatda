import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

// GET /api/food-guide?ageMonths=X&type=Y
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ageMonths = parseInt(req.query.ageMonths as string, 10);
    const type = req.query.type as string | undefined;

    if (isNaN(ageMonths)) {
      error(res, 'ageMonths 파라미터가 필요합니다');
      return;
    }

    const where: Record<string, unknown> = {
      targetAgeMin: { lte: ageMonths },
      targetAgeMax: { gte: ageMonths },
    };
    if (type) {
      where.suitableType = type;
    }

    const guides = await prisma.foodGuideDict.findMany({ where });
    const formatted = guides.map((g) => ({
      id: g.id,
      targetAgeMin: g.targetAgeMin,
      targetAgeMax: g.targetAgeMax,
      suitableType: g.suitableType,
      foods: JSON.parse(g.foods),
    }));

    success(res, formatted);
  } catch (e) {
    error(res, '영양 가이드 조회 중 오류가 발생했습니다', 500);
  }
});

export default router;

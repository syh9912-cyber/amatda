import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { getTraitWeather } from '../services/trait.weather';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

// GET /api/weather/:childId
router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const child = await prisma.child.findFirst({
      where: { id: req.params.childId as string, userId: req.userId },
    });
    if (!child) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    const innate = JSON.parse(child.innateData);
    const weather = getTraitWeather(innate.dominantType);

    success(res, {
      childName: child.name,
      dominantType: innate.dominantType,
      ...weather,
    });
  } catch (e) {
    error(res, '기질 날씨 조회 중 오류가 발생했습니다', 500);
  }
});

export default router;

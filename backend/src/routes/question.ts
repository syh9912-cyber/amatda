import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

// GET /api/questions?ageMonths=X&type=Y
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
      where.sajuType = type;
    }

    const questions = await prisma.questionBank.findMany({ where });
    const formatted = questions.map((q) => ({
      id: q.id,
      targetAgeMin: q.targetAgeMin,
      targetAgeMax: q.targetAgeMax,
      sajuType: q.sajuType,
      questionText: q.questionText,
      options: JSON.parse(q.options),
    }));

    success(res, formatted);
  } catch (e) {
    error(res, '질문 조회 중 오류가 발생했습니다', 500);
  }
});

export default router;

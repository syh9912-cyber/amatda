import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { analyzeAllSiblings } from '../services/sibling.compatibility';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

// GET /api/siblings/compatibility
router.get('/compatibility', authMiddleware, async (req: Request, res: Response) => {
  try {
    const children = await prisma.child.findMany({
      where: { userId: req.userId },
    });

    if (children.length < 2) {
      success(res, { message: '다자녀 궁합 분석은 2명 이상 등록 시 가능합니다', results: [] });
      return;
    }

    const traits = children.map((c) => {
      const innate = JSON.parse(c.innateData);
      return {
        name: c.name,
        dominantType: innate.dominantType,
        fiveElements: innate.fiveElements,
      };
    });

    const results = analyzeAllSiblings(traits);
    success(res, { results });
  } catch (e) {
    error(res, '궁합 분석 중 오류가 발생했습니다', 500);
  }
});

export default router;

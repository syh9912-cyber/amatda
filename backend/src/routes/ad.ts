import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

// GET /api/ads?type=academy&ageMonths=100&trait=조화형
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 5;

    const where: Record<string, unknown> = { isActive: true };
    if (type) where.type = type;

    const ads = await prisma.ad.findMany({
      where,
      orderBy: { priority: 'desc' },
      take: limit,
    });

    // 조회수 증가
    for (const ad of ads) {
      await prisma.ad.update({
        where: { id: ad.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    success(res, ads.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      imageUrl: a.imageUrl,
      linkUrl: a.linkUrl,
      sponsor: a.sponsor,
      isAd: true,
    })));
  } catch (e) {
    error(res, '광고 조회 중 오류가 발생했습니다', 500);
  }
});

// POST /api/ads/:id/click
router.post('/:id/click', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.ad.update({
      where: { id: req.params.id as string },
      data: { clickCount: { increment: 1 } },
    });
    success(res, { clicked: true });
  } catch (e) {
    error(res, '클릭 기록 중 오류가 발생했습니다', 500);
  }
});

export default router;

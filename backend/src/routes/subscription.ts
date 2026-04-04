import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

// GET /api/subscriptions/:childId
router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const subs = await prisma.subscription.findMany({
      where: { childId: req.params.childId as string, userId: req.userId! },
    });
    success(res, subs.map((s) => ({
      id: s.id,
      kitType: s.kitType,
      status: s.status,
      nextDeliveryDate: s.nextDeliveryDate.toISOString().split('T')[0],
    })));
  } catch (e) {
    error(res, '구독 조회 중 오류가 발생했습니다', 500);
  }
});

// POST /api/subscriptions
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, kitType } = req.body;
    if (!childId || !kitType) {
      error(res, 'childId와 kitType을 입력해주세요');
      return;
    }

    const child = await prisma.child.findFirst({
      where: { id: childId, userId: req.userId },
    });
    if (!child) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    // 다음 배송일: 다음 달 1일
    const now = new Date();
    const nextDelivery = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const sub = await prisma.subscription.create({
      data: {
        userId: req.userId!,
        childId,
        kitType,
        nextDeliveryDate: nextDelivery,
      },
    });

    success(res, {
      id: sub.id,
      kitType: sub.kitType,
      status: sub.status,
      nextDeliveryDate: sub.nextDeliveryDate.toISOString().split('T')[0],
    }, 201);
  } catch (e) {
    error(res, '구독 등록 중 오류가 발생했습니다', 500);
  }
});

// PUT /api/subscriptions/:id/cancel
router.put('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id as string },
    });
    if (!sub || sub.userId !== req.userId) {
      error(res, '구독을 찾을 수 없습니다', 404);
      return;
    }
    if (sub.status === 'CANCELLED') {
      error(res, '이미 해지된 구독입니다');
      return;
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED' },
    });

    success(res, {
      id: updated.id,
      kitType: updated.kitType,
      status: updated.status,
      nextDeliveryDate: updated.nextDeliveryDate.toISOString().split('T')[0],
    });
  } catch (e) {
    error(res, '구독 해지 중 오류가 발생했습니다', 500);
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';

const router = Router();

router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const snap = await collections.subscriptions
      .where('childId', '==', req.params.childId)
      .where('userId', '==', req.userId!).get();
    success(res, snap.docs.map((d) => {
      const s = d.data();
      return { id: d.id, kitType: s.kitType, status: s.status, nextDeliveryDate: s.nextDeliveryDate };
    }));
  } catch { error(res, '구독 조회 중 오류가 발생했습니다', 500); }
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, kitType } = req.body;
    if (!childId || !kitType) { error(res, 'childId와 kitType을 입력해주세요'); return; }
    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }

    const now = new Date();
    const nextDelivery = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
    const id = genId();
    await collections.subscriptions.doc(id).set({ userId: req.userId!, childId, kitType, status: 'ACTIVE', nextDeliveryDate: nextDelivery });
    success(res, { id, kitType, status: 'ACTIVE', nextDeliveryDate: nextDelivery }, 201);
  } catch { error(res, '구독 등록 중 오류가 발생했습니다', 500); }
});

router.put('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.subscriptions.doc(req.params.id as string).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) { error(res, '구독을 찾을 수 없습니다', 404); return; }
    if (doc.data()!.status === 'CANCELLED') { error(res, '이미 해지된 구독입니다'); return; }
    await collections.subscriptions.doc(req.params.id as string).update({ status: 'CANCELLED' });
    success(res, { id: doc.id, status: 'CANCELLED' });
  } catch { error(res, '구독 해지 중 오류가 발생했습니다', 500); }
});

export default router;

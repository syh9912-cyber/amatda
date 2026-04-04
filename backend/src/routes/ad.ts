import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 5;

    let snap;
    if (type) {
      snap = await collections.ads.where('type', '==', type).where('isActive', '==', true).orderBy('priority', 'desc').limit(limit).get();
    } else {
      snap = await collections.ads.where('isActive', '==', true).orderBy('priority', 'desc').limit(limit).get();
    }

    success(res, snap.docs.map((d) => {
      const a = d.data();
      return { id: d.id, type: a.type, title: a.title, description: a.description, imageUrl: a.imageUrl, linkUrl: a.linkUrl, sponsor: a.sponsor, isAd: true };
    }));
  } catch { error(res, '광고 조회 중 오류가 발생했습니다', 500); }
});

router.post('/:id/click', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.ads.doc(req.params.id as string).get();
    if (doc.exists) {
      const current = doc.data()!.clickCount ?? 0;
      await collections.ads.doc(req.params.id as string).update({ clickCount: current + 1 });
    }
    success(res, { clicked: true });
  } catch { error(res, '클릭 기록 중 오류가 발생했습니다', 500); }
});

export default router;

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getTraitWeather } from '../services/trait.weather';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';

const router = Router();

router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.children.doc(req.params.childId as string).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }
    const innate = typeof doc.data()!.innateData === 'string' ? JSON.parse(doc.data()!.innateData as string) : doc.data()!.innateData;
    const weather = getTraitWeather(innate.dominantType);
    success(res, { childName: doc.data()!.name, dominantType: innate.dominantType, ...weather });
  } catch { error(res, '기질 날씨 조회 중 오류가 발생했습니다', 500); }
});

export default router;

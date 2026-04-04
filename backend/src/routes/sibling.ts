import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { analyzeAllSiblings } from '../services/sibling.compatibility';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';

const router = Router();

router.get('/compatibility', authMiddleware, async (req: Request, res: Response) => {
  try {
    const snap = await collections.children.where('userId', '==', req.userId).get();
    if (snap.docs.length < 2) { success(res, { message: '다자녀 궁합 분석은 2명 이상 등록 시 가능합니다', results: [] }); return; }

    const traits = snap.docs.map((d) => {
      const data = d.data();
      const innate = typeof data.innateData === 'string' ? JSON.parse(data.innateData) : data.innateData;
      return { name: data.name as string, dominantType: innate.dominantType, fiveElements: innate.fiveElements };
    });
    success(res, { results: analyzeAllSiblings(traits) });
  } catch { error(res, '궁합 분석 중 오류가 발생했습니다', 500); }
});

export default router;

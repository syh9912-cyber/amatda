import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ageMonths = parseInt(req.query.ageMonths as string, 10);
    const type = req.query.type as string | undefined;
    if (isNaN(ageMonths)) { error(res, 'ageMonths 파라미터가 필요합니다'); return; }

    let query = collections.questions
      .where('targetAgeMin', '<=', ageMonths);

    const snap = await query.get();
    const filtered = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((q: Record<string, unknown>) =>
        (q.targetAgeMax as number) >= ageMonths &&
        (!type || q.sajuType === type)
      )
      .map((q: Record<string, unknown>) => ({
        id: q.id, targetAgeMin: q.targetAgeMin, targetAgeMax: q.targetAgeMax,
        sajuType: q.sajuType, questionText: q.questionText,
        options: typeof q.options === 'string' ? JSON.parse(q.options as string) : q.options,
      }));

    success(res, filtered);
  } catch { error(res, '질문 조회 중 오류가 발생했습니다', 500); }
});

export default router;

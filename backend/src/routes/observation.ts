import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { generateCrossReport } from '../services/ai.service';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { parseInnateDataFull } from '../utils/parse';
import { getChildIfAccessible } from '../utils/childAccess';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, content, type } = req.body;
    if (!childId || !content) { error(res, '자녀 ID와 내용을 입력해주세요'); return; }

    const access = await getChildIfAccessible(childId, req.userId, 'editRecords', res);
    if (!access) return;

    const id = genId();
    const now = new Date().toISOString();
    await collections.observations.doc(id).set({
      childId, type: type || 'TEXT', rawContent: content, createdAt: now,
    });

    success(res, { observation: { id, type: type || 'TEXT', rawContent: content, createdAt: now } }, 201);
  } catch { error(res, '관찰 일기 저장 중 오류가 발생했습니다', 500); }
});

router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const access = await getChildIfAccessible(req.params.childId as string, req.userId, 'viewRecords', res);
    if (!access) return;

    const snap = await collections.observations
      .where('childId', '==', req.params.childId)
      .orderBy('createdAt', 'desc').limit(20).get();

    success(res, snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id, type: data.type, rawContent: data.rawContent,
        createdAt: data.createdAt,
      };
    }));
  } catch { error(res, '관찰 일기 조회 중 오류가 발생했습니다', 500); }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.observations.doc(req.params.id as string).get();
    if (!doc.exists) { error(res, '관찰 일기를 찾을 수 없습니다', 404); return; }
    const access = await getChildIfAccessible(doc.data()!.childId, req.userId, 'editRecords', res);
    if (!access) return;

    await collections.observations.doc(req.params.id as string).delete();
    success(res, { id: req.params.id, message: '삭제되었습니다' });
  } catch { error(res, '관찰 일기 삭제 중 오류가 발생했습니다', 500); }
});

router.get('/report/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const access = await getChildIfAccessible(req.params.childId as string, req.userId, 'viewRecords', res);
    if (!access) return;

    const data = access.data;
    const innate = parseInnateDataFull(data.innateData) as { dominantType: string; fiveElements: Record<string, number> };

    const snap = await collections.observations
      .where('childId', '==', req.params.childId)
      .orderBy('createdAt', 'desc').limit(10).get();
    const recentTexts = snap.docs.map((d) => d.data().rawContent as string).filter(Boolean);

    const report = generateCrossReport(innate, recentTexts);
    const observedSummary = recentTexts.length
      ? `최근 ${recentTexts.length}개 관찰 일기 기반`
      : '관찰 데이터 없음';
    success(res, { childName: data.name, innateType: innate.dominantType, fiveElements: innate.fiveElements, observedSummary, ...report });
  } catch { error(res, '리포트 생성 중 오류가 발생했습니다', 500); }
});

export default router;

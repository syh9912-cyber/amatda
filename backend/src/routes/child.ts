import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { calculateSaju } from '../services/saju.calculator';
import { calculateAge } from '../services/age.calculator';
import { generateChildReport } from '../services/child.report';
import { success, error } from '../utils/response';
import { collections, genId, toISO } from '../services/firestore';

const router = Router();

function formatChild(id: string, data: Record<string, unknown>) {
  const innate = typeof data.innateData === 'string' ? JSON.parse(data.innateData as string) : data.innateData;
  const { pillars, ...publicInnate } = innate;
  const bd = data.birthDate instanceof Date ? data.birthDate : new Date(data.birthDate as string);
  return {
    id, name: data.name, gender: data.gender,
    birthDate: bd.toISOString().split('T')[0],
    birthTime: data.birthTime,
    innateData: publicInnate,
    baseline: data.baseline ? (typeof data.baseline === 'string' ? JSON.parse(data.baseline as string) : data.baseline) : null,
    observedTraits: data.observedTraits ? (typeof data.observedTraits === 'string' ? JSON.parse(data.observedTraits as string) : data.observedTraits) : null,
    analysisReport: data.analysisReport ? (typeof data.analysisReport === 'string' ? JSON.parse(data.analysisReport as string) : data.analysisReport) : null,
    ageInfo: calculateAge(bd),
  };
}

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const snap = await collections.children.where('userId', '==', req.userId).get();
    success(res, snap.docs.map((d) => formatChild(d.id, d.data())));
  } catch { error(res, '자녀 목록 조회 중 오류가 발생했습니다', 500); }
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, gender, birthDate, birthTime } = req.body;
    if (!name || !gender || !birthDate || !birthTime) { error(res, '이름, 성별, 생년월일, 출생시각을 모두 입력해주세요'); return; }

    const innateData = calculateSaju(new Date(birthDate), birthTime);
    const id = genId();
    const data = {
      userId: req.userId!, name, gender, birthDate, birthTime,
      innateData: JSON.stringify(innateData), baseline: null, observedTraits: null,
    };
    await collections.children.doc(id).set(data);
    success(res, formatChild(id, data), 201);
  } catch { error(res, '자녀 등록 중 오류가 발생했습니다', 500); }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.children.doc(req.params.id as string).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }
    success(res, formatChild(doc.id, doc.data()!));
  } catch { error(res, '자녀 조회 중 오류가 발생했습니다', 500); }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.children.doc(req.params.id as string).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }

    const updates: Record<string, unknown> = {};
    const { name, gender, birthDate, birthTime } = req.body;
    if (name) updates.name = name;
    if (gender) updates.gender = gender;
    if (birthDate || birthTime) {
      const bd = birthDate || doc.data()!.birthDate;
      const bt = birthTime || doc.data()!.birthTime;
      updates.birthDate = bd;
      updates.birthTime = bt;
      updates.innateData = JSON.stringify(calculateSaju(new Date(bd), bt));
    }

    await collections.children.doc(req.params.id as string).update(updates);
    const updated = await collections.children.doc(req.params.id as string).get();
    success(res, formatChild(updated.id, updated.data()!));
  } catch { error(res, '자녀 수정 중 오류가 발생했습니다', 500); }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.children.doc(req.params.id as string).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }

    // cascade delete
    const obs = await collections.observations.where('childId', '==', req.params.id).get();
    const subs = await collections.subscriptions.where('childId', '==', req.params.id).get();
    const batch = collections.children.firestore.batch();
    obs.docs.forEach((d) => batch.delete(d.ref));
    subs.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc.ref);
    await batch.commit();

    success(res, { id: req.params.id, message: '삭제되었습니다' });
  } catch { error(res, '자녀 삭제 중 오류가 발생했습니다', 500); }
});

router.post('/:id/analyze', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) { error(res, '응답 데이터가 필요합니다'); return; }

    const doc = await collections.children.doc(req.params.id as string).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }

    const data = doc.data()!;
    const innate = typeof data.innateData === 'string' ? JSON.parse(data.innateData as string) : data.innateData;

    // Save baseline answers
    const baseline = JSON.stringify({ answers, completedAt: new Date().toISOString() });
    await collections.children.doc(req.params.id as string).update({ baseline });

    // Generate static report
    const report = generateChildReport(innate.dominantType, answers);

    // Save report to child document
    await collections.children.doc(req.params.id as string).update({
      analysisReport: JSON.stringify(report),
    });

    const updated = await collections.children.doc(req.params.id as string).get();
    const formatted = formatChild(updated.id, updated.data()!);
    success(res, { ...formatted, analysisReport: report });
  } catch { error(res, '분석 리포트 생성 중 오류가 발생했습니다', 500); }
});

router.post('/:id/baseline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) { error(res, '응답 데이터가 필요합니다'); return; }

    const doc = await collections.children.doc(req.params.id as string).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }

    const baseline = JSON.stringify({ answers, completedAt: new Date().toISOString() });
    await collections.children.doc(req.params.id as string).update({ baseline });
    const updated = await collections.children.doc(req.params.id as string).get();
    success(res, formatChild(updated.id, updated.data()!));
  } catch { error(res, '베이스라인 저장 중 오류가 발생했습니다', 500); }
});

export default router;

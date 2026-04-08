import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { calculateSaju } from '../services/saju.calculator';
import { calculateAge } from '../services/age.calculator';
import { generateChildReport, monthsToAgeGroup } from '../services/child.report';
import { success, error } from '../utils/response';
import { collections, genId, toISO } from '../services/firestore';
import { parseInnateData, parseInnateDataFull, safeParse } from '../utils/parse';

const router = Router();

function formatChild(id: string, data: Record<string, unknown>) {
  const publicInnate = parseInnateData(data.innateData);
  const bd = data.birthDate instanceof Date ? data.birthDate : new Date(data.birthDate as string);
  return {
    id, name: data.name, gender: data.gender,
    birthDate: bd.toISOString().split('T')[0],
    birthTime: data.birthTime,
    photoUri: data.photoUri || null,
    innateData: publicInnate,
    baseline: safeParse(data.baseline),
    observedTraits: safeParse(data.observedTraits),
    analysisReport: safeParse(data.analysisReport),
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
    const { name, gender, birthDate, birthTime, photoUri } = req.body;
    if (name) updates.name = name;
    if (gender) updates.gender = gender;
    if (photoUri !== undefined) updates.photoUri = photoUri;
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

    // cascade delete all related data
    const childId = req.params.id as string;
    const relatedQueries = await Promise.all([
      collections.observations.where('childId', '==', childId).get(),
      collections.subscriptions.where('childId', '==', childId).get(),
      collections.coachingSessions.where('childId', '==', childId).get(),
      collections.followups.where('childId', '==', childId).get(),
      collections.conversationSummaries.where('childId', '==', childId).get(),
      collections.dailyTracking.where('childId', '==', childId).get(),
      collections.dailyTraits.where('childId', '==', childId).get(),
    ]);
    const batch = collections.children.firestore.batch();
    for (const snap of relatedQueries) {
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
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
    const innate = parseInnateDataFull(data.innateData) as { dominantType: string; fiveElements: Record<string, number> };

    // Save baseline answers
    const baseline = JSON.stringify({ answers, completedAt: new Date().toISOString() });
    await collections.children.doc(req.params.id as string).update({ baseline });

    // Compute age group from birth date
    const birthDate = data.birthDate ? new Date(data.birthDate as string) : new Date();
    const ageMonths = calculateAge(birthDate).months;
    const ageGroup = monthsToAgeGroup(ageMonths);

    // Generate static report
    const report = generateChildReport(innate.dominantType, answers, ageGroup);

    // Save report to child document
    await collections.children.doc(req.params.id as string).update({
      analysisReport: JSON.stringify(report),
    });

    const updated = await collections.children.doc(req.params.id as string).get();
    const formatted = formatChild(updated.id, updated.data()!);
    success(res, { ...formatted, analysisReport: report });
  } catch { error(res, '분석 리포트 생성 중 오류가 발생했습니다', 500); }
});

router.post('/:id/daily-tracking', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childDoc = await collections.children.doc(req.params.id as string).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '자녀를 찾을 수 없습니다', 404); return;
    }
    const { date, feeding, diaper, sleep } = req.body;
    if (!date) { error(res, '날짜가 필요합니다'); return; }

    const docId = `${req.params.id}_${date}`;
    const trackingData = {
      childId: req.params.id,
      userId: req.userId!,
      date,
      feeding: feeding || { type: 'breast', count: 0 },
      diaper: diaper || { poop: 0, pee: 0, total: 0 },
      sleep: sleep || { naps: 0, totalHours: 0 },
      updatedAt: new Date().toISOString(),
    };
    await collections.dailyTracking.doc(docId).set(trackingData, { merge: true });
    success(res, { id: docId, ...trackingData });
  } catch { error(res, '기록 저장 중 오류가 발생했습니다', 500); }
});

router.get('/:id/daily-tracking', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childDoc = await collections.children.doc(req.params.id as string).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '자녀를 찾을 수 없습니다', 404); return;
    }
    const days = parseInt(req.query.days as string) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const snap = await collections.dailyTracking
      .where('childId', '==', req.params.id)
      .where('date', '>=', sinceStr)
      .orderBy('date', 'desc')
      .get();

    success(res, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch { error(res, '기록 조회 중 오류가 발생했습니다', 500); }
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

// ===== Daily Trait Accumulation =====

interface DailyTraitInsight {
  weekLabel: string;
  insight: string;
  reason: string;
  createdAt: string;
}

function generateTraitInsight(
  responses: Array<{ question: string; answer: string; date: string }>,
  dominantType: string
): DailyTraitInsight {
  const now = new Date();
  const month = now.getMonth() + 1;
  const weekNum = Math.ceil(now.getDate() / 7);
  const weekLabel = `${month}월 ${weekNum}주차`;

  // Keyword-based simple insight generation
  const allAnswers = responses.map((r) => r.answer).join(' ');
  let insight = '꾸준히 성장하고 있어요.';
  let reason = '일상의 작은 변화들이 모여 큰 성장이 됩니다.';

  if (allAnswers.includes('친구') || allAnswers.includes('또래') || allAnswers.includes('함께')) {
    insight = '사교성이 높아지고 있어요.';
    reason = '또래와 어울리는 시간이 늘었기 때문입니다.';
  } else if (allAnswers.includes('집중') || allAnswers.includes('오래') || allAnswers.includes('몰두')) {
    insight = '집중력이 발달하고 있어요.';
    reason = '한 가지 활동에 오래 몰두하는 모습이 보입니다.';
  } else if (allAnswers.includes('활발') || allAnswers.includes('에너지') || allAnswers.includes('운동')) {
    insight = '활동성이 더욱 커지고 있어요.';
    reason = '신체 활동에 대한 욕구와 에너지가 넘칩니다.';
  } else if (allAnswers.includes('감정') || allAnswers.includes('울') || allAnswers.includes('기분')) {
    insight = '감수성이 풍부해지고 있어요.';
    reason = '감정 표현이 다양해지고 섬세해졌습니다.';
  } else if (allAnswers.includes('새') || allAnswers.includes('도전') || allAnswers.includes('시도')) {
    insight = '도전 정신이 자라고 있어요.';
    reason = '새로운 것에 대한 호기심과 시도가 늘었습니다.';
  }

  return {
    weekLabel,
    insight,
    reason,
    createdAt: now.toISOString(),
  };
}

router.post('/:id/daily-trait', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childDoc = await collections.children.doc(req.params.id as string).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '자녀를 찾을 수 없습니다', 404); return;
    }

    const { question, answer, date } = req.body;
    if (!question || !answer || !date) {
      error(res, '질문, 답변, 날짜가 필요합니다'); return;
    }

    const docId = genId();
    const traitData = {
      childId: req.params.id,
      userId: req.userId!,
      question,
      answer,
      date,
      createdAt: new Date().toISOString(),
    };
    await collections.dailyTraits.doc(docId).set(traitData);

    // Check if 7+ responses accumulated — auto-generate insight
    const allSnap = await collections.dailyTraits
      .where('childId', '==', req.params.id)
      .orderBy('date', 'desc')
      .get();

    const totalResponses = allSnap.docs.length;
    let newInsight: DailyTraitInsight | null = null;

    if (totalResponses > 0 && totalResponses % 7 === 0) {
      const recent7 = allSnap.docs.slice(0, 7).map((d) => d.data() as { question: string; answer: string; date: string });
      const childData = childDoc.data()!;
      const innate = parseInnateDataFull(childData.innateData) as { dominantType: string };

      newInsight = generateTraitInsight(recent7, innate.dominantType as string);

      // Store insight in child document's traitInsights array
      const existingInsights: DailyTraitInsight[] = childData.traitInsights
        ? (typeof childData.traitInsights === 'string'
            ? JSON.parse(childData.traitInsights as string)
            : childData.traitInsights)
        : [];
      existingInsights.push(newInsight);
      await collections.children.doc(req.params.id as string).update({
        traitInsights: JSON.stringify(existingInsights),
      });
    }

    success(res, {
      id: docId,
      ...traitData,
      totalResponses,
      newInsight,
    });
  } catch { error(res, '기질 기록 저장 중 오류가 발생했습니다', 500); }
});

router.get('/:id/daily-traits', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childDoc = await collections.children.doc(req.params.id as string).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '자녀를 찾을 수 없습니다', 404); return;
    }

    // Return daily trait responses
    const snap = await collections.dailyTraits
      .where('childId', '==', req.params.id)
      .orderBy('date', 'desc')
      .get();

    const responses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Return trait insights from child document
    const childData = childDoc.data()!;
    const insights: DailyTraitInsight[] = childData.traitInsights
      ? (typeof childData.traitInsights === 'string'
          ? JSON.parse(childData.traitInsights as string)
          : childData.traitInsights)
      : [];

    success(res, { responses, insights });
  } catch { error(res, '기질 기록 조회 중 오류가 발생했습니다', 500); }
});

export default router;

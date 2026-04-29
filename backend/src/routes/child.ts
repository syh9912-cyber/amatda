import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { calculateSajuWithAI } from '../services/saju.interpreter';
import { calculateAge } from '../services/age.calculator';
import { generateChildReport, monthsToAgeGroup } from '../services/child.report';
import { success, error } from '../utils/response';
import { collections, db, genId, toISO } from '../services/firestore';
import { parseInnateData, parseInnateDataFull, safeParse } from '../utils/parse';
import { getChildIfAccessible, getAccessibleChildIds } from '../utils/childAccess';
import { logger } from '../utils/logger';

const router = Router();

function formatChild(id: string, data: Record<string, unknown>) {
  const publicInnate = parseInnateData(data.innateData);
  const isPregnant = (data.isPregnant as boolean) === true;

  // 임산부: birthDate 없을 수 있음
  let birthDateStr: string | null = null;
  let ageInfo: ReturnType<typeof calculateAge> | null = null;
  if (data.birthDate) {
    const bd = data.birthDate instanceof Date ? data.birthDate : new Date(data.birthDate as string);
    birthDateStr = bd.toISOString().split('T')[0];
    ageInfo = calculateAge(bd);
  }

  // 임신 주수 계산
  let pregnancyWeeks: number | null = null;
  if (isPregnant && data.dueDate) {
    const due = new Date(data.dueDate as string);
    const now = new Date();
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysPregnant = 280 - daysUntilDue;
    pregnancyWeeks = Math.max(1, Math.floor(daysPregnant / 7));
  }

  return {
    id, name: data.name, gender: data.gender,
    birthDate: birthDateStr,
    birthTime: data.birthTime || null,
    photoUri: data.photoUri || null,
    innateData: publicInnate,
    baseline: safeParse(data.baseline),
    observedTraits: safeParse(data.observedTraits),
    analysisReport: safeParse(data.analysisReport),
    ageInfo: isPregnant
      ? { label: pregnancyWeeks ? `임신 ${pregnancyWeeks}주차` : '임신 중', months: -1, group: 'pregnant' as const }
      : ageInfo,
    height: typeof data.height === 'number' ? data.height : null,
    weight: typeof data.weight === 'number' ? data.weight : null,
    // 건강 정보
    bloodType: (data.bloodType as string) || null,
    specialNotes: (data.specialNotes as string) || null,
    // 임신 전용 필드
    isPregnant,
    dueDate: (data.dueDate as string) || null,
    pregnancyWeeks,
    pregnancyNotes: (data.pregnancyNotes as string) || null,
    // 산모 건강 정보
    momHeight: typeof data.momHeight === 'number' ? data.momHeight : null,
    momWeight: typeof data.momWeight === 'number' ? data.momWeight : null,
    momBloodType: (data.momBloodType as string) || null,
    momSpecialNotes: (data.momSpecialNotes as string) || null,
  };
}

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    // 소유 아이 + 가족으로 접근 가능한 아이 모두 조회
    const childIds = await getAccessibleChildIds(req.userId!);
    if (childIds.length === 0) { success(res, []); return; }

    // getAll() 배치 조회 — N+1 제거
    const refs = childIds.map((cid) => collections.children.doc(cid));
    const snaps = refs.length > 0 ? await db.getAll(...refs) : [];
    const results = snaps
      .filter((doc) => doc.exists)
      .map((doc) => formatChild(doc.id, doc.data()!));
    success(res, results);
  } catch { error(res, '자녀 목록 조회 중 오류가 발생했습니다', 500); }
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, gender, birthDate, birthTime } = req.body;
    if (!name || !gender || !birthDate || !birthTime) { error(res, '이름, 성별, 생년월일, 출생시각을 모두 입력해주세요'); return; }

    const innateData = await calculateSajuWithAI(new Date(birthDate), birthTime, name, gender);
    const id = genId();
    const heightVal = typeof req.body.height === 'number' ? req.body.height : null;
    const weightVal = typeof req.body.weight === 'number' ? req.body.weight : null;
    const photoUri = typeof req.body.photoUri === 'string' ? req.body.photoUri : null;
    const bloodType = typeof req.body.bloodType === 'string' ? req.body.bloodType : null;
    const specialNotes = typeof req.body.specialNotes === 'string' ? req.body.specialNotes : null;
    const data: Record<string, unknown> = {
      userId: req.userId!, name, gender, birthDate, birthTime,
      innateData: JSON.stringify(innateData), baseline: null, observedTraits: null,
      height: heightVal, weight: weightVal, bloodType, specialNotes, photoUri,
      isPregnant: false,
    };
    await collections.children.doc(id).set(data);
    success(res, formatChild(id, data), 201);
  } catch { error(res, '자녀 등록 중 오류가 발생했습니다', 500); }
});

// ─── POST /api/child/pregnant — 임신 중 아기 등록 (태명 + 출산예정일) ───
router.post('/pregnant', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, dueDate, gender, pregnancyNotes } = req.body as {
      name: string;        // 태명
      dueDate: string;     // 출산예정일 (YYYY-MM-DD)
      gender?: string;     // 성별 (모르면 'U')
      pregnancyNotes?: string; // 특이사항 (쌍둥이, 고위험 등)
    };

    if (!name || !dueDate) {
      error(res, '태명과 출산예정일을 입력해주세요');
      return;
    }

    // 출산예정일 유효성 검사
    const due = new Date(dueDate);
    if (isNaN(due.getTime())) {
      error(res, '유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)');
      return;
    }

    const id = genId();
    const photoUri = typeof req.body.photoUri === 'string' ? req.body.photoUri : null;
    const momHeight = typeof req.body.momHeight === 'number' ? req.body.momHeight : null;
    const momWeight = typeof req.body.momWeight === 'number' ? req.body.momWeight : null;
    const momBloodType = typeof req.body.momBloodType === 'string' ? req.body.momBloodType : null;
    const momSpecialNotes = typeof req.body.momSpecialNotes === 'string' ? req.body.momSpecialNotes : null;
    const data: Record<string, unknown> = {
      userId: req.userId!,
      name,                              // 태명
      gender: gender || 'U',             // 모르면 U(unknown)
      isPregnant: true,
      dueDate,
      pregnancyNotes: pregnancyNotes || null,
      birthDate: null,                   // 아직 태어나지 않음
      birthTime: null,
      innateData: null,                  // 출산 후 생성
      baseline: null,
      observedTraits: null,
      height: null,
      weight: null,
      momHeight,                         // 산모 키
      momWeight,                         // 산모 몸무게
      momBloodType,                      // 산모 혈액형
      momSpecialNotes,                   // 산모 특이사항 (알레르기 등)
      photoUri,                          // 초음파 사진 등
      createdAt: new Date().toISOString(),
    };

    await collections.children.doc(id).set(data);
    success(res, formatChild(id, data), 201);
  } catch { error(res, '임신 등록 중 오류가 발생했습니다', 500); }
});

// ─── POST /api/child/:id/birth — 출산 전환 (임신→육아) ───
router.post('/:id/birth', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childDoc = await collections.children.doc(req.params.id as string).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    const data = childDoc.data()!;
    if (data.isPregnant !== true) {
      error(res, '이미 출산 완료된 아이입니다');
      return;
    }

    const { birthDate, birthTime, name, gender, height, weight } = req.body as {
      birthDate: string;     // YYYY-MM-DD
      birthTime: string;     // HH:MM
      name?: string;         // 정식 이름 (태명에서 변경)
      gender?: string;       // 성별 확정
      height?: number;       // 출생 키
      weight?: number;       // 출생 체중
    };

    if (!birthDate || !birthTime) {
      error(res, '생년월일과 출생시각을 입력해주세요');
      return;
    }

    // 사주/기질 분석 (Gemini 해석 포함, 실패 시 룰 fallback)
    const bornChildDoc = await collections.children.doc(req.params.id as string).get();
    const childName =
      (name as string | undefined) ?? (bornChildDoc.data()?.name as string | undefined) ?? '';
    const childGender =
      gender && gender !== 'U'
        ? (gender as string)
        : ((bornChildDoc.data()?.gender as string | undefined) ?? 'U');
    const innateData = await calculateSajuWithAI(
      new Date(birthDate),
      birthTime,
      childName,
      childGender,
    );

    const updates: Record<string, unknown> = {
      isPregnant: false,
      birthDate,
      birthTime,
      innateData: JSON.stringify(innateData),
      bornAt: new Date().toISOString(),  // 전환 시점 기록
    };

    // 선택적 필드 업데이트
    if (name) updates.name = name;                  // 태명→정식 이름
    if (gender && gender !== 'U') updates.gender = gender;
    if (typeof height === 'number') updates.height = height;
    if (typeof weight === 'number') updates.weight = weight;

    await collections.children.doc(req.params.id as string).update(updates);

    const updated = await collections.children.doc(req.params.id as string).get();
    success(res, {
      ...formatChild(updated.id, updated.data()!),
      message: '축하합니다! 아이가 태어났어요. 이제부터 육아 코칭이 시작됩니다.',
      innateData: parseInnateData(JSON.stringify(innateData)),
    });
  } catch { error(res, '출산 전환 중 오류가 발생했습니다', 500); }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const access = await getChildIfAccessible(req.params.id as string, req.userId, 'viewProfile', res);
    if (!access) return;
    success(res, formatChild(req.params.id as string, access.data));
  } catch { error(res, '자녀 조회 중 오류가 발생했습니다', 500); }
});

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const access = await getChildIfAccessible(req.params.id as string, req.userId, 'editProfile', res);
    if (!access) return;

    const updates: Record<string, unknown> = {};
    const { name, gender, birthDate, birthTime, photoUri } = req.body;
    if (name) updates.name = name;
    if (gender) updates.gender = gender;
    if (photoUri !== undefined) updates.photoUri = photoUri;
    if (birthDate || birthTime) {
      const bd = birthDate || access.data.birthDate;
      const bt = birthTime || access.data.birthTime;
      updates.birthDate = bd;
      updates.birthTime = bt;
      const updName = (name as string | undefined) ?? (access.data.name as string | undefined) ?? '';
      const updGender =
        (gender as string | undefined) ?? (access.data.gender as string | undefined) ?? 'U';
      updates.innateData = JSON.stringify(
        await calculateSajuWithAI(new Date(bd), bt, updName, updGender),
      );
    }
    // 건강 정보 필드
    if (req.body.height !== undefined) updates.height = typeof req.body.height === 'number' ? req.body.height : null;
    if (req.body.weight !== undefined) updates.weight = typeof req.body.weight === 'number' ? req.body.weight : null;
    if (req.body.bloodType !== undefined) updates.bloodType = req.body.bloodType || null;
    if (req.body.specialNotes !== undefined) updates.specialNotes = req.body.specialNotes || null;
    // 임산부 건강 정보
    if (req.body.momHeight !== undefined) updates.momHeight = typeof req.body.momHeight === 'number' ? req.body.momHeight : null;
    if (req.body.momWeight !== undefined) updates.momWeight = typeof req.body.momWeight === 'number' ? req.body.momWeight : null;
    if (req.body.momBloodType !== undefined) updates.momBloodType = req.body.momBloodType || null;
    if (req.body.momSpecialNotes !== undefined) updates.momSpecialNotes = req.body.momSpecialNotes || null;
    if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate || null;
    if (req.body.pregnancyNotes !== undefined) updates.pregnancyNotes = req.body.pregnancyNotes || null;

    await collections.children.doc(req.params.id as string).update(updates);
    const updated = await collections.children.doc(req.params.id as string).get();
    success(res, formatChild(updated.id, updated.data()!));
  } catch { error(res, '자녀 수정 중 오류가 발생했습니다', 500); }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.children.doc(req.params.id as string).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }

    const childId = req.params.id as string;

    // cascade delete — 자녀와 연결된 모든 컬렉션
    // ⚠️ 신규 컬렉션이 childId를 가질 때마다 여기에 추가할 것
    //    누락 시 자녀 삭제 후에도 stale 데이터로 푸시/추천이 발생함
    const relatedQueries = await Promise.all([
      // 코칭/일기/관찰
      collections.observations.where('childId', '==', childId).get(),
      collections.coachingSessions.where('childId', '==', childId).get(),
      collections.followups.where('childId', '==', childId).get(),
      collections.conversationSummaries.where('childId', '==', childId).get(),
      collections.autoDiaries.where('childId', '==', childId).get(),
      collections.learnedKnowledge.where('childId', '==', childId).get(),
      // 트래킹/기록
      collections.dailyTracking.where('childId', '==', childId).get(),
      collections.dailyTraits.where('childId', '==', childId).get(),
      collections.analysisUsage.where('childId', '==', childId).get(),
      collections.sleepPredictions.where('childId', '==', childId).get(),
      // 마일스톤/앨범
      collections.milestoneChecks.where('childId', '==', childId).get(),
      collections.milestonePhotos.where('childId', '==', childId).get(),
      collections.growthAlbums.where('childId', '==', childId).get(),
      // 헬스/예방접종
      collections.vaccinations.where('childId', '==', childId).get(),
      // 가족/공유
      collections.familyMembers.where('childId', '==', childId).get(),
      // 추천 캐시
      collections.recommendationCache.where('childId', '==', childId).get(),
      // 구독
      collections.subscriptions.where('childId', '==', childId).get(),
      // 임신 관련 컬렉션
      collections.pregnancyRecords.where('childId', '==', childId).get(),
      collections.momHealthChecks.where('childId', '==', childId).get(),
      collections.gdmRecords.where('childId', '==', childId).get(),
      collections.gdmFoodLogs.where('childId', '==', childId).get(),
    ]);

    // Firestore batch 최대 500개 → 청크 분할 삭제
    const db = collections.children.firestore;
    const allRefs = [doc.ref];
    for (const snap of relatedQueries) {
      for (const d of snap.docs) allRefs.push(d.ref);
    }

    // pushSchedules는 docId 패턴 `{userId}_{childId}` 사용 → 직접 ref로 삭제
    // (where 쿼리 불가능, ID 기반이라 Promise.all로 묶지 않음)
    allRefs.push(collections.pushSchedules.doc(`${req.userId}_${childId}`));
    const BATCH_LIMIT = 450;
    for (let i = 0; i < allRefs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      allRefs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    success(res, { id: childId, message: '삭제되었습니다' });
  } catch (err) {
    console.error('[Child] Delete error:', err);
    error(res, '자녀 삭제 중 오류가 발생했습니다', 500);
  }
});

router.post('/:id/analyze', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) { error(res, '응답 데이터가 필요합니다'); return; }

    const access = await getChildIfAccessible(req.params.id as string, req.userId, 'editProfile', res);
    if (!access) return;

    const data = access.data;
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
    const access = await getChildIfAccessible(req.params.id as string, req.userId, 'editRecords', res);
    if (!access) return;
    const { date, feeding, diaper, sleep, sleepStart, sleepEnd, sleepHours } = req.body;
    if (!date) { error(res, '날짜가 필요합니다'); return; }

    const docId = `${req.params.id}_${date}`;
    const trackingData: Record<string, unknown> = {
      childId: req.params.id,
      userId: req.userId!,
      date,
      feeding: feeding || { type: 'breast', count: 0 },
      diaper: diaper || { poop: 0, pee: 0, total: 0 },
      sleep: sleep || { naps: 0, totalHours: 0 },
      updatedAt: new Date().toISOString(),
    };
    if (typeof sleepStart === 'string') trackingData.sleepStart = sleepStart;
    if (typeof sleepEnd === 'string') trackingData.sleepEnd = sleepEnd;
    if (typeof sleepHours === 'number') trackingData.sleepHours = sleepHours;
    await collections.dailyTracking.doc(docId).set(trackingData, { merge: true });
    success(res, { id: docId, ...trackingData });
  } catch { error(res, '기록 저장 중 오류가 발생했습니다', 500); }
});

router.get('/:id/daily-tracking', authMiddleware, async (req: Request, res: Response) => {
  try {
    const access = await getChildIfAccessible(req.params.id as string, req.userId, 'viewRecords', res);
    if (!access) return;
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

    const access = await getChildIfAccessible(req.params.id as string, req.userId, 'editProfile', res);
    if (!access) return;

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
    const access = await getChildIfAccessible(req.params.id as string, req.userId, 'editRecords', res);
    if (!access) return;

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
      const innate = parseInnateDataFull(access.data.innateData) as { dominantType: string };

      newInsight = generateTraitInsight(recent7, innate.dominantType as string);

      // Store insight in child document's traitInsights array
      const existingInsights: DailyTraitInsight[] = access.data.traitInsights
        ? (typeof access.data.traitInsights === 'string'
            ? JSON.parse(access.data.traitInsights as string)
            : access.data.traitInsights) as DailyTraitInsight[]
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
  } catch (err) {
    logger.error('daily-trait save', err, { childId: req.params.id });
    error(res, '기질 기록 저장 중 오류가 발생했습니다', 500);
  }
});

router.get('/:id/daily-traits', authMiddleware, async (req: Request, res: Response) => {
  try {
    const access = await getChildIfAccessible(req.params.id as string, req.userId, 'viewRecords', res);
    if (!access) return;

    // Return daily trait responses
    const snap = await collections.dailyTraits
      .where('childId', '==', req.params.id)
      .orderBy('date', 'desc')
      .get();

    const responses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Return trait insights from child document
    const insights: DailyTraitInsight[] = access.data.traitInsights
      ? (typeof access.data.traitInsights === 'string'
          ? JSON.parse(access.data.traitInsights as string)
          : access.data.traitInsights) as DailyTraitInsight[]
      : [];

    success(res, { responses, insights });
  } catch { error(res, '기질 기록 조회 중 오류가 발생했습니다', 500); }
});

export default router;

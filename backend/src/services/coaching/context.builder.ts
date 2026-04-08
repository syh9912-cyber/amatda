import { collections } from '../firestore';
import { ChildContext, TrackingSummary } from './types';

/** 아이 프로필에서 프롬프트용 컨텍스트 빌드 */
export async function buildChildContext(
  childId: string,
  userId: string
): Promise<ChildContext | null> {
  const doc = await collections.children.doc(childId).get();
  if (!doc.exists) return null;
  const d = doc.data() as Record<string, unknown>;
  if (d.userId !== userId) return null;

  // 월령 계산
  const birthDate = d.birthDate as string | undefined;
  let ageMonths = 12;
  let ageInfo = '정보 없음';
  if (birthDate) {
    const birth = new Date(birthDate);
    const now = new Date();
    ageMonths = (now.getFullYear() - birth.getFullYear()) * 12
      + (now.getMonth() - birth.getMonth());
    if (ageMonths < 24) {
      ageInfo = `${ageMonths}개월`;
    } else {
      const years = Math.floor(ageMonths / 12);
      const months = ageMonths % 12;
      ageInfo = months > 0 ? `${years}세 ${months}개월` : `${years}세`;
    }
  }

  // 기질 정보 추출 (짧은 기질명)
  const innateData = d.innateData as Record<string, unknown> | undefined;
  const fullLabel = (innateData?.label as string) || '';
  const typeMatch = fullLabel.match(/(탐구형|활동형|조화형|분석형|감성형)/);
  const dominantType = typeMatch ? typeMatch[1] : (fullLabel || '정보 없음');
  const detail = innateData?.detail as Record<string, unknown> | undefined;

  let temperamentDetail = '';
  if (detail) {
    const personality = (detail.personality as string[] | undefined)?.slice(0, 3).join(', ') ?? '';
    const socialStyle = (detail.socialStyle as string) ?? '';
    const stressResponse = (detail.stressResponse as string) ?? '';
    temperamentDetail = [personality, socialStyle, stressResponse]
      .filter(Boolean).join(' | ');
  }

  let specialNotes = '';
  if (detail) {
    const cautions = (detail.cautions as string[] | undefined)?.slice(0, 2).join(', ') ?? '';
    const tips = (detail.parentingTips as string[] | undefined)?.slice(0, 2).join(', ') ?? '';
    specialNotes = [cautions, tips].filter(Boolean).join(' / ');
  }

  // baseline (부모 설문)
  let baseline = '없음';
  if (d.baseline) {
    try {
      const parsed = typeof d.baseline === 'string'
        ? JSON.parse(d.baseline) as Record<string, unknown>
        : d.baseline as Record<string, unknown>;
      const answers = parsed.answers as string[] | undefined;
      baseline = answers ? answers.slice(0, 5).join(', ') : '없음';
    } catch { baseline = '없음'; }
  }

  // observedTraits (관찰 특성)
  let observedTraits = '없음';
  if (d.observedTraits) {
    try {
      const parsed = typeof d.observedTraits === 'string'
        ? JSON.parse(d.observedTraits) as Record<string, unknown>
        : d.observedTraits as Record<string, unknown>;
      const summary = parsed.summary as string | undefined;
      observedTraits = summary ?? '없음';
    } catch { observedTraits = '없음'; }
  }

  const gender = (d.gender as string) === 'M' ? '남자아이' : '여자아이';

  return {
    name: (d.name as string) || '아이',
    ageInfo,
    ageMonths,
    gender,
    temperament: dominantType,
    temperamentDetail,
    specialNotes,
    baseline,
    observedTraits,
  };
}

/** 최근 7일 추적 데이터에서 요약 빌드 */
export async function buildTrackingSummary(
  childId: string,
  days = 7
): Promise<TrackingSummary> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  try {
    const snap = await collections.dailyTracking
      .where('childId', '==', childId)
      .where('date', '>=', cutoff.toISOString().slice(0, 10))
      .orderBy('date', 'desc')
      .limit(days)
      .get();

    if (snap.empty) {
      return {
        sleepSummary: '기록 없음',
        mealSummary: '기록 없음',
        poopSummary: '기록 없음',
        conditionSummary: '기록 없음',
        recentChangeSummary: '특이사항 없음',
      };
    }

    const records = snap.docs.map((d) => d.data() as Record<string, unknown>);
    return {
      sleepSummary: summarizeSleep(records),
      mealSummary: summarizeMeal(records),
      poopSummary: summarizePoop(records),
      conditionSummary: summarizeCondition(records),
      recentChangeSummary: summarizeChanges(records),
    };
  } catch {
    return {
      sleepSummary: '기록 없음',
      mealSummary: '기록 없음',
      poopSummary: '기록 없음',
      conditionSummary: '기록 없음',
      recentChangeSummary: '특이사항 없음',
    };
  }
}

function summarizeSleep(records: Record<string, unknown>[]): string {
  const sleepData = records
    .map((r) => r.sleep as Record<string, unknown> | undefined)
    .filter(Boolean);
  if (sleepData.length === 0) return '기록 없음';
  const totalHours = sleepData
    .map((s) => (s?.totalHours as number) || 0)
    .filter((h) => h > 0);
  if (totalHours.length === 0) return '기록 있으나 상세 없음';
  const avg = Math.round(totalHours.reduce((a, b) => a + b, 0) / totalHours.length * 10) / 10;
  return `최근 ${sleepData.length}일 평균 ${avg}시간`;
}

function summarizeMeal(records: Record<string, unknown>[]): string {
  const mealData = records
    .map((r) => r.feeding as Record<string, unknown> | undefined)
    .filter(Boolean);
  if (mealData.length === 0) return '기록 없음';
  return `최근 ${mealData.length}일 식사 기록 있음`;
}

function summarizePoop(records: Record<string, unknown>[]): string {
  const poopData = records
    .map((r) => r.diaper as Record<string, unknown> | undefined)
    .filter(Boolean);
  if (poopData.length === 0) return '기록 없음';
  return `최근 ${poopData.length}일 배변 기록 있음`;
}

function summarizeCondition(records: Record<string, unknown>[]): string {
  const conditions = records
    .map((r) => r.condition as string | undefined)
    .filter(Boolean);
  if (conditions.length === 0) return '기록 없음';
  const latest = conditions[0];
  return `최근 컨디션: ${latest}`;
}

function summarizeChanges(records: Record<string, unknown>[]): string {
  const notes = records
    .map((r) => r.notes as string | undefined)
    .filter((n): n is string => !!n && n.length > 0);
  if (notes.length === 0) return '특이사항 없음';
  return notes.slice(0, 2).join(', ');
}

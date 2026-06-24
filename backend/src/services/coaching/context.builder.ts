import { collections } from '../firestore';
import { ChildContext, TrackingSummary } from './types';
import { safeParse } from '../../utils/parse';

/**
 * 아이 프로필에서 프롬프트용 컨텍스트 빌드 (소유자 OR 가족 구성원).
 * @param requiredPermission 공유 멤버에게 요구할 권한.
 *   - AI 코칭 생성(ask/firstTalk/dailyDiary/analyzeMedia/followup): 'useCoaching' (기본값)
 *   - 단순 열람(마일스톤 등): 'viewProfile' 등 호출부에서 지정
 *   소유자는 항상 통과.
 */
export async function buildChildContext(
  childId: string,
  userId: string,
  requiredPermission: string = 'useCoaching'
): Promise<ChildContext | null> {
  const doc = await collections.children.doc(childId).get();
  if (!doc.exists) {
    console.warn('[buildChildContext] child not found: childId=%s userId=%s', childId, userId);
    return null;
  }
  const d = doc.data() as Record<string, unknown>;

  // 소유자가 아니면 가족 멤버 + 권한 확인
  if (d.userId !== userId) {
    const memberSnap = await collections.familyMembers
      .where('childId', '==', childId)
      .where('inviteeUserId', '==', userId)
      .where('status', '==', 'accepted')
      .limit(1)
      .get();
    if (memberSnap.empty) {
      console.warn('[buildChildContext] no familyMember entry - denying access');
      return null;
    }
    // 권한 잠금: 멤버가 requiredPermission 을 보유해야 허용
    const perms = (memberSnap.docs[0].data().permissions as string[]) ?? [];
    if (!perms.includes(requiredPermission)) {
      console.warn('[buildChildContext] member lacks %s - denying: childId=%s', requiredPermission, childId);
      return null;
    }
  }

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
  // ★ innateData 는 Firestore 에 JSON 문자열로 저장됨 → 반드시 파싱해야 label/detail 접근 가능.
  //   (이전엔 raw 캐스팅이라 항상 undefined → 코칭에 기질/성향이 전혀 안 들어갔음)
  const innateData = safeParse(d.innateData) ?? undefined;
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

  // 최근 관찰 일기 3건을 원문 그대로 컨텍스트에 주입
  let observedTraits = '없음';
  try {
    const obsSnap = await collections.observations
      .where('childId', '==', childId)
      .orderBy('createdAt', 'desc').limit(3).get();
    const texts = obsSnap.docs
      .map((o) => (o.data().rawContent as string | undefined)?.trim())
      .filter((t): t is string => !!t && t.length > 0)
      .map((t) => (t.length > 200 ? t.slice(0, 200) + '...' : t));
    if (texts.length > 0) {
      observedTraits = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');
    }
  } catch { observedTraits = '없음'; }

  const isPregnant = (d.isPregnant as boolean) === true;
  const gender = isPregnant ? '태아' : ((d.gender as string) === 'M' ? '남자아이' : '여자아이');

  // 임산부: 주수 계산 (dueDate 기준)
  let pregnancyWeeks: number | undefined;
  let dueDate: string | undefined;
  let babyNickname: string | undefined;
  let pregnancyNotes: string | undefined;

  if (isPregnant) {
    dueDate = d.dueDate as string | undefined;
    babyNickname = (d.name as string) || undefined;  // 태명
    pregnancyNotes = d.pregnancyNotes as string | undefined;

    if (dueDate) {
      const due = new Date(dueDate);
      const now = new Date();
      // 출산예정일에서 역산: 임신 40주 = 280일
      const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const daysPregnant = 280 - daysUntilDue;
      pregnancyWeeks = Math.max(1, Math.floor(daysPregnant / 7));
    }
  }

  return {
    name: (d.name as string) || (isPregnant ? '태명 미정' : '아이'),
    ageInfo: isPregnant ? (pregnancyWeeks ? `임신 ${pregnancyWeeks}주차` : '임신 중') : ageInfo,
    ageMonths: isPregnant ? -1 : ageMonths,
    gender,
    temperament: isPregnant ? '없음' : dominantType,
    temperamentDetail: isPregnant ? '' : temperamentDetail,
    specialNotes: isPregnant ? (pregnancyNotes || '') : specialNotes,
    baseline,
    observedTraits: isPregnant ? '없음' : observedTraits,
    isPregnant,
    pregnancyWeeks,
    dueDate,
    babyNickname,
    pregnancyNotes,
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

  // 패턴 분석: 추세 감지
  const parts: string[] = [`최근 ${sleepData.length}일 평균 ${avg}시간`];
  if (totalHours.length >= 3) {
    const recent3 = totalHours.slice(0, 3);
    const older = totalHours.slice(3);
    if (older.length > 0) {
      const recentAvg = recent3.reduce((a, b) => a + b, 0) / recent3.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const diff = recentAvg - olderAvg;
      if (diff < -0.5) parts.push('수면 감소 추세');
      else if (diff > 0.5) parts.push('수면 증가 추세');
    }
  }

  // 야간 각성 체크
  const wakeups = sleepData
    .map((s) => (s?.nightWakeups as number) || 0)
    .filter((w) => w > 0);
  if (wakeups.length > 0) {
    const avgWake = Math.round(wakeups.reduce((a, b) => a + b, 0) / wakeups.length * 10) / 10;
    if (avgWake >= 2) parts.push(`야간 각성 평균 ${avgWake}회`);
  }

  return parts.join(', ');
}

function summarizeMeal(records: Record<string, unknown>[]): string {
  const mealData = records
    .map((r) => r.feeding as Record<string, unknown> | undefined)
    .filter(Boolean);
  if (mealData.length === 0) return '기록 없음';

  const parts: string[] = [`최근 ${mealData.length}일 식사 기록 있음`];

  // 식사 거부 패턴
  const refusals = mealData.filter((m) => {
    const amount = (m?.amount as string) || '';
    return amount === '거부' || amount === '소량' || amount === '적음';
  });
  if (refusals.length >= 2) {
    parts.push(`식사 거부/소량 ${refusals.length}회`);
  }

  // 수유량/식사량 추세
  const amounts = mealData
    .map((m) => (m?.totalMl as number) || (m?.totalAmount as number) || 0)
    .filter((a) => a > 0);
  if (amounts.length >= 3) {
    const recent = amounts.slice(0, 2);
    const older = amounts.slice(2);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    if (olderAvg > 0 && recentAvg < olderAvg * 0.7) parts.push('섭취량 감소 추세');
  }

  return parts.join(', ');
}

function summarizePoop(records: Record<string, unknown>[]): string {
  const poopData = records
    .map((r) => r.diaper as Record<string, unknown> | undefined)
    .filter(Boolean);
  if (poopData.length === 0) return '기록 없음';

  const parts: string[] = [`최근 ${poopData.length}일 배변 기록 있음`];

  // 횟수 패턴
  const counts = poopData
    .map((p) => (p?.poopCount as number) || 0)
    .filter((c) => c > 0);
  if (counts.length > 0) {
    const avg = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length * 10) / 10;
    parts.push(`평균 ${avg}회/일`);
    // 변비 의심 (0회인 날이 2일 이상)
    const zeroDays = poopData.filter((p) => ((p?.poopCount as number) || 0) === 0).length;
    if (zeroDays >= 2) parts.push(`무배변 ${zeroDays}일(변비 의심)`);
  }

  // 설사 체크
  const diarrhea = poopData.filter((p) => {
    const consistency = (p?.consistency as string) || '';
    return consistency === '묽음' || consistency === '설사' || consistency === '물변';
  });
  if (diarrhea.length >= 2) parts.push(`묽은 변 ${diarrhea.length}회`);

  return parts.join(', ');
}

function summarizeCondition(records: Record<string, unknown>[]): string {
  const conditions = records
    .map((r) => r.condition as string | undefined)
    .filter((c): c is string => !!c);
  if (conditions.length === 0) return '기록 없음';

  const parts: string[] = [`최근 컨디션: ${conditions[0]}`];

  // 체온 체크
  const temps = records
    .map((r) => (r.temperature as number) || 0)
    .filter((t) => t > 0);
  if (temps.length > 0) {
    const maxTemp = Math.max(...temps);
    const latestTemp = temps[0];
    if (latestTemp >= 37.5) parts.push(`현재 체온 ${latestTemp}도`);
    if (maxTemp >= 38) parts.push(`최근 최고 ${maxTemp}도`);
  }

  // 컨디션 변화 추세
  const moodMap: Record<string, number> = { '좋음': 3, '보통': 2, '나쁨': 1, '아픔': 0 };
  const scores = conditions.map((c) => moodMap[c] ?? 2);
  if (scores.length >= 3) {
    const recentAvg = scores.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const olderAvg = scores.slice(2).reduce((a, b) => a + b, 0) / scores.slice(2).length;
    if (recentAvg < olderAvg - 0.5) parts.push('컨디션 하락 추세');
    else if (recentAvg > olderAvg + 0.5) parts.push('컨디션 개선 추세');
  }

  return parts.join(', ');
}

function summarizeChanges(records: Record<string, unknown>[]): string {
  const notes = records
    .map((r) => r.notes as string | undefined)
    .filter((n): n is string => !!n && n.length > 0);
  if (notes.length === 0) return '특이사항 없음';
  return notes.slice(0, 2).join(', ');
}

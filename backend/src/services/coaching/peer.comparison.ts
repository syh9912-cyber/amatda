/**
 * 또래 비교 인사이트
 * - 같은 월령대 아이들의 통계 기반 비교
 * - "우리 아이 정상인가요?"에 대한 데이터 기반 답변
 * - 소아과학회 발달 기준 + 앱 내 집계 데이터 활용
 */

// 소아과학회 기준 정상 범위 (월령별)
interface NormData {
  ageRange: [number, number];
  sleep: { min: number; max: number; unit: string };
  meals: { min: number; max: number; unit: string };
  poop: { min: number; max: number; unit: string };
  weight?: { min: number; max: number; unit: string };
  height?: { min: number; max: number; unit: string };
}

const NORMS: NormData[] = [
  { ageRange: [0, 3], sleep: { min: 14, max: 17, unit: '시간' }, meals: { min: 8, max: 12, unit: '회/일' }, poop: { min: 3, max: 10, unit: '회/일' } },
  { ageRange: [4, 6], sleep: { min: 12, max: 16, unit: '시간' }, meals: { min: 5, max: 8, unit: '회/일' }, poop: { min: 2, max: 6, unit: '회/일' } },
  { ageRange: [7, 12], sleep: { min: 12, max: 15, unit: '시간' }, meals: { min: 3, max: 5, unit: '회/일(이유식+수유)' }, poop: { min: 1, max: 4, unit: '회/일' } },
  { ageRange: [13, 24], sleep: { min: 11, max: 14, unit: '시간' }, meals: { min: 3, max: 5, unit: '회/일' }, poop: { min: 1, max: 3, unit: '회/일' } },
  { ageRange: [25, 36], sleep: { min: 10, max: 13, unit: '시간' }, meals: { min: 3, max: 4, unit: '회/일' }, poop: { min: 1, max: 2, unit: '회/일' } },
  { ageRange: [37, 60], sleep: { min: 10, max: 13, unit: '시간' }, meals: { min: 3, max: 4, unit: '회/일' }, poop: { min: 1, max: 2, unit: '회/일' } },
  { ageRange: [61, 96], sleep: { min: 9, max: 12, unit: '시간' }, meals: { min: 3, max: 3, unit: '회/일' }, poop: { min: 1, max: 2, unit: '회/일' } },
  { ageRange: [97, 144], sleep: { min: 8, max: 11, unit: '시간' }, meals: { min: 3, max: 3, unit: '회/일' }, poop: { min: 1, max: 2, unit: '회/일' } },
];

export interface ComparisonItem {
  category: string;
  icon: string;
  childValue: string;
  normRange: string;
  status: 'above' | 'normal' | 'below' | 'unknown';
  percentile: number; // 0~100
  comment: string;
}

export interface PeerComparison {
  ageGroup: string;
  items: ComparisonItem[];
  overallComment: string;
}

function getNorm(ageMonths: number): NormData | null {
  return NORMS.find((n) => ageMonths >= n.ageRange[0] && ageMonths <= n.ageRange[1]) ?? null;
}

function calcPercentile(value: number, min: number, max: number): { percentile: number; status: 'above' | 'normal' | 'below' } {
  const mid = (min + max) / 2;
  const range = max - min;

  if (value >= min && value <= max) {
    // 정상 범위 내: 30~70 사이로 매핑
    const ratio = range > 0 ? (value - min) / range : 0.5;
    return { percentile: Math.round(30 + ratio * 40), status: 'normal' };
  }
  if (value > max) {
    // 정상 이상: 70~95
    const overBy = value - max;
    const pct = Math.min(95, 70 + (overBy / mid) * 50);
    return { percentile: Math.round(pct), status: 'above' };
  }
  // 정상 이하: 5~30
  const underBy = min - value;
  const pct = Math.max(5, 30 - (underBy / mid) * 50);
  return { percentile: Math.round(pct), status: 'below' };
}

export function generatePeerComparison(
  ageMonths: number,
  trackingData: {
    avgSleepHours?: number;
    avgMeals?: number;
    avgPoop?: number;
  },
): PeerComparison {
  const norm = getNorm(ageMonths);
  const ageGroup = ageMonths < 12 ? `${ageMonths}개월` :
    `${Math.floor(ageMonths / 12)}세${ageMonths % 12 ? ` ${ageMonths % 12}개월` : ''}`;

  if (!norm) {
    return {
      ageGroup,
      items: [],
      overallComment: '해당 월령의 비교 데이터가 아직 준비되지 않았어요.',
    };
  }

  const items: ComparisonItem[] = [];

  // 수면 비교
  if (trackingData.avgSleepHours != null && trackingData.avgSleepHours > 0) {
    const { percentile, status } = calcPercentile(trackingData.avgSleepHours, norm.sleep.min, norm.sleep.max);
    const comments: Record<string, string> = {
      above: '또래보다 수면이 넉넉해요. 좋은 수면 습관이에요!',
      normal: '또래 평균 범위 안에 있어요. 잘 자고 있어요.',
      below: '또래보다 수면이 조금 적은 편이에요. 수면 루틴을 점검해보세요.',
    };
    items.push({
      category: '수면',
      icon: 'sleep',
      childValue: `${trackingData.avgSleepHours}시간`,
      normRange: `${norm.sleep.min}~${norm.sleep.max}${norm.sleep.unit}`,
      status,
      percentile,
      comment: comments[status],
    });
  }

  // 식사 비교
  if (trackingData.avgMeals != null && trackingData.avgMeals > 0) {
    const { percentile, status } = calcPercentile(trackingData.avgMeals, norm.meals.min, norm.meals.max);
    const comments: Record<string, string> = {
      above: '식사 횟수가 많은 편이에요. 간식 포함인지 확인해보세요.',
      normal: '또래 평균적인 식사 패턴이에요.',
      below: '식사 횟수가 조금 적어요. 소량씩 자주 주는 것도 방법이에요.',
    };
    items.push({
      category: '식사',
      icon: 'meal',
      childValue: `${trackingData.avgMeals}회/일`,
      normRange: `${norm.meals.min}~${norm.meals.max}${norm.meals.unit}`,
      status,
      percentile,
      comment: comments[status],
    });
  }

  // 배변 비교
  if (trackingData.avgPoop != null && trackingData.avgPoop >= 0) {
    const { percentile, status } = calcPercentile(trackingData.avgPoop, norm.poop.min, norm.poop.max);
    const comments: Record<string, string> = {
      above: '배변 횟수가 많은 편이에요. 묽기나 색 변화가 없다면 괜찮아요.',
      normal: '또래 정상 범위의 배변 패턴이에요.',
      below: '배변이 뜸한 편이에요. 수분 섭취와 활동량을 늘려보세요.',
    };
    items.push({
      category: '배변',
      icon: 'poop',
      childValue: `${trackingData.avgPoop}회/일`,
      normRange: `${norm.poop.min}~${norm.poop.max}${norm.poop.unit}`,
      status,
      percentile,
      comment: comments[status],
    });
  }

  // 종합 코멘트
  const normalCount = items.filter((i) => i.status === 'normal').length;
  const belowCount = items.filter((i) => i.status === 'below').length;
  let overallComment: string;
  if (items.length === 0) {
    overallComment = '기록 데이터가 쌓이면 또래 비교 결과를 보여드릴게요.';
  } else if (normalCount === items.length) {
    overallComment = '전체적으로 또래 평균 범위 안에서 잘 성장하고 있어요!';
  } else if (belowCount > 0) {
    overallComment = '일부 항목이 또래 평균보다 낮지만, 아이마다 속도가 달라요. 상담이모에게 맞춤 팁을 받아보세요.';
  } else {
    overallComment = '전반적으로 건강한 패턴이에요. 지금처럼 꾸준히 기록해주세요!';
  }

  return { ageGroup, items, overallComment };
}

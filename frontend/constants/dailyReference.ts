/**
 * 일일 권장량 / 권장 수면 / 수유 텀 기준 (한국 소아과 일반 가이드 기반)
 *
 * 사용:
 *   const ref = getDailyReference(ageMonths, weightKg);
 *   ref.sleepHrMin / sleepHrMax       — 권장 일일 수면 (시간)
 *   ref.formulaMlMin / formulaMlMax   — 권장 일일 분유량 (ml, 몸무게 기반)
 *   ref.feedIntervalHrMin / Max       — 권장 수유 텀 (시간)
 *
 * 몸무게가 없을 때는 개월별 평균 몸무게로 자동 추정 (avgWeightKg).
 */

interface AgeRange {
  minMonths: number;
  maxMonths: number;
  // 수면 (개월수 기준)
  sleepHrMin: number;
  sleepHrMax: number;
  // 분유 (몸무게 × 계수, ml/일)
  formulaPerKgMin: number;
  formulaPerKgMax: number;
  // 수유 텀 (개월수 기준)
  feedIntervalHrMin: number;
  feedIntervalHrMax: number;
  // 평균 몸무게 (기록 없을 때 fallback, kg)
  avgWeightKg: number;
}

const AGE_TABLE: AgeRange[] = [
  // 0~1개월
  { minMonths: 0, maxMonths: 1, sleepHrMin: 14, sleepHrMax: 17,
    formulaPerKgMin: 150, formulaPerKgMax: 200,
    feedIntervalHrMin: 2, feedIntervalHrMax: 3, avgWeightKg: 4 },
  // 1~3개월
  { minMonths: 1, maxMonths: 3, sleepHrMin: 14, sleepHrMax: 17,
    formulaPerKgMin: 150, formulaPerKgMax: 200,
    feedIntervalHrMin: 3, feedIntervalHrMax: 4, avgWeightKg: 5.5 },
  // 4~6개월
  { minMonths: 4, maxMonths: 6, sleepHrMin: 12, sleepHrMax: 16,
    formulaPerKgMin: 150, formulaPerKgMax: 180,
    feedIntervalHrMin: 3, feedIntervalHrMax: 4, avgWeightKg: 7 },
  // 7~12개월
  { minMonths: 7, maxMonths: 12, sleepHrMin: 12, sleepHrMax: 15,
    formulaPerKgMin: 100, formulaPerKgMax: 150,
    feedIntervalHrMin: 4, feedIntervalHrMax: 5, avgWeightKg: 9 },
  // 13~24개월
  { minMonths: 13, maxMonths: 24, sleepHrMin: 11, sleepHrMax: 14,
    formulaPerKgMin: 50, formulaPerKgMax: 100,
    feedIntervalHrMin: 4, feedIntervalHrMax: 6, avgWeightKg: 11 },
  // 25~36개월
  { minMonths: 25, maxMonths: 36, sleepHrMin: 11, sleepHrMax: 14,
    formulaPerKgMin: 0, formulaPerKgMax: 0, // 분유 권장량 의미 없음 (일반식)
    feedIntervalHrMin: 0, feedIntervalHrMax: 0,
    avgWeightKg: 13 },
  // 36개월~
  { minMonths: 37, maxMonths: 144, sleepHrMin: 10, sleepHrMax: 13,
    formulaPerKgMin: 0, formulaPerKgMax: 0,
    feedIntervalHrMin: 0, feedIntervalHrMax: 0,
    avgWeightKg: 18 },
];

export interface DailyReference {
  ageMonths: number;
  weightKg: number;
  weightIsEstimated: boolean;
  /** 권장 일일 수면 (시간) */
  sleepHrMin: number;
  sleepHrMax: number;
  /** 권장 일일 분유 (ml) — 0이면 분유 권장 영역 아님 (일반식 기준) */
  formulaMlMin: number;
  formulaMlMax: number;
  /** 권장 수유 텀 (시간) — 0이면 의미 없음 */
  feedIntervalHrMin: number;
  feedIntervalHrMax: number;
}

function findAgeRange(ageMonths: number): AgeRange {
  const found = AGE_TABLE.find((r) => ageMonths >= r.minMonths && ageMonths <= r.maxMonths);
  if (found) return found;
  // 범위 벗어남: 마지막 또는 첫 번째 사용
  return ageMonths < 0 ? AGE_TABLE[0] : AGE_TABLE[AGE_TABLE.length - 1];
}

export function getDailyReference(
  ageMonths: number,
  weightKg: number | null | undefined,
): DailyReference {
  const range = findAgeRange(ageMonths);
  const w = weightKg && weightKg > 0 ? weightKg : range.avgWeightKg;
  const isEstimated = !weightKg || weightKg <= 0;

  return {
    ageMonths,
    weightKg: w,
    weightIsEstimated: isEstimated,
    sleepHrMin: range.sleepHrMin,
    sleepHrMax: range.sleepHrMax,
    formulaMlMin: Math.round(range.formulaPerKgMin * w),
    formulaMlMax: Math.round(range.formulaPerKgMax * w),
    feedIntervalHrMin: range.feedIntervalHrMin,
    feedIntervalHrMax: range.feedIntervalHrMax,
  };
}

/**
 * 마지막 수유 후 경과 시간을 권장 텀에 대한 진행률로 계산.
 *   0.0 = 방금 수유함
 *   0.9 = 권장 텀 90% 도달 (곧 수유 시간)
 *   1.0+ = 권장 텀 도달 또는 초과
 */
export function calcFeedIntervalProgress(
  minutesSinceLastFeed: number,
  feedIntervalHrMax: number,
): number {
  if (feedIntervalHrMax <= 0) return 0;
  const targetMin = feedIntervalHrMax * 60;
  return Math.max(0, minutesSinceLastFeed / targetMin);
}

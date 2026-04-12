/**
 * 성장 분석 서비스
 * WHO 표준 데이터 기반으로 아이의 성장 상태를 분석하고
 * 사전 구축된 코멘트 DB에서 적절한 조언을 반환
 */

import {
  BOYS_GROWTH,
  GIRLS_GROWTH,
  findClosestEntry,
  getPercentileLevel,
  findTrackerStandard,
  getTrackerLevel,
  getComment,
  type GrowthLevel,
  type AnalysisComment,
  type TrackerStandard,
} from '../data/growth-standards';

/* ─── Types ─── */

export interface GrowthInput {
  gender: 'M' | 'F';
  months: number;
  height?: number | null;
  weight?: number | null;
}

export interface TrackerInput {
  months: number;
  diaperCount?: number | null;
  feedingCount?: number | null;
  sleepHours?: number | null;
}

export interface MetricResult {
  metric: string;
  value: number;
  percentile: number;
  level: GrowthLevel;
  percentileLabel: string;
  standard50: number;
  title: string;
  emoji: string;
  comment: string;
  advice: string;
}

export interface TrackerResult {
  metric: string;
  value: number;
  level: GrowthLevel;
  standardRange: string;
  standardAvg: number;
  standardDetail: string;
  title: string;
  emoji: string;
  comment: string;
  advice: string;
}

export interface FullAnalysis {
  childMonths: number;
  ageLabel: string;
  growthMetrics: MetricResult[];
  trackerMetrics: TrackerResult[];
  trackerStandard: TrackerStandard;
  overallSummary: string;
}

/* ─── 백분위 라벨 ─── */

function percentileLabel(pct: number): string {
  if (pct <= 3) return '하위 3%';
  if (pct <= 10) return '하위 10%';
  if (pct <= 25) return '하위 25%';
  if (pct <= 50) return '중간 (50%)';
  if (pct <= 75) return '상위 25%';
  if (pct <= 90) return '상위 10%';
  return '상위 3%';
}

/* ─── 월령 라벨 ─── */

function ageMonthsLabel(months: number): string {
  if (months < 12) return `${months}개월`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years}세` : `${years}세 ${rem}개월`;
}

/* ─── 성장 분석 (키/몸무게) ─── */

export function analyzeGrowth(input: GrowthInput): MetricResult[] {
  const data = input.gender === 'F' ? GIRLS_GROWTH : BOYS_GROWTH;
  const entry = findClosestEntry(data, input.months);
  const results: MetricResult[] = [];

  if (input.height != null && input.height > 0) {
    const { percentile, level } = getPercentileLevel(input.height, entry.height);
    const comment = getComment('height', level) as AnalysisComment;
    results.push({
      metric: 'height',
      value: input.height,
      percentile,
      level,
      percentileLabel: percentileLabel(percentile),
      standard50: entry.height.p50,
      title: comment?.title ?? '키 분석',
      emoji: comment?.emoji ?? '📏',
      comment: comment?.comment ?? '',
      advice: comment?.advice ?? '',
    });
  }

  if (input.weight != null && input.weight > 0) {
    const { percentile, level } = getPercentileLevel(input.weight, entry.weight);
    const comment = getComment('weight', level) as AnalysisComment;
    results.push({
      metric: 'weight',
      value: input.weight,
      percentile,
      level,
      percentileLabel: percentileLabel(percentile),
      standard50: entry.weight.p50,
      title: comment?.title ?? '몸무게 분석',
      emoji: comment?.emoji ?? '⚖️',
      comment: comment?.comment ?? '',
      advice: comment?.advice ?? '',
    });
  }

  // BMI 계산 (키와 몸무게 둘 다 있을 때)
  if (input.height != null && input.weight != null && input.height > 0 && input.weight > 0) {
    const heightM = input.height / 100;
    const bmi = input.weight / (heightM * heightM);

    // 간이 BMI 레벨 판정 (연령별 다름)
    let level: GrowthLevel;
    if (input.months < 60) {
      // 영유아 BMI 기준
      if (bmi < 13) level = 'very_low';
      else if (bmi < 14.5) level = 'low';
      else if (bmi < 17.5) level = 'normal';
      else if (bmi < 19) level = 'high';
      else level = 'very_high';
    } else {
      // 초등 BMI 기준
      if (bmi < 13.5) level = 'very_low';
      else if (bmi < 15) level = 'low';
      else if (bmi < 20) level = 'normal';
      else if (bmi < 23) level = 'high';
      else level = 'very_high';
    }

    const comment = getComment('bmi', level) as AnalysisComment;
    results.push({
      metric: 'bmi',
      value: Math.round(bmi * 10) / 10,
      percentile: 50, // BMI는 백분위 대신 범주 표시
      level,
      percentileLabel: level === 'normal' ? '정상' : level === 'low' ? '저체중' : level === 'high' ? '과체중' : level === 'very_low' ? '심한 저체중' : '비만',
      standard50: 0,
      title: comment?.title ?? 'BMI 분석',
      emoji: comment?.emoji ?? '📊',
      comment: comment?.comment ?? '',
      advice: comment?.advice ?? '',
    });
  }

  return results;
}

/* ─── 육아 패턴 분석 (배변/수유/수면) ─── */

export function analyzeTracker(input: TrackerInput): { results: TrackerResult[]; standard: TrackerStandard } {
  const standard = findTrackerStandard(input.months);
  const results: TrackerResult[] = [];

  if (input.diaperCount != null) {
    const level = getTrackerLevel(input.diaperCount, standard.diaper);
    const comment = getComment('diaper', level) as AnalysisComment;
    results.push({
      metric: 'diaper',
      value: input.diaperCount,
      level,
      standardRange: `${standard.diaper.min}~${standard.diaper.max}${standard.diaper.unit}`,
      standardAvg: standard.diaper.avg,
      standardDetail: '',
      title: comment?.title ?? '배변 분석',
      emoji: comment?.emoji ?? '🧷',
      comment: comment?.comment ?? '',
      advice: comment?.advice ?? '',
    });
  }

  if (input.feedingCount != null) {
    const level = getTrackerLevel(input.feedingCount, standard.feeding);
    const comment = getComment('feeding', level) as AnalysisComment;
    results.push({
      metric: 'feeding',
      value: input.feedingCount,
      level,
      standardRange: `${standard.feeding.min}~${standard.feeding.max}${standard.feeding.unit}`,
      standardAvg: standard.feeding.avg,
      standardDetail: standard.feeding.detail,
      title: comment?.title ?? '수유/식사 분석',
      emoji: comment?.emoji ?? '🍼',
      comment: comment?.comment ?? '',
      advice: comment?.advice ?? '',
    });
  }

  if (input.sleepHours != null) {
    const level = getTrackerLevel(input.sleepHours, standard.sleep);
    const comment = getComment('sleep', level) as AnalysisComment;
    results.push({
      metric: 'sleep',
      value: input.sleepHours,
      level,
      standardRange: `${standard.sleep.min}~${standard.sleep.max}${standard.sleep.unit}`,
      standardAvg: standard.sleep.avg,
      standardDetail: standard.sleep.detail,
      title: comment?.title ?? '수면 분석',
      emoji: comment?.emoji ?? '😴',
      comment: comment?.comment ?? '',
      advice: comment?.advice ?? '',
    });
  }

  return { results, standard };
}

/* ─── 종합 분석 ─── */

export function analyzeAll(
  growthInput: GrowthInput,
  trackerInput: TrackerInput,
): FullAnalysis {
  const growthMetrics = analyzeGrowth(growthInput);
  const { results: trackerMetrics, standard: trackerStandard } = analyzeTracker(trackerInput);

  // 종합 요약 생성
  const warnings = [...growthMetrics, ...trackerMetrics].filter(
    (m) => m.level === 'very_low' || m.level === 'very_high',
  );
  const goods = [...growthMetrics, ...trackerMetrics].filter(
    (m) => m.level === 'normal',
  );

  let overallSummary: string;
  if (warnings.length > 0) {
    overallSummary = `주의가 필요한 항목이 ${warnings.length}개 있어요. 해당 항목의 조언을 확인해주세요.`;
  } else if (goods.length === growthMetrics.length + trackerMetrics.length) {
    overallSummary = '모든 항목이 정상 범위입니다! 현재 패턴을 잘 유지하고 있어요.';
  } else {
    overallSummary = '대체로 양호하지만, 일부 항목에서 관심이 필요해요.';
  }

  return {
    childMonths: growthInput.months,
    ageLabel: ageMonthsLabel(growthInput.months),
    growthMetrics,
    trackerMetrics,
    trackerStandard,
    overallSummary,
  };
}

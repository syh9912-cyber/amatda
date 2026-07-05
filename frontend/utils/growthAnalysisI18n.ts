import type { i18n as I18nInstance, TFunction } from 'i18next';
import { formatAgeLabel } from './ageLabel';

/**
 * 성장/육아패턴 분석 결과 다국어 표시 헬퍼.
 *
 * 백엔드(growthAnalysis.ts / growth-standards.ts)는 title·comment·advice·
 * percentileLabel·ageLabel·overallSummary를 한국어 고정 문자열로 내려준다.
 * 응답의 구조화 코드(metric/level/percentile/childMonths)가 있으면 코드 기반으로,
 * 문자열만 있으면 한국어→키 역참조 맵으로 표시 시점에 번역한다.
 * (milestonesChecklist의 koLabelToId 역참조 패턴과 동일. 미등록 문자열은 원문 유지.)
 */

const METRICS = ['height', 'weight', 'bmi', 'diaper', 'feeding', 'sleep'] as const;
const LEVELS = ['very_low', 'low', 'normal', 'high', 'very_high'] as const;
const FIELDS = ['title', 'comment', 'advice'] as const;
const BUCKETS = ['bottom3', 'bottom10', 'bottom25', 'middle50', 'top25', 'top10', 'top3'] as const;

const METRIC_SET = new Set<string>(METRICS);
const LEVEL_SET = new Set<string>(LEVELS);

export type GrowthCommentField = (typeof FIELDS)[number];

/** 백엔드 percentileLabel() 버킷과 동일한 경계 (growthAnalysis.ts) */
function percentileBucket(pct: number): (typeof BUCKETS)[number] {
  if (pct <= 3) return 'bottom3';
  if (pct <= 10) return 'bottom10';
  if (pct <= 25) return 'bottom25';
  if (pct <= 50) return 'middle50';
  if (pct <= 75) return 'top25';
  if (pct <= 90) return 'top10';
  return 'top3';
}

export interface GrowthAnalysisTranslator {
  /** 한국어 원문 전체 문자열 → 번역 (미등록이면 원문 그대로) */
  text: (raw: string) => string;
  /** metric/level 코드 기반 title·comment·advice 번역 */
  field: (metric: string, level: string, field: GrowthCommentField, fallback: string) => string;
  /** percentileLabel 번역 (BMI는 범주, 키/몸무게는 백분위 버킷) */
  percentileLabel: (
    metric: string,
    level: string,
    percentile: number | undefined,
    fallback: string,
  ) => string;
  /** 종합 요약 번역 ('주의가 필요한 항목이 N개…' 포함) */
  overallSummary: (raw: string) => string;
  /** 'N세 M개월' 형태 월령 라벨 번역 (months 코드가 있으면 우선 사용) */
  ageLabel: (raw: string, months?: number) => string;
  /** '4~6회/일' 등 표준 범위의 한국어 단위 번역 */
  standardRange: (raw: string) => string;
  /** '제목: 조언' 형태 추천 문자열 번역 */
  recommendation: (raw: string) => string;
}

export function createGrowthAnalysisTranslator(
  t: TFunction,
  i18n: I18nInstance,
): GrowthAnalysisTranslator {
  const tKo = i18n.getFixedT('ko');

  // 한국어 원문 → 로케일 키 역참조 맵 (ko 카탈로그 = 백엔드 원문과 동일)
  const koToKey: Record<string, string> = {};
  const register = (key: string) => {
    const ko = tKo(key);
    if (typeof ko === 'string' && ko.length > 0) koToKey[ko] = key;
  };
  METRICS.forEach((m) =>
    LEVELS.forEach((l) =>
      FIELDS.forEach((f) => register(`growthAnalysisI18n.comments.${m}.${l}.${f}`)),
    ),
  );
  BUCKETS.forEach((b) => register(`growthAnalysisI18n.percentileBuckets.${b}`));
  LEVELS.forEach((l) => register(`growthAnalysisI18n.bmiCategories.${l}`));
  register('growthAnalysisI18n.overallSummary.allNormal');
  register('growthAnalysisI18n.overallSummary.mostlyGood');

  const text = (raw: string): string => {
    const key = koToKey[raw] ?? koToKey[raw.trim()];
    return key ? t(key) : raw;
  };

  const field = (
    metric: string,
    level: string,
    fieldName: GrowthCommentField,
    fallback: string,
  ): string => {
    if (!fallback) return fallback;
    if (METRIC_SET.has(metric) && LEVEL_SET.has(level)) {
      return t(`growthAnalysisI18n.comments.${metric}.${level}.${fieldName}`);
    }
    return text(fallback);
  };

  const percentileLabel = (
    metric: string,
    level: string,
    percentile: number | undefined,
    fallback: string,
  ): string => {
    if (metric === 'bmi') {
      if (LEVEL_SET.has(level)) return t(`growthAnalysisI18n.bmiCategories.${level}`);
      return text(fallback);
    }
    if (typeof percentile === 'number' && Number.isFinite(percentile)) {
      return t(`growthAnalysisI18n.percentileBuckets.${percentileBucket(percentile)}`);
    }
    return text(fallback);
  };

  const overallSummary = (raw: string): string => {
    const warn = raw.match(/^주의가 필요한 항목이 (\d+)개 있어요\. 해당 항목의 조언을 확인해주세요\.$/);
    if (warn) return t('growthAnalysisI18n.overallSummary.warning', { count: Number(warn[1]) });
    return text(raw);
  };

  const ageLabel = (raw: string, months?: number): string => {
    if (typeof months === 'number' && Number.isFinite(months) && months >= 0) {
      return formatAgeLabel(t, Math.floor(months));
    }
    const ym = raw.match(/^(\d+)세 (\d+)개월$/);
    if (ym) return formatAgeLabel(t, Number(ym[1]) * 12 + Number(ym[2]));
    const y = raw.match(/^(\d+)세$/);
    if (y) return formatAgeLabel(t, Number(y[1]) * 12);
    const m = raw.match(/^(\d+)개월$/);
    if (m) return formatAgeLabel(t, Number(m[1]));
    return raw;
  };

  const standardRange = (raw: string): string => {
    const match = raw.match(/^(.+?)(회\/일|시간\/일)$/);
    if (!match) return raw;
    const unitKey = match[2] === '회/일' ? 'perDayCount' : 'perDayHours';
    return `${match[1]}${t(`growthAnalysisI18n.units.${unitKey}`)}`;
  };

  const recommendation = (raw: string): string => {
    const idx = raw.indexOf(': ');
    if (idx < 0) return text(raw);
    return `${text(raw.slice(0, idx))}: ${text(raw.slice(idx + 2))}`;
  };

  return { text, field, percentileLabel, overallSummary, ageLabel, standardRange, recommendation };
}

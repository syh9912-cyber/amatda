import type { TFunction } from 'i18next';

/**
 * 개월수 → 표시 언어 나이 라벨.
 * 백엔드 ageInfo.label(한국어 고정: '2세 6개월' 등) 대신 클라이언트에서 조립할 때 사용.
 * home.age.* 키 재사용: months(N개월) / years(N세) / yearsMonths(N세 M개월).
 */
export function formatAgeLabel(t: TFunction, months: number): string {
  if (!Number.isFinite(months) || months < 0) return '';
  if (months < 12) return t('home.age.months', { count: months });
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return t('home.age.years', { count: years });
  return t('home.age.yearsMonths', { years, months: rest });
}

/**
 * 절기(節氣) 데이터 — 월주 정확한 계산을 위한 절입 시간
 *
 * 기질 분석에서 월주는 음력 월이 아닌 절기를 기준으로 변합니다.
 * 예: 입춘(2월 4일경) ~ 경칩(3월 6일경) = 인월(1월)
 *
 * 아래는 양력 날짜 기준 각 월의 절기 시작일 (평균값)
 * 실제 정밀 만세력에서는 매년 달라지지만, 1~2일 오차 범위.
 */

export interface SolarTerm {
  month: number;   // 기질 월 (1=인월 ~ 12=축월)
  name: string;    // 절기명
  solarMonth: number;  // 양력 월
  solarDay: number;    // 양력 시작일 (평균)
  branch: string;  // 월지
}

export const SOLAR_TERMS: SolarTerm[] = [
  { month: 1,  name: '입춘', solarMonth: 2,  solarDay: 4,  branch: '인' },
  { month: 2,  name: '경칩', solarMonth: 3,  solarDay: 6,  branch: '묘' },
  { month: 3,  name: '청명', solarMonth: 4,  solarDay: 5,  branch: '진' },
  { month: 4,  name: '입하', solarMonth: 5,  solarDay: 6,  branch: '사' },
  { month: 5,  name: '망종', solarMonth: 6,  solarDay: 6,  branch: '오' },
  { month: 6,  name: '소서', solarMonth: 7,  solarDay: 7,  branch: '미' },
  { month: 7,  name: '입추', solarMonth: 8,  solarDay: 7,  branch: '신' },
  { month: 8,  name: '백로', solarMonth: 9,  solarDay: 8,  branch: '유' },
  { month: 9,  name: '한로', solarMonth: 10, solarDay: 8,  branch: '술' },
  { month: 10, name: '입동', solarMonth: 11, solarDay: 7,  branch: '해' },
  { month: 11, name: '대설', solarMonth: 12, solarDay: 7,  branch: '자' },
  { month: 12, name: '소한', solarMonth: 1,  solarDay: 6,  branch: '축' },
];

/**
 * 양력 날짜로 절기 기반 기질 월 번호를 구합니다.
 * @returns 기질 월 (1~12, 1=인월/입춘~경칩)
 */
export function getSajuMonthByTerm(solarMonth: number, solarDay: number): number {
  // 역순 탐색 — 현재 날짜가 어느 절기 이후인지 체크
  for (let i = SOLAR_TERMS.length - 1; i >= 0; i--) {
    const term = SOLAR_TERMS[i];
    if (
      solarMonth > term.solarMonth ||
      (solarMonth === term.solarMonth && solarDay >= term.solarDay)
    ) {
      return term.month;
    }
  }
  // 1월 1일~소한 이전 = 전년도 12월(축월)
  return 12;
}

/**
 * 절기 기�� 월지(月支) 반환
 */
export function getMonthBranchByTerm(solarMonth: number, solarDay: number): string {
  const sajuMonth = getSajuMonthByTerm(solarMonth, solarDay);
  const term = SOLAR_TERMS.find((t) => t.month === sajuMonth);
  return term?.branch ?? '인';
}

/**
 * 연도별 절기 상세 데이터 (2015~2030)
 * 정밀 만세력을 위한 연도별 절입 날짜
 */
export const YEARLY_SOLAR_TERMS: Record<number, { month: number; day: number }[]> = {
  2015: [{month:2,day:4},{month:3,day:6},{month:4,day:5},{month:5,day:6},{month:6,day:6},{month:7,day:7},{month:8,day:8},{month:9,day:8},{month:10,day:8},{month:11,day:8},{month:12,day:7},{month:1,day:6}],
  2016: [{month:2,day:4},{month:3,day:5},{month:4,day:4},{month:5,day:5},{month:6,day:5},{month:7,day:7},{month:8,day:7},{month:9,day:7},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2017: [{month:2,day:3},{month:3,day:5},{month:4,day:4},{month:5,day:5},{month:6,day:5},{month:7,day:7},{month:8,day:7},{month:9,day:7},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2018: [{month:2,day:4},{month:3,day:6},{month:4,day:5},{month:5,day:5},{month:6,day:6},{month:7,day:7},{month:8,day:7},{month:9,day:8},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2019: [{month:2,day:4},{month:3,day:6},{month:4,day:5},{month:5,day:6},{month:6,day:6},{month:7,day:7},{month:8,day:8},{month:9,day:8},{month:10,day:8},{month:11,day:8},{month:12,day:7},{month:1,day:6}],
  2020: [{month:2,day:4},{month:3,day:5},{month:4,day:4},{month:5,day:5},{month:6,day:5},{month:7,day:6},{month:8,day:7},{month:9,day:7},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2021: [{month:2,day:3},{month:3,day:5},{month:4,day:4},{month:5,day:5},{month:6,day:5},{month:7,day:7},{month:8,day:7},{month:9,day:7},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2022: [{month:2,day:4},{month:3,day:6},{month:4,day:5},{month:5,day:5},{month:6,day:6},{month:7,day:7},{month:8,day:7},{month:9,day:8},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2023: [{month:2,day:4},{month:3,day:6},{month:4,day:5},{month:5,day:6},{month:6,day:6},{month:7,day:7},{month:8,day:8},{month:9,day:8},{month:10,day:8},{month:11,day:8},{month:12,day:7},{month:1,day:6}],
  2024: [{month:2,day:4},{month:3,day:5},{month:4,day:4},{month:5,day:5},{month:6,day:5},{month:7,day:6},{month:8,day:7},{month:9,day:7},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2025: [{month:2,day:3},{month:3,day:5},{month:4,day:4},{month:5,day:5},{month:6,day:5},{month:7,day:7},{month:8,day:7},{month:9,day:7},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2026: [{month:2,day:4},{month:3,day:6},{month:4,day:5},{month:5,day:5},{month:6,day:6},{month:7,day:7},{month:8,day:7},{month:9,day:8},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2027: [{month:2,day:4},{month:3,day:6},{month:4,day:5},{month:5,day:6},{month:6,day:6},{month:7,day:7},{month:8,day:8},{month:9,day:8},{month:10,day:8},{month:11,day:8},{month:12,day:7},{month:1,day:6}],
  2028: [{month:2,day:4},{month:3,day:5},{month:4,day:4},{month:5,day:5},{month:6,day:5},{month:7,day:6},{month:8,day:7},{month:9,day:7},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2029: [{month:2,day:3},{month:3,day:5},{month:4,day:4},{month:5,day:5},{month:6,day:5},{month:7,day:7},{month:8,day:7},{month:9,day:7},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
  2030: [{month:2,day:4},{month:3,day:6},{month:4,day:5},{month:5,day:5},{month:6,day:6},{month:7,day:7},{month:8,day:7},{month:9,day:8},{month:10,day:8},{month:11,day:7},{month:12,day:7},{month:1,day:5}],
};

/**
 * 정밀 절기 기반 기질 월 구하기 (연도별 데이터 활용)
 */
export function getPreciseSajuMonth(year: number, solarMonth: number, solarDay: number): number {
  const yearData = YEARLY_SOLAR_TERMS[year];
  if (!yearData) {
    return getSajuMonthByTerm(solarMonth, solarDay);
  }

  // yearData[i]가 절기 i+1의 절입일
  for (let i = yearData.length - 1; i >= 0; i--) {
    const entry = yearData[i];
    if (
      solarMonth > entry.month ||
      (solarMonth === entry.month && solarDay >= entry.day)
    ) {
      return (i % 12) + 1;
    }
  }
  return 12;
}

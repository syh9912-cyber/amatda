/**
 * WHO 성장 표준 데이터 (남아/여아 0~144개월)
 * 백분위: p3, p10, p25, p50, p75, p90, p97
 * 출처: WHO Child Growth Standards + 대한소아과학회 표준성장도표
 */

/* ─── Types ─── */

export interface Percentiles {
  p3: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p97: number;
}

export interface GrowthEntry {
  months: number;
  height: Percentiles; // cm
  weight: Percentiles; // kg
}

export type GrowthLevel = 'very_low' | 'low' | 'normal' | 'high' | 'very_high';

/* ─── 남아 성장 표준 (0~144개월, 주요 시점) ─── */

export const BOYS_GROWTH: GrowthEntry[] = [
  { months: 0, height: { p3: 46.3, p10: 47.5, p25: 48.6, p50: 49.9, p75: 51.1, p90: 52.3, p97: 53.4 }, weight: { p3: 2.5, p10: 2.8, p25: 3.0, p50: 3.3, p75: 3.7, p90: 4.0, p97: 4.3 } },
  { months: 1, height: { p3: 50.2, p10: 51.4, p25: 52.7, p50: 54.0, p75: 55.3, p90: 56.5, p97: 57.6 }, weight: { p3: 3.4, p10: 3.8, p25: 4.1, p50: 4.5, p75: 5.0, p90: 5.4, p97: 5.8 } },
  { months: 2, height: { p3: 53.2, p10: 54.6, p25: 55.9, p50: 57.3, p75: 58.8, p90: 60.0, p97: 61.2 }, weight: { p3: 4.3, p10: 4.7, p25: 5.1, p50: 5.6, p75: 6.2, p90: 6.7, p97: 7.1 } },
  { months: 3, height: { p3: 55.7, p10: 57.1, p25: 58.5, p50: 60.0, p75: 61.4, p90: 62.7, p97: 63.9 }, weight: { p3: 5.0, p10: 5.4, p25: 5.9, p50: 6.4, p75: 7.0, p90: 7.5, p97: 8.0 } },
  { months: 4, height: { p3: 57.6, p10: 59.1, p25: 60.5, p50: 62.1, p75: 63.5, p90: 64.9, p97: 66.1 }, weight: { p3: 5.6, p10: 6.0, p25: 6.5, p50: 7.0, p75: 7.6, p90: 8.2, p97: 8.7 } },
  { months: 5, height: { p3: 59.2, p10: 60.7, p25: 62.2, p50: 63.8, p75: 65.3, p90: 66.7, p97: 68.0 }, weight: { p3: 6.0, p10: 6.5, p25: 7.0, p50: 7.5, p75: 8.1, p90: 8.7, p97: 9.3 } },
  { months: 6, height: { p3: 60.5, p10: 62.1, p25: 63.6, p50: 65.2, p75: 66.8, p90: 68.2, p97: 69.6 }, weight: { p3: 6.4, p10: 6.9, p25: 7.4, p50: 7.9, p75: 8.6, p90: 9.2, p97: 9.8 } },
  { months: 9, height: { p3: 64.0, p10: 65.7, p25: 67.3, p50: 69.0, p75: 70.6, p90: 72.2, p97: 73.6 }, weight: { p3: 7.1, p10: 7.7, p25: 8.3, p50: 8.9, p75: 9.6, p90: 10.3, p97: 10.9 } },
  { months: 12, height: { p3: 68.0, p10: 69.8, p25: 71.5, p50: 73.3, p75: 75.1, p90: 76.7, p97: 78.2 }, weight: { p3: 7.7, p10: 8.4, p25: 9.0, p50: 9.6, p75: 10.4, p90: 11.2, p97: 11.8 } },
  { months: 15, height: { p3: 71.2, p10: 73.1, p25: 74.9, p50: 76.9, p75: 78.8, p90: 80.5, p97: 82.1 }, weight: { p3: 8.2, p10: 8.9, p25: 9.6, p50: 10.3, p75: 11.1, p90: 11.9, p97: 12.6 } },
  { months: 18, height: { p3: 74.0, p10: 76.0, p25: 78.0, p50: 80.2, p75: 82.2, p90: 84.0, p97: 85.7 }, weight: { p3: 8.6, p10: 9.4, p25: 10.1, p50: 10.9, p75: 11.7, p90: 12.5, p97: 13.3 } },
  { months: 24, height: { p3: 79.3, p10: 81.5, p25: 83.6, p50: 86.0, p75: 88.2, p90: 90.3, p97: 92.1 }, weight: { p3: 9.6, p10: 10.5, p25: 11.3, p50: 12.2, p75: 13.2, p90: 14.2, p97: 15.0 } },
  { months: 30, height: { p3: 83.5, p10: 85.9, p25: 88.2, p50: 90.7, p75: 93.1, p90: 95.3, p97: 97.3 }, weight: { p3: 10.5, p10: 11.4, p25: 12.4, p50: 13.3, p75: 14.5, p90: 15.5, p97: 16.5 } },
  { months: 36, height: { p3: 87.0, p10: 89.6, p25: 92.1, p50: 94.9, p75: 97.5, p90: 99.8, p97: 101.9 }, weight: { p3: 11.3, p10: 12.3, p25: 13.3, p50: 14.3, p75: 15.5, p90: 16.7, p97: 17.7 } },
  { months: 42, height: { p3: 90.5, p10: 93.2, p25: 95.8, p50: 98.7, p75: 101.5, p90: 103.9, p97: 106.1 }, weight: { p3: 12.0, p10: 13.1, p25: 14.2, p50: 15.3, p75: 16.6, p90: 17.8, p97: 19.0 } },
  { months: 48, height: { p3: 93.5, p10: 96.4, p25: 99.2, p50: 102.3, p75: 105.2, p90: 107.8, p97: 110.1 }, weight: { p3: 12.7, p10: 13.9, p25: 15.0, p50: 16.3, p75: 17.7, p90: 19.1, p97: 20.3 } },
  { months: 54, height: { p3: 96.4, p10: 99.4, p25: 102.4, p50: 105.6, p75: 108.7, p90: 111.5, p97: 113.9 }, weight: { p3: 13.4, p10: 14.7, p25: 15.9, p50: 17.3, p75: 18.9, p90: 20.4, p97: 21.8 } },
  { months: 60, height: { p3: 99.0, p10: 102.2, p25: 105.3, p50: 108.7, p75: 111.9, p90: 114.8, p97: 117.4 }, weight: { p3: 14.1, p10: 15.4, p25: 16.8, p50: 18.3, p75: 20.0, p90: 21.7, p97: 23.3 } },
  { months: 72, height: { p3: 103.8, p10: 107.3, p25: 110.7, p50: 114.4, p75: 118.0, p90: 121.1, p97: 123.8 }, weight: { p3: 15.5, p10: 17.1, p25: 18.7, p50: 20.5, p75: 22.6, p90: 24.7, p97: 26.7 } },
  { months: 84, height: { p3: 108.4, p10: 112.2, p25: 115.8, p50: 119.8, p75: 123.6, p90: 126.9, p97: 129.8 }, weight: { p3: 17.0, p10: 18.9, p25: 20.8, p50: 23.1, p75: 25.6, p90: 28.2, p97: 30.7 } },
  { months: 96, height: { p3: 112.8, p10: 116.8, p25: 120.7, p50: 124.9, p75: 128.9, p90: 132.4, p97: 135.5 }, weight: { p3: 18.7, p10: 21.0, p25: 23.3, p50: 26.0, p75: 29.2, p90: 32.4, p97: 35.5 } },
  { months: 108, height: { p3: 117.0, p10: 121.2, p25: 125.3, p50: 129.7, p75: 134.0, p90: 137.7, p97: 140.9 }, weight: { p3: 20.5, p10: 23.2, p25: 26.0, p50: 29.2, p75: 33.1, p90: 37.0, p97: 40.8 } },
  { months: 120, height: { p3: 121.2, p10: 125.6, p25: 129.9, p50: 134.5, p75: 139.0, p90: 142.9, p97: 146.3 }, weight: { p3: 22.5, p10: 25.7, p25: 29.0, p50: 32.8, p75: 37.4, p90: 42.1, p97: 46.7 } },
  { months: 132, height: { p3: 125.5, p10: 130.2, p25: 134.7, p50: 139.6, p75: 144.3, p90: 148.4, p97: 152.0 }, weight: { p3: 24.8, p10: 28.5, p25: 32.3, p50: 36.8, p75: 42.2, p90: 47.7, p97: 53.2 } },
  { months: 144, height: { p3: 130.0, p10: 135.0, p25: 139.8, p50: 145.0, p75: 150.0, p90: 154.3, p97: 158.0 }, weight: { p3: 27.4, p10: 31.6, p25: 36.0, p50: 41.2, p75: 47.4, p90: 53.8, p97: 60.2 } },
];

/* ─── 여아 성장 표준 ─── */

export const GIRLS_GROWTH: GrowthEntry[] = [
  { months: 0, height: { p3: 45.6, p10: 46.8, p25: 47.9, p50: 49.1, p75: 50.3, p90: 51.4, p97: 52.5 }, weight: { p3: 2.4, p10: 2.6, p25: 2.9, p50: 3.2, p75: 3.6, p90: 3.9, p97: 4.2 } },
  { months: 1, height: { p3: 49.0, p10: 50.2, p25: 51.4, p50: 52.7, p75: 54.0, p90: 55.1, p97: 56.2 }, weight: { p3: 3.2, p10: 3.5, p25: 3.8, p50: 4.2, p75: 4.6, p90: 5.0, p97: 5.4 } },
  { months: 2, height: { p3: 52.0, p10: 53.3, p25: 54.5, p50: 55.9, p75: 57.3, p90: 58.5, p97: 59.6 }, weight: { p3: 3.9, p10: 4.3, p25: 4.7, p50: 5.1, p75: 5.6, p90: 6.1, p97: 6.6 } },
  { months: 3, height: { p3: 54.4, p10: 55.7, p25: 57.1, p50: 58.5, p75: 59.9, p90: 61.2, p97: 62.3 }, weight: { p3: 4.5, p10: 4.9, p25: 5.4, p50: 5.8, p75: 6.4, p90: 6.9, p97: 7.4 } },
  { months: 4, height: { p3: 56.3, p10: 57.7, p25: 59.1, p50: 60.6, p75: 62.1, p90: 63.4, p97: 64.6 }, weight: { p3: 5.0, p10: 5.4, p25: 5.9, p50: 6.4, p75: 7.0, p90: 7.5, p97: 8.1 } },
  { months: 5, height: { p3: 57.8, p10: 59.3, p25: 60.8, p50: 62.4, p75: 63.9, p90: 65.2, p97: 66.5 }, weight: { p3: 5.4, p10: 5.8, p25: 6.3, p50: 6.9, p75: 7.5, p90: 8.1, p97: 8.7 } },
  { months: 6, height: { p3: 59.2, p10: 60.7, p25: 62.2, p50: 63.8, p75: 65.4, p90: 66.8, p97: 68.1 }, weight: { p3: 5.7, p10: 6.2, p25: 6.7, p50: 7.3, p75: 7.9, p90: 8.5, p97: 9.2 } },
  { months: 9, height: { p3: 62.7, p10: 64.3, p25: 66.0, p50: 67.7, p75: 69.4, p90: 70.9, p97: 72.3 }, weight: { p3: 6.5, p10: 7.1, p25: 7.7, p50: 8.4, p75: 9.1, p90: 9.8, p97: 10.5 } },
  { months: 12, height: { p3: 66.3, p10: 68.0, p25: 69.8, p50: 71.6, p75: 73.4, p90: 75.0, p97: 76.5 }, weight: { p3: 7.0, p10: 7.7, p25: 8.4, p50: 9.0, p75: 9.8, p90: 10.6, p97: 11.4 } },
  { months: 15, height: { p3: 69.3, p10: 71.2, p25: 73.0, p50: 75.0, p75: 76.9, p90: 78.6, p97: 80.2 }, weight: { p3: 7.5, p10: 8.2, p25: 8.9, p50: 9.6, p75: 10.5, p90: 11.3, p97: 12.1 } },
  { months: 18, height: { p3: 72.0, p10: 74.0, p25: 75.9, p50: 78.0, p75: 80.0, p90: 81.9, p97: 83.6 }, weight: { p3: 8.0, p10: 8.7, p25: 9.4, p50: 10.2, p75: 11.1, p90: 11.9, p97: 12.8 } },
  { months: 24, height: { p3: 76.7, p10: 78.9, p25: 81.0, p50: 83.3, p75: 85.5, p90: 87.5, p97: 89.3 }, weight: { p3: 8.9, p10: 9.8, p25: 10.6, p50: 11.5, p75: 12.6, p90: 13.6, p97: 14.6 } },
  { months: 30, height: { p3: 80.8, p10: 83.2, p25: 85.5, p50: 88.0, p75: 90.4, p90: 92.6, p97: 94.5 }, weight: { p3: 9.7, p10: 10.7, p25: 11.7, p50: 12.7, p75: 13.9, p90: 15.0, p97: 16.1 } },
  { months: 36, height: { p3: 84.5, p10: 87.1, p25: 89.6, p50: 92.3, p75: 94.9, p90: 97.3, p97: 99.3 }, weight: { p3: 10.6, p10: 11.6, p25: 12.6, p50: 13.9, p75: 15.2, p90: 16.4, p97: 17.6 } },
  { months: 42, height: { p3: 87.8, p10: 90.6, p25: 93.3, p50: 96.2, p75: 99.0, p90: 101.5, p97: 103.7 }, weight: { p3: 11.3, p10: 12.5, p25: 13.6, p50: 14.9, p75: 16.4, p90: 17.8, p97: 19.2 } },
  { months: 48, height: { p3: 90.9, p10: 93.9, p25: 96.8, p50: 99.8, p75: 102.8, p90: 105.5, p97: 107.8 }, weight: { p3: 12.1, p10: 13.3, p25: 14.5, p50: 16.0, p75: 17.6, p90: 19.2, p97: 20.8 } },
  { months: 54, height: { p3: 93.8, p10: 96.9, p25: 100.0, p50: 103.3, p75: 106.5, p90: 109.3, p97: 111.8 }, weight: { p3: 12.8, p10: 14.1, p25: 15.5, p50: 17.0, p75: 18.8, p90: 20.6, p97: 22.4 } },
  { months: 60, height: { p3: 96.5, p10: 99.8, p25: 103.1, p50: 106.5, p75: 109.9, p90: 112.9, p97: 115.5 }, weight: { p3: 13.5, p10: 14.9, p25: 16.4, p50: 18.1, p75: 20.1, p90: 22.1, p97: 24.1 } },
  { months: 72, height: { p3: 101.5, p10: 105.1, p25: 108.7, p50: 112.6, p75: 116.4, p90: 119.6, p97: 122.4 }, weight: { p3: 14.9, p10: 16.6, p25: 18.4, p50: 20.5, p75: 23.0, p90: 25.6, p97: 28.1 } },
  { months: 84, height: { p3: 106.2, p10: 110.1, p25: 113.9, p50: 118.1, p75: 122.2, p90: 125.6, p97: 128.6 }, weight: { p3: 16.4, p10: 18.5, p25: 20.6, p50: 23.2, p75: 26.3, p90: 29.5, p97: 32.7 } },
  { months: 96, height: { p3: 110.7, p10: 114.9, p25: 119.0, p50: 123.4, p75: 127.7, p90: 131.3, p97: 134.5 }, weight: { p3: 18.1, p10: 20.6, p25: 23.2, p50: 26.3, p75: 30.1, p90: 34.0, p97: 38.0 } },
  { months: 108, height: { p3: 115.2, p10: 119.7, p25: 124.0, p50: 128.7, p75: 133.3, p90: 137.1, p97: 140.4 }, weight: { p3: 20.1, p10: 23.0, p25: 26.1, p50: 29.8, p75: 34.4, p90: 39.1, p97: 43.9 } },
  { months: 120, height: { p3: 119.8, p10: 124.5, p25: 129.1, p50: 134.0, p75: 138.9, p90: 143.0, p97: 146.5 }, weight: { p3: 22.3, p10: 25.8, p25: 29.5, p50: 33.8, p75: 39.3, p90: 44.9, p97: 50.6 } },
  { months: 132, height: { p3: 124.5, p10: 129.5, p25: 134.3, p50: 139.5, p75: 144.6, p90: 148.9, p97: 152.6 }, weight: { p3: 24.9, p10: 29.0, p25: 33.3, p50: 38.4, p75: 44.7, p90: 51.2, p97: 57.8 } },
  { months: 144, height: { p3: 129.5, p10: 134.8, p25: 139.8, p50: 145.3, p75: 150.6, p90: 155.1, p97: 158.9 }, weight: { p3: 27.8, p10: 32.5, p25: 37.5, p50: 43.3, p75: 50.5, p90: 57.8, p97: 65.0 } },
];

/* ─── 육아 패턴 표준 (월령별) ─── */

export interface TrackerStandard {
  ageRange: [number, number]; // [from, to] months
  label: string;
  diaper: { min: number; max: number; avg: number; unit: string };
  feeding: { min: number; max: number; avg: number; unit: string; detail: string };
  sleep: { min: number; max: number; avg: number; unit: string; detail: string };
}

export const TRACKER_STANDARDS: TrackerStandard[] = [
  {
    ageRange: [0, 1],
    label: '신생아',
    diaper: { min: 6, max: 10, avg: 8, unit: '회/일' },
    feeding: { min: 8, max: 12, avg: 10, unit: '회/일', detail: '2~3시간 간격, 1회 60~90ml' },
    sleep: { min: 14, max: 18, avg: 16, unit: '시간/일', detail: '수유 간격마다 잠, 밤낮 구분 없음' },
  },
  {
    ageRange: [1, 3],
    label: '1~3개월',
    diaper: { min: 5, max: 8, avg: 6, unit: '회/일' },
    feeding: { min: 6, max: 10, avg: 8, unit: '회/일', detail: '3시간 간격, 1회 90~150ml' },
    sleep: { min: 14, max: 17, avg: 15, unit: '시간/일', detail: '낮잠 3~4회, 밤잠 점차 길어짐' },
  },
  {
    ageRange: [3, 6],
    label: '3~6개월',
    diaper: { min: 4, max: 7, avg: 5, unit: '회/일' },
    feeding: { min: 5, max: 8, avg: 6, unit: '회/일', detail: '3~4시간 간격, 1회 150~200ml' },
    sleep: { min: 12, max: 16, avg: 14, unit: '시간/일', detail: '낮잠 2~3회, 밤잠 6~8시간 연속' },
  },
  {
    ageRange: [6, 9],
    label: '6~9개월',
    diaper: { min: 4, max: 6, avg: 5, unit: '회/일' },
    feeding: { min: 4, max: 6, avg: 5, unit: '회/일', detail: '이유식 1~2회 + 수유 3~4회' },
    sleep: { min: 12, max: 15, avg: 14, unit: '시간/일', detail: '낮잠 2회, 밤잠 10~12시간' },
  },
  {
    ageRange: [9, 12],
    label: '9~12개월',
    diaper: { min: 4, max: 6, avg: 5, unit: '회/일' },
    feeding: { min: 4, max: 6, avg: 5, unit: '회/일', detail: '이유식 3회 + 수유 2~3회' },
    sleep: { min: 12, max: 14, avg: 13, unit: '시간/일', detail: '낮잠 1~2회, 밤잠 10~12시간' },
  },
  {
    ageRange: [12, 18],
    label: '12~18개월',
    diaper: { min: 3, max: 6, avg: 4, unit: '회/일' },
    feeding: { min: 3, max: 5, avg: 4, unit: '회/일', detail: '유아식 3회 + 간식 1~2회' },
    sleep: { min: 11, max: 14, avg: 13, unit: '시간/일', detail: '낮잠 1회(2시간), 밤잠 10~12시간' },
  },
  {
    ageRange: [18, 24],
    label: '18~24개월',
    diaper: { min: 3, max: 5, avg: 4, unit: '회/일' },
    feeding: { min: 3, max: 5, avg: 4, unit: '회/일', detail: '유아식 3회 + 간식 1~2회' },
    sleep: { min: 11, max: 14, avg: 12.5, unit: '시간/일', detail: '낮잠 1회(1.5~2시간), 밤잠 10~11시간' },
  },
  {
    ageRange: [24, 36],
    label: '2~3세',
    diaper: { min: 2, max: 5, avg: 3, unit: '회/일' },
    feeding: { min: 3, max: 5, avg: 4, unit: '회/일', detail: '식사 3회 + 간식 1~2회' },
    sleep: { min: 10, max: 13, avg: 12, unit: '시간/일', detail: '낮잠 0~1회, 밤잠 10~11시간' },
  },
  {
    ageRange: [36, 60],
    label: '3~5세',
    diaper: { min: 1, max: 4, avg: 2, unit: '회/일' },
    feeding: { min: 3, max: 5, avg: 4, unit: '회/일', detail: '식사 3회 + 간식 1~2회' },
    sleep: { min: 10, max: 13, avg: 11, unit: '시간/일', detail: '낮잠 서서히 줄어듦, 밤잠 10~11시간' },
  },
  {
    ageRange: [60, 84],
    label: '5~7세',
    diaper: { min: 1, max: 3, avg: 2, unit: '회/일' },
    feeding: { min: 3, max: 4, avg: 3, unit: '회/일', detail: '식사 3회 + 간식 1회' },
    sleep: { min: 9, max: 12, avg: 10.5, unit: '시간/일', detail: '낮잠 없음, 밤잠 9~11시간' },
  },
  {
    ageRange: [84, 144],
    label: '초등학생',
    diaper: { min: 1, max: 3, avg: 2, unit: '회/일' },
    feeding: { min: 3, max: 4, avg: 3, unit: '회/일', detail: '식사 3회 + 간식 0~1회' },
    sleep: { min: 8, max: 11, avg: 10, unit: '시간/일', detail: '밤잠 9~10시간 권장' },
  },
];

/* ─── 분석 코멘트 DB (시나리오별) ─── */

export interface AnalysisComment {
  metric: 'height' | 'weight' | 'bmi' | 'diaper' | 'feeding' | 'sleep';
  level: GrowthLevel;
  title: string;
  comment: string;
  advice: string;
  emoji: string;
}

export const ANALYSIS_COMMENTS: AnalysisComment[] = [
  // ── 키 ──
  { metric: 'height', level: 'very_low', title: '키가 또래보다 작아요', emoji: '📏',
    comment: '하위 3% 미만입니다. 성장 지연 가능성이 있어요.',
    advice: '소아과에서 성장판 검사를 받아보세요. 충분한 수면(밤 10시 이전 취침)과 균형 잡힌 식단, 그리고 규칙적인 운동이 성장에 도움돼요. 스트레칭과 줄넘기도 좋습니다.' },
  { metric: 'height', level: 'low', title: '키가 약간 작은 편이에요', emoji: '📏',
    comment: '하위 10~25% 범위입니다. 정상 범위 내이지만 관심이 필요해요.',
    advice: '성장에 좋은 음식(우유, 달걀, 콩, 생선)을 충분히 섭취하고, 밤 10시 전 취침 습관을 만들어주세요. 성장호르몬은 밤 10시~새벽 2시에 가장 많이 분비됩니다.' },
  { metric: 'height', level: 'normal', title: '키가 또래와 비슷해요', emoji: '📏',
    comment: '25~75% 범위로 또래 평균 수준입니다.',
    advice: '현재 성장 속도가 좋습니다! 규칙적인 식사와 충분한 수면, 적절한 운동을 유지하면 건강하게 자랄 거예요. 6개월마다 키를 측정해서 성장 추이를 확인하세요.' },
  { metric: 'height', level: 'high', title: '키가 큰 편이에요', emoji: '📏',
    comment: '상위 10~25% 범위입니다. 또래보다 큰 편이에요.',
    advice: '키 성장이 좋은 편입니다. 바른 자세를 유지하는 것이 중요해요. 스마트폰이나 게임기 사용 시 목과 허리 자세를 주의하세요. 충분한 칼슘 섭취를 계속하세요.' },
  { metric: 'height', level: 'very_high', title: '키가 또래보다 많이 커요', emoji: '📏',
    comment: '상위 3% 이상입니다. 빠른 성장을 보이고 있어요.',
    advice: '조기 성장은 성조숙증 가능성도 있어요. 소아과에서 뼈 나이 검사를 받아보시면 좋겠습니다. 비만이 동반되지 않도록 균형 잡힌 식단과 운동을 유지하세요.' },

  // ── 몸무게 ──
  { metric: 'weight', level: 'very_low', title: '체중이 또래보다 적어요', emoji: '⚖️',
    comment: '하위 3% 미만입니다. 저체중에 해당해요.',
    advice: '소아과 상담을 권장합니다. 고칼로리 영양식(아보카도, 치즈, 올리브오일)을 추가하고, 식사 시간을 일정하게 유지해주세요. 스트레스로 인한 식욕 저하도 확인해보세요.' },
  { metric: 'weight', level: 'low', title: '체중이 약간 가벼운 편이에요', emoji: '⚖️',
    comment: '하위 10~25% 범위입니다. 정상이지만 관찰이 필요해요.',
    advice: '식사량이 부족하지 않은지 확인하세요. 간식으로 과일, 요거트, 견과류를 권장합니다. 편식이 심하다면 다양한 조리법으로 시도해보세요.' },
  { metric: 'weight', level: 'normal', title: '체중이 또래와 비슷해요', emoji: '⚖️',
    comment: '25~75% 범위로 정상 체중입니다.',
    advice: '현재 체중이 적절합니다! 균형 잡힌 식단(탄수화물, 단백질, 지방, 채소)을 유지하세요. 과자나 음료수보다 신선한 과일과 물을 권장합니다.' },
  { metric: 'weight', level: 'high', title: '체중이 많은 편이에요', emoji: '⚖️',
    comment: '상위 10~25% 범위입니다. 과체중 경향이 있어요.',
    advice: '식사량보다 활동량을 늘리는 것이 중요해요. 하루 1시간 이상 신체 활동을 하고, 단 음료와 과자를 줄여주세요. 급격한 다이어트는 성장에 좋지 않으니 자연스럽게 조절하세요.' },
  { metric: 'weight', level: 'very_high', title: '비만 주의가 필요해요', emoji: '⚖️',
    comment: '상위 3% 이상입니다. 소아비만에 해당할 수 있어요.',
    advice: '소아과에서 비만도 검사를 받아보세요. 소아비만은 성인 비만으로 이어질 수 있어요. TV/게임 시간을 줄이고 야외 활동을 늘려주세요. 가족이 함께 건강한 식습관을 만드는 것이 가장 효과적입니다.' },

  // ── BMI ──
  { metric: 'bmi', level: 'very_low', title: 'BMI가 매우 낮아요', emoji: '📊',
    comment: '키 대비 체중이 매우 적어요. 영양 상태를 확인해주세요.',
    advice: '고열량 고단백 식단을 보충하고, 감염 여부나 알레르기로 인한 영양 흡수 문제가 없는지 소아과에서 확인해보세요.' },
  { metric: 'bmi', level: 'low', title: 'BMI가 낮은 편이에요', emoji: '📊',
    comment: '키 대비 체중이 약간 적어요.',
    advice: '식사를 거르지 않고, 단백질(고기, 생선, 달걀, 콩)을 충분히 섭취하세요. 간식으로 견과류, 치즈, 바나나를 추천합니다.' },
  { metric: 'bmi', level: 'normal', title: 'BMI가 정상이에요', emoji: '📊',
    comment: '키 대비 체중이 적절합니다. 균형 잡힌 체형이에요.',
    advice: '현재 체형을 유지하세요! 꾸준한 운동과 균형 식단이 핵심입니다.' },
  { metric: 'bmi', level: 'high', title: 'BMI가 높은 편이에요', emoji: '📊',
    comment: '키 대비 체중이 많은 편입니다.',
    advice: '식사 속도를 천천히 하고, 야채를 먼저 먹는 습관을 들여주세요. 식후 가벼운 산책도 도움이 됩니다.' },
  { metric: 'bmi', level: 'very_high', title: 'BMI가 높아요', emoji: '📊',
    comment: '키 대비 체중이 많습니다. 관리가 필요해요.',
    advice: '소아과에서 상담을 받고, 가족 식단 개선과 함께 매일 30분 이상 활동량을 확보하세요.' },

  // ── 배변 ──
  { metric: 'diaper', level: 'very_low', title: '배변 횟수가 매우 적어요', emoji: '🧷',
    comment: '평균보다 배변 횟수가 현저히 적습니다.',
    advice: '변비 가능성이 있어요. 수분 섭취를 늘리고, 식이섬유가 풍부한 음식(고구마, 배, 푸룬)을 주세요. 2~3일 이상 변을 보지 않으면 소아과 상담을 권장합니다.' },
  { metric: 'diaper', level: 'low', title: '배변 횟수가 적은 편이에요', emoji: '🧷',
    comment: '정상 범위의 하단입니다.',
    advice: '물을 충분히 마시게 하고, 배 마사지(시계방향)를 해주세요. 유산균 섭취도 도움이 됩니다.' },
  { metric: 'diaper', level: 'normal', title: '배변 패턴이 좋아요', emoji: '🧷',
    comment: '또래 평균과 비슷한 배변 패턴입니다.',
    advice: '현재 패턴을 유지하세요! 일정한 시간에 식사하는 것이 규칙적인 배변에 도움됩니다.' },
  { metric: 'diaper', level: 'high', title: '배변 횟수가 많은 편이에요', emoji: '🧷',
    comment: '평균보다 배변 횟수가 많습니다.',
    advice: '설사가 아닌지 변의 형태를 관찰하세요. 찬 음식이나 과일을 과하게 먹으면 변이 묽어질 수 있어요. 열이 동반되면 소아과 방문을 권장합니다.' },
  { metric: 'diaper', level: 'very_high', title: '배변 횟수가 매우 많아요', emoji: '🧷',
    comment: '평균보다 현저히 많은 배변 횟수입니다.',
    advice: '잦은 설사는 탈수를 유발할 수 있어요. 이온 음료나 끓인 물을 자주 먹이고, 하루 5회 이상 물변이면 소아과에 방문하세요. 기저귀 발진도 주의해주세요.' },

  // ── 수유/식사 ──
  { metric: 'feeding', level: 'very_low', title: '식사 횟수가 매우 적어요', emoji: '🍼',
    comment: '평균보다 수유/식사 횟수가 현저히 적습니다.',
    advice: '성장에 필요한 영양이 부족할 수 있어요. 한 번에 많이 먹기보다 소량 자주 먹이는 방식을 시도하세요. 수유 거부가 심하면 소아과 상담이 필요합니다.' },
  { metric: 'feeding', level: 'low', title: '식사 횟수가 적은 편이에요', emoji: '🍼',
    comment: '정상 범위의 하단입니다.',
    advice: '식사 환경을 편안하게 만들어주세요. TV를 끄고, 식탁에 앉아서 천천히 먹는 습관을 들여주세요. 간식 시간을 줄이면 식사 시 배가 고파져서 잘 먹을 수 있어요.' },
  { metric: 'feeding', level: 'normal', title: '식사 패턴이 좋아요', emoji: '🍼',
    comment: '또래 평균과 비슷한 식사 패턴입니다.',
    advice: '현재 패턴을 유지하세요! 다양한 식재료를 경험하게 해주면 편식 예방에 도움됩니다.' },
  { metric: 'feeding', level: 'high', title: '식사 횟수가 많은 편이에요', emoji: '🍼',
    comment: '평균보다 수유/식사 횟수가 많습니다.',
    advice: '1회 식사량을 점검해보세요. 소량 잦은 수유는 위장에 부담을 줄 수 있어요. 식사 간격을 서서히 늘려주세요.' },
  { metric: 'feeding', level: 'very_high', title: '식사 횟수가 매우 많아요', emoji: '🍼',
    comment: '평균보다 현저히 많은 식사 횟수입니다.',
    advice: '과식으로 인한 체중 증가에 주의하세요. 배부름 신호(고개 돌리기, 숟가락 밀기)를 존중해주세요. 습관적인 수유(특히 밤중 수유)가 아닌지 확인하세요.' },

  // ── 수면 ──
  { metric: 'sleep', level: 'very_low', title: '수면 시간이 매우 부족해요', emoji: '😴',
    comment: '권장 수면 시간에 크게 못 미칩니다.',
    advice: '수면 부족은 성장호르몬 분비와 면역력에 직접 영향을 미칩니다. 일정한 취침 시간을 정하고, 취침 30분 전 스마트폰/TV를 끄세요. 어두운 환경과 적절한 실내 온도(20~22도)를 유지해주세요.' },
  { metric: 'sleep', level: 'low', title: '수면이 약간 부족한 편이에요', emoji: '😴',
    comment: '권장 수면 시간의 하단입니다.',
    advice: '취침 루틴(목욕→동화책→자장가)을 만들어주세요. 카페인이 든 음식(초콜릿, 탄산음료)은 오후에 피하고, 낮 동안 충분한 신체 활동을 하면 밤잠이 좋아집니다.' },
  { metric: 'sleep', level: 'normal', title: '수면 패턴이 좋아요', emoji: '😴',
    comment: '또래 권장 수면 시간을 잘 지키고 있어요.',
    advice: '현재 수면 패턴이 좋습니다! 주말에도 같은 시간에 자고 일어나면 생체 리듬이 안정됩니다. 규칙적인 수면이 키 성장에 핵심입니다.' },
  { metric: 'sleep', level: 'high', title: '수면 시간이 많은 편이에요', emoji: '😴',
    comment: '평균보다 수면 시간이 많습니다.',
    advice: '성장기에 충분한 수면은 좋지만, 낮 동안 무기력하거나 활동량이 적다면 수면의 질을 확인해보세요. 코골이나 수면무호흡이 있다면 이비인후과 상담을 권장합니다.' },
  { metric: 'sleep', level: 'very_high', title: '수면 시간이 매우 많아요', emoji: '😴',
    comment: '또래보다 현저히 오래 잡니다.',
    advice: '과도한 수면은 빈혈, 갑상선 기능 저하 등의 신호일 수 있어요. 깨어 있는 동안 활기가 있는지 관찰하고, 지속적으로 많이 자면 소아과 상담을 받아보세요.' },
];

/* ─── 헬퍼: 가장 가까운 월령의 성장 데이터 찾기 ─── */

export function findClosestEntry(data: GrowthEntry[], months: number): GrowthEntry {
  let closest = data[0];
  let minDiff = Math.abs(months - data[0].months);
  for (const entry of data) {
    const diff = Math.abs(months - entry.months);
    if (diff < minDiff) {
      minDiff = diff;
      closest = entry;
    }
  }
  return closest;
}

/* ─── 헬퍼: 값이 어느 백분위에 해당하는지 계산 ─── */

export function getPercentileLevel(value: number, p: Percentiles): { percentile: number; level: GrowthLevel } {
  if (value < p.p3) return { percentile: 1, level: 'very_low' };
  if (value < p.p10) return { percentile: 5, level: 'low' };
  if (value < p.p25) return { percentile: 15, level: 'low' };
  if (value < p.p50) return { percentile: 35, level: 'normal' };
  if (value < p.p75) return { percentile: 60, level: 'normal' };
  if (value < p.p90) return { percentile: 80, level: 'high' };
  if (value < p.p97) return { percentile: 93, level: 'high' };
  return { percentile: 98, level: 'very_high' };
}

/* ─── 헬퍼: 월령에 맞는 육아 패턴 표준 찾기 ─── */

export function findTrackerStandard(months: number): TrackerStandard {
  const match = TRACKER_STANDARDS.find(
    (s) => months >= s.ageRange[0] && months < s.ageRange[1],
  );
  return match ?? TRACKER_STANDARDS[TRACKER_STANDARDS.length - 1];
}

/* ─── 헬퍼: 실제값 vs 표준 범위 비교 ─── */

export function getTrackerLevel(
  value: number,
  standard: { min: number; max: number; avg: number },
): GrowthLevel {
  const range = standard.max - standard.min;
  const veryLow = standard.min - range * 0.3;
  const veryHigh = standard.max + range * 0.3;

  if (value <= veryLow) return 'very_low';
  if (value < standard.min) return 'low';
  if (value <= standard.max) return 'normal';
  if (value <= veryHigh) return 'high';
  return 'very_high';
}

/* ─── 헬퍼: 분석 코멘트 조회 ─── */

export function getComment(
  metric: AnalysisComment['metric'],
  level: GrowthLevel,
): AnalysisComment | undefined {
  return ANALYSIS_COMMENTS.find((c) => c.metric === metric && c.level === level);
}

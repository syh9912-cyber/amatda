import KoreanLunarCalendar from 'korean-lunar-calendar';
import { getPreciseSajuMonth, SOLAR_TERMS } from './solar-terms';

// 천간 (Heavenly Stems)
const HEAVENLY_STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
// 지지 (Earthly Branches)
const EARTHLY_BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;

// 천간 → 오행 매핑
const STEM_ELEMENT: Record<string, string> = {
  '갑': 'wood', '을': 'wood',
  '병': 'fire', '정': 'fire',
  '무': 'earth', '기': 'earth',
  '경': 'metal', '신': 'metal',
  '임': 'water', '계': 'water',
};

// 지지 → 오행 매핑
const BRANCH_ELEMENT: Record<string, string> = {
  '인': 'wood', '묘': 'wood',
  '사': 'fire', '오': 'fire',
  '진': 'earth', '술': 'earth', '축': 'earth', '미': 'earth',
  '신': 'metal', '유': 'metal',
  '해': 'water', '자': 'water',
};

// 기질 유형 라벨
const TYPE_LABELS: Record<string, string> = {
  wood: '탐구형',
  fire: '활동형',
  earth: '조화형',
  metal: '분석형',
  water: '감성형',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  wood: '호기심이 넘치고 새로운 것을 배우는 데 에너지를 쏟는 탐구형 기질',
  fire: '밝고 활발하며 자기표현이 강한 활동형 기질',
  earth: '안정적이고 조화를 중시하며 배려심이 깊은 조화형 기질',
  metal: '꼼꼼하고 집중력이 뛰어나며 논리적인 분석형 기질',
  water: '감수성이 풍부하고 적응력이 뛰어난 감성형 기질',
};

// 시주 지지 매핑 (일간 기준 시간대별)
const HOUR_BRANCH_INDEX: Record<number, number> = {
  23: 0, 0: 0,   // 자시
  1: 1, 2: 1,    // 축시
  3: 2, 4: 2,    // 인시
  5: 3, 6: 3,    // 묘시
  7: 4, 8: 4,    // 진시
  9: 5, 10: 5,   // 사시
  11: 6, 12: 6,  // 오시
  13: 7, 14: 7,  // 미시
  15: 8, 16: 8,  // 신시
  17: 9, 18: 9,  // 유시
  19: 10, 20: 10, // 술시
  21: 11, 22: 11, // 해시
};

// 시간 천간 계산 (일간 기준)
const HOUR_STEM_BASE: Record<number, number> = {
  0: 0, 1: 0,  // 갑,기일 → 갑자시 시작
  2: 2, 3: 2,  // 을,경일 → 병자시 시작
  4: 4, 5: 4,  // 병,신일 → 무자시 시작
  6: 6, 7: 6,  // 정,임일 → 경자시 시작
  8: 8, 9: 8,  // 무,계일 → 임자시 시작
};

interface SajuResult {
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  fiveElements: {
    wood: number;
    fire: number;
    earth: number;
    metal: number;
    water: number;
  };
  dominantType: string;
  label: string;
}

function getYearPillar(lunarYear: number): { stem: string; branch: string } {
  const stemIdx = (lunarYear - 4) % 10;
  const branchIdx = (lunarYear - 4) % 12;
  return {
    stem: HEAVENLY_STEMS[stemIdx >= 0 ? stemIdx : stemIdx + 10],
    branch: EARTHLY_BRANCHES[branchIdx >= 0 ? branchIdx : branchIdx + 12],
  };
}

function getMonthPillarByTerm(
  sajuMonth: number,
  yearStemIdx: number
): { stem: string; branch: string } {
  // 절기 기반 월지: 사주 월 1=인 ~ 12=축
  const term = SOLAR_TERMS.find((t) => t.month === sajuMonth);
  const branch = term?.branch ?? '인';
  const branchIdx = EARTHLY_BRANCHES.indexOf(branch as typeof EARTHLY_BRANCHES[number]);
  // 월간: 년간 기준 계산
  const baseIdx = (yearStemIdx % 5) * 2;
  const stemIdx = (baseIdx + sajuMonth - 1) % 10;
  return {
    stem: HEAVENLY_STEMS[stemIdx],
    branch: EARTHLY_BRANCHES[branchIdx >= 0 ? branchIdx : 0],
  };
}

function getDayPillar(solarYear: number, solarMonth: number, solarDay: number): { stem: string; branch: string; stemIdx: number } {
  // 기준일: 2000년 1월 1일 = 갑진(甲辰)일
  const baseDate = new Date(2000, 0, 1);
  const targetDate = new Date(solarYear, solarMonth - 1, solarDay);
  const diffDays = Math.floor(
    (targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 2000-01-01: 천간=경(6), 지지=진(4)
  const baseStemIdx = 6;
  const baseBranchIdx = 4;

  let stemIdx = (baseStemIdx + diffDays) % 10;
  let branchIdx = (baseBranchIdx + diffDays) % 12;
  if (stemIdx < 0) stemIdx += 10;
  if (branchIdx < 0) branchIdx += 12;

  return {
    stem: HEAVENLY_STEMS[stemIdx],
    branch: EARTHLY_BRANCHES[branchIdx],
    stemIdx,
  };
}

function getHourPillar(
  hour: number,
  dayStemIdx: number
): { stem: string; branch: string } {
  const branchIdx = HOUR_BRANCH_INDEX[hour] ?? 0;
  const base = HOUR_STEM_BASE[dayStemIdx % 5] ?? 0;
  const stemIdx = (base + branchIdx) % 10;
  return {
    stem: HEAVENLY_STEMS[stemIdx],
    branch: EARTHLY_BRANCHES[branchIdx],
  };
}

function countElements(pillars: { stem: string; branch: string }[]): Record<string, number> {
  const counts: Record<string, number> = {
    wood: 0, fire: 0, earth: 0, metal: 0, water: 0,
  };

  for (const p of pillars) {
    const stemEl = STEM_ELEMENT[p.stem];
    const branchEl = BRANCH_ELEMENT[p.branch];
    if (stemEl) counts[stemEl]++;
    if (branchEl) counts[branchEl]++;
  }

  return counts;
}

function normalizeElements(counts: Record<string, number>): Record<string, number> {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return { wood: 20, fire: 20, earth: 20, metal: 20, water: 20 };
  }

  const normalized: Record<string, number> = {};
  for (const [key, val] of Object.entries(counts)) {
    normalized[key] = Math.round((val / total) * 100);
  }

  // 합이 100이 되도록 보정
  const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
  if (sum !== 100) {
    const maxKey = Object.entries(normalized)
      .sort((a, b) => b[1] - a[1])[0][0];
    normalized[maxKey] += 100 - sum;
  }

  return normalized;
}

export function calculateSaju(
  birthDate: Date,
  birthTime: string
): SajuResult {
  const solarYear = birthDate.getFullYear();
  const solarMonth = birthDate.getMonth() + 1;
  const solarDay = birthDate.getDate();

  // 양력 → 음력 변환
  const calendar = new KoreanLunarCalendar();
  calendar.setSolarDate(solarYear, solarMonth, solarDay);
  const lunarYear = calendar.getLunarCalendar().year;
  const lunarMonth = calendar.getLunarCalendar().month;

  // 년주
  const yearPillar = getYearPillar(lunarYear);
  const yearStemIdx = HEAVENLY_STEMS.indexOf(yearPillar.stem as typeof HEAVENLY_STEMS[number]);

  // 월주 (절기 기반)
  const sajuMonth = getPreciseSajuMonth(solarYear, solarMonth, solarDay);
  const monthPillar = getMonthPillarByTerm(sajuMonth, yearStemIdx);

  // 일주
  const dayPillar = getDayPillar(solarYear, solarMonth, solarDay);

  // 시주
  const [hourStr] = birthTime.split(':');
  const hour = parseInt(hourStr, 10) || 0;
  const hourPillar = getHourPillar(hour, dayPillar.stemIdx);

  // 사주 배열
  const allPillars = [yearPillar, monthPillar, dayPillar, hourPillar];

  // 오행 집계 및 정규화
  const rawCounts = countElements(allPillars);
  const fiveElements = normalizeElements(rawCounts);

  // 최우세 오행 결정
  const dominant = Object.entries(fiveElements)
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    pillars: {
      year: yearPillar.stem + yearPillar.branch,
      month: monthPillar.stem + monthPillar.branch,
      day: dayPillar.stem + dayPillar.branch,
      hour: hourPillar.stem + hourPillar.branch,
    },
    fiveElements: {
      wood: fiveElements.wood,
      fire: fiveElements.fire,
      earth: fiveElements.earth,
      metal: fiveElements.metal,
      water: fiveElements.water,
    },
    dominantType: TYPE_LABELS[dominant] ?? '조화형',
    label: TYPE_DESCRIPTIONS[dominant] ?? TYPE_DESCRIPTIONS.earth,
  };
}

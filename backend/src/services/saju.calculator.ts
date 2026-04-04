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

interface TraitDetail {
  personality: string[];
  strengths: string[];
  cautions: string[];
  parentingTips: string[];
  learningStyle: string;
  socialStyle: string;
  stressResponse: string;
  bestActivities: string[];
  bestFoods: string[];
}

const TYPE_DETAILS: Record<string, TraitDetail> = {
  wood: {
    personality: ['왕성한 호기심과 탐구심', '독립적이고 자기주도적', '도전을 즐기며 새로운 환경에 빠르게 적응', '질문이 많고 원리를 파악하려 함', '한 가지에 깊이 빠져드는 집중력'],
    strengths: ['창의적 문제 해결 능력이 뛰어남', '자기주도 학습 능력이 강함', '새로운 환경에 대한 적응력이 좋음', '관찰력이 뛰어나고 분석적', '성장 욕구가 강하고 발전지향적'],
    cautions: ['한 가지에 빠지면 주변을 잊을 수 있음', '규칙이나 반복적인 활동에 지루해할 수 있음', '자기 방식에 대한 고집이 생길 수 있음', '결과보다 과정에 흥미를 느껴 마무리가 약할 수 있음'],
    parentingTips: ['"왜?"라는 질문에 성의 있게 답해주세요', '직접 체험하고 실험할 기회를 충분히 주세요', '도서관, 과학관, 자연 탐험 등 다양한 경험을 제공하세요', '스스로 답을 찾을 시간을 주되, 막히면 힌트를 주세요', '완성의 기쁨을 느낄 수 있도록 작은 프로젝트를 함께하세요'],
    learningStyle: '직접 해보며 배우는 체험 학습형. 이론보다 실습, 암기보다 이해를 선호합니다.',
    socialStyle: '소수의 깊은 친구 관계를 선호하며, 혼자만의 시간도 중요하게 여깁니다.',
    stressResponse: '혼자 조용히 생각하며 스트레스를 해소합니다. 강제로 대화를 시도하기보다 공간을 주세요.',
    bestActivities: ['과학 실험', '레고/블록 조립', '자연 관찰', '독서', '코딩', '퍼즐'],
    bestFoods: ['연어 (DHA)', '호두 (오메가3)', '블루베리 (항산화)', '달걀 (콜린)'],
  },
  fire: {
    personality: ['에너지가 넘치고 활발함', '자기표현이 강하고 솔직함', '리더십이 있고 친구들에게 인기 많음', '감정 표현이 풍부하고 열정적', '새로운 사람과 빠르게 친해짐'],
    strengths: ['뛰어난 행동력과 추진력', '사교성이 좋고 분위기를 이끎', '도전정신이 강하고 두려움이 적음', '긍정적 에너지로 주변을 밝게 함', '운동 능력과 신체 발달이 빠름'],
    cautions: ['충동적으로 행동할 수 있음', '에너지 발산이 안 되면 짜증이 날 수 있음', '집중 시간이 짧을 수 있음', '경쟁심이 지나칠 수 있음', '감정 기복이 클 수 있음'],
    parentingTips: ['충분한 신체 활동 시간을 확보해주세요', '에너지를 긍정적으로 발산할 수 있는 활동을 찾아주세요', '감정 조절 방법을 자연스럽게 알려주세요', '작은 성취에도 칭찬과 격려를 해주세요', '규칙은 명확하되 자유도 함께 주세요'],
    learningStyle: '몸을 움직이며 배우는 활동 학습형. 게임, 역할극, 그룹 활동을 통해 잘 배웁니다.',
    socialStyle: '넓은 교우관계를 형성하며, 리더 역할을 자연스럽게 맡습니다.',
    stressResponse: '신체 활동으로 스트레스를 풀어요. 달리기, 공놀이 등이 효과적입니다.',
    bestActivities: ['축구/농구 등 팀 스포츠', '댄스', '연극/뮤지컬', '야외 놀이', '수영'],
    bestFoods: ['닭가슴살 (단백질)', '바나나 (에너지)', '고구마 (복합탄수화물)', '우유 (칼슘)'],
  },
  earth: {
    personality: ['온화하고 안정적인 성격', '배려심이 깊고 공감 능력 뛰어남', '규칙적인 생활을 좋아함', '갈등을 피하고 조화를 추구', '인내심이 강하고 꾸준함'],
    strengths: ['안정적이고 신뢰할 수 있는 성격', '친구들 사이에서 중재 역할을 잘 함', '책임감이 강하고 약속을 잘 지킴', '새로운 환경에서도 차분하게 적응', '끈기 있게 한 가지를 꾸준히 할 수 있음'],
    cautions: ['자기 의견을 표현하는 데 소극적일 수 있음', '변화를 두려워할 수 있음', '다른 사람의 감정에 지나치게 영향받을 수 있음', '자기 욕구를 억누를 수 있음', '결정을 내리는 데 시간이 걸릴 수 있음'],
    parentingTips: ['의견을 물어보고 스스로 선택할 기회를 주세요', '변화가 있을 때 미리 알려주고 마음의 준비 시간을 주세요', '다른 사람을 배려하는 것도 중요하지만 자기 감정도 중요하다고 알려주세요', '"No"라고 말해도 괜찮다고 알려주세요', '규칙적인 일상 루틴을 만들어주세요'],
    learningStyle: '체계적이고 단계적인 학습을 선호합니다. 반복 학습에 강하고 꾸준히 실력이 늘어납니다.',
    socialStyle: '소수의 가까운 친구와 깊은 관계를 맺으며, 그룹에서 조율자 역할을 합니다.',
    stressResponse: '가족과 함께 있거나 익숙한 환경에서 안정을 찾습니다. 포옹이나 대화가 도움됩니다.',
    bestActivities: ['요리/베이킹', '정원 가꾸기', '보드게임', '그림 그리기', '또래 놀이'],
    bestFoods: ['잡곡밥 (균형 영양)', '된장국 (발효식품)', '두부 (식물성 단백질)', '사과 (비타민)'],
  },
  metal: {
    personality: ['꼼꼼하고 세밀한 관찰력', '논리적이고 체계적인 사고', '완벽주의 성향이 있음', '규칙을 잘 따르고 질서 정연', '조용하지만 깊이 있는 성격'],
    strengths: ['집중력이 뛰어나고 한 가지를 깊이 탐구', '분석력과 문제 해결 능력이 강함', '정리정돈을 잘하고 계획적', '학업 성취도가 높을 가능성이 큼', '세부 사항을 놓치지 않는 꼼꼼함'],
    cautions: ['완벽하지 않으면 스트레스를 받을 수 있음', '새로운 시도를 두려워할 수 있음', '감정 표현이 서투를 수 있음', '혼자만의 세계에 빠져들 수 있음', '실수를 과도하게 신경 쓸 수 있음'],
    parentingTips: ['"완벽하지 않아도 괜찮아"라는 메시지를 자주 전해주세요', '과정의 노력을 결과보다 더 칭찬해주세요', '감정을 말로 표현하는 연습을 함께하세요', '충분한 혼자만의 시간과 공간을 제공해주세요', '다양한 경험을 통해 유연성을 키워주세요'],
    learningStyle: '체계적이고 논리적인 학습을 선호합니다. 스스로 정리하며 배우고, 원리 이해를 중요시합니다.',
    socialStyle: '소수의 깊은 관계를 선호하며, 대화보다 함께 활동하며 친해집니다.',
    stressResponse: '조용한 공간에서 혼자 시간을 보내며 정리합니다. 일기 쓰기나 그림이 도움됩니다.',
    bestActivities: ['코딩/프로그래밍', '체스/바둑', '레고 테크닉', '과학 실험', '수학 퍼즐'],
    bestFoods: ['계란 (콜린)', '시금치 (철분)', '고등어 (DHA)', '그릭 요거트 (단백질)'],
  },
  water: {
    personality: ['감수성이 풍부하고 예술적', '직관력이 뛰어나고 눈치가 빠름', '상상력이 풍부하고 창의적', '타인의 감정을 잘 읽음', '조용하지만 내면이 깊음'],
    strengths: ['예술적 재능과 창의력이 뛰어남', '공감 능력이 높아 좋은 친구가 됨', '적응력이 뛰어나고 유연함', '직관적 판단력이 좋음', '상상력으로 독창적인 아이디어를 냄'],
    cautions: ['감정에 쉽게 영향받을 수 있음', '우울하거나 불안해질 수 있음', '결정을 내리기 어려워할 수 있음', '현실보다 상상에 빠질 수 있음', '비판에 민감할 수 있음'],
    parentingTips: ['감정을 표현할 수 있는 안전한 환경을 만들어주세요', '예술 활동(그림, 음악, 글쓰기)으로 감성을 키워주세요', '"네 감정은 모두 소중하다"는 메시지를 전해주세요', '상상력을 현실로 연결하는 활동을 함께하세요', '안정적인 루틴 속에서 자유로운 표현 시간을 주세요'],
    learningStyle: '이야기와 감정이 담긴 학습을 좋아합니다. 음악, 미술, 문학을 통해 잘 배웁니다.',
    socialStyle: '소수의 마음이 통하는 친구와 깊은 우정을 나누며, 혼자만의 시간도 필요합니다.',
    stressResponse: '음악 듣기, 그림 그리기, 일기 쓰기 등 창작 활동으로 감정을 풀어냅니다.',
    bestActivities: ['미술/그림', '음악/악기 연주', '글쓰기/동화 만들기', '자연 산책', '요가/명상'],
    bestFoods: ['아보카도 (건강한 지방)', '다크초콜릿 (세로토닌)', '연어 (오메가3)', '견과류 (마그네슘)'],
  },
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
  detail: TraitDetail;
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
    detail: TYPE_DETAILS[dominant] ?? TYPE_DETAILS.earth,
  };
}

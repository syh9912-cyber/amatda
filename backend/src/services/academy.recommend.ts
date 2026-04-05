export interface AcademyRecommendation {
  category: string;
  emoji: string;
  reason: string;
  searchQuery: string;
  priority: number;
}

interface RecommendationEntry {
  category: string;
  emoji: string;
  reason: string;
  priority: number;
}

const TRAIT_RECOMMENDATIONS: Record<string, RecommendationEntry[]> = {
  '탐구형': [
    {
      category: '과학교실',
      emoji: '🔬',
      reason: '탐구형 아이는 실험과 관찰을 통해 배우는 것을 좋아합니다. 과학교실에서 직접 실험하며 호기심을 충족시킬 수 있습니다.',
      priority: 1,
    },
    {
      category: '코딩',
      emoji: '💻',
      reason: '논리적 사고와 문제 해결을 즐기는 탐구형에게 코딩은 체계적으로 생각하는 힘을 길러줍니다.',
      priority: 1,
    },
    {
      category: '실험교실',
      emoji: '🧪',
      reason: '직접 만지고 조작하며 원리를 탐색하는 것을 좋아하는 탐구형에게 최적의 환경입니다.',
      priority: 1,
    },
    {
      category: '영어',
      emoji: '🌍',
      reason: '새로운 언어 체계를 탐구하며 세계를 넓혀가는 경험이 탐구형의 지적 호기심을 자극합니다.',
      priority: 2,
    },
    {
      category: '독서논술',
      emoji: '📚',
      reason: '다양한 분야의 책을 통해 깊이 있는 사고력을 키울 수 있어 탐구형에게 잘 맞습니다.',
      priority: 2,
    },
    {
      category: '로봇',
      emoji: '🤖',
      reason: '로봇을 조립하고 프로그래밍하는 과정이 탐구형의 분석력과 창의력을 동시에 발달시킵니다.',
      priority: 2,
    },
  ],
  '활동형': [
    {
      category: '태권도',
      emoji: '🥋',
      reason: '에너지가 넘치는 활동형 아이에게 태권도는 체력과 예절을 함께 배울 수 있는 최고의 운동입니다.',
      priority: 1,
    },
    {
      category: '축구',
      emoji: '⚽',
      reason: '팀 활동을 통해 협동심과 리더십을 기를 수 있어 활동형 아이의 사회성 발달에 도움됩니다.',
      priority: 1,
    },
    {
      category: '수영',
      emoji: '🏊',
      reason: '전신 운동인 수영은 활동형 아이의 넘치는 에너지를 건강하게 발산시켜 줍니다.',
      priority: 1,
    },
    {
      category: '체육',
      emoji: '🏃',
      reason: '다양한 신체 활동을 통해 운동 능력을 골고루 발달시킬 수 있어 활동형에게 적합합니다.',
      priority: 1,
    },
    {
      category: '발레/댄스',
      emoji: '💃',
      reason: '리듬감과 표현력을 키우며 활동형 아이의 에너지를 예술적으로 승화시킬 수 있습니다.',
      priority: 2,
    },
    {
      category: '웅변',
      emoji: '🎤',
      reason: '자기 표현욕이 강한 활동형 아이가 논리적으로 말하는 힘을 기를 수 있습니다.',
      priority: 2,
    },
  ],
  '조화형': [
    {
      category: '연극',
      emoji: '🎭',
      reason: '조화형 아이는 다양한 역할을 이해하고 공감하는 능력이 뛰어나 연극에서 빛을 발합니다.',
      priority: 1,
    },
    {
      category: '합창',
      emoji: '🎵',
      reason: '함께 화음을 맞추는 활동은 조화형 아이의 협동심과 음악적 감수성을 동시에 키워줍니다.',
      priority: 1,
    },
    {
      category: '또래활동센터',
      emoji: '🤝',
      reason: '사회성이 뛰어난 조화형 아이가 또래와 함께 성장하며 리더십을 발휘할 수 있습니다.',
      priority: 1,
    },
    {
      category: '미술',
      emoji: '🎨',
      reason: '감성이 풍부한 조화형 아이가 색채와 형태를 통해 내면을 자유롭게 표현할 수 있습니다.',
      priority: 2,
    },
    {
      category: '음악',
      emoji: '🎹',
      reason: '음악의 조화로운 구조가 조화형 아이의 균형 잡힌 감성 발달에 잘 어울립니다.',
      priority: 2,
    },
    {
      category: '요리',
      emoji: '👨‍🍳',
      reason: '재료를 조합하고 나누는 요리 활동은 조화형 아이의 배려심과 창의력을 키워줍니다.',
      priority: 2,
    },
  ],
  '분석형': [
    {
      category: '수학',
      emoji: '🔢',
      reason: '논리와 패턴을 파악하는 능력이 뛰어난 분석형 아이에게 수학은 사고력을 극대화시키는 최적의 학습입니다.',
      priority: 1,
    },
    {
      category: '코딩',
      emoji: '💻',
      reason: '체계적이고 정밀한 사고를 좋아하는 분석형 아이가 알고리즘적 문제 해결력을 키울 수 있습니다.',
      priority: 1,
    },
    {
      category: '바둑/체스',
      emoji: '♟️',
      reason: '전략적 사고와 집중력이 뛰어난 분석형 아이에게 바둑과 체스는 두뇌 발달에 최적입니다.',
      priority: 1,
    },
    {
      category: '과학',
      emoji: '🔬',
      reason: '원인과 결과를 분석하기 좋아하는 분석형 아이가 과학적 탐구 방법을 체계적으로 배울 수 있습니다.',
      priority: 2,
    },
    {
      category: '로봇',
      emoji: '🤖',
      reason: '구조를 분석하고 조립하는 로봇 활동은 분석형 아이의 공학적 사고를 발달시킵니다.',
      priority: 2,
    },
    {
      category: '영어',
      emoji: '🌍',
      reason: '문법 구조를 체계적으로 분석하며 배우는 분석형 아이에게 언어 학습이 잘 맞습니다.',
      priority: 2,
    },
  ],
  '감성형': [
    {
      category: '피아노',
      emoji: '🎹',
      reason: '섬세한 감수성을 가진 감성형 아이가 음악을 통해 감정을 아름답게 표현할 수 있습니다.',
      priority: 1,
    },
    {
      category: '미술',
      emoji: '🎨',
      reason: '풍부한 상상력과 감성을 시각적으로 표현하는 미술은 감성형 아이의 재능을 꽃피웁니다.',
      priority: 1,
    },
    {
      category: '글쓰기',
      emoji: '✍️',
      reason: '내면의 감정과 이야기를 글로 풀어내는 활동이 감성형 아이의 표현력을 키워줍니다.',
      priority: 1,
    },
    {
      category: '발레',
      emoji: '🩰',
      reason: '우아한 움직임으로 감정을 표현하는 발레는 감성형 아이의 예술적 감각을 발달시킵니다.',
      priority: 2,
    },
    {
      category: '연극',
      emoji: '🎭',
      reason: '다양한 감정을 경험하고 표현하는 연극이 감성형 아이의 공감 능력을 더욱 풍부하게 합니다.',
      priority: 2,
    },
    {
      category: '합창',
      emoji: '🎶',
      reason: '함께 노래하며 감정을 공유하는 합창은 감성형 아이에게 정서적 안정감을 줍니다.',
      priority: 2,
    },
  ],
};

const AGE_FILTERS: Record<string, number> = {
  '태권도': 48,
  '축구': 48,
  '수영': 36,
  '코딩': 60,
  '바둑/체스': 60,
  '로봇': 60,
  '독서논술': 60,
  '웅변': 72,
  '글쓰기': 60,
};

export function getRecommendedAcademyTypes(
  dominantType: string,
  ageMonths: number
): AcademyRecommendation[] {
  const entries = TRAIT_RECOMMENDATIONS[dominantType];
  if (!entries) return [];

  return entries
    .filter((entry) => {
      const minAge = AGE_FILTERS[entry.category];
      return !minAge || ageMonths >= minAge;
    })
    .map((entry) => ({
      category: entry.category,
      emoji: entry.emoji,
      reason: entry.reason,
      searchQuery: entry.category,
      priority: entry.priority,
    }));
}

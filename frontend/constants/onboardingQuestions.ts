/**
 * onboardingQuestions.ts
 * 온보딩 성향 설문 60문항 (연령별 20문항, 리커트 5점 척도)
 *
 * 연령 그룹:
 *   infant     (0~24개월)
 *   toddler    (25~72개월)
 *   elementary (73~144개월)
 *
 * 기질 유형 (temperamentTarget):
 *   explorer  - 탐구형
 *   active    - 활동형
 *   harmony   - 조화형
 *   analyst   - 분석형
 *   sensitive - 감성형
 *
 * 채점: 각 질문은 하나의 기질 유형을 측정한다.
 *       리커트 응답(1~5)이 해당 기질의 점수가 된다.
 *       기질당 4문항 x 5기질 = 20문항/연령그룹
 */

export interface TemperamentScores {
  explorer: number;
  active: number;
  harmony: number;
  analyst: number;
  sensitive: number;
}

export interface SurveyQuestion {
  id: string;
  ageGroup: 'infant' | 'toddler' | 'elementary';
  category: string;
  order: number;
  question: string;
  temperamentTarget: 'explorer' | 'active' | 'harmony' | 'analyst' | 'sensitive';
}

/** 리커트 5점 척도 선택지 (UI에서 공통 사용) */
export const LIKERT_OPTIONS = [
  { label: '매우 그렇다', value: 5 },
  { label: '그렇다', value: 4 },
  { label: '보통이다', value: 3 },
  { label: '아니다', value: 2 },
  { label: '전혀 아니다', value: 1 },
] as const;

export type LikertValue = 1 | 2 | 3 | 4 | 5;

// ============================================================
//  영아 (0~24개월) 20문항
// ============================================================
const INFANT_QUESTIONS: SurveyQuestion[] = [
  // ── 탐구형 (explorer) 4문항 ──
  {
    id: 'infant-exp-1',
    ageGroup: 'infant',
    category: '탐색 반응',
    order: 1,
    question: '새 장난감을 주면 바로 손을 뻗어 만져봐요',
    temperamentTarget: 'explorer',
  },
  {
    id: 'infant-exp-2',
    ageGroup: 'infant',
    category: '탐색 반응',
    order: 2,
    question: '처음 가는 곳에서 주변을 두리번거려요',
    temperamentTarget: 'explorer',
  },
  {
    id: 'infant-exp-3',
    ageGroup: 'infant',
    category: '탐색 반응',
    order: 3,
    question: '서랍이나 틈새에 손가락을 넣어보려 해요',
    temperamentTarget: 'explorer',
  },
  {
    id: 'infant-exp-4',
    ageGroup: 'infant',
    category: '탐색 반응',
    order: 4,
    question: '음식을 먹기 전에 손으로 먼저 만져봐요',
    temperamentTarget: 'explorer',
  },

  // ── 활동형 (active) 4문항 ──
  {
    id: 'infant-act-1',
    ageGroup: 'infant',
    category: '신체 활동',
    order: 5,
    question: '가만히 눕혀두면 금방 뒤집거나 기어가요',
    temperamentTarget: 'active',
  },
  {
    id: 'infant-act-2',
    ageGroup: 'infant',
    category: '신체 활동',
    order: 6,
    question: '안아주면 꿈틀거리며 내려가려 해요',
    temperamentTarget: 'active',
  },
  {
    id: 'infant-act-3',
    ageGroup: 'infant',
    category: '신체 활동',
    order: 7,
    question: '깨어 있으면 손발을 쉴 새 없이 움직여요',
    temperamentTarget: 'active',
  },
  {
    id: 'infant-act-4',
    ageGroup: 'infant',
    category: '신체 활동',
    order: 8,
    question: '기저귀 갈 때 가만있지 않고 자꾸 뒤집어요',
    temperamentTarget: 'active',
  },

  // ── 조화형 (harmony) 4문항 ──
  {
    id: 'infant-har-1',
    ageGroup: 'infant',
    category: '사회적 반응',
    order: 9,
    question: '엄마 아빠 얼굴 보면 잘 웃어요',
    temperamentTarget: 'harmony',
  },
  {
    id: 'infant-har-2',
    ageGroup: 'infant',
    category: '사회적 반응',
    order: 10,
    question: '다른 아기를 보면 관심을 보이며 다가가요',
    temperamentTarget: 'harmony',
  },
  {
    id: 'infant-har-3',
    ageGroup: 'infant',
    category: '사회적 반응',
    order: 11,
    question: '안아주거나 토닥이면 금방 편안해져요',
    temperamentTarget: 'harmony',
  },
  {
    id: 'infant-har-4',
    ageGroup: 'infant',
    category: '사회적 반응',
    order: 12,
    question: '가족이 모여 있으면 혼자일 때보다 기분이 좋아요',
    temperamentTarget: 'harmony',
  },

  // ── 분석형 (analyst) 4문항 ──
  {
    id: 'infant-ana-1',
    ageGroup: 'infant',
    category: '규칙성',
    order: 13,
    question: '수유, 수면 시간이 매일 비슷한 편이에요',
    temperamentTarget: 'analyst',
  },
  {
    id: 'infant-ana-2',
    ageGroup: 'infant',
    category: '규칙성',
    order: 14,
    question: '장난감으로 같은 동작을 반복해서 놀아요',
    temperamentTarget: 'analyst',
  },
  {
    id: 'infant-ana-3',
    ageGroup: 'infant',
    category: '규칙성',
    order: 15,
    question: '정해진 순서(수유-놀이-낮잠)대로 하면 더 안정돼요',
    temperamentTarget: 'analyst',
  },
  {
    id: 'infant-ana-4',
    ageGroup: 'infant',
    category: '규칙성',
    order: 16,
    question: '늘 쓰던 젖병이나 이불이 바뀌면 싫어해요',
    temperamentTarget: 'analyst',
  },

  // ── 감성형 (sensitive) 4문항 ──
  {
    id: 'infant-sen-1',
    ageGroup: 'infant',
    category: '감각 민감성',
    order: 17,
    question: '작은 소리에도 깜짝 놀라거나 울어요',
    temperamentTarget: 'sensitive',
  },
  {
    id: 'infant-sen-2',
    ageGroup: 'infant',
    category: '감각 민감성',
    order: 18,
    question: '낯선 사람을 보면 불안해하며 울려고 해요',
    temperamentTarget: 'sensitive',
  },
  {
    id: 'infant-sen-3',
    ageGroup: 'infant',
    category: '감각 민감성',
    order: 19,
    question: '옷 태그나 질감이 불편하면 칭얼거려요',
    temperamentTarget: 'sensitive',
  },
  {
    id: 'infant-sen-4',
    ageGroup: 'infant',
    category: '감각 민감성',
    order: 20,
    question: '조명, 온도, 소음이 바뀌면 예민하게 반응해요',
    temperamentTarget: 'sensitive',
  },
];

// ============================================================
//  유아 (25~72개월) 20문항
// ============================================================
const TODDLER_QUESTIONS: SurveyQuestion[] = [
  // ── 탐구형 (explorer) 4문항 ──
  {
    id: 'toddler-exp-1',
    ageGroup: 'toddler',
    category: '호기심',
    order: 1,
    question: '"이건 뭐야?" "왜?" 질문을 입에 달고 살아요',
    temperamentTarget: 'explorer',
  },
  {
    id: 'toddler-exp-2',
    ageGroup: 'toddler',
    category: '호기심',
    order: 2,
    question: '장난감을 원래 용도 말고 다른 방법으로 놀아요',
    temperamentTarget: 'explorer',
  },
  {
    id: 'toddler-exp-3',
    ageGroup: 'toddler',
    category: '호기심',
    order: 3,
    question: '산책 중 벌레, 꽃, 돌멩이를 유심히 관찰해요',
    temperamentTarget: 'explorer',
  },
  {
    id: 'toddler-exp-4',
    ageGroup: 'toddler',
    category: '호기심',
    order: 4,
    question: '새로운 놀이를 해보자고 하면 적극적이에요',
    temperamentTarget: 'explorer',
  },

  // ── 활동형 (active) 4문항 ──
  {
    id: 'toddler-act-1',
    ageGroup: 'toddler',
    category: '놀이 활동',
    order: 5,
    question: '집 안보다 밖에서 뛰어노는 걸 좋아해요',
    temperamentTarget: 'active',
  },
  {
    id: 'toddler-act-2',
    ageGroup: 'toddler',
    category: '놀이 활동',
    order: 6,
    question: '한곳에 앉아있기보다 돌아다니면서 놀아요',
    temperamentTarget: 'active',
  },
  {
    id: 'toddler-act-3',
    ageGroup: 'toddler',
    category: '놀이 활동',
    order: 7,
    question: '달리기, 점프, 공놀이 같은 활동을 좋아해요',
    temperamentTarget: 'active',
  },
  {
    id: 'toddler-act-4',
    ageGroup: 'toddler',
    category: '놀이 활동',
    order: 8,
    question: '밥 먹다가 자리에서 자꾸 일어나요',
    temperamentTarget: 'active',
  },

  // ── 조화형 (harmony) 4문항 ──
  {
    id: 'toddler-har-1',
    ageGroup: 'toddler',
    category: '또래 관계',
    order: 9,
    question: '다른 아이에게 장난감을 나눠주거나 양보해요',
    temperamentTarget: 'harmony',
  },
  {
    id: 'toddler-har-2',
    ageGroup: 'toddler',
    category: '또래 관계',
    order: 10,
    question: '혼자 놀기보다 누군가와 같이 노는 걸 좋아해요',
    temperamentTarget: 'harmony',
  },
  {
    id: 'toddler-har-3',
    ageGroup: 'toddler',
    category: '또래 관계',
    order: 11,
    question: '친구가 울면 걱정하거나 달래주려 해요',
    temperamentTarget: 'harmony',
  },
  {
    id: 'toddler-har-4',
    ageGroup: 'toddler',
    category: '또래 관계',
    order: 12,
    question: '놀이할 때 자기 고집보다 상대에게 맞춰줘요',
    temperamentTarget: 'harmony',
  },

  // ── 분석형 (analyst) 4문항 ──
  {
    id: 'toddler-ana-1',
    ageGroup: 'toddler',
    category: '사고 방식',
    order: 13,
    question: '블록이나 퍼즐에 오래 집중해서 놀아요',
    temperamentTarget: 'analyst',
  },
  {
    id: 'toddler-ana-2',
    ageGroup: 'toddler',
    category: '사고 방식',
    order: 14,
    question: '장난감을 색깔이나 크기별로 나눠 정리해요',
    temperamentTarget: 'analyst',
  },
  {
    id: 'toddler-ana-3',
    ageGroup: 'toddler',
    category: '사고 방식',
    order: 15,
    question: '같은 그림책을 반복해서 읽어달라고 해요',
    temperamentTarget: 'analyst',
  },
  {
    id: 'toddler-ana-4',
    ageGroup: 'toddler',
    category: '사고 방식',
    order: 16,
    question: '하루 일과(밥-양치-놀이)가 바뀌면 불편해해요',
    temperamentTarget: 'analyst',
  },

  // ── 감성형 (sensitive) 4문항 ──
  {
    id: 'toddler-sen-1',
    ageGroup: 'toddler',
    category: '감정 표현',
    order: 17,
    question: '부모의 기분 변화를 빠르게 알아차려요',
    temperamentTarget: 'sensitive',
  },
  {
    id: 'toddler-sen-2',
    ageGroup: 'toddler',
    category: '감정 표현',
    order: 18,
    question: '동화나 영상의 슬픈 장면에 눈물을 글썽여요',
    temperamentTarget: 'sensitive',
  },
  {
    id: 'toddler-sen-3',
    ageGroup: 'toddler',
    category: '감정 표현',
    order: 19,
    question: '혼나면 오래 속상해하며 잘 풀어지지 않아요',
    temperamentTarget: 'sensitive',
  },
  {
    id: 'toddler-sen-4',
    ageGroup: 'toddler',
    category: '감정 표현',
    order: 20,
    question: '시끄럽거나 사람 많은 곳에서 금방 지쳐요',
    temperamentTarget: 'sensitive',
  },
];

// ============================================================
//  초등 (73~144개월) 20문항
// ============================================================
const ELEMENTARY_QUESTIONS: SurveyQuestion[] = [
  // ── 탐구형 (explorer) 4문항 ──
  {
    id: 'elem-exp-1',
    ageGroup: 'elementary',
    category: '학습 태도',
    order: 1,
    question: '수업에서 배운 것 외에 혼자 더 찾아보려 해요',
    temperamentTarget: 'explorer',
  },
  {
    id: 'elem-exp-2',
    ageGroup: 'elementary',
    category: '학습 태도',
    order: 2,
    question: '"이건 왜 이렇게 되는 거야?" 하며 원리를 궁금해해요',
    temperamentTarget: 'explorer',
  },
  {
    id: 'elem-exp-3',
    ageGroup: 'elementary',
    category: '학습 태도',
    order: 3,
    question: '만들기, 실험, 요리처럼 직접 해보는 활동을 좋아해요',
    temperamentTarget: 'explorer',
  },
  {
    id: 'elem-exp-4',
    ageGroup: 'elementary',
    category: '학습 태도',
    order: 4,
    question: '새 관심사가 생기면 푹 빠져서 몰두해요',
    temperamentTarget: 'explorer',
  },

  // ── 활동형 (active) 4문항 ──
  {
    id: 'elem-act-1',
    ageGroup: 'elementary',
    category: '활동 선호',
    order: 5,
    question: '쉬는 시간에 교실보다 밖에서 뛰어놀아요',
    temperamentTarget: 'active',
  },
  {
    id: 'elem-act-2',
    ageGroup: 'elementary',
    category: '활동 선호',
    order: 6,
    question: '운동이나 체육 시간에 자신감 있고 적극적이에요',
    temperamentTarget: 'active',
  },
  {
    id: 'elem-act-3',
    ageGroup: 'elementary',
    category: '활동 선호',
    order: 7,
    question: '오래 앉아서 하는 공부를 힘들어해요',
    temperamentTarget: 'active',
  },
  {
    id: 'elem-act-4',
    ageGroup: 'elementary',
    category: '활동 선호',
    order: 8,
    question: '주말에 집에만 있으면 답답해하며 나가자고 해요',
    temperamentTarget: 'active',
  },

  // ── 조화형 (harmony) 4문항 ──
  {
    id: 'elem-har-1',
    ageGroup: 'elementary',
    category: '교우 관계',
    order: 9,
    question: '혼자보다 친구들과 같이 하는 활동을 더 좋아해요',
    temperamentTarget: 'harmony',
  },
  {
    id: 'elem-har-2',
    ageGroup: 'elementary',
    category: '교우 관계',
    order: 10,
    question: '친구들이 싸우면 중간에서 화해시키려 해요',
    temperamentTarget: 'harmony',
  },
  {
    id: 'elem-har-3',
    ageGroup: 'elementary',
    category: '교우 관계',
    order: 11,
    question: '모둠 활동이나 조별 과제에서 협력을 잘해요',
    temperamentTarget: 'harmony',
  },
  {
    id: 'elem-har-4',
    ageGroup: 'elementary',
    category: '교우 관계',
    order: 12,
    question: '자기 것을 친구에게 나눠주거나 빌려주는 걸 어려워하지 않아요',
    temperamentTarget: 'harmony',
  },

  // ── 분석형 (analyst) 4문항 ──
  {
    id: 'elem-ana-1',
    ageGroup: 'elementary',
    category: '문제 해결',
    order: 13,
    question: '문제를 풀 때 바로 답 쓰기보다 과정을 꼼꼼히 따져요',
    temperamentTarget: 'analyst',
  },
  {
    id: 'elem-ana-2',
    ageGroup: 'elementary',
    category: '문제 해결',
    order: 14,
    question: '자기 물건이나 책상을 스스로 정리 정돈해요',
    temperamentTarget: 'analyst',
  },
  {
    id: 'elem-ana-3',
    ageGroup: 'elementary',
    category: '문제 해결',
    order: 15,
    question: '계획을 세우고 순서대로 실행하는 걸 좋아해요',
    temperamentTarget: 'analyst',
  },
  {
    id: 'elem-ana-4',
    ageGroup: 'elementary',
    category: '문제 해결',
    order: 16,
    question: '약속 시간이나 규칙을 잘 지키려고 노력해요',
    temperamentTarget: 'analyst',
  },

  // ── 감성형 (sensitive) 4문항 ──
  {
    id: 'elem-sen-1',
    ageGroup: 'elementary',
    category: '감정 조절',
    order: 17,
    question: '선생님이나 친구의 말 한마디에 기분이 크게 변해요',
    temperamentTarget: 'sensitive',
  },
  {
    id: 'elem-sen-2',
    ageGroup: 'elementary',
    category: '감정 조절',
    order: 18,
    question: '영화나 책에서 감동받으면 깊이 빠져들어요',
    temperamentTarget: 'sensitive',
  },
  {
    id: 'elem-sen-3',
    ageGroup: 'elementary',
    category: '감정 조절',
    order: 19,
    question: '실수하면 오래 신경 쓰고 자책하는 편이에요',
    temperamentTarget: 'sensitive',
  },
  {
    id: 'elem-sen-4',
    ageGroup: 'elementary',
    category: '감정 조절',
    order: 20,
    question: '집안 분위기나 교실 분위기에 민감하게 반응해요',
    temperamentTarget: 'sensitive',
  },
];

// ============================================================
//  통합 목록 + 유틸리티
// ============================================================
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  ...INFANT_QUESTIONS,
  ...TODDLER_QUESTIONS,
  ...ELEMENTARY_QUESTIONS,
];

/** 연령 그룹별 질문 필터 */
export function getQuestionsByAgeGroup(ageGroup: SurveyQuestion['ageGroup']): SurveyQuestion[] {
  return SURVEY_QUESTIONS.filter((q) => q.ageGroup === ageGroup);
}

/** 월령으로 연령 그룹 판별 */
export function getAgeGroupFromMonths(months: number): SurveyQuestion['ageGroup'] {
  if (months <= 24) return 'infant';
  if (months <= 72) return 'toddler';
  return 'elementary';
}

const TEMPERAMENT_LABELS: Record<string, string> = {
  explorer: '탐구형',
  active: '활동형',
  harmony: '조화형',
  analyst: '분석형',
  sensitive: '감성형',
};

const TEMPERAMENT_KEYS = ['explorer', 'active', 'harmony', 'analyst', 'sensitive'] as const;

/**
 * 리커트 응답 기반 기질 산출
 * @param answers questionId -> 리커트 점수 (1~5) 매핑
 * @returns dominant 기질 key, 각 기질 총점, 한글 라벨
 */
export function calculateTemperament(
  answers: Record<string, number>,
): {
  dominant: string;
  scores: Record<string, number>;
  label: string;
} {
  const totals: Record<string, number> = {
    explorer: 0,
    active: 0,
    harmony: 0,
    analyst: 0,
    sensitive: 0,
  };

  for (const [questionId, likertScore] of Object.entries(answers)) {
    const q = SURVEY_QUESTIONS.find((sq) => sq.id === questionId);
    if (!q) continue;

    const score = Math.max(1, Math.min(5, Math.round(likertScore)));
    totals[q.temperamentTarget] = (totals[q.temperamentTarget] ?? 0) + score;
  }

  let dominant = 'harmony';
  let maxScore = -1;
  for (const key of TEMPERAMENT_KEYS) {
    const val = totals[key] ?? 0;
    if (val > maxScore) {
      maxScore = val;
      dominant = key;
    }
  }

  return {
    dominant,
    scores: totals,
    label: TEMPERAMENT_LABELS[dominant] ?? dominant,
  };
}

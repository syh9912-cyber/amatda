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
 *
 * i18n: question/category/options[].text 는 getSurveyQuestions(t) 팩토리에서
 *       i18next 네임스페이스 `onboardingQuestions.<id>.*` 로 런타임에 해석된다.
 *       id/ageGroup/order/temperamentTarget/options[].trait 는 구조적 데이터이며
 *       번역 대상이 아니다 (calculateTemperament 채점 로직이 의존함, 변경 금지).
 */
import type { TFunction } from 'i18next';

export interface TemperamentScores {
  explorer: number;
  active: number;
  harmony: number;
  analyst: number;
  sensitive: number;
}

export type TemperamentKey = 'explorer' | 'active' | 'harmony' | 'analyst' | 'sensitive';

export interface AnswerOption {
  /** 이 답변이 해당하는 기질 — 사용자 선택 시 이 기질에 점수 부여 */
  trait: TemperamentKey;
  /** 시나리오에 대한 구체적 행동 (예: "먼저 살펴보고 천천히 만져요") */
  text: string;
}

export interface SurveyQuestion {
  id: string;
  ageGroup: 'infant' | 'toddler' | 'elementary';
  category: string;
  order: number;
  /** 질문 (시나리오 형태 — 예: "새 장난감을 받으면 어떤가요?") */
  question: string;
  /** 이 질문의 주 측정 기질 (백엔드 점수 호환용) */
  temperamentTarget: TemperamentKey;
  /** 시나리오 5개 행동 답변 (각 답변은 트레이트 1개에 대응) */
  options?: AnswerOption[];
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
  // ── 탐색 반응 ──
  {
    id: 'infant-exp-1',
    ageGroup: 'infant', category: '탐색 반응', order: 1,
    question: '새 장난감을 받았을 때 어떤가요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '먼저 한참 살펴보고 만져요' },
      { trait: 'explorer',  text: '바로 손을 뻗어 만져봐요' },
      { trait: 'harmony',   text: '엄마가 주는 대로 받아요' },
      { trait: 'active',    text: '잡았다 던졌다 활발하게 놀아요' },
      { trait: 'sensitive', text: '낯설면 안 만지려 해요' },
    ],
  },
  {
    id: 'infant-exp-2',
    ageGroup: 'infant', category: '탐색 반응', order: 2,
    question: '처음 가는 장소에서 어떤가요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '천천히 둘러보며 익숙해져요' },
      { trait: 'explorer',  text: '주변을 두리번거리며 살펴요' },
      { trait: 'harmony',   text: '엄마 곁에서 떨어지지 않아요' },
      { trait: 'active',    text: '여기저기 움직이며 돌아다녀요' },
      { trait: 'sensitive', text: '낯설어서 곧 울먹여요' },
    ],
  },
  {
    id: 'infant-exp-3',
    ageGroup: 'infant', category: '탐색 반응', order: 3,
    question: '눈에 보이는 작은 틈새에 어떻게 반응해요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '한참 들여다본 뒤 만져요' },
      { trait: 'explorer',  text: '손가락을 바로 넣어봐요' },
      { trait: 'harmony',   text: '관심 없고 사람을 봐요' },
      { trait: 'active',    text: '여러 곳을 빠르게 옮겨가요' },
      { trait: 'sensitive', text: '거칠면 금방 손을 빼요' },
    ],
  },
  {
    id: 'infant-exp-4',
    ageGroup: 'infant', category: '탐색 반응', order: 4,
    question: '새 음식을 보면 어떤가요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '한참 본 뒤 조심스레 먹어요' },
      { trait: 'explorer',  text: '손으로 먼저 만져보고 먹어요' },
      { trait: 'harmony',   text: '엄마가 먹여주면 잘 받아요' },
      { trait: 'active',    text: '맛에 상관없이 빠르게 먹어요' },
      { trait: 'sensitive', text: '낯선 향이면 안 먹으려 해요' },
    ],
  },

  // ── 신체 활동 ──
  {
    id: 'infant-act-1',
    ageGroup: 'infant', category: '신체 활동', order: 5,
    question: '눕혀두면 어떻게 행동하나요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '주변을 보며 가만히 있어요' },
      { trait: 'explorer',  text: '손에 닿는 것을 살펴봐요' },
      { trait: 'harmony',   text: '엄마 쪽을 보며 웃어요' },
      { trait: 'active',    text: '바로 뒤집고 기어가요' },
      { trait: 'sensitive', text: '얼마 안 가 칭얼거려요' },
    ],
  },
  {
    id: 'infant-act-2',
    ageGroup: 'infant', category: '신체 활동', order: 6,
    question: '안아주면 어떤 모습인가요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '주변을 가만히 둘러봐요' },
      { trait: 'explorer',  text: '손이 닿는 곳을 만져봐요' },
      { trait: 'harmony',   text: '품에 안겨 편안해해요' },
      { trait: 'active',    text: '꿈틀거리며 내려가려 해요' },
      { trait: 'sensitive', text: '엄마 표정에 민감해요' },
    ],
  },
  {
    id: 'infant-act-3',
    ageGroup: 'infant', category: '신체 활동', order: 7,
    question: '깨어 있을 때 평소 모습은?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '한 가지에 차분히 집중해요' },
      { trait: 'explorer',  text: '이것저것 만지며 탐색해요' },
      { trait: 'harmony',   text: '사람 쪽을 보며 웃어요' },
      { trait: 'active',    text: '손발을 쉴 새 없이 움직여요' },
      { trait: 'sensitive', text: '주변 자극에 자주 놀라요' },
    ],
  },
  {
    id: 'infant-act-4',
    ageGroup: 'infant', category: '신체 활동', order: 8,
    question: '기저귀 갈 때 어떤가요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '루틴대로 잠자코 있어요' },
      { trait: 'explorer',  text: '손에 닿는 것을 만져봐요' },
      { trait: 'harmony',   text: '말 걸어주면 협조적이에요' },
      { trait: 'active',    text: '가만히 안 있고 자꾸 뒤집어요' },
      { trait: 'sensitive', text: '차거나 축축하면 곧 울어요' },
    ],
  },

  // ── 사회적 반응 ──
  {
    id: 'infant-har-1',
    ageGroup: 'infant', category: '사회적 반응', order: 9,
    question: '엄마·아빠 얼굴을 보면?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '한참 응시하며 살펴요' },
      { trait: 'explorer',  text: '얼굴을 만져보려 해요' },
      { trait: 'harmony',   text: '활짝 웃으며 반응해요' },
      { trait: 'active',    text: '몸을 움직이며 좋아해요' },
      { trait: 'sensitive', text: '표정 변화에 민감해요' },
    ],
  },
  {
    id: 'infant-har-2',
    ageGroup: 'infant', category: '사회적 반응', order: 10,
    question: '다른 아기를 만나면?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '거리를 두고 관찰해요' },
      { trait: 'explorer',  text: '얼굴이나 손을 만져봐요' },
      { trait: 'harmony',   text: '관심 보이며 다가가요' },
      { trait: 'active',    text: '활발히 다가가 부딪쳐요' },
      { trait: 'sensitive', text: '낯설어서 엄마를 찾아요' },
    ],
  },
  {
    id: 'infant-har-3',
    ageGroup: 'infant', category: '사회적 반응', order: 11,
    question: '울 때 달래주면 어떤가요?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '익숙한 방법에 진정돼요' },
      { trait: 'explorer',  text: '관심 끄는 물건에 멈춰요' },
      { trait: 'harmony',   text: '안아주면 금방 편안해져요' },
      { trait: 'active',    text: '안기보다 움직여야 그쳐요' },
      { trait: 'sensitive', text: '오래 달래줘야 진정돼요' },
    ],
  },
  {
    id: 'infant-har-4',
    ageGroup: 'infant', category: '사회적 반응', order: 12,
    question: '가족이 함께 모여 있을 때?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '조용히 분위기를 살펴요' },
      { trait: 'explorer',  text: '주변 사람·물건을 탐색해요' },
      { trait: 'harmony',   text: '혼자일 때보다 기분 좋아요' },
      { trait: 'active',    text: '돌아다니며 활발해져요' },
      { trait: 'sensitive', text: '시끄러우면 금방 지쳐요' },
    ],
  },

  // ── 규칙성 ──
  {
    id: 'infant-ana-1',
    ageGroup: 'infant', category: '규칙성', order: 13,
    question: '수유·수면 시간 패턴은?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '매일 거의 같은 시간이에요' },
      { trait: 'explorer',  text: '활동량 따라 들쑥날쑥해요' },
      { trait: 'harmony',   text: '주변 사람에 맞춰 변해요' },
      { trait: 'active',    text: '컨디션에 따라 자주 바뀌어요' },
      { trait: 'sensitive', text: '환경 변화에 영향받아요' },
    ],
  },
  {
    id: 'infant-ana-2',
    ageGroup: 'infant', category: '규칙성', order: 14,
    question: '장난감 놀이 방식은?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '같은 동작을 반복해서 해요' },
      { trait: 'explorer',  text: '여러 방식으로 시도해봐요' },
      { trait: 'harmony',   text: '엄마와 같이 놀려고 해요' },
      { trait: 'active',    text: '잡고 던지며 활발히 놀아요' },
      { trait: 'sensitive', text: '소리·질감에 민감해요' },
    ],
  },
  {
    id: 'infant-ana-3',
    ageGroup: 'infant', category: '규칙성', order: 15,
    question: '정해진 일과(수유→놀이→낮잠)대로 하면?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '훨씬 안정되고 편안해해요' },
      { trait: 'explorer',  text: '새로운 자극이 있어야 해요' },
      { trait: 'harmony',   text: '함께 있는 사람이 더 중요해요' },
      { trait: 'active',    text: '활동이 많아야 진정돼요' },
      { trait: 'sensitive', text: '분위기에 따라 달라요' },
    ],
  },
  {
    id: 'infant-ana-4',
    ageGroup: 'infant', category: '규칙성', order: 16,
    question: '익숙한 물건(젖병·이불)이 바뀌면?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '예민하게 거부해요' },
      { trait: 'explorer',  text: '새 물건에 호기심 보여요' },
      { trait: 'harmony',   text: '엄마가 주면 받아들여요' },
      { trait: 'active',    text: '크게 신경 안 쓰고 활동해요' },
      { trait: 'sensitive', text: '냄새·질감 차이에 울어요' },
    ],
  },

  // ── 감각 민감성 ──
  {
    id: 'infant-sen-1',
    ageGroup: 'infant', category: '감각 민감성', order: 17,
    question: '갑자기 큰 소리가 나면?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '소리 나는 쪽을 가만히 봐요' },
      { trait: 'explorer',  text: '소리를 따라가며 찾아봐요' },
      { trait: 'harmony',   text: '엄마를 찾아 안기려 해요' },
      { trait: 'active',    text: '몸을 빠르게 움직여요' },
      { trait: 'sensitive', text: '깜짝 놀라 울먹여요' },
    ],
  },
  {
    id: 'infant-sen-2',
    ageGroup: 'infant', category: '감각 민감성', order: 18,
    question: '낯선 사람을 만나면?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '거리를 두고 한참 살펴요' },
      { trait: 'explorer',  text: '관심 있게 다가가 봐요' },
      { trait: 'harmony',   text: '엄마 뒤에 숨었다 나와요' },
      { trait: 'active',    text: '낯가림 없이 활발히 다가가요' },
      { trait: 'sensitive', text: '불안해하며 울려고 해요' },
    ],
  },
  {
    id: 'infant-sen-3',
    ageGroup: 'infant', category: '감각 민감성', order: 19,
    question: '옷이 까칠하거나 태그가 닿으면?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '신경 쓰여도 잠시 참아요' },
      { trait: 'explorer',  text: '관심 없고 다른 것에 집중해요' },
      { trait: 'harmony',   text: '엄마가 옆에 있으면 괜찮아요' },
      { trait: 'active',    text: '활동하면 잊어버려요' },
      { trait: 'sensitive', text: '바로 칭얼거리며 불편해해요' },
    ],
  },
  {
    id: 'infant-sen-4',
    ageGroup: 'infant', category: '감각 민감성', order: 20,
    question: '조명·온도·소음이 바뀌면?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '잠시 살핀 뒤 적응해요' },
      { trait: 'explorer',  text: '변화에 호기심을 보여요' },
      { trait: 'harmony',   text: '익숙한 사람만 있으면 괜찮아요' },
      { trait: 'active',    text: '신경 안 쓰고 활동해요' },
      { trait: 'sensitive', text: '예민하게 반응해요' },
    ],
  },
];

// ============================================================
//  유아 (25~72개월) 20문항
// ============================================================
const TODDLER_QUESTIONS: SurveyQuestion[] = [
  // ── 호기심 ──
  {
    id: 'toddler-exp-1',
    ageGroup: 'toddler', category: '호기심', order: 1,
    question: '평소 질문은 어떻게 하나요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '같은 질문을 정확히 반복해요' },
      { trait: 'explorer',  text: '"이건 뭐야?" "왜?" 자주 물어요' },
      { trait: 'harmony',   text: '같이 있는 사람과 이야기해요' },
      { trait: 'active',    text: '말보다 행동으로 보여줘요' },
      { trait: 'sensitive', text: '눈치 보고 조심스레 물어요' },
    ],
  },
  {
    id: 'toddler-exp-2',
    ageGroup: 'toddler', category: '호기심', order: 2,
    question: '장난감을 가지고 놀 때 모습은?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '같은 패턴을 반복해서 놀아요' },
      { trait: 'explorer',  text: '원래 용도와 다른 방법으로 놀아요' },
      { trait: 'harmony',   text: '함께 노는 사람을 따라해요' },
      { trait: 'active',    text: '몸 쓰는 활발한 놀이를 해요' },
      { trait: 'sensitive', text: '좋아하는 것 하나에 빠져요' },
    ],
  },
  {
    id: 'toddler-exp-3',
    ageGroup: 'toddler', category: '호기심', order: 3,
    question: '산책 중 작은 자연물을 만나면?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '한참 들여다보고 분석해요' },
      { trait: 'explorer',  text: '벌레·꽃·돌을 유심히 관찰해요' },
      { trait: 'harmony',   text: '같이 있는 사람과 이야기해요' },
      { trait: 'active',    text: '뛰어가서 만지고 멀어져요' },
      { trait: 'sensitive', text: '낯설면 만지기 싫어해요' },
    ],
  },
  {
    id: 'toddler-exp-4',
    ageGroup: 'toddler', category: '호기심', order: 4,
    question: '새로운 놀이를 해보자고 하면?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '규칙을 먼저 물어봐요' },
      { trait: 'explorer',  text: '먼저 해보자며 적극적이에요' },
      { trait: 'harmony',   text: '같이 하는 사람이 누군지 봐요' },
      { trait: 'active',    text: '몸 움직이는 놀이면 좋아해요' },
      { trait: 'sensitive', text: '익숙한 놀이를 더 좋아해요' },
    ],
  },

  // ── 놀이 활동 ──
  {
    id: 'toddler-act-1',
    ageGroup: 'toddler', category: '놀이 활동', order: 5,
    question: '집과 야외 중 어디를 더 좋아해요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '익숙한 집을 더 좋아해요' },
      { trait: 'explorer',  text: '둘 다 좋아하며 탐색해요' },
      { trait: 'harmony',   text: '사람 있는 곳이면 좋아요' },
      { trait: 'active',    text: '밖에서 뛰어노는 걸 좋아해요' },
      { trait: 'sensitive', text: '조용하고 차분한 곳이 편해요' },
    ],
  },
  {
    id: 'toddler-act-2',
    ageGroup: 'toddler', category: '놀이 활동', order: 6,
    question: '놀이할 때 자세는?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '한자리에 차분히 집중해요' },
      { trait: 'explorer',  text: '여러 장난감 사이를 옮겨요' },
      { trait: 'harmony',   text: '함께 노는 사람 옆에 있어요' },
      { trait: 'active',    text: '돌아다니면서 놀아요' },
      { trait: 'sensitive', text: '익숙한 자리를 떠나기 싫어해요' },
    ],
  },
  {
    id: 'toddler-act-3',
    ageGroup: 'toddler', category: '놀이 활동', order: 7,
    question: '운동·달리기 같은 활동은?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '규칙 있는 게임을 좋아해요' },
      { trait: 'explorer',  text: '새로운 동작을 시도해봐요' },
      { trait: 'harmony',   text: '친구·가족과 함께면 좋아해요' },
      { trait: 'active',    text: '달리기·점프를 매우 좋아해요' },
      { trait: 'sensitive', text: '격한 활동은 부담스러워해요' },
    ],
  },
  {
    id: 'toddler-act-4',
    ageGroup: 'toddler', category: '놀이 활동', order: 8,
    question: '식사 시간 모습은?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '같은 자리·같은 순서로 먹어요' },
      { trait: 'explorer',  text: '음식 종류·맛을 탐색해요' },
      { trait: 'harmony',   text: '가족과 함께 먹는 걸 좋아해요' },
      { trait: 'active',    text: '먹다가 자꾸 일어나 돌아다녀요' },
      { trait: 'sensitive', text: '식감·향에 예민해요' },
    ],
  },

  // ── 또래 관계 ──
  {
    id: 'toddler-har-1',
    ageGroup: 'toddler', category: '또래 관계', order: 9,
    question: '다른 아이와 장난감을 두고 만나면?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '규칙대로 차례를 지켜요' },
      { trait: 'explorer',  text: '새 친구·장난감을 탐색해요' },
      { trait: 'harmony',   text: '나눠주거나 양보해요' },
      { trait: 'active',    text: '먼저 차지하려 빠르게 움직여요' },
      { trait: 'sensitive', text: '거절하기 어려워 양보해요' },
    ],
  },
  {
    id: 'toddler-har-2',
    ageGroup: 'toddler', category: '또래 관계', order: 10,
    question: '혼자 놀이와 함께 놀이 중 선호는?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '혼자 집중하는 걸 좋아해요' },
      { trait: 'explorer',  text: '둘 다 좋아하며 즐겨요' },
      { trait: 'harmony',   text: '누군가와 같이 노는 걸 좋아해요' },
      { trait: 'active',    text: '활동적이면 누구든 좋아요' },
      { trait: 'sensitive', text: '편한 한 명과 노는 걸 좋아해요' },
    ],
  },
  {
    id: 'toddler-har-3',
    ageGroup: 'toddler', category: '또래 관계', order: 11,
    question: '친구가 울고 있을 때?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '왜 우는지 물어봐요' },
      { trait: 'explorer',  text: '관심 끌 만한 것을 보여줘요' },
      { trait: 'harmony',   text: '걱정하며 달래주려 해요' },
      { trait: 'active',    text: '신경 안 쓰고 자기 놀이해요' },
      { trait: 'sensitive', text: '같이 슬퍼하며 우려고 해요' },
    ],
  },
  {
    id: 'toddler-har-4',
    ageGroup: 'toddler', category: '또래 관계', order: 12,
    question: '의견이 다를 때?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '논리·규칙으로 설득해요' },
      { trait: 'explorer',  text: '다른 방법을 제안해요' },
      { trait: 'harmony',   text: '자기 고집 줄이고 맞춰줘요' },
      { trait: 'active',    text: '자기 뜻을 강하게 주장해요' },
      { trait: 'sensitive', text: '눈치 보다 마지못해 따라요' },
    ],
  },

  // ── 사고 방식 ──
  {
    id: 'toddler-ana-1',
    ageGroup: 'toddler', category: '사고 방식', order: 13,
    question: '블록·퍼즐을 가지고 놀 때?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '오래 집중해서 완성해요' },
      { trait: 'explorer',  text: '새로운 모양을 시도해요' },
      { trait: 'harmony',   text: '같이 만들어 달라고 해요' },
      { trait: 'active',    text: '잠깐 하다 다른 놀이로 가요' },
      { trait: 'sensitive', text: '잘 안 되면 속상해해요' },
    ],
  },
  {
    id: 'toddler-ana-2',
    ageGroup: 'toddler', category: '사고 방식', order: 14,
    question: '장난감 정리는 어떻게 해요?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '색깔·크기별로 분류해요' },
      { trait: 'explorer',  text: '나름의 방식으로 새로 정리해요' },
      { trait: 'harmony',   text: '엄마와 같이 정리해요' },
      { trait: 'active',    text: '대충 빨리 끝내려 해요' },
      { trait: 'sensitive', text: '익숙한 자리에 그대로 둬요' },
    ],
  },
  {
    id: 'toddler-ana-3',
    ageGroup: 'toddler', category: '사고 방식', order: 15,
    question: '같은 그림책 읽어달라고 할 때?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '같은 책을 반복해서 원해요' },
      { trait: 'explorer',  text: '다른 책 보여달라 해요' },
      { trait: 'harmony',   text: '읽어주는 사람을 좋아해요' },
      { trait: 'active',    text: '오래 못 앉아 일어나요' },
      { trait: 'sensitive', text: '슬픈 장면에 깊이 빠져요' },
    ],
  },
  {
    id: 'toddler-ana-4',
    ageGroup: 'toddler', category: '사고 방식', order: 16,
    question: '하루 일과(밥-양치-놀이)가 바뀌면?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '불편해하며 거부해요' },
      { trait: 'explorer',  text: '새 일정에 호기심 보여요' },
      { trait: 'harmony',   text: '함께 있는 사람이면 괜찮아요' },
      { trait: 'active',    text: '활동만 있으면 신경 안 써요' },
      { trait: 'sensitive', text: '예민하게 반응해요' },
    ],
  },

  // ── 감정 표현 ──
  {
    id: 'toddler-sen-1',
    ageGroup: 'toddler', category: '감정 표현', order: 17,
    question: '부모의 기분 변화를?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '표정·말투로 천천히 알아차려요' },
      { trait: 'explorer',  text: '관심 두지 않고 자기 일을 해요' },
      { trait: 'harmony',   text: '눈치 채고 어울려 맞춰요' },
      { trait: 'active',    text: '잘 모르고 활동을 계속해요' },
      { trait: 'sensitive', text: '바로 알아차리며 영향받아요' },
    ],
  },
  {
    id: 'toddler-sen-2',
    ageGroup: 'toddler', category: '감정 표현', order: 18,
    question: '동화나 영상의 슬픈 장면에서?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '왜 그런지 묻고 분석해요' },
      { trait: 'explorer',  text: '다음 장면이 궁금해해요' },
      { trait: 'harmony',   text: '같이 보는 사람과 이야기해요' },
      { trait: 'active',    text: '집중 못 하고 다른 데 가요' },
      { trait: 'sensitive', text: '눈물을 글썽이며 깊이 빠져요' },
    ],
  },
  {
    id: 'toddler-sen-3',
    ageGroup: 'toddler', category: '감정 표현', order: 19,
    question: '혼이 나고 나면?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '왜 혼났는지 곰곰이 생각해요' },
      { trait: 'explorer',  text: '금방 잊고 다른 활동해요' },
      { trait: 'harmony',   text: '바로 미안하다고 사과해요' },
      { trait: 'active',    text: '잠깐만 풀이 죽고 곧 회복해요' },
      { trait: 'sensitive', text: '오래 속상해하며 안 풀려요' },
    ],
  },
  {
    id: 'toddler-sen-4',
    ageGroup: 'toddler', category: '감정 표현', order: 20,
    question: '시끄럽고 사람 많은 곳에서?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '구석에서 차분히 있어요' },
      { trait: 'explorer',  text: '여기저기 둘러보며 즐겨요' },
      { trait: 'harmony',   text: '함께 있는 사람 옆에 붙어요' },
      { trait: 'active',    text: '에너지 받아 더 활발해져요' },
      { trait: 'sensitive', text: '금방 지치고 힘들어해요' },
    ],
  },
];

// ============================================================
//  초등 (73~144개월) 20문항
// ============================================================
const ELEMENTARY_QUESTIONS: SurveyQuestion[] = [
  // ── 학습 태도 ──
  {
    id: 'elem-exp-1',
    ageGroup: 'elementary', category: '학습 태도', order: 1,
    question: '수업에서 배운 내용에 대한 반응은?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '필기·정리하며 곱씹어요' },
      { trait: 'explorer',  text: '혼자 더 찾아보고 조사해요' },
      { trait: 'harmony',   text: '친구와 같이 이야기해요' },
      { trait: 'active',    text: '실습·체험으로 익혀요' },
      { trait: 'sensitive', text: '재미있는 부분에 빠져들어요' },
    ],
  },
  {
    id: 'elem-exp-2',
    ageGroup: 'elementary', category: '학습 태도', order: 2,
    question: '새로운 현상을 보면?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '체계적으로 분석해요' },
      { trait: 'explorer',  text: '"왜 이렇게 되지?" 원리를 궁금해해요' },
      { trait: 'harmony',   text: '함께 본 사람과 의견 나눠요' },
      { trait: 'active',    text: '직접 따라 해보려 해요' },
      { trait: 'sensitive', text: '신기해하며 감동받아요' },
    ],
  },
  {
    id: 'elem-exp-3',
    ageGroup: 'elementary', category: '학습 태도', order: 3,
    question: '만들기·실험·요리 같은 활동은?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '순서·정확도를 따져요' },
      { trait: 'explorer',  text: '직접 해보는 걸 매우 좋아해요' },
      { trait: 'harmony',   text: '친구·가족과 함께면 좋아요' },
      { trait: 'active',    text: '몸 움직이는 활동이라 좋아해요' },
      { trait: 'sensitive', text: '결과물이 마음에 들어야 해요' },
    ],
  },
  {
    id: 'elem-exp-4',
    ageGroup: 'elementary', category: '학습 태도', order: 4,
    question: '새 관심사가 생기면?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst',   text: '체계적으로 공부해요' },
      { trait: 'explorer',  text: '푹 빠져서 깊이 몰두해요' },
      { trait: 'harmony',   text: '친구와 같이 즐겨요' },
      { trait: 'active',    text: '관심을 자주 옮겨다녀요' },
      { trait: 'sensitive', text: '꽂히면 정서적으로 빠져요' },
    ],
  },

  // ── 활동 선호 ──
  {
    id: 'elem-act-1',
    ageGroup: 'elementary', category: '활동 선호', order: 5,
    question: '쉬는 시간에 주로?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '책을 읽거나 정리해요' },
      { trait: 'explorer',  text: '관심거리를 더 찾아봐요' },
      { trait: 'harmony',   text: '친구들과 이야기해요' },
      { trait: 'active',    text: '교실 밖에서 뛰어놀아요' },
      { trait: 'sensitive', text: '조용한 자리에서 쉬어요' },
    ],
  },
  {
    id: 'elem-act-2',
    ageGroup: 'elementary', category: '활동 선호', order: 6,
    question: '체육 시간에는?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '규칙을 잘 지키며 해요' },
      { trait: 'explorer',  text: '새로운 종목에 호기심 보여요' },
      { trait: 'harmony',   text: '팀 활동을 즐겨요' },
      { trait: 'active',    text: '자신감 있고 매우 적극적이에요' },
      { trait: 'sensitive', text: '부담스러워 소극적이에요' },
    ],
  },
  {
    id: 'elem-act-3',
    ageGroup: 'elementary', category: '활동 선호', order: 7,
    question: '오래 앉아서 하는 공부는?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '집중력 있게 잘 해내요' },
      { trait: 'explorer',  text: '관심 주제면 오래 몰두해요' },
      { trait: 'harmony',   text: '친구와 같이 하면 잘해요' },
      { trait: 'active',    text: '오래 못 앉아 힘들어해요' },
      { trait: 'sensitive', text: '분위기·기분에 영향받아요' },
    ],
  },
  {
    id: 'elem-act-4',
    ageGroup: 'elementary', category: '활동 선호', order: 8,
    question: '주말에 집에만 있으면?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst',   text: '혼자 차분히 시간 보내요' },
      { trait: 'explorer',  text: '관심거리에 푹 빠져요' },
      { trait: 'harmony',   text: '가족과 이야기하며 보내요' },
      { trait: 'active',    text: '답답해하며 나가자고 해요' },
      { trait: 'sensitive', text: '안정감 있어 편하게 보내요' },
    ],
  },

  // ── 교우 관계 ──
  {
    id: 'elem-har-1',
    ageGroup: 'elementary', category: '교우 관계', order: 9,
    question: '활동을 할 때 선호하는 방식은?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '혼자 차분히 하는 게 좋아요' },
      { trait: 'explorer',  text: '주제에 따라 다르게 해요' },
      { trait: 'harmony',   text: '친구들과 함께가 좋아요' },
      { trait: 'active',    text: '활발한 활동이면 누구든 좋아요' },
      { trait: 'sensitive', text: '편한 한두 명과 좋아요' },
    ],
  },
  {
    id: 'elem-har-2',
    ageGroup: 'elementary', category: '교우 관계', order: 10,
    question: '친구들이 싸우면?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '잘잘못을 따져 말해요' },
      { trait: 'explorer',  text: '왜 싸웠는지 듣고 싶어해요' },
      { trait: 'harmony',   text: '중간에서 화해시키려 해요' },
      { trait: 'active',    text: '신경 안 쓰고 자기 일 해요' },
      { trait: 'sensitive', text: '같이 속상해하며 우려해요' },
    ],
  },
  {
    id: 'elem-har-3',
    ageGroup: 'elementary', category: '교우 관계', order: 11,
    question: '모둠 활동·조별 과제에서?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '계획·역할 분담을 주도해요' },
      { trait: 'explorer',  text: '아이디어를 많이 내요' },
      { trait: 'harmony',   text: '협력을 잘 이끌어요' },
      { trait: 'active',    text: '실행을 빠르게 해요' },
      { trait: 'sensitive', text: '조용히 자기 부분 책임져요' },
    ],
  },
  {
    id: 'elem-har-4',
    ageGroup: 'elementary', category: '교우 관계', order: 12,
    question: '내 물건을 친구가 빌려달라고 하면?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst',   text: '조건을 정하고 빌려줘요' },
      { trait: 'explorer',  text: '대신 다른 걸 제안해요' },
      { trait: 'harmony',   text: '거리낌 없이 빌려줘요' },
      { trait: 'active',    text: '내 것은 잘 빌려주지 않아요' },
      { trait: 'sensitive', text: '거절 못하고 빌려주고 후회해요' },
    ],
  },

  // ── 문제 해결 ──
  {
    id: 'elem-ana-1',
    ageGroup: 'elementary', category: '문제 해결', order: 13,
    question: '어려운 문제를 풀 때?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '과정을 꼼꼼히 따져 풀어요' },
      { trait: 'explorer',  text: '여러 방법을 시도해봐요' },
      { trait: 'harmony',   text: '친구·부모에게 같이 풀자 해요' },
      { trait: 'active',    text: '빠르게 답을 쓰고 넘어가요' },
      { trait: 'sensitive', text: '안 풀리면 속상해해요' },
    ],
  },
  {
    id: 'elem-ana-2',
    ageGroup: 'elementary', category: '문제 해결', order: 14,
    question: '책상이나 자기 물건 정리는?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '스스로 깔끔히 정리해요' },
      { trait: 'explorer',  text: '관심사 위주로 자기 식대로 둬요' },
      { trait: 'harmony',   text: '말해주면 같이 정리해요' },
      { trait: 'active',    text: '신경 안 쓰고 어지럽혀요' },
      { trait: 'sensitive', text: '자기 자리·물건에 애착이 있어요' },
    ],
  },
  {
    id: 'elem-ana-3',
    ageGroup: 'elementary', category: '문제 해결', order: 15,
    question: '하고 싶은 일이 있을 때?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '계획을 세우고 순서대로 해요' },
      { trait: 'explorer',  text: '여러 시도를 해보며 진행해요' },
      { trait: 'harmony',   text: '주변과 의논하며 해요' },
      { trait: 'active',    text: '바로 행동으로 옮겨요' },
      { trait: 'sensitive', text: '의욕이 들 때만 시작해요' },
    ],
  },
  {
    id: 'elem-ana-4',
    ageGroup: 'elementary', category: '문제 해결', order: 16,
    question: '약속 시간·규칙을?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst',   text: '잘 지키려고 노력해요' },
      { trait: 'explorer',  text: '왜 그런지 묻고 따져봐요' },
      { trait: 'harmony',   text: '주변에 맞춰 잘 지켜요' },
      { trait: 'active',    text: '느슨하게 여기는 편이에요' },
      { trait: 'sensitive', text: '어기면 미안해하고 자책해요' },
    ],
  },

  // ── 감정 조절 ──
  {
    id: 'elem-sen-1',
    ageGroup: 'elementary', category: '감정 조절', order: 17,
    question: '선생님·친구의 말 한마디에?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '의도를 분석해서 받아들여요' },
      { trait: 'explorer',  text: '관심 두지 않고 잊어요' },
      { trait: 'harmony',   text: '관계가 어색할까 신경 써요' },
      { trait: 'active',    text: '잠깐 기분 변하고 회복해요' },
      { trait: 'sensitive', text: '기분이 크게 변해요' },
    ],
  },
  {
    id: 'elem-sen-2',
    ageGroup: 'elementary', category: '감정 조절', order: 18,
    question: '영화·책에서 감동받으면?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '왜 감동했는지 분석해요' },
      { trait: 'explorer',  text: '비슷한 작품을 더 찾아요' },
      { trait: 'harmony',   text: '같이 본 사람과 이야기해요' },
      { trait: 'active',    text: '금방 잊고 다른 것 해요' },
      { trait: 'sensitive', text: '깊이 빠져들어 오래 남아요' },
    ],
  },
  {
    id: 'elem-sen-3',
    ageGroup: 'elementary', category: '감정 조절', order: 19,
    question: '실수했을 때?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '원인을 찾아 다음에 피해요' },
      { trait: 'explorer',  text: '경험으로 받아들이고 넘어가요' },
      { trait: 'harmony',   text: '주변에 사과하고 회복해요' },
      { trait: 'active',    text: '잠깐만 신경 쓰고 잊어요' },
      { trait: 'sensitive', text: '오래 자책하며 신경 써요' },
    ],
  },
  {
    id: 'elem-sen-4',
    ageGroup: 'elementary', category: '감정 조절', order: 20,
    question: '집·교실 분위기가 무거우면?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst',   text: '왜 그런지 살펴보고 행동해요' },
      { trait: 'explorer',  text: '신경 안 쓰고 자기 일 해요' },
      { trait: 'harmony',   text: '분위기를 풀려고 노력해요' },
      { trait: 'active',    text: '활동으로 분위기 전환해요' },
      { trait: 'sensitive', text: '민감하게 반응하며 위축돼요' },
    ],
  },
];

// ============================================================
//  통합 목록 + 유틸리티
//
//  SURVEY_QUESTIONS 는 한국어 원본(raw) 데이터다.
//  id/ageGroup/order/temperamentTarget/options[].trait 는 구조적 데이터로
//  그대로 사용하고, question/category/options[].text (표시용 텍스트)는
//  getSurveyQuestions(t) 팩토리를 통해 i18next 번역으로 치환해서 사용한다.
//  (calculateTemperament 는 아래 한국어 원본 SURVEY_QUESTIONS 를 그대로 참조 —
//   trait/temperamentTarget 매칭에는 언어가 관여하지 않으므로 안전하다)
// ============================================================
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  ...INFANT_QUESTIONS,
  ...TODDLER_QUESTIONS,
  ...ELEMENTARY_QUESTIONS,
];

/** 연령 그룹별 질문 필터 (한국어 원본 — 구조 참조용) */
export function getQuestionsByAgeGroup(ageGroup: SurveyQuestion['ageGroup']): SurveyQuestion[] {
  return SURVEY_QUESTIONS.filter((q) => q.ageGroup === ageGroup);
}

/**
 * 번역된 설문 문항 전체 목록.
 * question/category/options[].text 는 i18next 네임스페이스
 * `onboardingQuestions.<id>.question` / `.category` / `.options.<index>` 로 해석된다.
 * id/ageGroup/order/temperamentTarget/options[].trait 는 SURVEY_QUESTIONS(한국어 원본)의
 * 구조적 데이터를 그대로 유지한다 — calculateTemperament 채점 로직과 완전히 호환된다.
 */
export function getTranslatedSurveyQuestions(t: TFunction): SurveyQuestion[] {
  return SURVEY_QUESTIONS.map((q) => ({
    ...q,
    question: t(`onboardingQuestions.${q.id}.question`),
    category: t(`onboardingQuestions.${q.id}.category`),
    options: q.options?.map((o, idx) => ({
      ...o,
      text: t(`onboardingQuestions.${q.id}.options.${idx}`),
    })),
  }));
}

/** 연령 그룹별 번역된 질문 필터 */
export function getTranslatedQuestionsByAgeGroup(
  t: TFunction,
  ageGroup: SurveyQuestion['ageGroup'],
): SurveyQuestion[] {
  return getTranslatedSurveyQuestions(t).filter((q) => q.ageGroup === ageGroup);
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

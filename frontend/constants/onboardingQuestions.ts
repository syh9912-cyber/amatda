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
  ageGroup: 'm0' | 'm6' | 'm12' | 'm24' | 'm48' | 'm84';
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
//  연령별 기질 설문 (2026-07-19 재설계)
//  연령 6구간 × 10문항 = 60문항. 기질당 2문항.
//  설계 원칙: 한 문항의 5개 답변은 그 월령 아이가 모두 할 수 있는 행동이고,
//  차이는 "어떻게/어디로"(스타일)뿐 — 능력 차이를 기질로 오측정하지 않도록 함.
// ============================================================
// 0~5개월
const M0_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'm0-exp-1',
    ageGroup: 'm0', category: '새로운 자극', order: 1,
    question: '머리 위에 새 모빌을 달아주면 어떤가요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '한 곳을 오래 가만히 봐요' },
      { trait: 'explorer', text: '눈이 이쪽저쪽 계속 옮겨가요' },
      { trait: 'harmony', text: '모빌보다 제 얼굴을 더 봐요' },
      { trait: 'active', text: '보면서 팔다리를 힘차게 움직여요' },
      { trait: 'sensitive', text: '보다가 눈을 찡그리며 피해요' },
    ],
  },
  {
    id: 'm0-exp-3',
    ageGroup: 'm0', category: '주변 탐색', order: 2,
    question: '기저귀 갈려고 눕히면 어디를 보나요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '늘 보던 익숙한 쪽을 봐요' },
      { trait: 'explorer', text: '안 보던 새로운 쪽으로 돌려요' },
      { trait: 'harmony', text: '사람 있는 쪽으로 고개를 돌려요' },
      { trait: 'active', text: '이쪽저쪽 쉴 새 없이 돌려요' },
      { trait: 'sensitive', text: '밝거나 시끄러운 쪽은 피해요' },
    ],
  },
  {
    id: 'm0-act-1',
    ageGroup: 'm0', category: '활동량', order: 3,
    question: '낮잠에서 깬 직후 눕혀두면 어떤가요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '한동안 가만있다 천천히 움직여요' },
      { trait: 'explorer', text: '고개를 돌려 주변을 살펴요' },
      { trait: 'harmony', text: '사람 소리가 나면 그쪽을 봐요' },
      { trait: 'active', text: '팔다리를 쉬지 않고 크게 움직여요' },
      { trait: 'sensitive', text: '조금 칭얼대며 안아주길 바라요' },
    ],
  },
  {
    id: 'm0-act-2',
    ageGroup: 'm0', category: '활동량', order: 4,
    question: '목욕 후 옷을 입힐 때 모습은요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '늘 하던 순서면 가만히 있어요' },
      { trait: 'explorer', text: '고개를 돌려 주변을 둘러봐요' },
      { trait: 'harmony', text: '제 얼굴을 보며 표정을 지어요' },
      { trait: 'active', text: '다리를 힘차게 차며 움직여요' },
      { trait: 'sensitive', text: '옷이 닿으면 찡그리며 칭얼대요' },
    ],
  },
  {
    id: 'm0-har-1',
    ageGroup: 'm0', category: '사람 반응', order: 5,
    question: '제가 마주 보며 말을 걸어주면?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '표정 없이 가만히 들여다봐요' },
      { trait: 'explorer', text: '제 얼굴 여기저기를 훑어봐요' },
      { trait: 'harmony', text: '눈을 맞추고 입을 오물거려요' },
      { trait: 'active', text: '팔다리를 파닥이며 반응해요' },
      { trait: 'sensitive', text: '조금 보다가 고개를 돌려요' },
    ],
  },
  {
    id: 'm0-har-2',
    ageGroup: 'm0', category: '사람 반응', order: 6,
    question: '저 말고 다른 사람이 안아주면?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '얼굴을 한참 살펴본 뒤 가만있어요' },
      { trait: 'explorer', text: '고개를 돌려 새 얼굴을 봐요' },
      { trait: 'harmony', text: '누구 품에서든 편안해해요' },
      { trait: 'active', text: '품에서도 팔다리를 계속 움직여요' },
      { trait: 'sensitive', text: '금세 저를 찾으며 칭얼대요' },
    ],
  },
  {
    id: 'm0-ana-1',
    ageGroup: 'm0', category: '익숙함·루틴', order: 7,
    question: '수유 시간이 평소보다 조금 밀리면?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '늘 먹던 시간에 딱 맞춰 찾아요' },
      { trait: 'explorer', text: '주변을 둘러보다 뒤늦게 찾아요' },
      { trait: 'harmony', text: '제가 안아주면 조금 기다려요' },
      { trait: 'active', text: '온몸을 움직이며 크게 울어요' },
      { trait: 'sensitive', text: '조금만 늦어도 예민하게 울어요' },
    ],
  },
  {
    id: 'm0-ana-2',
    ageGroup: 'm0', category: '익숙함·루틴', order: 8,
    question: '잠자리에 눕힐 때 어떤 편인가요?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '늘 하던 순서대로 해야 잘 자요' },
      { trait: 'explorer', text: '주변을 둘러보다 늦게 잠들어요' },
      { trait: 'harmony', text: '제가 옆에 있으면 편히 잠들어요' },
      { trait: 'active', text: '잠들기 전까지 팔다리를 움직여요' },
      { trait: 'sensitive', text: '작은 소리에도 깨서 칭얼대요' },
    ],
  },
  {
    id: 'm0-sen-2',
    ageGroup: 'm0', category: '감각 민감도', order: 9,
    question: '갑자기 큰 소리가 났을 때는요?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '소리 난 쪽을 잠시 조용히 봐요' },
      { trait: 'explorer', text: '소리 난 쪽으로 고개를 돌려 찾아요' },
      { trait: 'harmony', text: '제 얼굴을 보며 반응을 살펴요' },
      { trait: 'active', text: '온몸을 크게 움찔하며 움직여요' },
      { trait: 'sensitive', text: '놀라서 바로 울음을 터뜨려요' },
    ],
  },
  {
    id: 'm0-sen-3',
    ageGroup: 'm0', category: '감각 민감도', order: 10,
    question: '목욕물에 처음 몸을 담글 때는?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '늘 하던 순서면 조용히 있어요' },
      { trait: 'explorer', text: '고개를 돌려 주변을 둘러봐요' },
      { trait: 'harmony', text: '제 얼굴을 보며 안심해요' },
      { trait: 'active', text: '팔다리를 첨벙이며 움직여요' },
      { trait: 'sensitive', text: '물이 닿자마자 몸이 굳어요' },
    ],
  },
];

// 6~11개월
const M6_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'm6-exp-1',
    ageGroup: 'm6', category: '새로운 자극', order: 1,
    question: '처음 보는 장난감을 눈앞에 놓아주면?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '한참 보다가 천천히 잡아요' },
      { trait: 'explorer', text: '바로 잡아서 이리저리 만져요' },
      { trait: 'harmony', text: '저를 한번 보고 나서 잡아요' },
      { trait: 'active', text: '잡자마자 흔들고 두드려요' },
      { trait: 'sensitive', text: '살짝 만졌다가 손을 거둬요' },
    ],
  },
  {
    id: 'm6-exp-2',
    ageGroup: 'm6', category: '먹기', order: 2,
    question: '이유식에 새 재료를 넣어주면?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '늘 먹던 것부터 먼저 먹어요' },
      { trait: 'explorer', text: '새 재료부터 먼저 받아먹어요' },
      { trait: 'harmony', text: '제 표정을 보고 따라 먹어요' },
      { trait: 'active', text: '입을 크게 벌려 빨리 먹어요' },
      { trait: 'sensitive', text: '입에 조금 물고 천천히 먹어요' },
    ],
  },
  {
    id: 'm6-act-1',
    ageGroup: 'm6', category: '일상 루틴', order: 3,
    question: '기저귀를 갈려고 눕히면?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '늘 하던 대로 가만히 있어요' },
      { trait: 'explorer', text: '옆에 놓인 물티슈로 손을 뻗어요' },
      { trait: 'harmony', text: '저를 보며 옹알이해요' },
      { trait: 'active', text: '몸을 뒤집고 버둥거려요' },
      { trait: 'sensitive', text: '찬 느낌에 몸을 움츠려요' },
    ],
  },
  {
    id: 'm6-act-4',
    ageGroup: 'm6', category: '목욕 시간', order: 4,
    question: '목욕물에 앉혀놓으면?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '늘 하던 대로 가만히 앉아 있어요' },
      { trait: 'explorer', text: '물에 뜬 장난감을 잡아 살펴봐요' },
      { trait: 'harmony', text: '제 얼굴 보며 소리를 내요' },
      { trait: 'active', text: '손발로 물을 세게 첨벙거려요' },
      { trait: 'sensitive', text: '물이 튀면 몸을 움츠려요' },
    ],
  },
  {
    id: 'm6-har-1',
    ageGroup: 'm6', category: '애착 놀이', order: 5,
    question: '까꿍놀이를 해주면?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '가리는 손을 가만히 지켜봐요' },
      { trait: 'explorer', text: '가린 천을 잡아당겨 봐요' },
      { trait: 'harmony', text: '저를 보며 활짝 웃어요' },
      { trait: 'active', text: '온몸을 흔들며 좋아해요' },
      { trait: 'sensitive', text: '갑자기 나타나면 움찔해요' },
    ],
  },
  {
    id: 'm6-har-3',
    ageGroup: 'm6', category: '소통', order: 6,
    question: '옹알이를 할 때 어떤 모습인가요?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '늘 내던 같은 소리를 반복해요' },
      { trait: 'explorer', text: '새로운 소리를 자꾸 내봐요' },
      { trait: 'harmony', text: '제가 답해주면 더 소리내요' },
      { trait: 'active', text: '몸 흔들며 크게 소리내요' },
      { trait: 'sensitive', text: '조용할 때만 작게 소리내요' },
    ],
  },
  {
    id: 'm6-ana-2',
    ageGroup: 'm6', category: '새로운 환경', order: 7,
    question: '처음 가는 집에 안고 들어가면?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '앉아서 한참 둘러봐요' },
      { trait: 'explorer', text: '손 닿는 물건을 만져봐요' },
      { trait: 'harmony', text: '그 집 사람 보며 웃어요' },
      { trait: 'active', text: '몸을 움직이며 소리를 내요' },
      { trait: 'sensitive', text: '저에게 붙어 떨어지지 않아요' },
    ],
  },
  {
    id: 'm6-ana-3',
    ageGroup: 'm6', category: '수면 루틴', order: 8,
    question: '잠자리에 눕혔을 때 모습은?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '늘 하던 순서여야 잠들어요' },
      { trait: 'explorer', text: '주변을 둘러보다 잠들어요' },
      { trait: 'harmony', text: '제 손을 잡고 잠들어요' },
      { trait: 'active', text: '한참 뒤척이다 잠들어요' },
      { trait: 'sensitive', text: '작은 소리에도 금방 깨요' },
    ],
  },
  {
    id: 'm6-sen-1',
    ageGroup: 'm6', category: '감각 반응', order: 9,
    question: '가까이서 큰 소리가 나면?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '늘 나던 소리면 그냥 있어요' },
      { trait: 'explorer', text: '소리 난 쪽을 찾아 쳐다봐요' },
      { trait: 'harmony', text: '제 얼굴부터 확인해요' },
      { trait: 'active', text: '따라서 소리내며 움직여요' },
      { trait: 'sensitive', text: '깜짝 놀라 울먹여요' },
    ],
  },
  {
    id: 'm6-sen-3',
    ageGroup: 'm6', category: '낯가림', order: 10,
    question: '낯선 사람이 안으려고 하면?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '익숙해질 때까지 지켜봐요' },
      { trait: 'explorer', text: '손을 뻗어 얼굴을 만져봐요' },
      { trait: 'harmony', text: '웃으면서 순순히 안겨요' },
      { trait: 'active', text: '몸을 움직이며 소리를 내요' },
      { trait: 'sensitive', text: '금세 울먹이며 저를 찾아요' },
    ],
  },
];

// 12~23개월
const M12_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'm12-exp-1',
    ageGroup: 'm12', category: '새로운 자극', order: 1,
    question: '처음 보는 장난감을 꺼내 놓으면?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '한참 보다가 천천히 만져요' },
      { trait: 'explorer', text: '바로 손을 뻗어 만져요' },
      { trait: 'harmony', text: '저를 한번 보고 나서 만져요' },
      { trait: 'active', text: '만졌다 놨다 계속 바꿔요' },
      { trait: 'sensitive', text: '제가 쥐여줘야 만져요' },
    ],
  },
  {
    id: 'm12-exp-4',
    ageGroup: 'm12', category: '식사', order: 2,
    question: '안 먹어본 음식을 접시에 올려주면?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '먹던 것부터 먹고 나중에 손대요' },
      { trait: 'explorer', text: '새 것부터 집어서 입에 넣어요' },
      { trait: 'harmony', text: '제가 먹는 걸 보고 따라 먹어요' },
      { trait: 'active', text: '손으로 집어 여기저기 옮겨요' },
      { trait: 'sensitive', text: '손끝으로 살짝 만져만 봐요' },
    ],
  },
  {
    id: 'm12-act-2',
    ageGroup: 'm12', category: '바깥 활동', order: 3,
    question: '놀이터 같은 넓은 곳에 데려가면?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '늘 가던 기구 쪽으로 걸어가요' },
      { trait: 'explorer', text: '처음 보는 기구 쪽으로 걸어가요' },
      { trait: 'harmony', text: '다른 아이들 있는 쪽으로 가요' },
      { trait: 'active', text: '넓은 데를 계속 걸어다녀요' },
      { trait: 'sensitive', text: '제 손을 잡고 천천히 움직여요' },
    ],
  },
  {
    id: 'm12-act-3',
    ageGroup: 'm12', category: '놀이', order: 4,
    question: '좋아하는 노래가 나오면?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '늘 하던 동작만 반복해요' },
      { trait: 'explorer', text: '새로운 동작을 따라 해봐요' },
      { trait: 'harmony', text: '저를 보며 같이 하자고 해요' },
      { trait: 'active', text: '온몸을 크게 흔들어요' },
      { trait: 'sensitive', text: '가만히 듣다가 살짝만 움직여요' },
    ],
  },
  {
    id: 'm12-har-2',
    ageGroup: 'm12', category: '일상', order: 5,
    question: '제가 집안일을 하고 있으면?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '늘 하던 놀이를 옆에서 해요' },
      { trait: 'explorer', text: '제가 쓰는 물건을 만져봐요' },
      { trait: 'harmony', text: '제 옆에 붙어 따라 해요' },
      { trait: 'active', text: '왔다 갔다 하며 물건을 옮겨요' },
      { trait: 'sensitive', text: '제가 보이는 자리에서 놀아요' },
    ],
  },
  {
    id: 'm12-har-4',
    ageGroup: 'm12', category: '의사표현', order: 6,
    question: '관심 가는 걸 발견했을 때?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '늘 가리키던 것을 또 가리켜요' },
      { trait: 'explorer', text: '처음 본 것을 가리켜요' },
      { trait: 'harmony', text: '저를 보면서 가리켜요' },
      { trait: 'active', text: '가리키면서 그쪽으로 걸어가요' },
      { trait: 'sensitive', text: '조용히 손끝으로 가리켜요' },
    ],
  },
  {
    id: 'm12-ana-2',
    ageGroup: 'm12', category: '놀이', order: 7,
    question: '블록이나 그릇을 손에 쥐여주면?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '늘 하던 방식대로 쌓거나 담아요' },
      { trait: 'explorer', text: '매번 다른 방법으로 해봐요' },
      { trait: 'harmony', text: '저랑 번갈아 가며 해요' },
      { trait: 'active', text: '빠르게 담았다 쏟았다 해요' },
      { trait: 'sensitive', text: '하나씩 천천히 맞춰 놔요' },
    ],
  },
  {
    id: 'm12-ana-3',
    ageGroup: 'm12', category: '놀이', order: 8,
    question: '그림책을 볼 때 모습은?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '늘 보던 책만 계속 봐요' },
      { trait: 'explorer', text: '새 책을 자꾸 꺼내 와요' },
      { trait: 'harmony', text: '제 무릎에 앉아 같이 봐요' },
      { trait: 'active', text: '책장을 빠르게 넘겨요' },
      { trait: 'sensitive', text: '한 장을 오래 들여다봐요' },
    ],
  },
  {
    id: 'm12-sen-1',
    ageGroup: 'm12', category: '자극 반응', order: 9,
    question: '청소기나 초인종 소리가 났을 때?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '소리 나는 쪽을 확인하러 가요' },
      { trait: 'explorer', text: '소리 나는 물건을 만져보러 가요' },
      { trait: 'harmony', text: '저를 보며 괜찮은지 확인해요' },
      { trait: 'active', text: '소리에 맞춰 몸을 움직여요' },
      { trait: 'sensitive', text: '놀라서 제게 안겨요' },
    ],
  },
  {
    id: 'm12-sen-2',
    ageGroup: 'm12', category: '일상', order: 10,
    question: '옷을 갈아입힐 때 아이는?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '늘 입던 옷이면 순순히 입어요' },
      { trait: 'explorer', text: '새 옷을 만져보며 입어요' },
      { trait: 'harmony', text: '저랑 눈 맞추면 잘 입어요' },
      { trait: 'active', text: '몸을 계속 움직여 입히기 힘들어요' },
      { trait: 'sensitive', text: '옷 느낌에 따라 싫어하기도 해요' },
    ],
  },
];

// 24~47개월
const M24_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'm24-exp-2',
    ageGroup: 'm24', category: '놀이', order: 1,
    question: '새 장난감을 꺼내주면 어떻게 하나요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '쓰던 방식 그대로 놀아요' },
      { trait: 'explorer', text: '이리저리 눌러보고 뒤집어봐요' },
      { trait: 'harmony', text: '저한테 들고 와 같이 놀자 해요' },
      { trait: 'active', text: '들고 뛰어다니며 놀아요' },
      { trait: 'sensitive', text: '조금 만져보다 제 눈치를 봐요' },
    ],
  },
  {
    id: 'm24-exp-3',
    ageGroup: 'm24', category: '식사', order: 2,
    question: '처음 보는 음식이 밥상에 올라오면요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '늘 먹던 것부터 먹어요' },
      { trait: 'explorer', text: '새 음식을 먼저 집어 먹어요' },
      { trait: 'harmony', text: '제가 먹는 걸 보고 따라 먹어요' },
      { trait: 'active', text: '한 입 먹고 일어나 돌아다녀요' },
      { trait: 'sensitive', text: '냄새 맡고 조금씩 대보다 먹어요' },
    ],
  },
  {
    id: 'm24-act-1',
    ageGroup: 'm24', category: '실내 놀이', order: 3,
    question: '비 와서 하루 종일 집에 있는 날은요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '늘 하던 놀이를 반복해요' },
      { trait: 'explorer', text: '서랍이나 다른 방을 열어봐요' },
      { trait: 'harmony', text: '자꾸 저를 놀이에 부르러 와요' },
      { trait: 'active', text: '소파에서 뛰어내리고 달려요' },
      { trait: 'sensitive', text: '조용한 자리에서 혼자 놀아요' },
    ],
  },
  {
    id: 'm24-act-2',
    ageGroup: 'm24', category: '음악·율동', order: 4,
    question: '신나는 노래가 나오면 어떻게 하나요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '늘 하던 같은 동작만 해요' },
      { trait: 'explorer', text: '새로운 동작을 만들어 해봐요' },
      { trait: 'harmony', text: '제 손 잡고 같이 추자고 해요' },
      { trait: 'active', text: '방을 돌며 크게 뛰어요' },
      { trait: 'sensitive', text: '몸을 살짝만 흔들며 봐요' },
    ],
  },
  {
    id: 'm24-har-1',
    ageGroup: 'm24', category: '또래 관계', order: 5,
    question: '놀이터에서 또래가 옆에 와서 놀면요?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '하던 놀이 하며 곁눈질해요' },
      { trait: 'explorer', text: '그 아이 장난감 쪽으로 가봐요' },
      { trait: 'harmony', text: '옆에 붙어서 따라 해요' },
      { trait: 'active', text: '그 아이 주변을 뛰어다녀요' },
      { trait: 'sensitive', text: '저를 한 번 보고 다시 놀아요' },
    ],
  },
  {
    id: 'm24-har-3',
    ageGroup: 'm24', category: '낯선 사람', order: 6,
    question: '손님이 집에 오면 아이는 어떻게 하나요?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '하던 놀이를 그대로 계속해요' },
      { trait: 'explorer', text: '손님 가방이나 물건을 구경해요' },
      { trait: 'harmony', text: '먼저 다가가 인사하고 말 걸어요' },
      { trait: 'active', text: '신나서 뛰어다녀요' },
      { trait: 'sensitive', text: '제 뒤에 숨었다 천천히 나와요' },
    ],
  },
  {
    id: 'm24-ana-1',
    ageGroup: 'm24', category: '잠자리', order: 7,
    question: '잠자리에 들 때 아이 모습은 어떤가요?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '순서가 늘 똑같아야 해요' },
      { trait: 'explorer', text: '책이나 물건을 새로 가져와요' },
      { trait: 'harmony', text: '제가 옆에 있어야 누워요' },
      { trait: 'active', text: '이불 위에서 뒹굴고 뛰어요' },
      { trait: 'sensitive', text: '인형이나 이불을 꼭 챙겨요' },
    ],
  },
  {
    id: 'm24-ana-2',
    ageGroup: 'm24', category: '놀이', order: 8,
    question: '블록을 가지고 놀 때 어떻게 하나요?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '같은 색끼리 줄 세워 놓아요' },
      { trait: 'explorer', text: '매번 다른 모양을 만들어봐요' },
      { trait: 'harmony', text: '만든 걸 저한테 보여주러 와요' },
      { trait: 'active', text: '쌓자마자 무너뜨리고 또 쌓아요' },
      { trait: 'sensitive', text: '천천히 하나씩 맞춰 놓아요' },
    ],
  },
  {
    id: 'm24-sen-1',
    ageGroup: 'm24', category: '감정', order: 9,
    question: '놀다가 넘어져서 살짝 아플 때는요?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '늘 하던 대로 밴드를 찾아요' },
      { trait: 'explorer', text: '털고 일어나 그쪽을 다시 봐요' },
      { trait: 'harmony', text: '저한테 안겨 위로받으려 해요' },
      { trait: 'active', text: '울다 말고 바로 뛰어가요' },
      { trait: 'sensitive', text: '한참 울고 계속 아프다고 해요' },
    ],
  },
  {
    id: 'm24-sen-2',
    ageGroup: 'm24', category: '자극 반응', order: 10,
    question: '청소기나 사이렌 같은 큰 소리가 나면요?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '무슨 소리인지 확인하러 가요' },
      { trait: 'explorer', text: '소리 나는 쪽으로 다가가요' },
      { trait: 'harmony', text: '제 손 잡고 같이 보자고 해요' },
      { trait: 'active', text: '따라서 더 큰 소리를 내요' },
      { trait: 'sensitive', text: '귀를 막고 자리를 피해요' },
    ],
  },
];

// 48~83개월
const M48_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'm48-exp-2',
    ageGroup: 'm48', category: '새로운 장소', order: 1,
    question: '처음 가 본 놀이터에 도착하면 어떻게 하나요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '늘 타던 것과 같은 걸 찾아요' },
      { trait: 'explorer', text: '안 타 본 기구부터 올라가요' },
      { trait: 'harmony', text: '아이들 놀고 있는 쪽으로 가요' },
      { trait: 'active', text: '여기저기 빠르게 옮겨 다녀요' },
      { trait: 'sensitive', text: '제 손을 잡고 천천히 들어가요' },
    ],
  },
  {
    id: 'm48-exp-3',
    ageGroup: 'm48', category: '식사', order: 2,
    question: '처음 보는 반찬이 식탁에 올라오면 어떻게 하나요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '뭘로 만든 건지 물어봐요' },
      { trait: 'explorer', text: '일단 한 입 먹어 봐요' },
      { trait: 'harmony', text: '제가 먹으면 따라 먹어요' },
      { trait: 'active', text: '얼른 먹고 자리에서 일어나요' },
      { trait: 'sensitive', text: '냄새를 맡아 보고 조심히 대요' },
    ],
  },
  {
    id: 'm48-act-1',
    ageGroup: 'm48', category: '아침 일과', order: 3,
    question: '아침에 잠에서 깨면 어떻게 하나요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '늘 하던 순서대로 준비해요' },
      { trait: 'explorer', text: '오늘 뭐 하는지부터 물어봐요' },
      { trait: 'harmony', text: '가족한테 먼저 인사하러 가요' },
      { trait: 'active', text: '일어나자마자 몸부터 움직여요' },
      { trait: 'sensitive', text: '한참 안겨 있다가 시작해요' },
    ],
  },
  {
    id: 'm48-act-2',
    ageGroup: 'm48', category: '바깥 이동', order: 4,
    question: '집을 나서서 길을 걸을 때 어떤 모습인가요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '늘 다니던 길로 가려고 해요' },
      { trait: 'explorer', text: '다른 길로 가 보자고 해요' },
      { trait: 'harmony', text: '제 손 잡고 이야기하며 걸어요' },
      { trait: 'active', text: '앞서 뛰어갔다 돌아와요' },
      { trait: 'sensitive', text: '소리나 차를 살피며 걸어요' },
    ],
  },
  {
    id: 'm48-har-1',
    ageGroup: 'm48', category: '또래 놀이', order: 5,
    question: '친구들이 이미 놀고 있는 곳에 가면 어떻게 하나요?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '뭐 하고 노는지 보고 들어가요' },
      { trait: 'explorer', text: '새 놀이를 하자고 말해요' },
      { trait: 'harmony', text: '바로 끼워 달라고 해요' },
      { trait: 'active', text: '뛰어들어 몸으로 같이 놀아요' },
      { trait: 'sensitive', text: '한 명 옆에서 천천히 시작해요' },
    ],
  },
  {
    id: 'm48-har-2',
    ageGroup: 'm48', category: '차례와 양보', order: 6,
    question: '친구와 같은 장난감을 하고 싶어 할 때 어떻게 하나요?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '순서를 정하자고 말해요' },
      { trait: 'explorer', text: '다른 재밌는 걸 가져와요' },
      { trait: 'harmony', text: '친구한테 먼저 하라고 해요' },
      { trait: 'active', text: '먼저 잡고 놀다가 넘겨줘요' },
      { trait: 'sensitive', text: '기다렸다가 나중에 말해요' },
    ],
  },
  {
    id: 'm48-ana-1',
    ageGroup: 'm48', category: '규칙 게임', order: 7,
    question: '처음 하는 규칙 있는 놀이를 시작할 때 어떤가요?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '규칙을 다 듣고 시작해요' },
      { trait: 'explorer', text: '일단 해 보면서 익혀요' },
      { trait: 'harmony', text: '같이 하는 게 좋아 바로 앉아요' },
      { trait: 'active', text: '자기 차례를 빨리 하고 싶어해요' },
      { trait: 'sensitive', text: '다른 사람 표정을 살피며 해요' },
    ],
  },
  {
    id: 'm48-ana-2',
    ageGroup: 'm48', category: '외출 준비', order: 8,
    question: '외출하려고 옷을 입을 때 어떤 모습인가요?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '늘 하던 순서대로 입어요' },
      { trait: 'explorer', text: '새로운 옷이나 조합을 골라요' },
      { trait: 'harmony', text: '저와 이야기하며 같이 입어요' },
      { trait: 'active', text: '후다닥 입고 먼저 나가요' },
      { trait: 'sensitive', text: '몸에 편한 옷만 찾아 입어요' },
    ],
  },
  {
    id: 'm48-sen-1',
    ageGroup: 'm48', category: '자극이 많은 환경', order: 9,
    question: '사람 많고 시끄러운 곳에 가면 어떻게 하나요?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '어디에 뭐가 있는지 살펴봐요' },
      { trait: 'explorer', text: '구경할 걸 찾아 돌아다녀요' },
      { trait: 'harmony', text: '저와 이야기하며 따라다녀요' },
      { trait: 'active', text: '신나서 빠르게 움직여요' },
      { trait: 'sensitive', text: '시끄럽다며 제 곁에 붙어요' },
    ],
  },
  {
    id: 'm48-sen-2',
    ageGroup: 'm48', category: '속상한 순간', order: 10,
    question: '놀다가 넘어져 조금 아플 때 어떻게 하나요?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '어쩌다 그랬는지 설명해요' },
      { trait: 'explorer', text: '다른 놀이로 금방 옮겨 가요' },
      { trait: 'harmony', text: '저한테 와서 안아 달라고 해요' },
      { trait: 'active', text: '금방 일어나 다시 뛰어놀아요' },
      { trait: 'sensitive', text: '한참 달래 줘야 진정돼요' },
    ],
  },
];

// 84~144개월 (초등)
const M84_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'm84-exp-1',
    ageGroup: 'm84', category: '학교생활', order: 1,
    question: '새 학기 첫날 교실에 들어갔을 때 어떤가요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '자리에 앉아서 먼저 찬찬히 둘러봐요' },
      { trait: 'explorer', text: '사물함이며 교실 여기저기 살펴봐요' },
      { trait: 'harmony', text: '옆자리 친구에게 먼저 말을 걸어요' },
      { trait: 'active', text: '한자리에 오래 못 앉고 자꾸 일어나요' },
      { trait: 'sensitive', text: '선생님과 친구들 표정을 조심스레 살펴요' },
    ],
  },
  {
    id: 'm84-exp-3',
    ageGroup: 'm84', category: '일상', order: 2,
    question: '식당에서 메뉴를 고를 때 어떤 편인가요?',
    temperamentTarget: 'explorer',
    options: [
      { trait: 'analyst', text: '늘 먹던 걸로 시켜요' },
      { trait: 'explorer', text: '처음 보는 메뉴를 시켜봐요' },
      { trait: 'harmony', text: '다 같이 나눠 먹을 걸로 시켜요' },
      { trait: 'active', text: '빨리 나오는 걸로 얼른 정해요' },
      { trait: 'sensitive', text: '맛이 어떤지 꼼꼼히 물어봐요' },
    ],
  },
  {
    id: 'm84-act-1',
    ageGroup: 'm84', category: '일상', order: 3,
    question: '학교 끝나고 집에 오면 제일 먼저 뭘 하나요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '늘 하던 순서대로 씻고 자리에 앉아요' },
      { trait: 'explorer', text: '새로 생긴 게 없나 집 안을 둘러봐요' },
      { trait: 'harmony', text: '오늘 있었던 일부터 이야기해요' },
      { trait: 'active', text: '가방만 두고 바로 나가 놀자고 해요' },
      { trait: 'sensitive', text: '조용한 데서 좀 쉬었다 움직여요' },
    ],
  },
  {
    id: 'm84-act-3',
    ageGroup: 'm84', category: '학습', order: 4,
    question: '숙제하는 동안 아이 모습은 어떤가요?',
    temperamentTarget: 'active',
    options: [
      { trait: 'analyst', text: '정해둔 순서대로 한자리에서 해요' },
      { trait: 'explorer', text: '다른 방법으로도 풀어보려 해요' },
      { trait: 'harmony', text: '옆에 같이 있어 달라고 해요' },
      { trait: 'active', text: '중간중간 일어나 움직였다 와요' },
      { trait: 'sensitive', text: '조용하고 정리된 자리를 찾아요' },
    ],
  },
  {
    id: 'm84-har-1',
    ageGroup: 'm84', category: '또래관계', order: 5,
    question: '친구들과 무슨 놀이 할지 정할 때 어떤가요?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '원래 하던 규칙대로 하자고 해요' },
      { trait: 'explorer', text: '새로운 놀이를 해보자고 해요' },
      { trait: 'harmony', text: '다들 좋다는 쪽으로 맞춰줘요' },
      { trait: 'active', text: '뛰어노는 놀이를 하자고 해요' },
      { trait: 'sensitive', text: '빠지는 친구가 없는지 살펴요' },
    ],
  },
  {
    id: 'm84-har-4',
    ageGroup: 'm84', category: '일상', order: 6,
    question: '가족이 다 같이 밥 먹을 때 어떤 편인가요?',
    temperamentTarget: 'harmony',
    options: [
      { trait: 'analyst', text: '궁금한 걸 자세히 물어봐요' },
      { trait: 'explorer', text: '오늘 새로 알게 된 걸 말해요' },
      { trait: 'harmony', text: '다 같이 이야기하게 말을 이어줘요' },
      { trait: 'active', text: '말하면서 몸짓이 커지고 신나 해요' },
      { trait: 'sensitive', text: '분위기가 가라앉으면 금방 알아채요' },
    ],
  },
  {
    id: 'm84-ana-2',
    ageGroup: 'm84', category: '일상', order: 7,
    question: '조립하는 장난감을 받으면 어떻게 시작하나요?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '설명서를 처음부터 읽고 시작해요' },
      { trait: 'explorer', text: '설명서 없이 먼저 이리저리 맞춰봐요' },
      { trait: 'harmony', text: '같이 만들자고 불러요' },
      { trait: 'active', text: '후딱 만들고 바로 갖고 놀아요' },
      { trait: 'sensitive', text: '망가질까 봐 조심조심 다뤄요' },
    ],
  },
  {
    id: 'm84-ana-3',
    ageGroup: 'm84', category: '일상', order: 8,
    question: '아침에 학교 갈 준비를 할 때 어떤가요?',
    temperamentTarget: 'analyst',
    options: [
      { trait: 'analyst', text: '늘 같은 순서로 챙겨요' },
      { trait: 'explorer', text: '그날 기분대로 이것저것 챙겨요' },
      { trait: 'harmony', text: '같이 준비하며 말을 걸어요' },
      { trait: 'active', text: '후다닥 챙기고 먼저 나가 있어요' },
      { trait: 'sensitive', text: '빠뜨린 게 없나 다시 확인해요' },
    ],
  },
  {
    id: 'm84-sen-1',
    ageGroup: 'm84', category: '정서', order: 9,
    question: '잘못해서 지적을 받으면 어떻게 반응하나요?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '뭐가 잘못됐는지 짚어서 물어봐요' },
      { trait: 'explorer', text: '다음엔 다르게 해보겠다고 해요' },
      { trait: 'harmony', text: '미안하다고 먼저 말해요' },
      { trait: 'active', text: '금방 털고 다시 하던 걸 해요' },
      { trait: 'sensitive', text: '한참 마음에 담아 둬요' },
    ],
  },
  {
    id: 'm84-sen-3',
    ageGroup: 'm84', category: '일상', order: 10,
    question: '사람 많은 마트나 행사장에 가면 어떤가요?',
    temperamentTarget: 'sensitive',
    options: [
      { trait: 'analyst', text: '어디부터 갈지 순서를 정해요' },
      { trait: 'explorer', text: '이것저것 구경하러 다녀요' },
      { trait: 'harmony', text: '옆에 붙어 이야기하며 다녀요' },
      { trait: 'active', text: '앞서 걸어가고 걸음이 빨라요' },
      { trait: 'sensitive', text: '시끄러우면 힘들다고 말해요' },
    ],
  },
];

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  ...M0_QUESTIONS,
  ...M6_QUESTIONS,
  ...M12_QUESTIONS,
  ...M24_QUESTIONS,
  ...M48_QUESTIONS,
  ...M84_QUESTIONS,
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
    question: t(`onboardingQuestions.${q.id}.question`, { defaultValue: q.question }),
    category: t(`onboardingQuestions.${q.id}.category`, { defaultValue: q.category }),
    options: q.options?.map((o, idx) => ({
      ...o,
      text: t(`onboardingQuestions.${q.id}.options.${idx}`, { defaultValue: o.text }),
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
  if (months <= 5) return 'm0';
  if (months <= 11) return 'm6';
  if (months <= 23) return 'm12';
  if (months <= 47) return 'm24';
  if (months <= 83) return 'm48';
  return 'm84';
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

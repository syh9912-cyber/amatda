// 대변 분석 데이터베이스 - 규칙 기반 패턴 매칭 (AI 불필요)
// 소아과 의학 정보 기반 영유아~초등 대변 분석 시스템

// ─── 타입 정의 ───────────────────────────────────────

export interface PoopOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export interface PoopCharacteristic {
  id: string;
  category: 'color' | 'consistency' | 'frequency' | 'content';
  label: string;
  options: PoopOption[];
}

export interface PoopDiagnosis {
  id: string;
  name: string;
  severity: 'normal' | 'watch' | 'warning' | 'urgent';
  description: string;
  causes: string[];
  actions: string[];
  whenToSeeDoctor: string;
}

export interface PoopRule {
  conditions: Record<string, string[]>; // category -> matching option ids
  diagnosisId: string;
  confidence: number; // 0-100
}

export interface PoopAnalysisResult {
  diagnosis: PoopDiagnosis;
  confidence: number;
  relatedDiagnoses: PoopDiagnosis[];
  isUrgent: boolean;
}

// ─── 특성 선택 데이터 ────────────────────────────────

export const POOP_CHARACTERISTICS: PoopCharacteristic[] = [
  {
    id: 'color',
    category: 'color',
    label: '색상',
    options: [
      {
        id: 'yellow',
        label: '노란색/겨자색',
        emoji: '🟡',
        description: '모유수유 아기의 정상 변 색깔',
      },
      {
        id: 'brown',
        label: '갈색',
        emoji: '🟤',
        description: '분유/이유식 시작 후 정상 변 색깔',
      },
      {
        id: 'green',
        label: '초록색',
        emoji: '🟢',
        description: '소화가 빠르거나 담즙 영향',
      },
      {
        id: 'orange',
        label: '주황색',
        emoji: '🟠',
        description: '당근, 고구마 등 베타카로틴 음식 섭취',
      },
      {
        id: 'black',
        label: '검은색/타르색',
        emoji: '⚫',
        description: '태변(신생아) 또는 상부 위장관 출혈 가능',
      },
      {
        id: 'red',
        label: '빨간색/혈변',
        emoji: '🔴',
        description: '하부 위장관 출혈, 항문열상 가능',
      },
      {
        id: 'white',
        label: '흰색/회색',
        emoji: '⚪',
        description: '담즙 분비 이상 가능성 (담도폐쇄 의심)',
      },
    ],
  },
  {
    id: 'consistency',
    category: 'consistency',
    label: '형태/묽기',
    options: [
      {
        id: 'watery',
        label: '물같은 설사',
        emoji: '💧',
        description: '물처럼 흐르는 매우 묽은 변',
      },
      {
        id: 'mushy',
        label: '묽은 죽 형태',
        emoji: '🥣',
        description: '죽처럼 부드럽고 퍼지는 형태',
      },
      {
        id: 'soft',
        label: '부드러운 고체',
        emoji: '🍌',
        description: '바나나처럼 부드러운 정상 형태',
      },
      {
        id: 'hard',
        label: '단단한 고체',
        emoji: '🪨',
        description: '딱딱하고 건조한 형태',
      },
      {
        id: 'pellet',
        label: '염소똥 (동글동글)',
        emoji: '🫘',
        description: '작고 동글동글한 알갱이 형태',
      },
      {
        id: 'foamy',
        label: '거품이 있는',
        emoji: '🫧',
        description: '거품이 섞여 있는 변',
      },
    ],
  },
  {
    id: 'content',
    category: 'content',
    label: '내용물',
    options: [
      {
        id: 'normal',
        label: '특이사항 없음',
        emoji: '✅',
        description: '별다른 내용물 없이 균일한 변',
      },
      {
        id: 'food_chunks',
        label: '음식물 조각 보임',
        emoji: '🥕',
        description: '소화되지 않은 음식 조각이 보임',
      },
      {
        id: 'mucus',
        label: '점액질',
        emoji: '🫠',
        description: '끈적한 점액이 섞여 있음',
      },
      {
        id: 'seedy',
        label: '씨앗 모양 알갱이',
        emoji: '🌾',
        description: '모유변에서 보이는 작은 알갱이',
      },
      {
        id: 'stringy',
        label: '실 같은 것',
        emoji: '🧵',
        description: '실이나 섬유 같은 것이 보임',
      },
    ],
  },
  {
    id: 'frequency',
    category: 'frequency',
    label: '빈도',
    options: [
      {
        id: 'freq_1_2',
        label: '하루 1-2회',
        emoji: '1️⃣',
        description: '일반적으로 정상 범위',
      },
      {
        id: 'freq_3_5',
        label: '하루 3-5회',
        emoji: '3️⃣',
        description: '모유수유 아기에게는 정상일 수 있음',
      },
      {
        id: 'freq_6_plus',
        label: '하루 6회 이상',
        emoji: '6️⃣',
        description: '잦은 배변, 설사 가능성',
      },
      {
        id: 'freq_every_2_3',
        label: '2-3일에 한번',
        emoji: '📅',
        description: '모유수유 아기에게는 정상일 수 있음',
      },
      {
        id: 'freq_over_4',
        label: '4일 이상 안 봄',
        emoji: '⏳',
        description: '변비 가능성, 관찰 필요',
      },
    ],
  },
];

// ─── 진단 데이터베이스 ───────────────────────────────

export const POOP_DIAGNOSES: Record<string, PoopDiagnosis> = {
  normal_breastfed: {
    id: 'normal_breastfed',
    name: '정상 모유변',
    severity: 'normal',
    description:
      '모유수유 아기의 전형적인 정상 대변입니다. 노란색~겨자색에 씨앗 모양 알갱이가 있고, 묽은 형태가 정상입니다.',
    causes: [
      '모유의 정상적인 소화 과정',
      '모유 속 유당과 지방의 소화 산물',
      '모유수유 아기는 하루 여러 번 보는 것이 정상',
    ],
    actions: [
      '현재 상태를 유지하세요',
      '모유수유를 계속하세요',
      '아기가 잘 먹고 체중이 늘고 있다면 걱정 없습니다',
    ],
    whenToSeeDoctor: '체중 증가가 없거나, 수유 거부, 38도 이상 발열 시',
  },
  normal_formula: {
    id: 'normal_formula',
    name: '정상 분유변',
    severity: 'normal',
    description:
      '분유수유 아기의 전형적인 정상 대변입니다. 갈색~연갈색이며 모유변보다 단단하고 냄새가 강한 편입니다.',
    causes: [
      '분유의 정상적인 소화 과정',
      '분유 속 철분과 단백질의 소화 산물',
      '하루 1-2회 배변이 일반적',
    ],
    actions: [
      '현재 수유량과 패턴을 유지하세요',
      '분유 농도를 정확히 맞춰 타세요',
      '아기가 편안해 보인다면 정상입니다',
    ],
    whenToSeeDoctor: '변이 너무 딱딱하거나, 피가 섞이거나, 3일 이상 변을 안 볼 때',
  },
  normal_weaning: {
    id: 'normal_weaning',
    name: '정상 이유식변',
    severity: 'normal',
    description:
      '이유식 시작 후 변의 색깔, 형태, 냄새가 변하는 것은 정상입니다. 먹은 음식에 따라 색이 달라질 수 있습니다.',
    causes: [
      '새로운 음식의 소화 적응 과정',
      '당근, 고구마 등은 주황색 변을 만듦',
      '시금치, 완두콩은 초록색 변을 만들 수 있음',
      '소화되지 않은 음식 조각이 보이는 것은 정상',
    ],
    actions: [
      '새로운 음식은 3일 간격으로 하나씩 시도하세요',
      '음식 조각이 보여도 소화력이 자라면 자연스럽게 줄어듭니다',
      '수분 섭취를 충분히 해주세요',
    ],
    whenToSeeDoctor: '특정 음식 후 두드러기, 구토, 심한 설사가 동반될 때',
  },
  mild_diarrhea: {
    id: 'mild_diarrhea',
    name: '경미한 설사',
    severity: 'watch',
    description:
      '평소보다 묽고 잦은 변을 보고 있지만 전반적 컨디션이 괜찮은 상태입니다. 대부분 자연 회복됩니다.',
    causes: [
      '바이러스성 장염 초기',
      '새로운 음식에 대한 적응 과정',
      '항생제 복용 부작용',
      '과일즙이나 주스 과다 섭취',
    ],
    actions: [
      '수분 보충을 충분히 해주세요 (모유/분유/전해질 음료)',
      '기저귀 발진 예방을 위해 자주 갈아주세요',
      '장에 부담 되는 음식(기름진 음식, 유제품)은 줄이세요',
      '2-3일 이내 호전되는지 관찰하세요',
    ],
    whenToSeeDoctor: '3일 이상 지속되거나, 발열 동반, 수유 거부, 소변량 감소 시',
  },
  severe_diarrhea: {
    id: 'severe_diarrhea',
    name: '심한 설사 (탈수 위험)',
    severity: 'warning',
    description:
      '하루 6회 이상의 물같은 설사는 탈수 위험이 있습니다. 특히 영아는 빠르게 탈수가 진행될 수 있어 주의가 필요합니다.',
    causes: [
      '로타바이러스, 노로바이러스 등 장염',
      '세균성 장염 (살모넬라, 대장균 등)',
      '심한 식이 알레르기 반응',
      '유당불내증',
    ],
    actions: [
      '경구 수액 보충제(ORS)로 수분 보충하세요',
      '소변 횟수와 양을 체크하세요 (탈수 지표)',
      '모유수유 중이라면 자주 수유하세요',
      '입술 건조, 눈물 없이 울기, 대천문 함몰 등 탈수 징후를 관찰하세요',
      '가능하면 당일 소아과 진료를 받으세요',
    ],
    whenToSeeDoctor: '즉시 병원 방문 권장. 특히 6개월 미만 영아, 발열 38.5도 이상, 8시간 이상 소변 없을 때',
  },
  mild_constipation: {
    id: 'mild_constipation',
    name: '변비 (경미)',
    severity: 'watch',
    description:
      '배변 간격이 길어지고 변이 단단해진 상태입니다. 식이 조절과 수분 섭취로 개선될 수 있습니다.',
    causes: [
      '수분 섭취 부족',
      '식이섬유 부족',
      '분유 변경이나 이유식 시작',
      '배변 훈련 스트레스',
    ],
    actions: [
      '수분 섭취를 늘려주세요',
      '배 마사지를 시계 방향으로 해주세요',
      '이유식 중이라면 섬유질이 풍부한 과일(배, 자두)을 추가하세요',
      '자전거 다리 운동으로 장 운동을 도와주세요',
    ],
    whenToSeeDoctor: '5일 이상 변을 안 보거나, 배가 딱딱하게 부풀거나, 통증으로 울 때',
  },
  severe_constipation: {
    id: 'severe_constipation',
    name: '변비 (심함)',
    severity: 'warning',
    description:
      '4일 이상 배변이 없고 변이 매우 단단한 상태입니다. 의료 상담이 필요할 수 있습니다.',
    causes: [
      '만성적 수분/섬유질 부족',
      '장 운동 기능 저하',
      '특정 약물 부작용',
      '드물게 선천성 거대결장증(히르쉬스프룽병)',
    ],
    actions: [
      '소아과 진료를 받으세요',
      '의사 처방 없이 관장이나 변비약 사용을 삼가세요',
      '배 마사지와 충분한 수분 섭취를 병행하세요',
      '식이 일지를 작성해서 진료 시 가져가세요',
    ],
    whenToSeeDoctor: '즉시 소아과 방문 권장. 특히 구토 동반, 복부 팽만, 혈변 시',
  },
  indigestion: {
    id: 'indigestion',
    name: '소화불량',
    severity: 'watch',
    description:
      '소화되지 않은 음식물 조각이 많이 보이거나 변에 거품이 섞여 있는 경우입니다. 대부분 심각하지 않습니다.',
    causes: [
      '이유식 재료가 충분히 익지 않았거나 입자가 클 때',
      '아이의 소화 발달 단계에 비해 단단한 음식을 먹였을 때',
      '과식 또는 너무 빨리 먹었을 때',
      '소화효소 분비가 아직 미성숙한 경우',
    ],
    actions: [
      '이유식 재료를 더 잘게 다지거나 오래 익혀주세요',
      '한 번에 소량씩 천천히 먹이세요',
      '새로운 음식은 소량부터 시작하세요',
      '소화가 안 되는 특정 음식이 있다면 일시적으로 중단하세요',
    ],
    whenToSeeDoctor: '지속적인 구토, 체중 감소, 성장 지연이 보일 때',
  },
  lactose_intolerance: {
    id: 'lactose_intolerance',
    name: '유당불내증 의심',
    severity: 'watch',
    description:
      '유제품 섭취 후 거품이 있는 묽은 변, 복부 팽만감, 가스가 잦은 경우 유당불내증을 의심할 수 있습니다.',
    causes: [
      '유당 분해 효소(락타아제) 부족',
      '장염 후 일시적 유당불내증 (이차성)',
      '유전적 유당불내증 (보통 3세 이후 발현)',
    ],
    actions: [
      '유제품 섭취 후 증상 발생 여부를 기록하세요',
      '일시적으로 유제품을 줄여보고 변화를 관찰하세요',
      '분유 수유 중이라면 유당 제거 분유로 변경을 검토하세요',
      '소아과에서 유당불내증 검사를 받아보세요',
    ],
    whenToSeeDoctor: '체중 증가 부진, 지속적 설사, 복부 팽만이 심할 때',
  },
  food_allergy: {
    id: 'food_allergy',
    name: '식이 알레르기 의심',
    severity: 'warning',
    description:
      '특정 음식 섭취 후 점액변, 혈변, 설사가 반복된다면 식이 알레르기를 의심할 수 있습니다. 우유 단백질 알레르기가 가장 흔합니다.',
    causes: [
      '우유 단백질 알레르기 (가장 흔함)',
      '달걀, 밀, 대두 알레르기',
      '모유수유 중 엄마가 먹은 음식에 대한 반응',
    ],
    actions: [
      '의심되는 음식을 즉시 중단하세요',
      '어떤 음식 후 증상이 나타났는지 기록하세요',
      '소아과 또는 소아 알레르기 전문의 진료를 받으세요',
      '모유수유 중이라면 엄마의 식단도 점검하세요',
    ],
    whenToSeeDoctor: '혈변, 심한 구토, 발진, 호흡 곤란이 동반될 때 즉시 병원 방문',
  },
  gastroenteritis: {
    id: 'gastroenteritis',
    name: '장염 의심',
    severity: 'warning',
    description:
      '물같은 설사와 함께 발열, 구토가 동반되는 경우 바이러스성 또는 세균성 장염을 의심합니다.',
    causes: [
      '로타바이러스 (영아에게 가장 흔함)',
      '노로바이러스',
      '세균성 장염 (살모넬라, 캄필로박터 등)',
      '오염된 음식이나 물 섭취',
    ],
    actions: [
      '탈수 예방이 최우선입니다 - 소량씩 자주 수분 보충하세요',
      '구토가 심하면 숟가락으로 조금씩 수분을 주세요',
      '기저귀 교체 후 손 씻기를 철저히 하세요',
      '다른 아이들과의 접촉을 줄이세요',
      '소아과 진료를 받으세요',
    ],
    whenToSeeDoctor: '고열(38.5도 이상), 8시간 이상 소변 없음, 피가 섞인 변, 심한 복통 시 즉시 병원',
  },
  bloody_stool: {
    id: 'bloody_stool',
    name: '혈변',
    severity: 'urgent',
    description:
      '대변에 빨간 피가 섞여 있는 경우입니다. 원인에 따라 긴급 조치가 필요할 수 있으므로 반드시 병원을 방문하세요.',
    causes: [
      '항문 열상 (가장 흔한 원인, 변비로 인한)',
      '우유 단백질 알레르기',
      '세균성 장염',
      '장중첩증 (긴급, 복통 동반)',
      '메켈 게실',
    ],
    actions: [
      '즉시 소아과 또는 응급실을 방문하세요',
      '혈변 기저귀를 사진으로 기록하세요 (진료 시 참고)',
      '아이의 상태(울음, 복통, 발열 등)를 관찰하세요',
      '갑작스러운 심한 복통과 잼 같은 혈변은 장중첩증 가능성 - 즉시 응급실',
    ],
    whenToSeeDoctor: '즉시 병원 방문이 필요합니다. 특히 복통, 구토, 발열 동반 시 응급실로 가세요.',
  },
  black_stool: {
    id: 'black_stool',
    name: '흑색변',
    severity: 'urgent',
    description:
      '검은 타르색 변은 신생아 태변이 아닌 경우 상부 위장관 출혈을 의미할 수 있어 즉시 진료가 필요합니다.',
    causes: [
      '신생아 태변 (출생 후 2-3일, 정상)',
      '상부 위장관 출혈 (위, 식도)',
      '철분 보충제 복용 (검은 변 유발 가능, 정상)',
      '비스무스 제제 복용',
    ],
    actions: [
      '신생아(출생 후 3일 이내)의 태변이라면 정상입니다',
      '철분제 복용 중이 아니라면 즉시 병원을 방문하세요',
      '변 색깔을 사진으로 기록하세요',
      '최근 먹은 음식이나 약을 확인하세요',
    ],
    whenToSeeDoctor: '태변이나 철분제 복용이 아닌 경우 즉시 병원 방문. 구토, 창백함, 무기력 동반 시 응급실.',
  },
  white_stool: {
    id: 'white_stool',
    name: '백색변 (담도폐쇄 의심)',
    severity: 'urgent',
    description:
      '흰색이나 회색 변은 담즙이 장으로 분비되지 않는 것을 의미합니다. 담도폐쇄증 등 심각한 질환의 신호일 수 있어 즉시 진료가 필요합니다.',
    causes: [
      '담도폐쇄증 (신생아에서 가장 중요한 원인)',
      '간염',
      '담석 (소아에서는 드묾)',
      '제산제 과다 복용',
    ],
    actions: [
      '즉시 소아과를 방문하세요',
      '변 색깔을 사진으로 기록하세요',
      '피부나 눈 흰자가 노랗게 변했는지(황달) 확인하세요',
      '소변 색이 진한 갈색인지 확인하세요',
    ],
    whenToSeeDoctor: '즉시 병원 방문이 필요합니다. 담도폐쇄증은 조기 진단이 매우 중요합니다.',
  },
  mucus_stool: {
    id: 'mucus_stool',
    name: '점액변 (감염 의심)',
    severity: 'watch',
    description:
      '점액이 섞인 변은 장 점막의 자극을 의미합니다. 감기, 이가 날 때도 나타날 수 있지만, 지속되면 감염을 의심합니다.',
    causes: [
      '감기 등 상기도 감염 시 삼킨 콧물',
      '이가 나는 시기의 과도한 침 분비',
      '세균성 또는 바이러스성 장염',
      '식이 알레르기 (우유 단백질 등)',
      '장내 기생충 감염',
    ],
    actions: [
      '1-2일 관찰하면서 다른 증상이 동반되는지 확인하세요',
      '발열, 혈변, 심한 설사가 동반되면 병원을 방문하세요',
      '수분 섭취를 충분히 해주세요',
      '최근 새로 먹인 음식이 있다면 기록해두세요',
    ],
    whenToSeeDoctor: '3일 이상 지속, 혈변 동반, 발열 38도 이상, 체중 감소 시',
  },
  green_fast_transit: {
    id: 'green_fast_transit',
    name: '초록변 (빠른 장 통과)',
    severity: 'normal',
    description:
      '초록색 변은 담즙이 완전히 분해되기 전에 장을 통과한 것입니다. 대부분 정상이며, 특히 모유수유 아기에게 흔합니다.',
    causes: [
      '장 통과 시간이 빠른 경우',
      '모유수유 시 전유(foremilk)를 많이 먹은 경우',
      '철분 보충제 복용',
      '녹색 채소(시금치, 브로콜리) 섭취',
      '분유 변경',
    ],
    actions: [
      '대부분 걱정할 필요 없습니다',
      '모유수유 중이라면 한쪽 유방을 충분히 비운 후 교대하세요',
      '아기가 잘 먹고 기분이 좋다면 정상입니다',
      '지속되면서 설사, 발열이 동반되면 병원을 방문하세요',
    ],
    whenToSeeDoctor: '2주 이상 지속되거나, 설사/발열/구토가 동반될 때',
  },
  orange_stool: {
    id: 'orange_stool',
    name: '주황색변 (식이성)',
    severity: 'normal',
    description:
      '주황색 변은 베타카로틴이 풍부한 음식을 먹었을 때 나타나는 정상적인 변화입니다.',
    causes: [
      '당근, 고구마, 호박 등 베타카로틴 식품 섭취',
      '특정 분유의 색소',
      '비타민 보충제',
    ],
    actions: [
      '걱정할 필요 없는 정상 변화입니다',
      '해당 음식 섭취를 줄이면 자연스럽게 돌아옵니다',
      '다양한 음식을 골고루 먹이세요',
    ],
    whenToSeeDoctor: '주황색 음식을 먹이지 않았는데 지속될 때, 또는 다른 증상 동반 시',
  },
  foamy_stool: {
    id: 'foamy_stool',
    name: '거품변',
    severity: 'watch',
    description:
      '거품이 있는 변은 유당 소화 문제나 전유-후유 불균형을 시사할 수 있습니다.',
    causes: [
      '모유수유 시 전유(foremilk) 과다 섭취',
      '유당 소화 어려움',
      '장내 가스 과다 생성',
      '장염 초기 증상일 수 있음',
    ],
    actions: [
      '모유수유 시 한쪽 유방을 충분히 비운 후 교대하세요',
      '수유 후 트림을 잘 시켜주세요',
      '분유 수유 중이라면 분유 종류 변경을 고려하세요',
      '지속되면 유당불내증 검사를 받아보세요',
    ],
    whenToSeeDoctor: '2주 이상 지속, 체중 증가 부진, 심한 복부 팽만 시',
  },
};

// ─── 진단 규칙 ───────────────────────────────────────

export const POOP_RULES: PoopRule[] = [
  // === 긴급 (urgent) - 최우선 매칭 ===
  {
    conditions: { color: ['red'] },
    diagnosisId: 'bloody_stool',
    confidence: 95,
  },
  {
    conditions: { color: ['black'] },
    diagnosisId: 'black_stool',
    confidence: 90,
  },
  {
    conditions: { color: ['white'] },
    diagnosisId: 'white_stool',
    confidence: 95,
  },

  // === 혈변 + 점액 조합 ===
  {
    conditions: { color: ['red'], content: ['mucus'] },
    diagnosisId: 'bloody_stool',
    confidence: 98,
  },
  {
    conditions: { color: ['red'], consistency: ['watery'] },
    diagnosisId: 'bloody_stool',
    confidence: 97,
  },

  // === 장염 의심 ===
  {
    conditions: { consistency: ['watery'], frequency: ['freq_6_plus'] },
    diagnosisId: 'severe_diarrhea',
    confidence: 90,
  },
  {
    conditions: { consistency: ['watery'], frequency: ['freq_6_plus'], content: ['mucus'] },
    diagnosisId: 'gastroenteritis',
    confidence: 92,
  },
  {
    conditions: { color: ['green'], consistency: ['watery'], frequency: ['freq_6_plus'] },
    diagnosisId: 'gastroenteritis',
    confidence: 88,
  },
  {
    conditions: { color: ['green'], consistency: ['watery'], content: ['mucus'] },
    diagnosisId: 'gastroenteritis',
    confidence: 85,
  },

  // === 심한 설사 ===
  {
    conditions: { consistency: ['watery'], frequency: ['freq_3_5'] },
    diagnosisId: 'mild_diarrhea',
    confidence: 75,
  },
  {
    conditions: { consistency: ['watery'], frequency: ['freq_1_2'] },
    diagnosisId: 'mild_diarrhea',
    confidence: 65,
  },

  // === 식이 알레르기 ===
  {
    conditions: { content: ['mucus'], color: ['red'] },
    diagnosisId: 'food_allergy',
    confidence: 80,
  },
  {
    conditions: { content: ['mucus'], consistency: ['watery'], color: ['green'] },
    diagnosisId: 'food_allergy',
    confidence: 70,
  },

  // === 유당불내증 ===
  {
    conditions: { consistency: ['foamy'], color: ['green'] },
    diagnosisId: 'lactose_intolerance',
    confidence: 75,
  },
  {
    conditions: { consistency: ['foamy'], frequency: ['freq_3_5'] },
    diagnosisId: 'lactose_intolerance',
    confidence: 70,
  },
  {
    conditions: { consistency: ['foamy'], frequency: ['freq_6_plus'] },
    diagnosisId: 'lactose_intolerance',
    confidence: 78,
  },

  // === 거품변 ===
  {
    conditions: { consistency: ['foamy'] },
    diagnosisId: 'foamy_stool',
    confidence: 70,
  },
  {
    conditions: { consistency: ['foamy'], color: ['yellow'] },
    diagnosisId: 'foamy_stool',
    confidence: 72,
  },

  // === 점액변 ===
  {
    conditions: { content: ['mucus'] },
    diagnosisId: 'mucus_stool',
    confidence: 70,
  },
  {
    conditions: { content: ['mucus'], consistency: ['mushy'] },
    diagnosisId: 'mucus_stool',
    confidence: 75,
  },

  // === 변비 (심함) ===
  {
    conditions: { consistency: ['pellet'], frequency: ['freq_over_4'] },
    diagnosisId: 'severe_constipation',
    confidence: 90,
  },
  {
    conditions: { consistency: ['hard'], frequency: ['freq_over_4'] },
    diagnosisId: 'severe_constipation',
    confidence: 88,
  },

  // === 변비 (경미) ===
  {
    conditions: { consistency: ['pellet'], frequency: ['freq_every_2_3'] },
    diagnosisId: 'mild_constipation',
    confidence: 80,
  },
  {
    conditions: { consistency: ['hard'], frequency: ['freq_every_2_3'] },
    diagnosisId: 'mild_constipation',
    confidence: 78,
  },
  {
    conditions: { consistency: ['pellet'] },
    diagnosisId: 'mild_constipation',
    confidence: 65,
  },
  {
    conditions: { consistency: ['hard'] },
    diagnosisId: 'mild_constipation',
    confidence: 60,
  },
  {
    conditions: { frequency: ['freq_over_4'] },
    diagnosisId: 'severe_constipation',
    confidence: 70,
  },
  {
    conditions: { frequency: ['freq_every_2_3'], consistency: ['hard', 'pellet'] },
    diagnosisId: 'mild_constipation',
    confidence: 75,
  },

  // === 소화불량 ===
  {
    conditions: { content: ['food_chunks'] },
    diagnosisId: 'indigestion',
    confidence: 65,
  },
  {
    conditions: { content: ['food_chunks'], consistency: ['mushy'] },
    diagnosisId: 'indigestion',
    confidence: 72,
  },
  {
    conditions: { content: ['food_chunks'], color: ['green'] },
    diagnosisId: 'indigestion',
    confidence: 70,
  },

  // === 초록변 (빠른 장 통과) ===
  {
    conditions: { color: ['green'] },
    diagnosisId: 'green_fast_transit',
    confidence: 65,
  },
  {
    conditions: { color: ['green'], consistency: ['mushy'] },
    diagnosisId: 'green_fast_transit',
    confidence: 70,
  },
  {
    conditions: { color: ['green'], content: ['seedy'] },
    diagnosisId: 'green_fast_transit',
    confidence: 72,
  },

  // === 주황색변 ===
  {
    conditions: { color: ['orange'] },
    diagnosisId: 'orange_stool',
    confidence: 80,
  },
  {
    conditions: { color: ['orange'], content: ['food_chunks'] },
    diagnosisId: 'orange_stool',
    confidence: 85,
  },

  // === 정상 모유변 ===
  {
    conditions: { color: ['yellow'], content: ['seedy'] },
    diagnosisId: 'normal_breastfed',
    confidence: 95,
  },
  {
    conditions: { color: ['yellow'], consistency: ['mushy'], content: ['seedy'] },
    diagnosisId: 'normal_breastfed',
    confidence: 98,
  },
  {
    conditions: { color: ['yellow'], consistency: ['mushy'] },
    diagnosisId: 'normal_breastfed',
    confidence: 82,
  },
  {
    conditions: { color: ['yellow'], frequency: ['freq_3_5'] },
    diagnosisId: 'normal_breastfed',
    confidence: 78,
  },
  {
    conditions: { color: ['yellow'], consistency: ['mushy'], frequency: ['freq_3_5'] },
    diagnosisId: 'normal_breastfed',
    confidence: 90,
  },

  // === 정상 분유변 ===
  {
    conditions: { color: ['brown'], consistency: ['soft'] },
    diagnosisId: 'normal_formula',
    confidence: 90,
  },
  {
    conditions: { color: ['brown'], consistency: ['soft'], frequency: ['freq_1_2'] },
    diagnosisId: 'normal_formula',
    confidence: 95,
  },
  {
    conditions: { color: ['brown'], frequency: ['freq_1_2'] },
    diagnosisId: 'normal_formula',
    confidence: 80,
  },
  {
    conditions: { color: ['brown'] },
    diagnosisId: 'normal_formula',
    confidence: 70,
  },

  // === 정상 이유식변 ===
  {
    conditions: { color: ['brown'], content: ['food_chunks'] },
    diagnosisId: 'normal_weaning',
    confidence: 85,
  },
  {
    conditions: { color: ['brown'], content: ['food_chunks'], consistency: ['soft'] },
    diagnosisId: 'normal_weaning',
    confidence: 90,
  },
  {
    conditions: { color: ['orange'], content: ['food_chunks'] },
    diagnosisId: 'normal_weaning',
    confidence: 82,
  },
  {
    conditions: { color: ['green'], content: ['food_chunks'] },
    diagnosisId: 'normal_weaning',
    confidence: 78,
  },

  // === 노란색 기본 (정상) ===
  {
    conditions: { color: ['yellow'] },
    diagnosisId: 'normal_breastfed',
    confidence: 65,
  },
  {
    conditions: { color: ['yellow'], consistency: ['soft'] },
    diagnosisId: 'normal_breastfed',
    confidence: 75,
  },
];

// ─── 분석 함수 ───────────────────────────────────────

function countMatchingConditions(
  rule: PoopRule,
  selectedOptions: Record<string, string>
): number {
  let matches = 0;
  const categories = Object.keys(rule.conditions);

  for (const category of categories) {
    const acceptableValues = rule.conditions[category];
    const selectedValue = selectedOptions[category];
    if (selectedValue && acceptableValues.includes(selectedValue)) {
      matches += 1;
    }
  }

  return matches;
}

function doesRuleMatch(
  rule: PoopRule,
  selectedOptions: Record<string, string>
): boolean {
  const categories = Object.keys(rule.conditions);

  for (const category of categories) {
    const acceptableValues = rule.conditions[category];
    const selectedValue = selectedOptions[category];
    if (!selectedValue || !acceptableValues.includes(selectedValue)) {
      return false;
    }
  }

  return true;
}

export function analyzePoopByCharacteristics(
  selectedOptions: Record<string, string>
): PoopAnalysisResult {
  // 매칭되는 규칙 찾기
  const matchedRules: Array<{ rule: PoopRule; matchCount: number }> = [];

  for (const rule of POOP_RULES) {
    if (doesRuleMatch(rule, selectedOptions)) {
      const matchCount = countMatchingConditions(rule, selectedOptions);
      matchedRules.push({ rule, matchCount });
    }
  }

  // 정렬: 조건 수 많은 순 > 신뢰도 높은 순 > 긴급도 높은 순
  matchedRules.sort((a, b) => {
    // 조건 일치 수가 많을수록 우선
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    // 신뢰도가 높을수록 우선
    if (b.rule.confidence !== a.rule.confidence) return b.rule.confidence - a.rule.confidence;
    // 심각도가 높을수록 우선
    const severityOrder: Record<string, number> = { urgent: 4, warning: 3, watch: 2, normal: 1 };
    const diagA = POOP_DIAGNOSES[a.rule.diagnosisId];
    const diagB = POOP_DIAGNOSES[b.rule.diagnosisId];
    const sevA = diagA ? severityOrder[diagA.severity] ?? 0 : 0;
    const sevB = diagB ? severityOrder[diagB.severity] ?? 0 : 0;
    return sevB - sevA;
  });

  // urgent 진단이 매칭되면 항상 최우선
  const urgentMatch = matchedRules.find((m) => {
    const diag = POOP_DIAGNOSES[m.rule.diagnosisId];
    return diag && diag.severity === 'urgent';
  });

  const bestMatch = urgentMatch ?? matchedRules[0];

  // 기본 진단 (매칭 없을 경우)
  const fallbackDiagnosis: PoopDiagnosis = {
    id: 'unknown',
    name: '추가 관찰 필요',
    severity: 'watch',
    description:
      '선택하신 특성 조합으로는 명확한 판단이 어렵습니다. 아이의 전반적인 컨디션을 관찰하고, 걱정되시면 소아과를 방문하세요.',
    causes: ['다양한 원인이 가능합니다'],
    actions: [
      '아이의 전반적인 상태(기분, 식욕, 활동량)를 관찰하세요',
      '변의 변화를 2-3일 기록하세요',
      '걱정되시면 소아과 진료를 받으세요',
    ],
    whenToSeeDoctor: '발열, 구토, 혈변, 체중 감소 등 추가 증상이 나타날 때',
  };

  if (!bestMatch) {
    return {
      diagnosis: fallbackDiagnosis,
      confidence: 30,
      relatedDiagnoses: [],
      isUrgent: false,
    };
  }

  const primaryDiagnosis = POOP_DIAGNOSES[bestMatch.rule.diagnosisId] ?? fallbackDiagnosis;

  // 관련 진단 수집 (상위 3개, 중복 제거)
  const seenIds = new Set<string>([primaryDiagnosis.id]);
  const relatedDiagnoses: PoopDiagnosis[] = [];

  for (const match of matchedRules) {
    if (relatedDiagnoses.length >= 3) break;
    const diagId = match.rule.diagnosisId;
    if (!seenIds.has(diagId)) {
      const diag = POOP_DIAGNOSES[diagId];
      if (diag) {
        seenIds.add(diagId);
        relatedDiagnoses.push(diag);
      }
    }
  }

  const isUrgent = primaryDiagnosis.severity === 'urgent';

  return {
    diagnosis: primaryDiagnosis,
    confidence: bestMatch.rule.confidence,
    relatedDiagnoses,
    isUrgent,
  };
}

// ─── 심각도 라벨/색상 헬퍼 ───────────────────────────

export const SEVERITY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  normal: { label: '정상', color: '#2A8F7A', bgColor: '#7DD3B8' },
  watch: { label: '관찰', color: '#8B6914', bgColor: '#FFD76E' },
  warning: { label: '주의', color: '#A04520', bgColor: '#FF8C5A' },
  urgent: { label: '위험', color: '#FFFFFF', bgColor: '#FF4444' },
};

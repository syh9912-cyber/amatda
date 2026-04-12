// ─────────────────────────────────────────────
// 울음소리 규칙 기반 분석 데이터베이스
// AI 불필요 — 부모가 선택한 특성 조합으로 진단
// ─────────────────────────────────────────────

/* ── 타입 정의 ── */

export interface CryOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export interface CryCharacteristic {
  id: string;
  category: 'pitch' | 'pattern' | 'intensity' | 'duration' | 'timing' | 'bodyLanguage';
  label: string;
  description: string;
  options: CryOption[];
}

export interface CryDiagnosis {
  id: string;
  name: string;
  emoji: string;
  severity: 'normal' | 'attention' | 'warning';
  description: string;
  possibleCauses: string[];
  soothingMethods: string[];
  whenToWorry: string;
}

export interface CryRule {
  conditions: Record<string, string[]>;
  diagnosisId: string;
  confidence: number;
}

export interface CryAnalysisResult {
  diagnosis: CryDiagnosis;
  confidence: number;
  relatedDiagnoses: CryDiagnosis[];
  needsAttention: boolean;
}

/* ── 특성 데이터 ── */

export const CRY_CHARACTERISTICS: CryCharacteristic[] = [
  {
    id: 'pitch',
    category: 'pitch',
    label: '음높이',
    description: '울음소리의 높낮이를 선택해 주세요',
    options: [
      {
        id: 'low',
        label: '낮은 울음',
        emoji: '🔈',
        description: '으앙~ 하고 낮게 우는 소리',
      },
      {
        id: 'medium',
        label: '중간 울음',
        emoji: '🔉',
        description: '보통 높이의 울음소리',
      },
      {
        id: 'high',
        label: '높고 날카로운 울음',
        emoji: '🔊',
        description: '깨갱! 하고 높고 날카롭게 우는 소리',
      },
      {
        id: 'weak',
        label: '가늘고 약한 울음',
        emoji: '🤫',
        description: '힘없이 가늘게 우는 소리',
      },
    ],
  },
  {
    id: 'pattern',
    category: 'pattern',
    label: '패턴',
    description: '울음의 패턴을 선택해 주세요',
    options: [
      {
        id: 'rhythmic',
        label: '리듬적 반복',
        emoji: '🔄',
        description: '울다가 쉬다가를 반복',
      },
      {
        id: 'continuous',
        label: '지속적',
        emoji: '➡️',
        description: '쉬지 않고 계속 울음',
      },
      {
        id: 'sudden',
        label: '갑자기 시작',
        emoji: '⚡',
        description: '갑자기 울음이 터짐',
      },
      {
        id: 'escalating',
        label: '점점 커지는',
        emoji: '📈',
        description: '작게 시작해서 점점 세짐',
      },
      {
        id: 'intermittent',
        label: '간헐적',
        emoji: '💧',
        description: '가끔씩 울다 그치다 반복',
      },
    ],
  },
  {
    id: 'intensity',
    category: 'intensity',
    label: '강도',
    description: '울음의 세기를 선택해 주세요',
    options: [
      {
        id: 'fussy',
        label: '약한 칭얼거림',
        emoji: '😐',
        description: '짜증내듯 약하게 칭얼거림',
      },
      {
        id: 'moderate',
        label: '보통 울음',
        emoji: '😢',
        description: '보통 세기로 울음',
      },
      {
        id: 'intense',
        label: '격렬한 울음',
        emoji: '😭',
        description: '세게 울음, 얼굴이 붉어짐',
      },
      {
        id: 'screaming',
        label: '비명에 가까운',
        emoji: '😱',
        description: '비명처럼 격렬하게 울음',
      },
    ],
  },
  {
    id: 'duration',
    category: 'duration',
    label: '지속시간',
    description: '울음이 얼마나 지속되었나요?',
    options: [
      {
        id: 'under5',
        label: '5분 이내',
        emoji: '⏱️',
        description: '짧게 울다 그침',
      },
      {
        id: '5to15',
        label: '5~15분',
        emoji: '🕐',
        description: '잠깐 동안 울음',
      },
      {
        id: '15to30',
        label: '15~30분',
        emoji: '🕑',
        description: '꽤 오래 울음',
      },
      {
        id: '30to60',
        label: '30분~1시간',
        emoji: '🕒',
        description: '오래 울음, 달래기 어려움',
      },
      {
        id: 'over60',
        label: '1시간 이상',
        emoji: '🕓',
        description: '매우 오래 지속, 달래지지 않음',
      },
    ],
  },
  {
    id: 'timing',
    category: 'timing',
    label: '시간대/상황',
    description: '울음이 발생한 시간이나 상황을 선택해 주세요',
    options: [
      {
        id: 'beforeFeed',
        label: '수유 전후',
        emoji: '🍼',
        description: '수유 시간 전후로 울음',
      },
      {
        id: 'diaper',
        label: '기저귀 교체 필요',
        emoji: '🧷',
        description: '기저귀가 젖었거나 찼을 때',
      },
      {
        id: 'napTime',
        label: '낮잠 시간 전후',
        emoji: '😴',
        description: '낮잠 시간에 가까울 때',
      },
      {
        id: 'evening',
        label: '저녁/밤 시간',
        emoji: '🌙',
        description: '저녁~밤 시간대 (영아산통 시간)',
      },
      {
        id: 'noPattern',
        label: '특정 시간 없음',
        emoji: '❓',
        description: '특정 패턴 없이 울음',
      },
    ],
  },
  {
    id: 'bodyLanguage',
    category: 'bodyLanguage',
    label: '동반 행동',
    description: '울 때 함께 보이는 행동을 선택해 주세요 (복수 선택 가능)',
    options: [
      {
        id: 'fistClenching',
        label: '주먹 쥐기',
        emoji: '✊',
        description: '손을 꽉 쥠',
      },
      {
        id: 'legsPulling',
        label: '다리 끌어올리기',
        emoji: '🦵',
        description: '다리를 배 쪽으로 끌어올림',
      },
      {
        id: 'backArching',
        label: '등 젖히기',
        emoji: '🔙',
        description: '등을 활처럼 젖힘',
      },
      {
        id: 'faceReddening',
        label: '얼굴 붉힘',
        emoji: '🟥',
        description: '울 때 얼굴이 빨개짐',
      },
      {
        id: 'rooting',
        label: '입 벌리며 고개 돌리기',
        emoji: '👄',
        description: '루팅 반사 — 젖 찾는 행동',
      },
      {
        id: 'eyeRubbing',
        label: '눈 비비기',
        emoji: '👀',
        description: '눈을 비비거나 얼굴을 만짐',
      },
      {
        id: 'earPulling',
        label: '귀 잡아당기기',
        emoji: '👂',
        description: '귀를 반복적으로 만지거나 잡아당김',
      },
    ],
  },
];

/* ── 진단 데이터 ── */

export const CRY_DIAGNOSES: CryDiagnosis[] = [
  {
    id: 'hunger',
    name: '배고픔',
    emoji: '🍼',
    severity: 'normal',
    description: '아기가 배고파서 울고 있을 가능성이 높아요. 가장 흔한 울음 원인이에요.',
    possibleCauses: [
      '마지막 수유 후 2~3시간 경과',
      '성장 급등기(growth spurt)로 평소보다 더 자주 배고파함',
      '수유량이 충분하지 않았을 수 있음',
    ],
    soothingMethods: [
      '즉시 수유를 시도해 보세요',
      '수유 자세를 편안하게 잡아주세요',
      '트림을 충분히 시켜주세요',
      '수유 간격과 양을 기록해 보세요',
    ],
    whenToWorry: '수유를 해도 계속 울거나, 수유를 거부하면서 울 때는 다른 원인을 살펴보세요.',
  },
  {
    id: 'tired',
    name: '피곤함/졸림',
    emoji: '😴',
    severity: 'normal',
    description: '잠이 와서 울고 있을 가능성이 높아요. 피곤할수록 더 심하게 울 수 있어요.',
    possibleCauses: [
      '적정 수면 시간을 초과해 깨어있음',
      '과자극 후 피곤함이 누적',
      '수면 루틴이 흐트러짐',
    ],
    soothingMethods: [
      '조용하고 어두운 환경을 만들어 주세요',
      '부드럽게 흔들거나 안아주세요',
      '쉬~ 소리나 백색소음을 들려주세요',
      '일정한 수면 루틴을 지켜주세요',
    ],
    whenToWorry: '하루 종일 잠만 자거나, 반대로 전혀 잠들지 못하면 소아과 상담이 필요해요.',
  },
  {
    id: 'diaper',
    name: '기저귀 불편',
    emoji: '🧷',
    severity: 'normal',
    description: '기저귀가 젖었거나 더러워서 불편할 수 있어요.',
    possibleCauses: [
      '소변/대변으로 기저귀가 젖음',
      '기저귀 발진으로 피부가 민감해짐',
      '기저귀 사이즈가 맞지 않음',
    ],
    soothingMethods: [
      '기저귀를 확인하고 교체해 주세요',
      '엉덩이를 깨끗이 닦고 말려주세요',
      '기저귀 크림을 발라주세요',
      '통풍이 잘 되도록 잠시 벗겨두세요',
    ],
    whenToWorry: '기저귀 발진이 심하거나, 피가 섞인 대소변이 보이면 병원에 가세요.',
  },
  {
    id: 'colic',
    name: '영아산통/배앓이',
    emoji: '😫',
    severity: 'attention',
    description: '영아산통이 의심돼요. 보통 생후 2주~4개월 사이에 나타나며, 저녁에 심해지는 특징이 있어요.',
    possibleCauses: [
      '미성숙한 소화 기관',
      '장내 가스 축적',
      '과자극에 대한 반응',
      '수유 시 공기를 많이 삼킴',
    ],
    soothingMethods: [
      '배를 시계 방향으로 부드럽게 마사지해 주세요',
      '자전거 타기 동작으로 가스를 빼주세요',
      '따뜻한 수건을 배에 올려주세요',
      '카시트 자세로 안아 흔들어 주세요',
      '백색소음을 들려주세요',
      '보호자도 교대로 쉬어주세요 - 산통은 일시적이에요',
    ],
    whenToWorry: '3시간 이상 지속, 열이 있거나, 대변에 이상이 있으면 소아과를 방문하세요.',
  },
  {
    id: 'gas',
    name: '가스/복통',
    emoji: '💨',
    severity: 'normal',
    description: '뱃속에 가스가 차서 불편해하는 것 같아요.',
    possibleCauses: [
      '수유 시 공기를 많이 삼킴',
      '소화가 잘 안 되는 음식 (모유수유 시 엄마의 식단)',
      '분유 교체로 인한 소화 부담',
    ],
    soothingMethods: [
      '트림을 충분히 시켜주세요',
      '배를 시계 방향으로 마사지해 주세요',
      '자전거 타기 동작을 해주세요',
      '엎드려 놓기(tummy time)를 해주세요',
      '수유 후 20~30분 세워서 안아주세요',
    ],
    whenToWorry: '배가 딱딱하게 부풀거나, 대변에 피가 섞이거나, 구토가 동반되면 병원을 방문하세요.',
  },
  {
    id: 'overstimulation',
    name: '과자극',
    emoji: '🌀',
    severity: 'normal',
    description: '주변 자극이 너무 많아서 울고 있을 수 있어요. 아기가 감당할 수 있는 자극의 양은 제한적이에요.',
    possibleCauses: [
      '시끄러운 환경에 오래 노출',
      '많은 사람이 돌아가며 안음',
      '밝은 빛이나 큰 소리',
      '놀이 시간이 길어짐',
    ],
    soothingMethods: [
      '조용하고 어두운 공간으로 이동해 주세요',
      '자극을 최소화해 주세요',
      '포대기로 감싸주세요 (swaddling)',
      '한 명이 조용히 안아주세요',
      '쉬~ 소리를 내며 달래주세요',
    ],
    whenToWorry: '자극을 줄여도 30분 이상 달래지지 않으면 다른 원인을 확인해 보세요.',
  },
  {
    id: 'attention',
    name: '관심 요구/외로움',
    emoji: '🤗',
    severity: 'normal',
    description: '안아달라고, 함께 있어달라고 울고 있을 수 있어요. 정서적 요구를 표현하는 울음이에요.',
    possibleCauses: [
      '혼자 있는 시간이 길어짐',
      '부모와의 신체 접촉을 원함',
      '심심하거나 지루함',
    ],
    soothingMethods: [
      '안아주고 눈을 맞춰주세요',
      '부드럽게 이야기해 주세요',
      '피부 접촉(캥거루 케어)을 해주세요',
      '노래를 불러주거나 놀아주세요',
    ],
    whenToWorry: '안아줘도 전혀 달래지지 않으면 다른 불편이 있는지 확인하세요.',
  },
  {
    id: 'temperature',
    name: '체온 불편',
    emoji: '🌡️',
    severity: 'normal',
    description: '너무 덥거나 추워서 불편할 수 있어요.',
    possibleCauses: [
      '옷을 너무 많이/적게 입힘',
      '실내 온도가 적절하지 않음',
      '이불이 너무 두꺼움',
    ],
    soothingMethods: [
      '아기 뒷목을 만져 체온을 확인하세요',
      '실내 온도를 22~24도로 맞춰주세요',
      '옷을 한 겹 더 입히거나 벗겨주세요',
      '면 소재의 편안한 옷을 입혀주세요',
    ],
    whenToWorry: '체온이 38도 이상이면 즉시 소아과를 방문하세요.',
  },
  {
    id: 'teething',
    name: '이앓이',
    emoji: '🦷',
    severity: 'attention',
    description: '이가 나오면서 잇몸이 아파 울 수 있어요. 보통 생후 4~7개월에 시작돼요.',
    possibleCauses: [
      '유치가 잇몸을 뚫고 나오는 과정',
      '잇몸 부종과 통증',
      '침 분비 증가로 피부 자극',
    ],
    soothingMethods: [
      '차가운 치발기를 물려주세요',
      '깨끗한 손으로 잇몸을 부드럽게 마사지해 주세요',
      '차가운 수건을 물려주세요',
      '침을 자주 닦아주세요',
      '심하면 소아과에서 진통제 처방을 받으세요',
    ],
    whenToWorry: '38도 이상 발열, 설사, 심한 발진이 동반되면 이앓이가 아닌 다른 질환일 수 있으니 병원에 가세요.',
  },
  {
    id: 'generalPain',
    name: '일반 통증/불편',
    emoji: '🤕',
    severity: 'attention',
    description: '어딘가 아프거나 불편한 것 같아요. 정확한 부위를 파악하기 어려울 수 있어요.',
    possibleCauses: [
      '옷에 달린 태그나 단추가 피부를 자극',
      '머리카락이 손가락/발가락에 감김 (hair tourniquet)',
      '자세가 불편함',
      '피부 발진이나 긁힘',
    ],
    soothingMethods: [
      '옷을 벗기고 온몸을 꼼꼼히 확인해 주세요',
      '손가락, 발가락에 머리카락 감김이 없는지 확인',
      '피부에 발진이나 상처가 없는지 확인',
      '편안한 자세로 안아주세요',
    ],
    whenToWorry: '고열, 구토, 설사가 동반되거나 평소와 매우 다른 울음이면 즉시 병원을 방문하세요.',
  },
  {
    id: 'separationAnxiety',
    name: '분리불안',
    emoji: '💔',
    severity: 'normal',
    description: '부모와 떨어지는 것에 대한 불안으로 울고 있을 수 있어요. 6~18개월에 흔해요.',
    possibleCauses: [
      '주 양육자와의 분리',
      '낯선 환경이나 낯선 사람',
      '발달 단계상 정상적인 분리불안기',
    ],
    soothingMethods: [
      '갑자기 사라지지 말고 짧게 인사하고 떠나세요',
      '익숙한 물건(애착인형 등)을 함께 두세요',
      '짧은 분리부터 연습하세요',
      '돌아오면 반갑게 맞아주세요',
      '안정적인 일과를 유지하세요',
    ],
    whenToWorry: '분리불안이 18개월 이후에도 매우 심하거나 일상생활에 지장이 크면 전문가 상담을 받아보세요.',
  },
  {
    id: 'illness',
    name: '질병 의심',
    emoji: '🏥',
    severity: 'warning',
    description: '평소와 다른 울음이라면 질병의 가능성이 있어요. 병원 확인을 권장합니다.',
    possibleCauses: [
      '감기, 중이염 등 감염성 질환',
      '위장관 문제 (구토, 설사)',
      '요로 감염',
      '두통이나 기타 통증',
    ],
    soothingMethods: [
      '체온을 측정해 주세요',
      '수유량과 기저귀 양을 확인하세요',
      '아기 상태를 사진이나 영상으로 기록해 두세요',
      '소아과에 전화하거나 방문하세요',
    ],
    whenToWorry: '38도 이상 발열, 구토/설사 지속, 축 처짐, 수유 거부, 발진이 있으면 즉시 병원을 방문하세요.',
  },
];

/* ── 규칙 매핑 ── */

export const CRY_RULES: CryRule[] = [
  // 배고픔
  {
    conditions: {
      pitch: ['low', 'medium'],
      pattern: ['rhythmic', 'escalating'],
      timing: ['beforeFeed'],
      bodyLanguage: ['rooting'],
    },
    diagnosisId: 'hunger',
    confidence: 0.95,
  },
  {
    conditions: {
      pattern: ['escalating', 'rhythmic'],
      timing: ['beforeFeed'],
      bodyLanguage: ['rooting'],
    },
    diagnosisId: 'hunger',
    confidence: 0.9,
  },
  {
    conditions: {
      pitch: ['low', 'medium'],
      pattern: ['escalating'],
      bodyLanguage: ['rooting'],
    },
    diagnosisId: 'hunger',
    confidence: 0.8,
  },
  {
    conditions: {
      timing: ['beforeFeed'],
      pattern: ['rhythmic', 'escalating'],
    },
    diagnosisId: 'hunger',
    confidence: 0.7,
  },

  // 피곤함/졸림
  {
    conditions: {
      pitch: ['medium', 'weak'],
      pattern: ['intermittent', 'escalating'],
      timing: ['napTime'],
      bodyLanguage: ['eyeRubbing'],
    },
    diagnosisId: 'tired',
    confidence: 0.95,
  },
  {
    conditions: {
      intensity: ['fussy', 'moderate'],
      timing: ['napTime'],
      bodyLanguage: ['eyeRubbing'],
    },
    diagnosisId: 'tired',
    confidence: 0.9,
  },
  {
    conditions: {
      pattern: ['intermittent'],
      bodyLanguage: ['eyeRubbing'],
    },
    diagnosisId: 'tired',
    confidence: 0.75,
  },
  {
    conditions: {
      intensity: ['fussy'],
      timing: ['napTime'],
    },
    diagnosisId: 'tired',
    confidence: 0.7,
  },

  // 기저귀 불편
  {
    conditions: {
      intensity: ['fussy', 'moderate'],
      timing: ['diaper'],
      pattern: ['intermittent'],
    },
    diagnosisId: 'diaper',
    confidence: 0.9,
  },
  {
    conditions: {
      timing: ['diaper'],
      intensity: ['fussy', 'moderate'],
    },
    diagnosisId: 'diaper',
    confidence: 0.85,
  },
  {
    conditions: {
      timing: ['diaper'],
    },
    diagnosisId: 'diaper',
    confidence: 0.7,
  },

  // 영아산통/배앓이
  {
    conditions: {
      pitch: ['high'],
      pattern: ['continuous'],
      intensity: ['intense', 'screaming'],
      timing: ['evening'],
      bodyLanguage: ['legsPulling', 'fistClenching'],
    },
    diagnosisId: 'colic',
    confidence: 0.95,
  },
  {
    conditions: {
      pitch: ['high'],
      intensity: ['intense', 'screaming'],
      timing: ['evening'],
      bodyLanguage: ['legsPulling'],
    },
    diagnosisId: 'colic',
    confidence: 0.9,
  },
  {
    conditions: {
      pattern: ['continuous'],
      intensity: ['intense', 'screaming'],
      timing: ['evening'],
    },
    diagnosisId: 'colic',
    confidence: 0.8,
  },
  {
    conditions: {
      timing: ['evening'],
      duration: ['30to60', 'over60'],
      intensity: ['intense', 'screaming'],
    },
    diagnosisId: 'colic',
    confidence: 0.75,
  },

  // 가스/복통
  {
    conditions: {
      pitch: ['high', 'medium'],
      pattern: ['sudden', 'intermittent'],
      bodyLanguage: ['legsPulling', 'fistClenching'],
    },
    diagnosisId: 'gas',
    confidence: 0.85,
  },
  {
    conditions: {
      bodyLanguage: ['legsPulling', 'faceReddening'],
      pattern: ['sudden', 'intermittent'],
    },
    diagnosisId: 'gas',
    confidence: 0.8,
  },
  {
    conditions: {
      bodyLanguage: ['legsPulling'],
      intensity: ['moderate', 'intense'],
      timing: ['beforeFeed'],
    },
    diagnosisId: 'gas',
    confidence: 0.7,
  },

  // 과자극
  {
    conditions: {
      pitch: ['high'],
      pattern: ['sudden', 'continuous'],
      intensity: ['intense', 'screaming'],
      bodyLanguage: ['backArching'],
    },
    diagnosisId: 'overstimulation',
    confidence: 0.85,
  },
  {
    conditions: {
      pattern: ['sudden'],
      intensity: ['intense'],
      bodyLanguage: ['backArching', 'faceReddening'],
    },
    diagnosisId: 'overstimulation',
    confidence: 0.75,
  },
  {
    conditions: {
      pitch: ['high'],
      pattern: ['sudden'],
      bodyLanguage: ['backArching'],
    },
    diagnosisId: 'overstimulation',
    confidence: 0.7,
  },

  // 관심 요구/외로움
  {
    conditions: {
      pitch: ['low', 'medium'],
      pattern: ['intermittent'],
      intensity: ['fussy'],
      timing: ['noPattern'],
    },
    diagnosisId: 'attention',
    confidence: 0.8,
  },
  {
    conditions: {
      pitch: ['low'],
      intensity: ['fussy'],
      pattern: ['intermittent'],
    },
    diagnosisId: 'attention',
    confidence: 0.7,
  },

  // 체온 불편
  {
    conditions: {
      intensity: ['fussy', 'moderate'],
      pattern: ['intermittent', 'continuous'],
      timing: ['noPattern'],
      bodyLanguage: ['faceReddening'],
    },
    diagnosisId: 'temperature',
    confidence: 0.7,
  },
  {
    conditions: {
      intensity: ['fussy'],
      bodyLanguage: ['faceReddening'],
      timing: ['noPattern'],
    },
    diagnosisId: 'temperature',
    confidence: 0.6,
  },

  // 이앓이
  {
    conditions: {
      pattern: ['intermittent', 'continuous'],
      intensity: ['moderate', 'intense'],
      bodyLanguage: ['earPulling'],
    },
    diagnosisId: 'teething',
    confidence: 0.85,
  },
  {
    conditions: {
      bodyLanguage: ['earPulling', 'fistClenching'],
      intensity: ['moderate'],
    },
    diagnosisId: 'teething',
    confidence: 0.7,
  },
  {
    conditions: {
      bodyLanguage: ['earPulling'],
    },
    diagnosisId: 'teething',
    confidence: 0.6,
  },

  // 일반 통증/불편
  {
    conditions: {
      pitch: ['high'],
      pattern: ['sudden'],
      intensity: ['intense', 'screaming'],
    },
    diagnosisId: 'generalPain',
    confidence: 0.7,
  },
  {
    conditions: {
      pitch: ['high'],
      intensity: ['screaming'],
      bodyLanguage: ['backArching', 'faceReddening'],
    },
    diagnosisId: 'generalPain',
    confidence: 0.65,
  },

  // 분리불안
  {
    conditions: {
      pattern: ['sudden', 'escalating'],
      intensity: ['moderate', 'intense'],
      timing: ['noPattern'],
    },
    diagnosisId: 'separationAnxiety',
    confidence: 0.6,
  },
  {
    conditions: {
      pitch: ['high', 'medium'],
      pattern: ['escalating'],
      timing: ['noPattern'],
    },
    diagnosisId: 'separationAnxiety',
    confidence: 0.5,
  },

  // 질병 의심
  {
    conditions: {
      pitch: ['high', 'weak'],
      pattern: ['continuous'],
      intensity: ['intense', 'screaming'],
      duration: ['30to60', 'over60'],
    },
    diagnosisId: 'illness',
    confidence: 0.8,
  },
  {
    conditions: {
      pitch: ['weak'],
      pattern: ['continuous'],
      duration: ['over60'],
    },
    diagnosisId: 'illness',
    confidence: 0.7,
  },
  {
    conditions: {
      pitch: ['high'],
      intensity: ['screaming'],
      duration: ['over60'],
      bodyLanguage: ['backArching'],
    },
    diagnosisId: 'illness',
    confidence: 0.75,
  },
];

/* ── 유틸리티 함수 ── */

function getDiagnosisById(id: string): CryDiagnosis | undefined {
  return CRY_DIAGNOSES.find((d) => d.id === id);
}

function matchesConditions(
  selectedOptions: Record<string, string | string[]>,
  conditions: Record<string, string[]>,
): number {
  const conditionKeys = Object.keys(conditions);
  let matched = 0;
  let total = conditionKeys.length;

  for (const key of conditionKeys) {
    const required = conditions[key];
    const selected = selectedOptions[key];

    if (!selected) continue;

    // bodyLanguage 는 복수 선택이므로 배열로 올 수 있음
    const selectedArr = Array.isArray(selected) ? selected : [selected];
    const hasMatch = required.some((r) => selectedArr.includes(r));

    if (hasMatch) {
      matched += 1;
    }
  }

  if (total === 0) return 0;
  return matched / total;
}

/**
 * 선택된 특성 조합으로 울음 원인을 분석합니다.
 * @param selectedOptions - 카테고리별 선택된 옵션 ID (bodyLanguage는 string[] 가능)
 * @returns 분석 결과
 */
export function analyzeCryByCharacteristics(
  selectedOptions: Record<string, string | string[]>,
): CryAnalysisResult {
  // 각 규칙과의 매칭 점수를 계산
  const scores: Array<{ diagnosisId: string; score: number }> = [];

  for (const rule of CRY_RULES) {
    const matchRatio = matchesConditions(selectedOptions, rule.conditions);
    // 50% 이상 조건 매칭 시에만 후보로 추가
    if (matchRatio >= 0.5) {
      const adjustedScore = rule.confidence * matchRatio;
      scores.push({ diagnosisId: rule.diagnosisId, score: adjustedScore });
    }
  }

  // 진단 ID별로 최고 점수를 집계
  const bestScores = new Map<string, number>();
  for (const s of scores) {
    const current = bestScores.get(s.diagnosisId) ?? 0;
    if (s.score > current) {
      bestScores.set(s.diagnosisId, s.score);
    }
  }

  // 점수 내림차순 정렬
  const sorted = Array.from(bestScores.entries())
    .sort((a, b) => b[1] - a[1]);

  // 기본 진단 (매칭되는 규칙이 없을 때)
  const fallbackDiagnosis = getDiagnosisById('generalPain');
  if (!fallbackDiagnosis) {
    throw new Error('fallback diagnosis not found');
  }

  if (sorted.length === 0) {
    return {
      diagnosis: fallbackDiagnosis,
      confidence: 0.3,
      relatedDiagnoses: [],
      needsAttention: false,
    };
  }

  const [topId, topScore] = sorted[0];
  const topDiagnosis = getDiagnosisById(topId);
  if (!topDiagnosis) {
    return {
      diagnosis: fallbackDiagnosis,
      confidence: 0.3,
      relatedDiagnoses: [],
      needsAttention: false,
    };
  }

  // 상위 3개 관련 진단 (1위 제외)
  const related: CryDiagnosis[] = [];
  for (let i = 1; i < Math.min(sorted.length, 4); i++) {
    const d = getDiagnosisById(sorted[i][0]);
    if (d) related.push(d);
  }

  const needsAttention =
    topDiagnosis.severity === 'warning' ||
    topDiagnosis.severity === 'attention' ||
    topScore >= 0.85;

  return {
    diagnosis: topDiagnosis,
    confidence: Math.round(topScore * 100) / 100,
    relatedDiagnoses: related,
    needsAttention,
  };
}

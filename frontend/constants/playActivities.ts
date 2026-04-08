/* ------------------------------------------------------------------ */
/*  Static play/learning activity data per temperament & age group      */
/* ------------------------------------------------------------------ */

export interface PlayActivity {
  name: string;
  emoji: string;
  duration: string;
  materials: string[];
  reason: string;
  steps: string[];
  ageGroups: ('infant' | 'toddler' | 'elementary')[];
}

type TemperamentKey =
  | 'active'
  | 'explorer'
  | 'balanced'
  | 'analytical'
  | 'sensitive';

export function resolvePlayTemperament(
  dominantType: string,
): TemperamentKey {
  if (dominantType.includes('활동') || dominantType.includes('fire'))
    return 'active';
  if (dominantType.includes('탐구') || dominantType.includes('wood'))
    return 'explorer';
  if (dominantType.includes('조화') || dominantType.includes('earth'))
    return 'balanced';
  if (dominantType.includes('분석') || dominantType.includes('metal'))
    return 'analytical';
  if (dominantType.includes('감성') || dominantType.includes('water'))
    return 'sensitive';
  return 'balanced';
}

export const PLAY_ACTIVITIES: Record<TemperamentKey, PlayActivity[]> = {
  /* ======================== active ======================== */
  active: [
    {
      name: '실내 장애물 달리기',
      emoji: '🏃',
      duration: '20분',
      materials: ['베개', '쿠션', '후라후프'],
      reason:
        '활동형 기질은 대근육 발달이 빠라요. 장애물을 넘고 통과하며 에너지를 발산해요',
      steps: [
        '베개와 쿠션으로 거실에 장애물 코스를 만들어주세요',
        '아이와 함께 장애물을 넘고 기어가며 통과해요',
        '후라후프 터널도 추가하면 더 재미있어요',
        '완주 후 하이파이브로 축하해주세요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '신문지 공 던지기',
      emoji: '⚽',
      duration: '15분',
      materials: ['신문지', '테이프'],
      reason:
        '신문지 공을 만들고 던지며 대근육과 눈-손 협응력을 키워요',
      steps: [
        '신문지를 구겨서 공 모양으로 만들어요',
        '테이프로 감싸 공을 단단하게 해요',
        '바구니를 놓고 공을 던져 넣어봐요',
        '거리를 조금씩 늘려가며 성공할 때마다 응원해주세요',
      ],
      ageGroups: ['infant', 'toddler', 'elementary'],
    },
    {
      name: '음악에 맞춰 점프!',
      emoji: '🎵',
      duration: '15분',
      materials: ['스피커/휴대폰'],
      reason:
        '리듬에 맞춰 점프하며 체력과 리듬감을 함께 키워요',
      steps: [
        '아이가 좋아하는 신나는 노래를 틀어주세요',
        '빠른 부분에서는 높이 점프해요',
        '느린 부분에서는 바닥에 누워서 쉬어요',
        '노래가 끝나면 수고했다고 칭찬해주세요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '풍선 놓이',
      emoji: '🎈',
      duration: '20분',
      materials: ['풍선 3-5개'],
      reason:
        '풍선을 떨어뜨리지 않고 유지하는 놀이로 집중력과 반사신경을 키워요',
      steps: [
        '풍선을 불어 아이에게 주세요',
        '풍선을 위로 쳐올리고 바닥에 떨어지지 않게 유지해요',
        '여러 개를 동시에 띄워보는 도전도 해봐요',
        '점수를 세며 재미있는 경쟁으로 만들어주세요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '아기 체조 마사지',
      emoji: '👶',
      duration: '10분',
      materials: ['부드러운 매트'],
      reason:
        '영아의 대근육 발달을 촉진하고 애착 형성에 도움이 돼요',
      steps: [
        '아이를 부드러운 매트에 눈히세요',
        '다리를 부드럽게 굽혔 펴며 자전거 동작을 해줘요',
        '팔을 넓게 벌리고 모아주며 스트레칭해요',
        '부모님의 얼굴을 보며 행복한 스킨십을 즐겨요',
      ],
      ageGroups: ['infant'],
    },
    {
      name: '컬러 분류 달리기',
      emoji: '🔴',
      duration: '15분',
      materials: ['컬러 볼', '바구니'],
      reason:
        '달리면서 색깔을 분류하며 인지와 운동 능력을 함께 발달시켜요',
      steps: [
        '색깔별로 바구니를 놓아주세요',
        '컬러 볼을 방 여기저기 흩뿌려놓으세요',
        '같은 색 볼을 찾아 달려가서 바구니에 넣어요',
        '모든 색을 분류할 때까지 반복해요',
      ],
      ageGroups: ['toddler'],
    },
  ],

  /* ======================== explorer ======================== */
  explorer: [
    {
      name: '과학 실험: 화산 만들기',
      emoji: '🌋',
      duration: '25분',
      materials: ['베이킹소다', '식초', '세제', '색소'],
      reason:
        '탐구형 기질은 실험과 발견을 통해 학습 동기가 높아져요',
      steps: [
        '종이컵에 베이킹소다와 세제를 섯어요',
        '식초에 색소를 한 방울 넣어요',
        '식초를 베이킹소다에 부어 화산 폭발을 관찰해요',
        '왜 거품이 생기는지 아이와 대화해봐요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '자연 탐험 빈고',
      emoji: '🌿',
      duration: '30분',
      materials: ['빈고 카드', '크레용', '종이백'],
      reason:
        '자연물을 찾고 관찰하며 호기심과 관찰력을 키워요',
      steps: [
        '빈고 카드에 찾을 것들을 그려요 (잎사귀, 돌, 꽃 등)',
        '공원이나 마당에서 아이와 함께 찾아봐요',
        '찾은 것들을 종이백에 모아요',
        '집에 돌아와 관찰 일기를 써봐요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '돋보기 탐색',
      emoji: '🔍',
      duration: '10분',
      materials: ['돋보기'],
      reason:
        '작은 세상을 확대해보며 탐구심과 관찰력을 자귩해요',
      steps: [
        '돋보기를 사용하는 방법을 알려주세요',
        '집 안의 물건들을 확대해 관찰해요',
        '식물 잎사귀, 천 지문 등을 비교해봐요',
        '가장 신기했던 것을 이야기해봐요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '물 놀이 실험',
      emoji: '💧',
      duration: '20분',
      materials: ['양푸', '스폰지', '컵', '물'],
      reason:
        '물의 성질을 탐구하며 과학적 사고의 기초를 쉬운다',
      steps: [
        '양푸에 물을 담고 다양한 물건을 마련해요',
        '무엇이 뜨고 무엇이 가라앉는지 실험해요',
        '스폰지로 물을 흡수하고 짜보는 놀이를 해요',
        '결과를 예측해보고 확인하는 시간을 가져요',
      ],
      ageGroups: ['infant', 'toddler'],
    },
    {
      name: '그림자 놀이',
      emoji: '🔦',
      duration: '15분',
      materials: ['손전등', '벽'],
      reason:
        '빛과 그림자의 관계를 탐구하며 상상력을 키워요',
      steps: [
        '방을 어둡게 하고 손전등을 켜요',
        '손으로 동물 모양을 만들어 벽에 비춰요',
        '아이가 따라해보도록 도와주세요',
        '그림자 인형극으로 이야기를 만들어봐요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '촉감 상자',
      emoji: '📦',
      duration: '15분',
      materials: ['상자', '다양한 촉감 재료(쇜, 목화솔, 천 등)'],
      reason:
        '다양한 촉감을 탐색하며 감각 발달과 호기심을 동시에 채워요',
      steps: [
        '상자 안에 다양한 촉감의 물건을 넣어요',
        '아이가 손을 넣어 만져보고 알아맞혀요',
        '무엇인지 이야기해보고 확인해요',
        '같은 촉감끼리 분류해보는 활동도 해봐요',
      ],
      ageGroups: ['infant', 'toddler'],
    },
  ],

  /* ======================== balanced ======================== */
  balanced: [
    {
      name: '블록 쌓기 도전',
      emoji: '🧱',
      duration: '20분',
      materials: ['블록 세트'],
      reason:
        '조화형 기질은 균형 잡힌 활동을 좋아해요. 블록 쌓기로 창의력과 공간 감각을 함께 키워요',
      steps: [
        '아이와 함께 무엇을 만들지 이야기해요',
        '순서대로 하나씩 블록을 쌓아요',
        '완성하면 함께 감상하는 시간을 가져요',
        '무너뜨릴 때의 소리와 모양도 관찰해봐요',
      ],
      ageGroups: ['infant', 'toddler', 'elementary'],
    },
    {
      name: '요리 놀이',
      emoji: '🧑‍🍳',
      duration: '25분',
      materials: ['간단한 재료(밀가루, 물, 색소)'],
      reason:
        '순서를 따라 만들며 인지력과 소근육을 함께 발달시켜요',
      steps: [
        '밀가루와 물로 반죽을 만들어요',
        '식용 색소로 예쁜 색을 내요',
        '모양틀로 쿠키 모양을 찍어요',
        '오븐에 구워 진짜 간식처럼 즐겨요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '퍼즐 맞춰보기',
      emoji: '🧩',
      duration: '15분',
      materials: ['연령별 퍼즐'],
      reason:
        '문제 해결력과 인내심을 균형 있게 키워요',
      steps: [
        '아이 수준에 맞는 퍼즐을 가져오세요',
        '모서리 부분부터 맞춰보세요',
        '어려워하면 힌트를 주며 도와주세요',
        '완성하면 함께 박수치며 축하해요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '그림 그리기',
      emoji: '🎨',
      duration: '20분',
      materials: ['크레용', '도화지'],
      reason:
        '자유로운 표현을 통해 창의력과 감성을 균형 있게 키워요',
      steps: [
        '오늘 그리고 싶은 것을 아이에게 물어봐요',
        '함께 그림을 그려요',
        '색칠하며 색깔에 대해 이야기해요',
        '완성한 그림을 벗에 걸어주세요',
      ],
      ageGroups: ['infant', 'toddler', 'elementary'],
    },
    {
      name: '체조와 수세기',
      emoji: '👶',
      duration: '10분',
      materials: ['부드러운 매트'],
      reason:
        '영아의 운동 감각과 애착을 균형 있게 발달시켜요',
      steps: [
        '아이를 부드러운 매트 위에 누여요',
        '손과 발을 부드럽게 마사지해요',
        '수세오를 세고 노래를 불러줘요',
        '스킨십으로 애착을 강화해요',
      ],
      ageGroups: ['infant'],
    },
    {
      name: '역할 놀이',
      emoji: '🎭',
      duration: '20분',
      materials: ['인형', '소품'],
      reason:
        '다양한 역할을 경험하며 사회성과 공감 능력을 키워요',
      steps: [
        '인형이나 소품으로 역할을 정해요 (의사, 선생 등)',
        '아이와 번갈아 가며 연기해요',
        '상황을 바꾸어가며 다양한 경험을 해요',
        '감정 표현을 연습해봐요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
  ],

  /* ======================== analytical ======================== */
  analytical: [
    {
      name: '숫자 분류 놀이',
      emoji: '🔢',
      duration: '15분',
      materials: ['숫자 카드', '버튼'],
      reason:
        '분석형 기질은 체계적 분류와 패턴을 찾는 활동에 흥미를 느껴요',
      steps: [
        '숫자 카드를 섞어요',
        '순서대로 나열해보세요',
        '같은 숫자끼리 짝을 지어요',
        '버튼으로 더 복잡한 패턴을 만들어봐요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '레고 설계도 만들기',
      emoji: '🏗️',
      duration: '30분',
      materials: ['레고', '종이', '연필'],
      reason:
        '설계하고 구현하는 과정에서 논리적 사고를 강화해요',
      steps: [
        '종이에 만들고 싶은 것의 설계도를 그려요',
        '필요한 블록 종류와 수량을 계획해요',
        '설계도대로 레고를 조립해요',
        '완성후 설계도와 비교하며 이야기해요',
      ],
      ageGroups: ['elementary'],
    },
    {
      name: '코딩 보드게임',
      emoji: '💻',
      duration: '20분',
      materials: ['코딩 보드게임'],
      reason:
        '순차적 사고와 문제 해결 능력을 게임으로 배워요',
      steps: [
        '간단한 코딩 보드게임을 펼쳐요',
        '명령 카드를 순서대로 놓아요',
        '캐릭터를 목표지까지 이동시켜요',
        '단계를 높여가며 도전해요',
      ],
      ageGroups: ['elementary'],
    },
    {
      name: '분류 놀이 (모양/색깔)',
      emoji: '🔷',
      duration: '15분',
      materials: ['다양한 모양 블록'],
      reason:
        '패턴 인식과 분류 능력이 분석형 기질에 딱 맞아요',
      steps: [
        '다양한 모양과 색깔의 블록을 펼쳐요',
        '같은 모양끼리 모아요',
        '같은 색깔끼리 모아요',
        '모양과 색깔을 동시에 분류해보세요',
      ],
      ageGroups: ['infant', 'toddler'],
    },
    {
      name: '측정 놀이',
      emoji: '📏',
      duration: '15분',
      materials: ['자', '저울', '카드'],
      reason:
        '측정과 비교를 통해 수학적 사고력을 키워요',
      steps: [
        '집안의 물건을 자로 측정해요',
        '무거운 것과 가벼운 것을 저울로 비교해요',
        '결과를 카드에 기록해요',
        '부모와 함께 결과에 대해 이야기해요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '쌓기 컵 짝짓기',
      emoji: '🥤',
      duration: '10분',
      materials: ['종이컵 여러 개'],
      reason:
        '영아도 체계적 사고를 배울 수 있는 쉬운 쌓기 놀이에요',
      steps: [
        '컵을 하나씩 쌓아요',
        '높이 쌓는 것을 관찰해요',
        '두 줄로 나란히 쌓아봐요',
        '무너지면 다시 도전해요',
      ],
      ageGroups: ['infant'],
    },
  ],

  /* ======================== sensitive ======================== */
  sensitive: [
    {
      name: '그림 일기 쓰기',
      emoji: '🎨',
      duration: '20분',
      materials: ['크레용', '색연필', '노트'],
      reason:
        '감성형 기질은 감정 표현이 중요해요. 그림으로 느낌을 표현하며 정서를 안정시켜요',
      steps: [
        '오늘 기분이 어떤지 아이에게 물어봐요',
        '기분에 맞는 색을 고르게 해요',
        '자유롭게 그림을 그리고 이야기를 들어요',
        '부모님도 함께 그리며 공감해요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '음악 감상 시간',
      emoji: '🎶',
      duration: '15분',
      materials: ['스피커/휴대폰'],
      reason:
        '음악이 정서적 안정과 감성 발달에 큰 도움을 줘요',
      steps: [
        '편안한 공간에서 쟔쟔한 음악을 틀어요',
        '아이와 함께 누워서 음악을 들어요',
        '어떤 기분이 드는지 이야기해요',
        '좋아하는 음악을 함께 모아봐요',
      ],
      ageGroups: ['infant', 'toddler', 'elementary'],
    },
    {
      name: '처나 인형극',
      emoji: '🧸',
      duration: '20분',
      materials: ['양말', '인형'],
      reason:
        '인형극을 통해 감정을 안전하게 표현하고 경험해요',
      steps: [
        '양말 위에 인형을 올려요',
        '간단한 이야기를 만들어요',
        '아이가 인형의 감정을 표현하게 해요',
        '행복, 슬픔, 화남 등 다양한 감정을 연습해요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '처나 찍기',
      emoji: '📷',
      duration: '25분',
      materials: ['카메라/스마트폰'],
      reason:
        '눈에 보이는 세상을 카메라로 담으며 감성적 표현력을 키워요',
      steps: [
        '아이에게 카메라 사용법을 알려줘요',
        '집 안이나 밖에서 좋아하는 것을 찍어요',
        '찍은 사진을 함께 보며 이야기해요',
        '가장 좋은 사진을 골라 앨범을 만들어요',
      ],
      ageGroups: ['toddler', 'elementary'],
    },
    {
      name: '스킨십 마사지',
      emoji: '👶',
      duration: '10분',
      materials: ['베이비 로션/오일'],
      reason:
        '부드러운 터치가 감성형 영아의 정서적 안정에 큰 도움을 줘요',
      steps: [
        '베이비 로션을 손에 덧고 아이 팔다리를 부드럽게 마사지해요',
        '배를 둥글게 문질러요',
        '발바닥을 살살 간지러요',
        '노래를 부르며 편안한 분위기를 만들어요',
      ],
      ageGroups: ['infant'],
    },
    {
      name: '자연 소리 듣기',
      emoji: '🌿',
      duration: '15분',
      materials: [],
      reason:
        '자연의 소리가 감성형 아이의 정서 안정과 청각 발달에 좋아요',
      steps: [
        '바깥에서 조용히 앑아요',
        '들리는 자연 소리를 함께 찾아봐요',
        '새 소리, 바람 소리, 물 소리 등을 구별해요',
        '집에 돌아와 들었던 소리를 그려봐요',
      ],
      ageGroups: ['infant', 'toddler', 'elementary'],
    },
  ],
};

/**
 * onboarding-questions.ts
 * 온보딩 질문 80개 (연령 그룹별 20개)
 * 부모가 자녀 최초 등록 시 답변하는 질문 목록
 */

export interface OnboardingQuestion {
  id: string;
  ageGroup: 'infant' | 'kinder' | 'elem_low' | 'elem_high';
  ageLabel: string;
  questionText: string;
  options: string[];
  category: string;
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  // ========================================
  // 영아기 (0~36개월) 20개
  // ========================================

  // 1-4: 기질/성격
  {
    id: 'infant_1',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이가 낯선 환경(새로운 장소, 처음 가는 식당 등)에 가면 어떤 반응을 보이나요?',
    options: [
      '호기심을 가지고 주변을 탐색해요',
      '부모에게 꼭 달라붙어 불안해해요',
      '처음엔 경계하다가 서서히 적응해요',
      '별 반응 없이 평소와 비슷해요',
    ],
    category: 'personality',
  },
  {
    id: 'infant_2',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이가 원하는 것이 있을 때 고집을 부리는 정도는 어떤가요?',
    options: [
      '원하는 걸 얻을 때까지 강하게 고집해요',
      '잠깐 떼쓰다가 금방 잊어요',
      '다른 것으로 쉽게 관심이 옮겨져요',
      '표현 자체를 잘 안 하는 편이에요',
    ],
    category: 'personality',
  },
  {
    id: 'infant_3',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이가 뭔가 필요하거나 원할 때 주로 어떻게 표현하나요?',
    options: [
      '크게 울거나 소리를 질러요',
      '손가락으로 가리키며 옹알이해요',
      '부모 손을 잡고 끌고 가요',
      '표정이나 눈빛으로 알려줘요',
    ],
    category: 'personality',
  },
  {
    id: 'infant_4',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '새로운 장난감을 처음 받으면 어떤 반응을 보이나요?',
    options: [
      '신나서 바로 만지고 흔들어봐요',
      '한참 쳐다보며 관찰한 뒤 만져요',
      '부모가 먼저 놀아주길 기다려요',
      '기존 장난감에 더 관심을 보여요',
    ],
    category: 'personality',
  },

  // 5-8: 감각/활동
  {
    id: 'infant_5',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이가 특히 좋아하는 감각 자극은 무엇인가요?',
    options: [
      '밝은 색깔이나 움직이는 것 보기',
      '음악이나 소리 듣기',
      '다양한 촉감 만지기(물, 모래 등)',
      '몸을 흔들거나 움직이는 것 자체',
    ],
    category: 'activity',
  },
  {
    id: 'infant_6',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이의 평소 움직임 수준은 어떤가요?',
    options: [
      '쉴 새 없이 기어 다니거나 돌아다녀요',
      '적당히 활동적이에요',
      '한 자리에 오래 앉아 놀아요',
      '안기거나 누워있는 걸 더 좋아해요',
    ],
    category: 'activity',
  },
  {
    id: 'infant_7',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '바깥 나들이(산책, 놀이터)를 할 때 아이의 반응은?',
    options: [
      '매우 좋아하고 집에 안 들어오려 해요',
      '좋아하지만 금방 지쳐요',
      '좋아하는 편이에요',
      '밖보다 집 안을 더 좋아해요',
    ],
    category: 'activity',
  },
  {
    id: 'infant_8',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이가 가장 즐겨하는 놀이 유형은?',
    options: [
      '몸을 쓰는 놀이(기기, 타기, 던지기)',
      '손으로 쥐고 탐색하는 놀이(블록, 컵쌓기)',
      '소리나 음악에 반응하는 놀이',
      '그림책 보기나 가만히 관찰하는 놀이',
    ],
    category: 'activity',
  },

  // 9-12: 감정/애착
  {
    id: 'infant_9',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '부모와 떨어질 때(어린이집, 할머니댁 등) 아이의 반응은?',
    options: [
      '심하게 울고 한참 동안 진정이 안 돼요',
      '처음엔 울지만 비교적 빨리 적응해요',
      '별로 개의치 않고 잘 놀아요',
      '상황에 따라 매번 달라요',
    ],
    category: 'emotion',
  },
  {
    id: 'infant_10',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이가 칭찬(박수, "잘했어!")을 받으면 어떤 반응을 보이나요?',
    options: [
      '활짝 웃으며 반복하려 해요',
      '수줍어하거나 부끄러워해요',
      '별 반응 없이 하던 걸 계속해요',
      '더 신나서 과격하게 행동해요',
    ],
    category: 'emotion',
  },
  {
    id: 'infant_11',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이가 뜻대로 안 될 때(블록 안 쌓여질 때 등) 반응은?',
    options: [
      '화를 내거나 던져버려요',
      '울면서 도와달라고 해요',
      '포기하고 다른 놀이로 넘어가요',
      '끈기 있게 계속 시도해요',
    ],
    category: 'emotion',
  },
  {
    id: 'infant_12',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이가 속상하거나 울 때 가장 잘 진정되는 방법은?',
    options: [
      '안아주고 토닥여주면 금방 그쳐요',
      '좋아하는 물건(인형, 담요)을 쥐어주면 돼요',
      '다른 것에 관심을 돌리면 잊어요',
      '시간을 좀 두면 스스로 진정해요',
    ],
    category: 'emotion',
  },

  // 13-16: 사회성
  {
    id: 'infant_13',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '비슷한 나이의 다른 아이를 만나면 어떻게 반응하나요?',
    options: [
      '다가가서 관심을 보이고 만지려 해요',
      '멀리서 쳐다보기만 해요',
      '무서워하거나 부모 뒤에 숨어요',
      '같은 공간에서 각자 놀아요',
    ],
    category: 'social',
  },
  {
    id: 'infant_14',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '익숙하지 않은 어른(친척, 이웃)이 말을 걸면?',
    options: [
      '낯을 가리지 않고 잘 웃어요',
      '처음엔 경계하다가 풀려요',
      '부모 뒤에 숨거나 울어요',
      '무반응이거나 자기 할 것만 해요',
    ],
    category: 'social',
  },
  {
    id: 'infant_15',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이에게 간식이나 장난감을 "나눠줄까?"라고 하면?',
    options: [
      '기꺼이 내밀어요',
      '줬다 뺐었다 해요',
      '절대 안 줘요',
      '부모 것만 나눠줘요',
    ],
    category: 'social',
  },
  {
    id: 'infant_16',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이가 부모와 눈맞춤하거나 상호작용하는 정도는?',
    options: [
      '자주 눈을 맞추고 표정으로 소통해요',
      '관심이 있을 때만 눈을 마주쳐요',
      '물건에 더 관심이 많아 눈맞춤이 적어요',
      '부를 때 잘 쳐다보지만 먼저 찾진 않아요',
    ],
    category: 'social',
  },

  // 17-20: 습관/루틴
  {
    id: 'infant_17',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이의 수면 패턴은 어떤 편인가요?',
    options: [
      '정해진 시간에 잘 자고 잘 일어나요',
      '재우기가 힘들지만 한번 자면 잘 자요',
      '자주 깨거나 수면 시간이 불규칙해요',
      '낮잠 시간이 제각각이에요',
    ],
    category: 'habit',
  },
  {
    id: 'infant_18',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이의 식사(수유/이유식) 습관은 어떤가요?',
    options: [
      '잘 먹고 편식이 거의 없어요',
      '먹는 양은 적지만 골고루 먹어요',
      '좋아하는 것만 먹으려 해요',
      '먹는 것에 관심이 적어요',
    ],
    category: 'habit',
  },
  {
    id: 'infant_19',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '아이가 한 가지 놀이에 집중하는 시간은 대략 어느 정도인가요?',
    options: [
      '10분 이상 몰두하는 편이에요',
      '5분 내외로 놀다가 다른 걸로 옮겨요',
      '1~2분이면 다른 것에 관심을 가져요',
      '관심 있는 것만 오래 해요',
    ],
    category: 'habit',
  },
  {
    id: 'infant_20',
    ageGroup: 'infant',
    ageLabel: '영아기',
    questionText: '일상 루틴(수유 시간, 낮잠 시간 등)이 바뀌면 아이의 반응은?',
    options: [
      '금방 적응해요',
      '약간 불안해하지만 곧 괜찮아져요',
      '많이 보채고 힘들어해요',
      '크게 개의치 않아요',
    ],
    category: 'habit',
  },

  // ========================================
  // 유치원기 (37~72개월) 20개
  // ========================================

  // 1-4: 성격/기질
  {
    id: 'kinder_1',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이가 새로운 환경(새 학기, 처음 가는 학원 등)에 적응하는 모습은?',
    options: [
      '금방 적응하고 먼저 친구에게 다가가요',
      '며칠은 긴장하지만 곧 익숙해져요',
      '오랫동안 불안해하고 가기 싫어해요',
      '겉으로는 괜찮아 보이지만 집에서 힘들어해요',
    ],
    category: 'personality',
  },
  {
    id: 'kinder_2',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '규칙이나 약속(정리하기, 차례 지키기 등)에 대한 아이의 태도는?',
    options: [
      '규칙을 잘 따르고 다른 아이에게도 알려줘요',
      '대체로 따르지만 가끔 잊어요',
      '싫어하고 자기 방식대로 하려 해요',
      '"왜 그래야 해?"라며 이유를 물어요',
    ],
    category: 'personality',
  },
  {
    id: 'kinder_3',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이에게 선택지를 줬을 때(옷 고르기, 메뉴 정하기 등) 반응은?',
    options: [
      '빠르게 결정하고 확신이 있어요',
      '고민하다가 결국 잘 고르는 편이에요',
      '결정을 못 하고 부모에게 정해달라고 해요',
      '한번 정한 걸 자주 바꿔요',
    ],
    category: 'personality',
  },
  {
    id: 'kinder_4',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '어려운 과제(복잡한 퍼즐, 그림 그리기 등)를 할 때 아이의 인내심은?',
    options: [
      '끝까지 해내려고 집중해요',
      '중간에 힘들어도 도와주면 계속해요',
      '금방 "못하겠어"라며 포기해요',
      '쉬운 부분만 하고 어려우면 넘겨요',
    ],
    category: 'personality',
  },

  // 5-8: 학습/호기심
  {
    id: 'kinder_5',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이가 궁금한 것이 생기면 어떻게 하나요?',
    options: [
      '끊임없이 "왜?"라고 질문해요',
      '스스로 만져보거나 해보며 알아내요',
      '그림책이나 영상에서 답을 찾으려 해요',
      '궁금해도 금방 잊어버리는 편이에요',
    ],
    category: 'learning',
  },
  {
    id: 'kinder_6',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이가 가장 관심을 보이는 분야는 무엇인가요?',
    options: [
      '공룡, 우주, 동물 등 자연/과학',
      '글자, 숫자, 퍼즐 등 사고력 놀이',
      '그림 그리기, 노래, 춤 등 예술',
      '친구와 함께하는 역할놀이/사회놀이',
    ],
    category: 'learning',
  },
  {
    id: 'kinder_7',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이가 한 가지 활동에 집중하는 시간은 보통 어느 정도인가요?',
    options: [
      '30분 이상 꾸준히 집중해요',
      '15~20분 정도 집중해요',
      '10분 이내로 다른 것에 관심이 옮겨져요',
      '좋아하는 것만 오래, 나머지는 짧아요',
    ],
    category: 'learning',
  },
  {
    id: 'kinder_8',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이에게 새로운 것을 알려줄 때 가장 잘 이해하는 방식은?',
    options: [
      '직접 해보게 하면 금방 이해해요',
      '그림이나 영상으로 보여주면 잘 따라와요',
      '말로 차근차근 설명하면 이해해요',
      '또래와 함께 하면 더 빨리 배워요',
    ],
    category: 'learning',
  },

  // 9-12: 사회성
  {
    id: 'kinder_9',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이의 친구 관계는 어떤 편인가요?',
    options: [
      '다양한 친구와 두루두루 잘 어울려요',
      '한두 명의 단짝 친구가 있어요',
      '혼자 노는 것을 더 좋아해요',
      '친구를 사귀고 싶어하지만 어려워해요',
    ],
    category: 'social',
  },
  {
    id: 'kinder_10',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '친구와 갈등(장난감 뺏기, 의견 충돌)이 생기면 어떻게 하나요?',
    options: [
      '말로 자기 생각을 이야기해요',
      '양보하거나 참는 편이에요',
      '울거나 부모에게 도움을 요청해요',
      '화를 내거나 몸으로 표현해요',
    ],
    category: 'social',
  },
  {
    id: 'kinder_11',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '단체 놀이에서 아이가 보이는 모습은?',
    options: [
      '자연스럽게 이끄는 리더 역할을 해요',
      '규칙을 잘 따르며 협조적이에요',
      '자기 방식대로 하려고 고집부려요',
      '뒤에서 관찰하다가 천천히 참여해요',
    ],
    category: 'social',
  },
  {
    id: 'kinder_12',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이가 양보하거나 나누는 행동은 어느 정도인가요?',
    options: [
      '스스로 잘 나눠주고 양보해요',
      '부모가 말하면 하는 편이에요',
      '나누기를 매우 싫어해요',
      '친한 친구에게만 나눠줘요',
    ],
    category: 'social',
  },

  // 13-16: 감정
  {
    id: 'kinder_13',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이가 감정을 표현하는 방식은 주로 어떤가요?',
    options: [
      '말로 "기분이 좋아/슬퍼"라고 잘 표현해요',
      '표정과 몸짓으로 나타내요',
      '감정을 안으로 삼키고 잘 표현하지 않아요',
      '감정 기복이 크고 격하게 표현해요',
    ],
    category: 'emotion',
  },
  {
    id: 'kinder_14',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이가 실패하거나 못했을 때(게임에서 지기, 그림이 잘 안 됨) 반응은?',
    options: [
      '"다시 해볼래!"라며 다시 도전해요',
      '속상해하지만 격려하면 다시 해요',
      '"나는 못해"라며 쉽게 포기해요',
      '화를 내거나 울면서 안 하겠다고 해요',
    ],
    category: 'emotion',
  },
  {
    id: 'kinder_15',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이가 칭찬을 받았을 때의 반응은?',
    options: [
      '매우 기뻐하고 더 열심히 하려 해요',
      '기쁘지만 내색을 잘 안 해요',
      '칭찬에 별로 반응이 없어요',
      '"당연하지!"라며 자신감을 보여요',
    ],
    category: 'emotion',
  },
  {
    id: 'kinder_16',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '친구가 울거나 힘들어할 때 아이의 반응은?',
    options: [
      '다가가서 걱정하고 위로해줘요',
      '무슨 일인지 궁금해하며 쳐다봐요',
      '별로 관심을 보이지 않아요',
      '같이 울거나 불안해해요',
    ],
    category: 'emotion',
  },

  // 17-20: 놀이/활동
  {
    id: 'kinder_17',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이가 자유 시간이 있으면 주로 뭘 하나요?',
    options: [
      '뛰어다니거나 몸을 쓰는 활동',
      '블록, 퍼즐, 만들기 등 손 활동',
      '그림 그리기, 노래 부르기 등 예술 활동',
      '역할놀이나 상상놀이',
    ],
    category: 'activity',
  },
  {
    id: 'kinder_18',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이의 상상력이나 창의적 표현은 어떤 편인가요?',
    options: [
      '이야기를 만들어내고 상상 세계가 풍부해요',
      '현실적인 것을 관찰하고 그대로 표현해요',
      '규칙에 맞게 정확히 하려 해요',
      '보통 수준이에요',
    ],
    category: 'activity',
  },
  {
    id: 'kinder_19',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '미술이나 음악 활동에 대한 아이의 관심은?',
    options: [
      '매우 좋아하고 자주 하고 싶어해요',
      '하면 즐기지만 스스로 찾지는 않아요',
      '별로 관심이 없어요',
      '특정 분야(그리기 또는 노래)만 좋아해요',
    ],
    category: 'activity',
  },
  {
    id: 'kinder_20',
    ageGroup: 'kinder',
    ageLabel: '유치원기',
    questionText: '아이의 체력과 운동 능력은 어떤 편인가요?',
    options: [
      '에너지가 넘치고 오래 뛰어도 안 지쳐요',
      '또래 수준으로 잘 뛰고 놀아요',
      '체력이 약한 편이라 금방 지쳐요',
      '소근육(가위질, 그리기)이 대근육보다 발달했어요',
    ],
    category: 'activity',
  },

  // ========================================
  // 초등 저학년 (73~108개월, 1~3학년) 20개
  // ========================================

  // 1-4: 학습 스타일
  {
    id: 'elem_low_1',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이가 가장 잘 공부하는 방식은?',
    options: [
      '혼자 조용히 읽고 정리하며 공부해요',
      '부모나 선생님이 설명해주면 잘 따라가요',
      '친구와 함께 문제를 풀면 더 잘해요',
      '직접 실험하거나 만들면서 배우면 좋아해요',
    ],
    category: 'learning',
  },
  {
    id: 'elem_low_2',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '숙제를 대하는 아이의 태도는?',
    options: [
      '먼저 알아서 끝내놓아요',
      '시키면 하는데 꼼꼼하게 해요',
      '미루다가 마지막에 해요',
      '싫어하고 하기 싫어해서 매번 실랑이해요',
    ],
    category: 'learning',
  },
  {
    id: 'elem_low_3',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이가 공부하거나 책 읽을 때 집중력은?',
    options: [
      '한번 시작하면 30분 이상 잘 집중해요',
      '15~20분 정도 집중하는 편이에요',
      '자주 딴짓하거나 움직여요',
      '좋아하는 과목만 잘 집중해요',
    ],
    category: 'learning',
  },
  {
    id: 'elem_low_4',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '시험이나 발표가 있으면 아이의 반응은?',
    options: [
      '별로 긴장하지 않고 잘 해내요',
      '긴장하지만 준비를 열심히 해요',
      '불안해하며 스트레스를 받아요',
      '별로 신경 쓰지 않는 편이에요',
    ],
    category: 'learning',
  },

  // 5-8: 성격
  {
    id: 'elem_low_5',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이가 자기 의견을 말하는 모습은?',
    options: [
      '당당하게 자기 생각을 말해요',
      '물어보면 이야기하는 편이에요',
      '남들 눈치를 보며 잘 말 못 해요',
      '상황에 따라 다르게 행동해요',
    ],
    category: 'personality',
  },
  {
    id: 'elem_low_6',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이의 계획성은 어떤 편인가요?',
    options: [
      '할 일을 미리 정하고 순서대로 해요',
      '대략적인 계획은 세우는 편이에요',
      '계획 없이 즉흥적으로 해요',
      '계획은 세우지만 잘 안 지켜요',
    ],
    category: 'personality',
  },
  {
    id: 'elem_low_7',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이가 일을 할 때 완벽하게 하려는 성향이 있나요?',
    options: [
      '네, 꼼꼼하게 확인하고 완벽해야 넘어가요',
      '어느 정도 잘 하면 만족해요',
      '대충 빨리 끝내려 해요',
      '잘하는 것만 완벽하게, 나머진 대충 해요',
    ],
    category: 'personality',
  },
  {
    id: 'elem_low_8',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이가 새로운 것(취미, 놀이, 과목)에 도전하는 태도는?',
    options: [
      '호기심이 많아 새로운 것을 좋아해요',
      '관심 분야면 적극적으로 도전해요',
      '처음에는 무서워하지만 해보면 좋아해요',
      '익숙한 것만 하려 하고 새 시도를 꺼려요',
    ],
    category: 'personality',
  },

  // 9-12: 사회성
  {
    id: 'elem_low_9',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이의 친구 관계는 어떤가요?',
    options: [
      '많은 친구와 활발하게 어울려요',
      '소수의 친한 친구가 있어요',
      '친구보다 혼자 놀기를 좋아해요',
      '친구를 사귀고 싶지만 다가가기 어려워해요',
    ],
    category: 'social',
  },
  {
    id: 'elem_low_10',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '친구 사이에 갈등이 생기면 아이의 대처는?',
    options: [
      '대화로 해결하려고 해요',
      '참거나 양보하는 편이에요',
      '화를 내거나 싸우는 편이에요',
      '선생님이나 부모에게 말해요',
    ],
    category: 'social',
  },
  {
    id: 'elem_low_11',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '선생님과의 관계는 어떤가요?',
    options: [
      '선생님을 좋아하고 잘 따라요',
      '무난하게 지내요',
      '선생님을 어려워하거나 긴장해요',
      '관심받고 싶어서 자주 이야기해요',
    ],
    category: 'social',
  },
  {
    id: 'elem_low_12',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '모둠(그룹) 활동을 할 때 아이의 모습은?',
    options: [
      '적극적으로 의견을 내고 이끌어요',
      '맡은 역할을 책임감 있게 해요',
      '친구가 시키는 대로 따라가요',
      '혼자 하는 게 더 편해 보여요',
    ],
    category: 'social',
  },

  // 13-16: 감정/스트레스
  {
    id: 'elem_low_13',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이가 스트레스를 받으면 주로 어떻게 해소하나요?',
    options: [
      '몸을 움직이거나 운동해요',
      '좋아하는 취미(그림, 게임 등)를 해요',
      '부모나 친구에게 이야기해요',
      '혼자 조용히 있고 싶어해요',
    ],
    category: 'emotion',
  },
  {
    id: 'elem_low_14',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이가 실수하거나 실패했을 때 반응은?',
    options: [
      '금방 털어내고 다시 도전해요',
      '속상해하지만 격려하면 괜찮아져요',
      '오래 속상해하고 자책해요',
      '남 탓을 하거나 화를 내요',
    ],
    category: 'emotion',
  },
  {
    id: 'elem_low_15',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이의 전반적인 자신감 수준은?',
    options: [
      '"나 잘해!"라며 자신감이 넘쳐요',
      '잘하는 분야에서는 자신 있어해요',
      '전반적으로 자신감이 부족해요',
      '칭찬을 받으면 올라갔다가 곧 내려가요',
    ],
    category: 'emotion',
  },
  {
    id: 'elem_low_16',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이가 자주 걱정하거나 불안해하는 것이 있나요?',
    options: [
      '거의 걱정이 없어요',
      '학교나 시험에 대한 걱정이 있어요',
      '친구 관계에 대해 걱정해요',
      '여러 가지를 걱정하는 편이에요',
    ],
    category: 'emotion',
  },

  // 17-20: 생활습관
  {
    id: 'elem_low_17',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아침에 등교 준비하는 모습은?',
    options: [
      '스스로 일어나서 준비해요',
      '깨워주면 곧 일어나서 준비해요',
      '여러 번 깨워야 겨우 일어나요',
      '준비물 챙기는 걸 자주 빠뜨려요',
    ],
    category: 'habit',
  },
  {
    id: 'elem_low_18',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이의 정리정돈 습관은?',
    options: [
      '스스로 잘 정리해요',
      '시키면 정리하는 편이에요',
      '정리를 잘 못하고 어질러요',
      '자기 방식대로 정리하는데 좀 독특해요',
    ],
    category: 'habit',
  },
  {
    id: 'elem_low_19',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이의 시간 관리 능력은?',
    options: [
      '시간 약속을 잘 지키고 관리해요',
      '가끔 늦지만 노력하는 편이에요',
      '시간 개념이 약해서 자주 늦어요',
      '좋아하는 것에 빠지면 시간을 잊어요',
    ],
    category: 'habit',
  },
  {
    id: 'elem_low_20',
    ageGroup: 'elem_low',
    ageLabel: '초등 저학년',
    questionText: '아이가 요즘 가장 좋아하는 취미나 활동은?',
    options: [
      '스포츠나 야외 활동',
      '독서나 공부',
      '게임이나 영상 시청',
      '미술, 음악 등 창작 활동',
    ],
    category: 'habit',
  },

  // ========================================
  // 초등 고학년 (109~144개월, 4~6학년) 20개
  // ========================================

  // 1-4: 학습/진로
  {
    id: 'elem_high_1',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이가 가장 좋아하거나 자신 있어하는 과목은?',
    options: [
      '수학/과학 같은 논리적 과목',
      '국어/사회 같은 언어/인문 과목',
      '미술/음악/체육 같은 예체능 과목',
      '특별히 좋아하는 과목이 없어요',
    ],
    category: 'learning',
  },
  {
    id: 'elem_high_2',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이가 공부를 하는 주된 이유는 무엇인가요?',
    options: [
      '새로운 것을 알게 되는 게 재밌어서',
      '좋은 성적을 받고 싶어서',
      '부모님이 시켜서 해야 하니까',
      '장래 꿈을 위해 필요하다고 느껴서',
    ],
    category: 'learning',
  },
  {
    id: 'elem_high_3',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이가 목표를 세우고 실천하는 모습은?',
    options: [
      '구체적 목표를 세우고 꾸준히 실천해요',
      '목표는 세우지만 중간에 흐지부지돼요',
      '목표를 세우는 걸 어려워해요',
      '단기 목표는 잘 지키지만 장기는 힘들어해요',
    ],
    category: 'learning',
  },
  {
    id: 'elem_high_4',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이의 독서 습관은 어떤가요?',
    options: [
      '다양한 분야의 책을 자주 읽어요',
      '좋아하는 장르(만화, 소설 등)만 읽어요',
      '학교 필독서 외에는 잘 안 읽어요',
      '책보다 영상이나 유튜브를 선호해요',
    ],
    category: 'learning',
  },

  // 5-8: 성격/가치관
  {
    id: 'elem_high_5',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '불공평하다고 느끼는 상황에서 아이의 반응은?',
    options: [
      '적극적으로 목소리를 내요',
      '속으로 불만이지만 참아요',
      '신뢰하는 어른에게 이야기해요',
      '크게 신경 쓰지 않는 편이에요',
    ],
    category: 'personality',
  },
  {
    id: 'elem_high_6',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이의 독립심은 어떤 수준인가요?',
    options: [
      '대부분 스스로 알아서 해요',
      '해야 할 건 하지만 가끔 도움을 요청해요',
      '부모 도움이 많이 필요해요',
      '할 수 있는데도 해달라고 하는 편이에요',
    ],
    category: 'personality',
  },
  {
    id: 'elem_high_7',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '그룹이나 모임에서 아이의 리더십 성향은?',
    options: [
      '자연스럽게 이끌고 결정을 내려요',
      '의견은 적극적으로 내지만 따르기도 해요',
      '리더보다는 팔로워 역할이 편해요',
      '필요하면 리더를 하지만 선호하진 않아요',
    ],
    category: 'personality',
  },
  {
    id: 'elem_high_8',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '경쟁(시험, 대회, 게임 등)에 대한 아이의 태도는?',
    options: [
      '이기는 것을 매우 중요하게 생각해요',
      '경쟁은 좋아하지만 지는 것도 받아들여요',
      '경쟁 자체를 별로 좋아하지 않아요',
      '지면 크게 속상해하고 오래 끌어요',
    ],
    category: 'personality',
  },

  // 9-12: 사회성
  {
    id: 'elem_high_9',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이의 또래 관계에서 보이는 특징은?',
    options: [
      '인기가 많고 다양한 그룹에 속해 있어요',
      '몇 명의 절친과 깊은 관계를 유지해요',
      '친구보다 자기만의 시간을 중시해요',
      '또래 관계에서 어려움을 느끼는 것 같아요',
    ],
    category: 'social',
  },
  {
    id: 'elem_high_10',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '스마트폰이나 SNS 사용에 대한 아이의 모습은?',
    options: [
      '아직 거의 사용하지 않아요',
      '적절히 사용하고 스스로 조절해요',
      '많이 사용하고 놓기 힘들어해요',
      '친구와 소통 수단으로 주로 사용해요',
    ],
    category: 'social',
  },
  {
    id: 'elem_high_11',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '이성 친구에 대한 아이의 태도는?',
    options: [
      '자연스럽게 어울리고 편하게 지내요',
      '의식하면서 부끄러워해요',
      '별로 관심이 없어요',
      '이성 친구 이야기를 가끔 해요',
    ],
    category: 'social',
  },
  {
    id: 'elem_high_12',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '봉사활동이나 남을 돕는 일에 대한 아이의 관심은?',
    options: [
      '적극적으로 참여하고 보람을 느껴요',
      '시키면 하지만 스스로 나서진 않아요',
      '별로 관심이 없어요',
      '관심은 있지만 실천으로 옮기긴 어려워해요',
    ],
    category: 'social',
  },

  // 13-16: 감정/자아
  {
    id: 'elem_high_13',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이가 자기 자신을 얼마나 잘 이해하고 있다고 느끼세요?',
    options: [
      '자기 장단점을 꽤 잘 알고 있어요',
      '좋아하는 것은 알지만 깊은 이해는 부족해요',
      '자기 자신에 대해 잘 모르는 것 같아요',
      '자기 자신에 대해 자주 고민하는 편이에요',
    ],
    category: 'emotion',
  },
  {
    id: 'elem_high_14',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이의 스트레스 관리 능력은?',
    options: [
      '스스로 해소 방법을 알고 잘 관리해요',
      '부모 도움이 있으면 잘 극복해요',
      '쉽게 스트레스를 받고 해소가 어려워요',
      '스트레스를 안 받는 척하지만 쌓이는 것 같아요',
    ],
    category: 'emotion',
  },
  {
    id: 'elem_high_15',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '미래(중학교, 진로 등)에 대해 아이가 보이는 태도는?',
    options: [
      '기대하고 긍정적으로 생각해요',
      '약간의 걱정이 있지만 대체로 괜찮아요',
      '불안해하거나 걱정이 많아요',
      '아직 관심이 없는 것 같아요',
    ],
    category: 'emotion',
  },
  {
    id: 'elem_high_16',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이의 자존감 수준은 어떤 편인가요?',
    options: [
      '높은 편이고 자기 자신을 좋아해요',
      '보통이고 상황에 따라 달라져요',
      '낮은 편이고 자주 자신을 부정적으로 봐요',
      '겉으로는 자신감 있어 보이지만 속으로는 불안해요',
    ],
    category: 'emotion',
  },

  // 17-20: 생활/취미
  {
    id: 'elem_high_17',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이의 용돈 관리 습관은?',
    options: [
      '잘 아끼고 저축도 해요',
      '계획적으로 쓰려고 노력해요',
      '받으면 바로 써버려요',
      '아직 용돈을 주고 있지 않아요',
    ],
    category: 'habit',
  },
  {
    id: 'elem_high_18',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '학교, 학원, 놀이 시간 배분에 대한 아이의 모습은?',
    options: [
      '스스로 잘 조절하고 균형을 맞춰요',
      '부모가 정해주면 따라요',
      '놀이 시간만 늘리려 해요',
      '바빠서 여유 시간이 거의 없어요',
    ],
    category: 'habit',
  },
  {
    id: 'elem_high_19',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이가 좋아하거나 잘하는 운동이 있나요?',
    options: [
      '구기 운동(축구, 농구, 야구 등)',
      '개인 운동(수영, 달리기, 자전거 등)',
      '특별히 좋아하는 운동은 없어요',
      '운동보다 예술이나 두뇌 활동을 좋아해요',
    ],
    category: 'habit',
  },
  {
    id: 'elem_high_20',
    ageGroup: 'elem_high',
    ageLabel: '초등 고학년',
    questionText: '아이가 장래 희망이나 꿈에 대해 이야기한 적 있나요?',
    options: [
      '구체적인 꿈이 있고 자주 이야기해요',
      '관심 분야는 있지만 아직 확실하진 않아요',
      '자주 바뀌어요',
      '아직 특별히 생각해본 적 없는 것 같아요',
    ],
    category: 'habit',
  },
];

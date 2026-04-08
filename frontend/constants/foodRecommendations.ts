/* ------------------------------------------------------------------ */
/*  Static food recommendation data per temperament type                */
/*  Used as local fallback when backend /food-guide returns empty.      */
/* ------------------------------------------------------------------ */

export interface FoodRecommendation {
  name: string;
  emoji: string;
  reason: string;
  recipe: string[];
  youtubeQuery: string;
  caution?: string;
}

export interface AvoidFood {
  name: string;
  emoji: string;
  reason: string;
}

export interface TemperamentFoods {
  good: FoodRecommendation[];
  bad: AvoidFood[];
}

type TemperamentKey =
  | 'active'
  | 'explorer'
  | 'balanced'
  | 'analytical'
  | 'sensitive';

/**
 * Maps dominantType string from backend to a local key.
 * Backend may return labels like "활동형(火)", "탐구형(木)" etc.
 */
export function resolveTemperamentKey(
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

export const FOOD_RECOMMENDATIONS: Record<TemperamentKey, TemperamentFoods> = {
  /* ======================== active ======================== */
  active: {
    good: [
      {
        name: '소고기 죽',
        emoji: '\uD83E\uDD69',
        reason:
          '활동형 기질은 에너지 소모가 많아 철분과 단백질이 풍부한 소고기가 좋아요',
        recipe: [
          '소고기 30g을 잘게 다져주세요',
          '불린 쌀과 함께 물을 넣고 끓여주세요',
          '잘 저어가며 부드러운 죽이 될 때까지 끓여주세요',
        ],
        youtubeQuery: '아기 소고기죽 레시피',
        caution: '소고기 알레르기 확인 필요',
      },
      {
        name: '바나나 오트밀',
        emoji: '\uD83C\uDF4C',
        reason:
          '에너지를 빠르게 보충하면서도 소화가 편한 탄수화물 조합이에요',
        recipe: [
          '오트밀 3큰술을 물에 불려주세요',
          '바나나 반 개를 으깨 섞어주세요',
          '전자레인지에 1분 데워 따뜻하게 주세요',
        ],
        youtubeQuery: '아기 바나나 오트밀 만들기',
      },
      {
        name: '닭가슴살 채소볶음밥',
        emoji: '\uD83C\uDF57',
        reason:
          '고단백 저지방 닭가슴살이 활발한 근육 발달을 도와줘요',
        recipe: [
          '닭가슴살 40g을 잘게 찢어주세요',
          '당근, 양파를 작게 다져 볶아주세요',
          '밥과 함께 약간의 참기름으로 볶아 완성해요',
        ],
        youtubeQuery: '유아 닭가슴살 볶음밥',
      },
      {
        name: '고구마 스틱',
        emoji: '\uD83C\uDF60',
        reason:
          '에너지 보충에 좋은 복합 탄수화물로 활동 후 간식으로 딱이에요',
        recipe: [
          '고구마를 스틱 모양으로 잘라주세요',
          '찜기에 15분간 쪄주세요',
          '손에 잡기 좋은 크기로 식혀서 주세요',
        ],
        youtubeQuery: '아기 고구마 간식',
      },
      {
        name: '연어 덮밥',
        emoji: '\uD83E\uDD69',
        reason:
          '오메가3 지방산이 활동 후 근육 회복과 두뇌 발달에 도움을 줘요',
        recipe: [
          '연어 30g을 수증기로 쪄주세요',
          '잘게 부수어 밥 위에 올려주세요',
          '참기름 한 방울과 깨를 뿌려 마무리해요',
        ],
        youtubeQuery: '유아 연어 덮밥 만들기',
        caution: '생선 알레르기 확인 필요',
      },
      {
        name: '두부 달걀찜',
        emoji: '\uD83E\uDD5A',
        reason:
          '단백질이 풍부하면서도 부드러워 에너지 보충에 좋아요',
        recipe: [
          '달걀 1개와 두부 1/4모를 으깨 섞어주세요',
          '물 2큰술을 넣고 거품을 걷어내주세요',
          '찜기에 10분간 쪄주세요',
        ],
        youtubeQuery: '유아 두부 달걀찜',
      },
      {
        name: '시금치 감자 수프',
        emoji: '\uD83E\uDD66',
        reason:
          '철분이 풍부한 시금치가 활동적인 아이의 빈혈을 예방해요',
        recipe: [
          '감자 1개와 시금치를 부드럽게 삶아주세요',
          '블렌더로 곱게 갈아주세요',
          '따뜻하게 데워 우유 한 스푼과 섞어주세요',
        ],
        youtubeQuery: '유아 시금치 수프',
      },
      {
        name: '잡곡밥 주먹밥',
        emoji: '\uD83C\uDF59',
        reason:
          '다양한 영양소를 고르게 섭취하며 지속적인 에너지를 공급해요',
        recipe: [
          '잡곡밥에 잘게 다진 김과 참깨를 섞어주세요',
          '아이 손 크기에 맞게 동글게 빚어주세요',
          '김으로 감싸 손으로 먹기 좋게 해주세요',
        ],
        youtubeQuery: '유아 잡곡 주먹밥',
      },
    ],
    bad: [
      { name: '탄산음료', emoji: '\uD83E\uDD64', reason: '칼슘 흡수를 방해해 성장기 뼈 발달에 해로워요' },
      { name: '과자/쿠키', emoji: '\uD83C\uDF6A', reason: '빈 칼로리로 포만감만 주고 필요한 영양소가 부족해요' },
      { name: '튀김류', emoji: '\uD83C\uDF5F', reason: '과도한 지방이 소화를 느리게 하고 활동력을 떨어뜨려요' },
      { name: '초콜릿', emoji: '\uD83C\uDF6B', reason: '카페인 성분이 수면을 방해하고 과잉 흥분을 유발해요' },
      { name: '라면', emoji: '\uD83C\uDF5C', reason: '나트륨 과다 섭취가 신장에 부담을 줘요' },
    ],
  },

  /* ======================== explorer ======================== */
  explorer: {
    good: [
      {
        name: '블루베리 요거트',
        emoji: '\uD83E\uDED0',
        reason:
          '탐구형 기질의 두뇌 활동을 돕는 안토시아닌이 풍부해요',
        recipe: [
          '플레인 요거트 100ml를 그릇에 담아주세요',
          '블루베리 한 줌을 올려주세요',
          '꿀 반 스푼을 뿌려 완성해요',
        ],
        youtubeQuery: '아기 블루베리 요거트 만들기',
      },
      {
        name: '호두 바나나 스무디',
        emoji: '\uD83E\uDD5B',
        reason:
          '호두의 오메가3가 집중력과 기억력 발달에 도움을 줘요',
        recipe: [
          '바나나 1개와 호두 5알을 블렌더에 넣어주세요',
          '우유 150ml를 추가해주세요',
          '부드럽게 갈아서 컵에 담아주세요',
        ],
        youtubeQuery: '유아 호두 바나나 스무디',
        caution: '견과류 알레르기 확인 필요 (만 1세 이후 권장)',
      },
      {
        name: '달걀 시금치 토스트',
        emoji: '\uD83C\uDF5E',
        reason:
          '달걀의 콜린 성분이 두뇌 신경 전달을 활발하게 해줘요',
        recipe: [
          '달걀 1개를 스크램블로 만들어주세요',
          '데친 시금치를 잘게 다져 섞어주세요',
          '식빵 위에 올려 먹기 좋게 잘라주세요',
        ],
        youtubeQuery: '유아 달걀 시금치 토스트',
      },
      {
        name: '미역 소고기 국',
        emoji: '\uD83E\uDD62',
        reason:
          '미역의 요오드가 갑상선 건강과 두뇌 성장을 지원해요',
        recipe: [
          '불린 미역과 다진 소고기를 참기름에 볶아주세요',
          '물을 넣고 끓여주세요',
          '간장으로 약하게 간을 맞춰주세요',
        ],
        youtubeQuery: '유아 미역국 끓이기',
      },
      {
        name: '당근 사과 주스',
        emoji: '\uD83E\uDD55',
        reason:
          '베타카로틴이 시력 발달과 면역력 강화에 좋아요',
        recipe: [
          '당근 반 개와 사과 반 개를 잘게 잘라주세요',
          '물 100ml과 함께 블렌더로 갈아주세요',
          '체에 걸러 부드럽게 만들어주세요',
        ],
        youtubeQuery: '아기 당근 사과 주스',
      },
      {
        name: '두부 채소 죽',
        emoji: '\uD83C\uDF72',
        reason:
          '양질의 식물성 단백질이 성장기 두뇌에 영양을 공급해요',
        recipe: [
          '두부를 으깨고 당근, 애호박을 다져주세요',
          '불린 쌀과 물을 넣고 끓여주세요',
          '잘 저어가며 부드러운 죽을 만들어주세요',
        ],
        youtubeQuery: '유아 두부 채소죽',
      },
      {
        name: '고등어 구이',
        emoji: '\uD83D\uDC1F',
        reason:
          'DHA가 풍부하여 학습 능력과 집중력 향상에 도움을 줘요',
        recipe: [
          '고등어 한 토막의 가시를 제거해주세요',
          '프라이팬에 약한 불로 앞뒤로 구워주세요',
          '레몬즙을 뿌려 비린내를 줄여주세요',
        ],
        youtubeQuery: '유아 고등어 구이 만들기',
        caution: '생선 가시 완전 제거 필수',
      },
      {
        name: '검은콩 밥',
        emoji: '\uD83C\uDF5A',
        reason:
          '레시틴 성분이 기억력과 학습 능력을 높여줘요',
        recipe: [
          '검은콩을 6시간 이상 불려주세요',
          '쌀과 함께 밥솥에 넣어주세요',
          '일반 밥처럼 지어주세요',
        ],
        youtubeQuery: '검은콩밥 짓는 법',
      },
    ],
    bad: [
      { name: '사탕/젤리', emoji: '\uD83C\uDF6C', reason: '과도한 당분이 집중력을 흐리게 하고 충치를 유발해요' },
      { name: '인스턴트 식품', emoji: '\uD83E\uDD6B', reason: '인공첨가물이 두뇌 발달에 부정적인 영향을 줄 수 있어요' },
      { name: '핫도그/소시지', emoji: '\uD83C\uDF2D', reason: '아질산나트륨 등 보존제가 건강에 좋지 않아요' },
      { name: '아이스크림', emoji: '\uD83C\uDF68', reason: '과도한 당분과 지방이 영양 균형을 깨뜨려요' },
      { name: '캔 음료', emoji: '\uD83E\uDD64', reason: '인공감미료와 색소가 성장기 아이에게 해로워요' },
    ],
  },

  /* ======================== balanced ======================== */
  balanced: {
    good: [
      {
        name: '오곡밥',
        emoji: '\uD83C\uDF5A',
        reason:
          '조화형 기질에 맞게 다양한 영양소를 균형 있게 섭취할 수 있어요',
        recipe: [
          '찹쌀, 흑미, 수수, 기장, 팥을 미리 불려주세요',
          '쌀과 함께 밥솥에 넣어주세요',
          '일반 잡곡밥처럼 지어주세요',
        ],
        youtubeQuery: '오곡밥 짓는 법',
      },
      {
        name: '된장찌개',
        emoji: '\uD83C\uDF72',
        reason:
          '발효 식품의 유익균이 장 건강과 면역력을 키워줘요',
        recipe: [
          '두부, 감자, 애호박을 적당히 잘라주세요',
          '멸치 육수에 된장을 풀어주세요',
          '채소를 넣고 끓여 완성해주세요',
        ],
        youtubeQuery: '유아 된장찌개 순한맛',
      },
      {
        name: '계란말이',
        emoji: '\uD83E\uDD5A',
        reason:
          '완전식품 달걀로 단백질과 지방을 균형 있게 섭취해요',
        recipe: [
          '달걀 2개를 풀고 다진 당근, 파를 섞어주세요',
          '약한 불에서 얇게 펼쳐 말아주세요',
          '먹기 좋은 크기로 잘라주세요',
        ],
        youtubeQuery: '유아 계란말이 만들기',
      },
      {
        name: '제철 과일 샐러드',
        emoji: '\uD83E\uDD57',
        reason:
          '다양한 비타민과 미네랄로 전반적인 건강을 지켜줘요',
        recipe: [
          '사과, 배, 키위 등 제철 과일을 작게 깍둑썰기 해주세요',
          '플레인 요거트를 뿌려주세요',
          '잘 섞어서 그릇에 담아주세요',
        ],
        youtubeQuery: '유아 과일 샐러드',
      },
      {
        name: '멸치볶음',
        emoji: '\uD83D\uDC1F',
        reason:
          '칼슘이 풍부하여 균형 잡힌 뼈 성장을 도와줘요',
        recipe: [
          '잔멸치를 마른 팬에 볶아주세요',
          '간장, 올리고당으로 양념해주세요',
          '깨를 뿌려 마무리해요',
        ],
        youtubeQuery: '유아 멸치볶음 레시피',
      },
      {
        name: '미니 김밥',
        emoji: '\uD83C\uDF63',
        reason:
          '다양한 재료가 들어있어 영양 밸런스가 뛰어나요',
        recipe: [
          '밥에 참기름과 소금을 약간 넣고 섞어주세요',
          '김 위에 밥, 당근, 시금치, 달걀을 올려주세요',
          '아이 손에 맞게 작게 말아 잘라주세요',
        ],
        youtubeQuery: '유아 미니김밥 만들기',
      },
      {
        name: '찐 브로콜리',
        emoji: '\uD83E\uDD66',
        reason:
          '비타민C와 식이섬유가 면역과 소화를 함께 도와줘요',
        recipe: [
          '브로콜리를 한입 크기로 잘라주세요',
          '찜기에 5분간 쪄주세요',
          '참깨 소스나 치즈를 곁들여주세요',
        ],
        youtubeQuery: '아기 브로콜리 간식',
      },
      {
        name: '소고기 미역국밥',
        emoji: '\uD83E\uDD62',
        reason:
          '한 그릇에 단백질, 미네랄, 탄수화물이 모두 들어있어요',
        recipe: [
          '소고기 미역국을 끓여주세요',
          '밥을 넣어 국밥으로 만들어주세요',
          '참기름 한 방울을 뿌려 풍미를 높여주세요',
        ],
        youtubeQuery: '유아 소고기 미역국밥',
      },
    ],
    bad: [
      { name: '패스트푸드', emoji: '\uD83C\uDF54', reason: '과도한 나트륨과 지방이 성장기 아이에게 부담이 돼요' },
      { name: '가공 치즈', emoji: '\uD83E\uDDC0', reason: '인공 첨가물이 많아 자연 치즈를 선택하는 것이 좋아요' },
      { name: '달달한 시리얼', emoji: '\uD83E\uDD63', reason: '당분이 과다해 영양 불균형을 초래할 수 있어요' },
      { name: '맵고 자극적인 음식', emoji: '\uD83C\uDF36\uFE0F', reason: '아직 약한 위장을 자극할 수 있어요' },
      { name: '에너지 드링크', emoji: '\uD83E\uDD64', reason: '카페인과 타우린이 어린이에게 위험해요' },
    ],
  },

  /* ======================== analytical ======================== */
  analytical: {
    good: [
      {
        name: '현미밥',
        emoji: '\uD83C\uDF5A',
        reason:
          '분석형 기질의 체계적 사고를 돕는 비타민B 복합체가 풍부해요',
        recipe: [
          '현미를 6시간 이상 물에 불려주세요',
          '쌀과 현미를 2:1 비율로 섞어주세요',
          '밥솥에 물을 약간 더 넣고 지어주세요',
        ],
        youtubeQuery: '유아 현미밥 짓는 법',
      },
      {
        name: '닭고기 채소 스프',
        emoji: '\uD83C\uDF5C',
        reason:
          '소화가 좋고 면역력을 키워주는 따뜻한 한 그릇이에요',
        recipe: [
          '닭고기와 감자, 당근, 양파를 잘게 썰어주세요',
          '물을 넣고 부드러워질 때까지 끓여주세요',
          '소금으로 아주 약하게 간해주세요',
        ],
        youtubeQuery: '유아 닭고기 채소 스프',
      },
      {
        name: '견과류 에너지볼',
        emoji: '\uD83E\uDD5C',
        reason:
          '두뇌 에너지원인 건강한 지방과 단백질이 가득해요',
        recipe: [
          '오트밀, 꿀, 잘게 부순 견과류를 섞어주세요',
          '동글하게 빚어주세요',
          '냉장고에 30분 굳혀 완성해요',
        ],
        youtubeQuery: '유아 견과류 에너지볼',
        caution: '견과류 알레르기 확인 필요 (만 1세 이후 권장)',
      },
      {
        name: '배 조림',
        emoji: '\uD83C\uDF50',
        reason:
          '소화를 돕고 기관지 건강에 좋아 집중 환경을 만들어줘요',
        recipe: [
          '배를 적당한 크기로 잘라주세요',
          '물과 약간의 꿀을 넣고 약불에 조려주세요',
          '부드러워질 때까지 은근히 익혀주세요',
        ],
        youtubeQuery: '배 조림 아기 간식',
      },
      {
        name: '두부 스테이크',
        emoji: '\uD83E\uDDD1\u200D\uD83C\uDF73',
        reason:
          '두뇌 발달에 좋은 레시틴이 풍부한 식물성 단백질이에요',
        recipe: [
          '두부를 1cm 두께로 잘라 물기를 빼주세요',
          '팬에 올리브오일을 두르고 노릇하게 구워주세요',
          '간장 소스를 약간 뿌려 완성해요',
        ],
        youtubeQuery: '유아 두부 스테이크',
      },
      {
        name: '아보카도 토스트',
        emoji: '\uD83E\uDD51',
        reason:
          '불포화지방산이 두뇌 세포막 형성에 도움을 줘요',
        recipe: [
          '잘 익은 아보카도를 으깨주세요',
          '식빵 위에 고르게 펴 발라주세요',
          '방울토마토를 작게 잘라 올려주세요',
        ],
        youtubeQuery: '아보카도 토스트 만들기',
      },
      {
        name: '표고버섯 불고기',
        emoji: '\uD83C\uDF44',
        reason:
          '비타민D가 풍부해 뼈 건강과 면역력을 함께 지켜줘요',
        recipe: [
          '소고기와 표고버섯을 잘게 채 썰어주세요',
          '간장, 배즙으로 양념해주세요',
          '팬에 볶아서 밥과 함께 주세요',
        ],
        youtubeQuery: '유아 표고버섯 불고기',
      },
      {
        name: '치즈 감자전',
        emoji: '\uD83E\uDDC0',
        reason:
          '칼슘과 탄수화물로 에너지와 성장을 동시에 도와줘요',
        recipe: [
          '감자를 갈아 전분을 빼주세요',
          '자연 치즈를 잘게 잘라 섞어주세요',
          '팬에 동그랗게 부쳐주세요',
        ],
        youtubeQuery: '유아 치즈 감자전',
      },
    ],
    bad: [
      { name: '과도한 당분 간식', emoji: '\uD83C\uDF6D', reason: '혈당 급등락이 집중력 저하를 유발해요' },
      { name: '인공색소 음식', emoji: '\uD83C\uDF6C', reason: '인공색소가 행동 과잉과 주의력 분산을 일으킬 수 있어요' },
      { name: '냉동 피자', emoji: '\uD83C\uDF55', reason: '가공 치즈와 나트륨이 과다해 건강에 좋지 않아요' },
      { name: '맛살/게맛살', emoji: '\uD83E\uDD80', reason: '전분과 첨가물이 많아 진짜 해산물을 선택하세요' },
      { name: '달달한 음료', emoji: '\uD83E\uDD64', reason: '과도한 설탕이 성장 호르몬 분비를 방해해요' },
    ],
  },

  /* ======================== sensitive ======================== */
  sensitive: {
    good: [
      {
        name: '단호박 죽',
        emoji: '\uD83C\uDF83',
        reason:
          '감성형 기질은 정서 안정이 중요해요. 단호박의 트립토판이 마음을 편안하게 해줘요',
        recipe: [
          '단호박을 찜기에 쪄서 부드럽게 해주세요',
          '으깬 단호박에 불린 쌀을 넣고 끓여주세요',
          '부드러운 죽이 될 때까지 저어주세요',
        ],
        youtubeQuery: '아기 단호박죽 만들기',
      },
      {
        name: '따뜻한 우유',
        emoji: '\uD83E\uDD5B',
        reason:
          '칼슘과 트립토판이 감정 안정과 깊은 수면을 도와줘요',
        recipe: [
          '우유 200ml을 약불에 데워주세요',
          '꿀 반 스푼을 넣어 저어주세요',
          '따뜻할 때 마시도록 해주세요',
        ],
        youtubeQuery: '아이 따뜻한 우유 간식',
        caution: '유당불내증 확인 필요',
      },
      {
        name: '감자 치즈볼',
        emoji: '\uD83E\uDDC0',
        reason:
          '부드러운 식감이 까다로운 감성형 아이도 잘 먹어요',
        recipe: [
          '감자를 삶아 으깨주세요',
          '자연 치즈를 넣어 동글게 빚어주세요',
          '팬에 살짝 구워 완성해요',
        ],
        youtubeQuery: '유아 감자 치즈볼',
      },
      {
        name: '바나나 팬케이크',
        emoji: '\uD83E\uDD5E',
        reason:
          '바나나의 세로토닌 전구체가 기분 안정에 도움을 줘요',
        recipe: [
          '바나나를 으깨고 달걀 1개를 섞어주세요',
          '밀가루 2큰술을 넣어주세요',
          '팬에 작고 동글하게 부쳐주세요',
        ],
        youtubeQuery: '유아 바나나 팬케이크',
      },
      {
        name: '사과 배 조림',
        emoji: '\uD83C\uDF4E',
        reason:
          '따뜻하고 달콤한 간식이 정서적 안정감을 줘요',
        recipe: [
          '사과와 배를 작게 잘라주세요',
          '물과 약간의 설탕을 넣고 약불에 조려주세요',
          '부드러워지면 식혀서 주세요',
        ],
        youtubeQuery: '아기 사과 배 조림',
      },
      {
        name: '콩나물 밥',
        emoji: '\uD83C\uDF31',
        reason:
          '아스파라긴산이 피로를 풀어주고 예민한 기질을 안정시켜요',
        recipe: [
          '쌀을 씻고 콩나물을 올려주세요',
          '밥솥에 넣어 함께 지어주세요',
          '양념장을 곁들여 주세요',
        ],
        youtubeQuery: '콩나물밥 짓는 법',
      },
      {
        name: '미니 호떡',
        emoji: '\uD83E\uDD5E',
        reason:
          '따뜻한 간식이 위장을 편하게 하고 마음을 안정시켜요',
        recipe: [
          '호떡 반죽을 작게 빚어주세요',
          '견과 소를 넣고 팬에 눌러가며 구워주세요',
          '적당히 식혀서 주세요',
        ],
        youtubeQuery: '유아 미니호떡 만들기',
      },
      {
        name: '연근 조림',
        emoji: '\uD83E\uDD54',
        reason:
          '비타민C와 철분이 풍부해 면역력과 정서 안정에 좋아요',
        recipe: [
          '연근을 얇게 슬라이스해주세요',
          '간장, 올리고당으로 조려주세요',
          '참깨를 뿌려 완성해요',
        ],
        youtubeQuery: '유아 연근 조림',
      },
    ],
    bad: [
      { name: '매운 음식', emoji: '\uD83C\uDF36\uFE0F', reason: '예민한 위장을 자극해 소화 불량을 일으킬 수 있어요' },
      { name: '카페인 음료', emoji: '\u2615', reason: '카페인이 불안감을 높이고 수면의 질을 떨어뜨려요' },
      { name: '인스턴트 국물', emoji: '\uD83E\uDD62', reason: 'MSG와 나트륨이 예민한 체질에 자극적이에요' },
      { name: '딱딱한 견과류', emoji: '\uD83E\uDD5C', reason: '질감에 예민한 아이가 거부할 수 있어요 (잘게 갈아 제공)' },
      { name: '새콤한 과일 젤리', emoji: '\uD83C\uDF4A', reason: '인공산미료와 색소가 감성형 아이에게 자극적이에요' },
    ],
  },
};

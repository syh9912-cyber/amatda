/** FoodGuideDict 시드 — 연령×기질 조합 확대 (20개) */

export const FOOD_GUIDES = [
  // ===== 영아 (0~24개월) =====
  { targetAgeMin: 0, targetAgeMax: 24, suitableType: '활동형', foods: [
    { name: '고구마 퓨레', benefit: '에너지 보충과 소화가 쉬운 이유식', caution: '처음엔 소량부터' },
    { name: '소고기 퓨레', benefit: '철분 보충으로 활발한 성장 지원', caution: '알레르기 확인' },
    { name: '바나나', benefit: '칼륨 풍부, 에너지 보충' },
    { name: '닭가슴살 퓨레', benefit: '양질의 단백질 공급' },
  ]},
  { targetAgeMin: 0, targetAgeMax: 24, suitableType: '감성형', foods: [
    { name: '아보카도', benefit: '두뇌 발달에 좋은 건강한 지방', caution: '알레르기 확인' },
    { name: '단호박 퓨레', benefit: '비타민A 풍부, 시각 발달' },
    { name: '두부', benefit: '단백질 보충, 부드러운 식감', caution: '대두 알레르기 확인' },
    { name: '요거트', benefit: '장 건강과 면역력 강화', caution: '무가당 제품 선택' },
  ]},
  { targetAgeMin: 0, targetAgeMax: 24, suitableType: '탐구형', foods: [
    { name: '브로콜리 퓨레', benefit: '비타민C와 섬유질로 면역력 강화' },
    { name: '계란 노른자', benefit: '두뇌 발달에 필수인 콜린 함유', caution: '흰자는 돌 이후' },
    { name: '오트밀', benefit: '천천히 에너지를 공급해 집중력 유지' },
    { name: '당근 퓨레', benefit: '베타카로틴으로 시력 발달 지원' },
  ]},
  { targetAgeMin: 0, targetAgeMax: 24, suitableType: '조화형', foods: [
    { name: '감자 퓨레', benefit: '부드럽고 소화하기 쉬운 탄수화물' },
    { name: '배 퓨레', benefit: '수분 보충과 소화 도움' },
    { name: '쌀미음', benefit: '가장 안전한 첫 이유식' },
    { name: '애호박 퓨레', benefit: '비타민 풍부하고 알레르기 위험 낮음' },
  ]},
  { targetAgeMin: 0, targetAgeMax: 24, suitableType: '분석형', foods: [
    { name: '연두부', benefit: '두뇌 발달을 위한 양질의 식물성 단백질' },
    { name: '시금치 퓨레', benefit: '철분과 엽산으로 인지 발달 지원', caution: '질산염 주의, 소량부터' },
    { name: '참치 퓨레', benefit: 'DHA로 두뇌 신경 발달 촉진', caution: '수은 함량 확인' },
    { name: '완두콩 퓨레', benefit: '식물성 단백질과 비타민B군 풍부' },
  ]},

  // ===== 유아 (25~72개월) =====
  { targetAgeMin: 25, targetAgeMax: 72, suitableType: '활동형', foods: [
    { name: '닭가슴살 구이', benefit: '근육 발달을 위한 양질의 단백질' },
    { name: '현미밥', benefit: '지속적인 에너지 공급' },
    { name: '고구마 스틱', benefit: '건강한 간식, 식이섬유 풍부' },
    { name: '우유', benefit: '칼슘으로 뼈 성장 지원', caution: '유당불내증 확인' },
  ]},
  { targetAgeMin: 25, targetAgeMax: 72, suitableType: '감성형', foods: [
    { name: '블루베리', benefit: '안토시아닌으로 감성 발달과 면역력 강화' },
    { name: '치즈', benefit: '칼슘과 단백질로 안정감 있는 성장' },
    { name: '고구마 라떼(무가당)', benefit: '트립토판 함유로 정서 안정 도움' },
    { name: '바나나 팬케이크', benefit: '세로토닌 전구체로 기분 조절 도움' },
  ]},
  { targetAgeMin: 25, targetAgeMax: 72, suitableType: '탐구형', foods: [
    { name: '연어 볶음밥', benefit: 'DHA로 집중력과 호기심 지원' },
    { name: '아몬드', benefit: '비타민E로 두뇌 세포 보호', caution: '견과 알레르기 주의, 잘게 부숴서' },
    { name: '달걀 프라이', benefit: '콜린으로 기억력 향상' },
    { name: '김', benefit: '요오드로 갑상선 기능 지원' },
  ]},
  { targetAgeMin: 25, targetAgeMax: 72, suitableType: '조화형', foods: [
    { name: '잡곡밥', benefit: '균형 잡힌 영양소 공급' },
    { name: '된장국', benefit: '발효식품으로 장 건강 지원' },
    { name: '사과', benefit: '비타민과 식이섬유의 균형' },
    { name: '두부 스테이크', benefit: '식물성 단백질로 성장 지원' },
  ]},
  { targetAgeMin: 25, targetAgeMax: 72, suitableType: '분석형', foods: [
    { name: '호두', benefit: '오메가3로 논리적 사고 지원', caution: '견과 알레르기 주의' },
    { name: '고등어 구이', benefit: 'DHA 풍부, 집중력 향상', caution: '뼈 주의' },
    { name: '시금치 나물', benefit: '철분으로 두뇌 산소 공급' },
    { name: '현미 크래커', benefit: '비타민B군으로 신경 발달 지원' },
  ]},

  // ===== 초등 (73개월+) =====
  { targetAgeMin: 73, targetAgeMax: 200, suitableType: '활동형', foods: [
    { name: '닭가슴살 샐러드', benefit: '근육 회복과 체력 유지' },
    { name: '바나나 스무디', benefit: '운동 전후 에너지 보충' },
    { name: '잡곡밥', benefit: '지속적인 에너지와 식이섬유' },
    { name: '고구마', benefit: '복합 탄수화물로 꾸준한 에너지' },
    { name: '두유', benefit: '식물성 단백질 보충', caution: '대두 알레르기 확인' },
  ]},
  { targetAgeMin: 73, targetAgeMax: 200, suitableType: '감성형', foods: [
    { name: '다크 초콜릿', benefit: '세로토닌 분비 촉진으로 기분 개선', caution: '카카오 70% 이상, 소량만' },
    { name: '연어 초밥', benefit: 'DHA와 오메가3로 정서 안정' },
    { name: '아보카도 토스트', benefit: '건강한 지방으로 뇌 기능 지원' },
    { name: '캐모마일 차', benefit: '긴장 완화와 수면 도움', caution: '카페인 없음 확인' },
    { name: '견과류 믹스', benefit: '마그네슘으로 스트레스 완화', caution: '알레르기 확인' },
  ]},
  { targetAgeMin: 73, targetAgeMax: 200, suitableType: '탐구형', foods: [
    { name: '연어', benefit: '오메가3로 집중력과 두뇌 발달 지원' },
    { name: '블루베리', benefit: '항산화 성분으로 기억력 향상' },
    { name: '호두', benefit: '두뇌 영양 간식, 불포화지방산', caution: '견과류 알레르기 주의' },
    { name: '달걀', benefit: '콜린으로 학습 능력 강화' },
    { name: '카카오 닙스', benefit: '플라보노이드로 인지 기능 향상', caution: '카페인 소량 함유' },
  ]},
  { targetAgeMin: 73, targetAgeMax: 200, suitableType: '분석형', foods: [
    { name: '계란', benefit: '콜린 성분으로 집중력 강화' },
    { name: '시금치', benefit: '철분으로 두뇌 산소 공급 도움' },
    { name: '고등어', benefit: 'DHA 풍부, 논리적 사고력 지원', caution: '뼈 주의' },
    { name: '렌틸콩 수프', benefit: '철분과 엽산으로 인지 발달' },
    { name: '그릭 요거트', benefit: '단백질과 프로바이오틱스' },
  ]},
  { targetAgeMin: 73, targetAgeMax: 200, suitableType: '조화형', foods: [
    { name: '현미 비빔밥', benefit: '다양한 영양소의 균형 있는 식사' },
    { name: '미역국', benefit: '미네랄과 식이섬유로 균형 성장' },
    { name: '두부 샐러드', benefit: '식물성 단백질과 비타민 동시 섭취' },
    { name: '오렌지', benefit: '비타민C로 면역력 강화' },
    { name: '통밀빵 샌드위치', benefit: '균형 잡힌 한끼 식사' },
  ]},
];

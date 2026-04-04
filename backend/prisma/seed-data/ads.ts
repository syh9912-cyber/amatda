/** 광고 시드 데이터 — 학원 광고, 공구 광고, 배너 광고 */

export const ADS = [
  // 학원 광고 (academy 화면에 노출)
  { type: 'academy', title: '윤선생 영어교실 남악점', description: '기질 맞춤 1:1 영어 수업, 첫 달 무료 체험!', linkUrl: 'https://example.com/ad/yoon', sponsor: '윤선생', targetAge: '73-200', targetTrait: '탐구형', priority: 10 },
  { type: 'academy', title: '눈높이 학습센터', description: '아이 수준에 맞는 자기주도 학습, 무료 레벨 테스트', linkUrl: 'https://example.com/ad/noon', sponsor: '대교', targetAge: '73-200', targetTrait: '분석형', priority: 8 },
  { type: 'academy', title: '짐보리 남악점', description: '영유아 감각 발달 프로그램, 체험 수업 50% 할인', linkUrl: 'https://example.com/ad/gymboree', sponsor: '짐보리', targetAge: '0-48', targetTrait: '활동형', priority: 9 },
  { type: 'academy', title: '리틀팍스 영어 도서관', description: '매일 10분 영어 독서 습관, 7일 무료 체험', linkUrl: 'https://example.com/ad/littlefox', sponsor: '리틀팍스', targetAge: '48-144', targetTrait: '탐구형', priority: 7 },
  { type: 'academy', title: '아이챌린지 플레이센터', description: '오감 자극 놀이 프로그램, 주말 체험 무료', linkUrl: 'https://example.com/ad/ichallenge', sponsor: '베네세', targetAge: '0-36', targetTrait: '감성형', priority: 6 },

  // 공구 광고 (subscription/교구 화면에 노출)
  { type: 'groupbuy', title: '프뢰벨 전집 공구 모집', description: '프뢰벨 자연관찰 전집 42권, 정가 대비 40% 할인 공구!', linkUrl: 'https://example.com/ad/froebel', sponsor: '프뢰벨', targetAge: '25-72', priority: 10 },
  { type: 'groupbuy', title: '레고 듀플로 세트 공구', description: '대형 놀이 세트 공구, 무료 배송 + 추가 블록 증정', linkUrl: 'https://example.com/ad/lego', sponsor: '레고코리아', targetAge: '12-60', priority: 8 },
  { type: 'groupbuy', title: '유아 안전 매트 공구', description: '1등급 안전 인증 폴더매트, 3만원 할인 + 사은품', linkUrl: 'https://example.com/ad/mat', sponsor: '알집매트', targetAge: '0-36', priority: 7 },
  { type: 'groupbuy', title: '한솔 주니어 전집 공구', description: '창작 동화 + 과학 동화 80권, 44% 할인 공구!', linkUrl: 'https://example.com/ad/hansol', sponsor: '한솔교육', targetAge: '48-120', priority: 9 },
  { type: 'groupbuy', title: '키즈 테이블 의자 세트', description: '높이 조절 가능 학습 책상, 자세 교정 의자 포함', linkUrl: 'https://example.com/ad/desk', sponsor: '시디즈', targetAge: '36-120', priority: 6 },

  // 배너 광고 (홈 화면 하단 / 다양한 화면에 노출)
  { type: 'banner', title: '아이클레보 로봇 청소기', description: '육아맘 필수템! 조용한 청소, 첫 구매 20% 할인', linkUrl: 'https://example.com/ad/iclebo', sponsor: '유진로봇', priority: 5 },
  { type: 'banner', title: '매일유업 앱소루트', description: '우리 아이 첫 분유, 무료 샘플 신청하기', linkUrl: 'https://example.com/ad/maeil', sponsor: '매일유업', targetAge: '0-12', priority: 8 },
  { type: 'banner', title: '키디가든 유아 보험', description: '월 1만원대 어린이 보험, 15초 간편 가입', linkUrl: 'https://example.com/ad/insurance', sponsor: '삼성생명', priority: 6 },
  { type: 'banner', title: '아이 사진 인화 앱', description: '매월 무료 사진 10장 인화, 첫 주문 배송비 무료', linkUrl: 'https://example.com/ad/photo', sponsor: '스냅스', priority: 4 },
  { type: 'banner', title: '토이저러스 여름 세일', description: '인기 장난감 최대 50% 할인, 온라인 한정', linkUrl: 'https://example.com/ad/toysrus', sponsor: '토이저러스', priority: 7 },
];

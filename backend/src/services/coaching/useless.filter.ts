import { FilterResult } from './types';

const PARENTING_KEYWORDS = [
  '아이', '아기', '애기', '아들', '딸', '울', '잠', '밥', '먹', '수유',
  '대변', '변', '기저귀', '이유식', '분유', '모유', '열', '감기', '약',
  '깨', '칭얼', '보채', '사회성', '또래', '발달', '성장', '키', '몸무게',
  '떼', '행동', '공격', '예민', '어린이집', '유치원', '학원', '놀이',
  '교육', '코', '기침', '구토', '토', '설사', '변비', '발진', '피부',
  '수면', '낮잠', '밤', '습관', '배앓이', '영양', '간식', '학습',
  '개월', '돌', '걸음', '말', '언어', '치아', '이앓이', '체온', '컨디션',
  // 행동/기타 관련
  '던지', '물건', '손가락', '빨', '고집', '짜증', '소리', '물어',
  '때리', '안아', '안기', '무서', '겁', '싫어', '거부', '화',
  '소변', '기질', '성향', '적응', '분리', '불안', '낯가림',
  '젖', '젖병', '유모차', '카시트', '목욕', '양치', '어떻게',
  // 임산부 관련
  '임신', '입덧', '태동', '태아', '주수', '출산', '분만', '진통', '양수',
  '검진', '초음파', '태교', '태명', '엽산', '철분', '칼슘', '비타민',
  '배', '뭉침', '부종', '부어', '허리', '요통', '변비', '속쓰림',
  '두통', '피곤', '피로', '잠', '불면', '다리', '경련', '어지러',
  '출혈', '이슬', '조산', '전자간증', '당뇨', '혈압', '체중',
  '모유수유', '산후', '조리원', '제왕', '무통', '병원', '산부인과',
  '회음', '라마즈', '호흡법', '카시트', '입원', '가방', '준비물',
];

const GREETING_PATTERNS = /^(안녕|하이|헬로|반갑|감사합니다|고마워|ㅎㅎ|ㅋㅋ|ㅠㅠ|ㅜㅜ|ok|hi|hello)[\s!.?]*$/i;
const JOKE_PATTERNS = /^(ㅋ{3,}|ㅎ{3,}|ㅠ{3,}|\.{3,}|ㅡ{3,}|test|테스트|아무거나|몰라|뭐|asdf|qwer)/i;

// 대화 응답 패턴: 첫 질문이나 이전 질문에 대한 짧은 답변 (차단하면 안 됨)
const REPLY_PATTERNS = /^(네|응|예|아니|아뇨|맞아|그래|좋아|싫어|괜찮|잘|못|많이|조금|가끔|자주|별로|항상|전혀|보통|심해|안|잘 자|잘 먹|잘 안|잘 못|아직|없어|있어|그냥|몰라|좀|약간|그런|아닌|됐어|아직은|별로 없|그래요|됐어요|없어요|있어요)/;

export function filterUselessQuestion(message: string): FilterResult {
  const trimmed = message.trim();

  // 너무 짧은 입력 (2자 이하)
  if (trimmed.replace(/\s/g, '').length < 3) {
    return {
      isUseless: true,
      rejectionType: 'vague',
      rejectionMessage: '조금 더 자세히 알려주시면 도움드릴 수 있어요.\n예: "밤에 자주 깨요", "밥을 잘 안 먹어요" 처럼 적어주세요.',
    };
  }

  // 대화 응답 패턴은 항상 통과 (첫 질문 답변, 후속 질문 답변 등)
  if (REPLY_PATTERNS.test(trimmed)) {
    return { isUseless: false };
  }

  // 인사/감사만 (네/응은 위에서 이미 통과)
  if (GREETING_PATTERNS.test(trimmed)) {
    return {
      isUseless: true,
      rejectionType: 'vague',
      rejectionMessage: '안녕하세요! 육아나 임신에 대한 고민이 있으시면 편하게 말씀해주세요.\n수면, 식사, 발달, 임신 증상, 검진 등 다양한 고민으로 질문해주시면 도와드릴게요.',
    };
  }

  // 장난성 입력
  if (JOKE_PATTERNS.test(trimmed)) {
    return {
      isUseless: true,
      rejectionType: 'joke',
      rejectionMessage: '상황을 조금만 더 구체적으로 적어주시면 도움드릴게요.',
    };
  }

  // 육아/임신 키워드가 하나도 없고 짧으면 무관 질문 (15자 이상이면 통과)
  const hasParentingContext = PARENTING_KEYWORDS.some((kw) => trimmed.includes(kw));
  if (!hasParentingContext && trimmed.length < 15) {
    return {
      isUseless: true,
      rejectionType: 'irrelevant',
      rejectionMessage: '이 채팅은 육아/임신 고민 상담에 맞춰져 있어요.\n아이 또는 임신 관련 고민을 말씀해주시면 도와드릴게요.',
    };
  }

  return { isUseless: false };
}

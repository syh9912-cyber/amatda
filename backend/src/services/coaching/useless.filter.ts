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
];

const GREETING_PATTERNS = /^(안녕|하이|헬로|반갑|감사합니다|고마워|ㅎㅎ|ㅋㅋ|ㅠㅠ|ㅜㅜ|네|응|ok|hi|hello)[\s!.?]*$/i;
const JOKE_PATTERNS = /^(ㅋ{3,}|ㅎ{3,}|ㅠ{3,}|\.{3,}|ㅡ{3,}|test|테스트|아무거나|몰라|뭐|asdf|qwer)/i;

export function filterUselessQuestion(message: string): FilterResult {
  const trimmed = message.trim();

  // 너무 짧은 입력
  if (trimmed.replace(/\s/g, '').length < 4) {
    return {
      isUseless: true,
      rejectionType: 'vague',
      rejectionMessage: '조금 더 정확히 보려면 아이 월령과 어떤 상황에서 그런지 알려주세요.\n예: 수면, 식사, 대변, 울음 중 어떤 고민인지 함께 적어주시면 더 정확히 도와드릴 수 있어요.',
    };
  }

  // 인사/감사만
  if (GREETING_PATTERNS.test(trimmed)) {
    return {
      isUseless: true,
      rejectionType: 'vague',
      rejectionMessage: '안녕하세요! 아이에 대한 고민이 있으시면 편하게 말씀해주세요.\n울음, 수면, 식사, 대변, 사회성, 행동, 성장 관련 고민으로 질문해주시면 정확히 도와드릴게요.',
    };
  }

  // 장난성 입력
  if (JOKE_PATTERNS.test(trimmed)) {
    return {
      isUseless: true,
      rejectionType: 'joke',
      rejectionMessage: '지금 입력만으로는 육아 상담으로 보기 어려워요.\n아이 상황을 조금만 더 구체적으로 적어주시면 필요한 도움만 짧고 정확하게 드릴게요.',
    };
  }

  // 육아 키워드가 하나도 없고 짧으면 무관 질문 (15자 이상이면 통과)
  const hasParentingContext = PARENTING_KEYWORDS.some((kw) => trimmed.includes(kw));
  if (!hasParentingContext && trimmed.length < 15) {
    return {
      isUseless: true,
      rejectionType: 'irrelevant',
      rejectionMessage: '이 채팅은 아이 육아 고민 상담에 맞춰져 있어요.\n울음, 수면, 식사, 대변, 사회성, 행동, 성장 관련 고민으로 질문해주시면 더 정확히 도와드릴게요.',
    };
  }

  return { isUseless: false };
}

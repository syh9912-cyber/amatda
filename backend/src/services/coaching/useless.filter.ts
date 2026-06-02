import { FilterResult } from './types';

const GREETING_PATTERNS = /^(안녕|하이|헬로|반갑|감사합니다|고마워|ㅎㅎ|ㅋㅋ|ㅠㅠ|ㅜㅜ|ok|hi|hello)[\s!.?]*$/i;
const JOKE_PATTERNS = /^(ㅋ{3,}|ㅎ{3,}|ㅠ{3,}|\.{3,}|ㅡ{3,}|test|테스트|아무거나|몰라|뭐|asdf|qwer)/i;

// 대화 응답 패턴: 첫 질문이나 이전 질문에 대한 짧은 답변 (차단하면 안 됨)
const REPLY_PATTERNS = /^(네|응|예|아니|아뇨|맞아|그래|좋아|싫어|괜찮|잘|못|많이|조금|가끔|자주|별로|항상|전혀|보통|심해|안|잘 자|잘 먹|잘 안|잘 못|아직|없어|있어|그냥|몰라|좀|약간|그런|아닌|됐어|아직은|별로 없|그래요|됐어요|없어요|있어요)/;

export function filterUselessQuestion(message: string): FilterResult {
  const trimmed = message.trim();

  // 대화 응답 패턴은 항상 통과 (첫 질문 답변, 후속 질문 답변 등)
  // ※ 길이 체크보다 반드시 먼저 — "네"(1자)도 정상 응답이므로 차단되면 안 됨
  if (REPLY_PATTERNS.test(trimmed)) {
    return { isUseless: false };
  }

  // 너무 짧은 입력 (2자 이하, 그리고 응답 패턴도 아닌 경우)
  if (trimmed.replace(/\s/g, '').length < 3) {
    return {
      isUseless: true,
      rejectionType: 'vague',
      rejectionMessage: '조금 더 자세히 알려주시면 도움드릴 수 있어요.\n예: "밤에 자주 깨요", "밥을 잘 안 먹어요" 처럼 적어주세요.',
    };
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

  // 관련성(육아/임신 무관 여부)은 AI 시스템 지침에 위임 — 여기선 명백한 쓰레기만 거른다.
  // (키워드 화이트리스트 방식은 '똥' 같은 구어를 놓쳐 브리틀했음 → 제거. 무관 질문은
  //  AI가 시스템 지침의 [상담 범위]에 따라 정중히 거절한다.)
  return { isUseless: false };
}

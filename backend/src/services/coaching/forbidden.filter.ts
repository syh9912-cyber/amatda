/**
 * AI 응답 후처리 필터.
 *
 * CLAUDE.md 핵심 규칙: UI 에 사주/오행/천간/지지 노출 절대 금지.
 * Prompt injection 또는 모델 hallucination 으로 system prompt 의 금지가 깨질 수 있어
 * 서버에서 한 번 더 검증한다(defense-in-depth).
 *
 * 매칭되는 응답은 caller 가 결정한 fallback 으로 교체해야 한다.
 */

import { logger } from '../../utils/logger';

// ★ 일상어와 substring 충돌 없는 "고유 사주/오행 용어"만 차단한다 (2026-06-24 수정).
//   기존엔 '사주'(사주다=사다), '지지'(지지하다=support), '일주'(일주일),
//   '정화'(공기정화/이름), '계수'(계수=coefficient) 같은 흔한 단어를 부분 문자열로 잡아
//   정상 코칭 답변을 통째로 폐기 → mock 폴백되는 P0 버그가 있었다.
//   실제 사주 누출은 항상 '오행/천간/간지명/사주팔자'를 동반하므로 아래 용어로 충분히 차단된다.
//   (CLAUDE.md '사주/오행/천간/지지 노출 금지' 규칙은 유지 — 십이지지/천간지지로 지지도 커버)
const FORBIDDEN_TERMS = [
  '사주팔자', '사주풀이', '오행', '천간', '십이지지', '천간지지', '지장간',
  '갑목', '을목', '병화', '무토', '기토', '경금', '신금', '임수',
];

const FORBIDDEN_REGEX = new RegExp(`(${FORBIDDEN_TERMS.join('|')})`);

/** 텍스트에 금지 용어가 포함되어 있는지 검사 */
export function containsForbiddenTerms(text: unknown): boolean {
  if (typeof text !== 'string' || text.length === 0) return false;
  return FORBIDDEN_REGEX.test(text);
}

/**
 * 객체의 모든 문자열 필드(중첩 배열 포함)를 재귀 탐색해 처음 매칭된 금지 용어를 반환.
 * 없으면 null. Gemini 응답 객체(`{ judgement, reasons[], actions[], ... }`)에 사용.
 */
export function findForbiddenTerm(obj: unknown): string | null {
  if (obj == null) return null;
  if (typeof obj === 'string') {
    const m = obj.match(FORBIDDEN_REGEX);
    return m ? m[1] : null;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const hit = findForbiddenTerm(v);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const hit = findForbiddenTerm(v);
      if (hit) return hit;
    }
  }
  return null;
}

/** 하위호환 — 금지 용어 포함 여부 boolean */
export function responseContainsForbiddenTerms(obj: unknown): boolean {
  return findForbiddenTerm(obj) !== null;
}

/**
 * Gemini 응답 검증. 금지 용어 발견 시 경고 로그(어떤 용어인지 포함) + true 반환.
 * caller 는 true 일 때 응답을 폐기하고 fallback 으로 교체해야 한다.
 */
export function shouldRejectAIResponse(response: unknown, context: string): boolean {
  const hit = findForbiddenTerm(response);
  if (hit) {
    // 정상 동작(안전필터가 의도대로 차단)이므로 warn 으로 기록 — Sentry 에러 노이즈 방지.
    logger.warn(
      'forbidden.filter/ai-response-rejected',
      `AI 응답에 금지 용어 '${hit}' 포함 — fallback 으로 교체 (context: ${context})`,
    );
    return true;
  }
  return false;
}

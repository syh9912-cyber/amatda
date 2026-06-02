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

const FORBIDDEN_TERMS = [
  '사주', '오행', '천간', '지지',
  '일주', '월주', '년주', '시주',
  '갑목', '을목', '병화', '정화', '무토', '기토', '경금', '신금', '임수', '계수',
];

const FORBIDDEN_REGEX = new RegExp(`(${FORBIDDEN_TERMS.join('|')})`);

/** 텍스트에 금지 용어가 포함되어 있는지 검사 */
export function containsForbiddenTerms(text: unknown): boolean {
  if (typeof text !== 'string' || text.length === 0) return false;
  return FORBIDDEN_REGEX.test(text);
}

/**
 * 객체의 모든 문자열 필드(중첩 배열 포함)를 재귀 탐색해 금지 용어 포함 여부 검사.
 * Gemini 응답 객체(`{ judgement, reasons[], actions[], ... }`)에 사용.
 */
export function responseContainsForbiddenTerms(obj: unknown): boolean {
  if (obj == null) return false;
  if (typeof obj === 'string') return containsForbiddenTerms(obj);
  if (Array.isArray(obj)) return obj.some((v) => responseContainsForbiddenTerms(v));
  if (typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).some((v) => responseContainsForbiddenTerms(v));
  }
  return false;
}

/**
 * Gemini 응답 검증. 금지 용어 발견 시 경고 로그 + true 반환.
 * caller 는 true 일 때 응답을 폐기하고 fallback 으로 교체해야 한다.
 */
export function shouldRejectAIResponse(response: unknown, context: string): boolean {
  if (responseContainsForbiddenTerms(response)) {
    // 정상 동작(안전필터가 의도대로 차단)이므로 warn 으로 기록 — Sentry 에러 노이즈 방지.
    logger.warn(
      'forbidden.filter/ai-response-rejected',
      `AI 응답에 금지 용어 포함 — fallback 으로 교체 (context: ${context})`,
    );
    return true;
  }
  return false;
}

/**
 * 아이 이름 마스킹 — AI API 전송 시 개인정보 보호.
 *
 * CLAUDE.md 핵심 규칙: AI(Gemini) 전송 시 아이 실명은 반드시 '아이'로 치환.
 *
 * 보안 점검 결과 (2026-05-04):
 * - 기존 단순 `new RegExp(name, 'g')` 는 정규식 메타 문자(., (, +, *, ?, $)
 *   포함된 이름에서 SyntaxError 또는 의도와 다른 매칭. → escape 필요.
 * - childName 자체를 prompt 에 평문 주입하던 곳도 다수 — maskName 으로 통일.
 * - 한글 NFC 정규화 추가 (조합/분해형 일관성).
 */

/** 정규식 메타 문자 escape (이름에 .,(,+ 등 들어와도 안전) */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 한 글자 이름은 매칭이 너무 광범위(예: '주' → '주말') → 유지하되 단어 경계는 한글 안 먹음 */
function isSafeNameToMask(name: string): boolean {
  return name.trim().length >= 2;
}

/**
 * 텍스트 안의 아이 이름을 '아이'로 치환.
 * name 이 1자 이하 / 비어있으면 그대로 반환 (오탐 방지).
 */
export function maskChildName(text: string, name: string | null | undefined): string {
  if (!text || !name) return text;
  const trimmed = name.trim().normalize('NFC');
  if (!isSafeNameToMask(trimmed)) return text;
  try {
    const regex = new RegExp(escapeRegex(trimmed), 'g');
    return text.normalize('NFC').replace(regex, '아이');
  } catch {
    return text;
  }
}

/**
 * AI prompt 컨텍스트에서 사용할 안전한 이름 — 항상 '아이' 반환.
 * (실제 이름이 prompt 에 들어가면 안 됨)
 */
export function safeChildLabel(): string {
  return '아이';
}

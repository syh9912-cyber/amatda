import type { TFunction } from 'i18next';

/**
 * 기질 유형 표시명 번역 헬퍼.
 *
 * 배경: innateData.dominantType 은 설계상 **항상 한글 고정키**로 저장된다
 *       (탐구형 / 활동형 / 조화형 / 분석형 / 감성형 — saju.interpreter VALID_TYPES).
 *       저장값은 gradient/리포트 프로파일 조회 등의 내부 키로 쓰이므로 번역하면 안 되고,
 *       화면에 "표시"할 때만 현재 앱 언어로 바꿔야 한다.
 *
 * ⚠️ 사주/오행 용어(木火土金水) 노출 금지 원칙 유지 — 성향명만 노출.
 * 매칭 실패(알 수 없는 값)면 원본을 그대로 반환해 최소한 깨지지 않게 한다.
 */

const CANONICAL_TRAIT_TYPES = ['탐구형', '활동형', '조화형', '분석형', '감성형'];

export function getTraitTypeName(t: TFunction, dominantType?: string | null): string {
  const raw = (dominantType ?? '').trim();
  if (!raw) return '';
  // 방어적으로 연령 prefix("(0~36개월) 탐구형") 제거 후 캐논 키만 조회
  const key = raw.replace(/^\(.*?\)\s*/, '');
  if (!CANONICAL_TRAIT_TYPES.includes(key)) return raw;
  return t(`traitTypeName.${key}`, { defaultValue: raw });
}

import type { TFunction } from 'i18next';

/**
 * 서버 생성 익명 닉네임을 표시 언어로 변환.
 *
 * 백엔드가 문서에 한국어 고정 패턴으로 저장:
 *  - mom-group pickNickname: 표시이름 없으면 `엄마{userId 끝 4자}`
 *  - mom-group anonTagFor:   익명 댓글 `익명맘#{4자 해시}`
 *  - momstagram getDisplayName: 폴백 `익명`
 * 패턴이 아니면(실제 사용자 닉네임) 원문 그대로 반환.
 */
export function displayNickname(t: TFunction, name?: string | null): string {
  if (!name) return '';
  const mom = name.match(/^엄마([A-Za-z0-9_-]{4})$/);
  if (mom) return t('momGroup.defaultNickname', { tag: mom[1] });
  const anon = name.match(/^익명맘#([A-Z0-9]{4})$/);
  if (anon) return t('momGroup.anonNickname', { tag: anon[1] });
  if (name === '익명') return t('momGroup.anonymous');
  return name;
}

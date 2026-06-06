/**
 * 공동육아(coparenting) 작성자 표기 헬퍼.
 *
 * 초대받은 가족(엄마/아빠/조부모 등)이 아기시간에 기록하면 그 기록에
 * "엄마가 기록함" 처럼 작성자를 표시하기 위해, 신규 기록에 작성자 메타를 주입한다.
 *
 * 규칙:
 *  - 소유자(owner) 본인 기록은 라벨을 달지 않는다 (요구사항). → resolveAuthorMeta = null
 *  - 라벨 출처는 familyMembers.nickname ("엄마"/"아빠") — 작성 시점 스냅샷으로 비정규화 저장.
 *  - 옛 기록 / 권한 조회 실패 시엔 메타 없이 graceful (라벨 미표시).
 *
 * stamp 는 반드시 "신규 기록 생성" 시점에만 호출한다.
 * (saveRecords 같은 배열 저장 지점에서 일괄 stamp 하면 남이 만든 기록까지
 *  현재 사용자로 덮어쓰므로 절대 금지.)
 */

import { coparentingApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { TrackerRecord } from './types';

export interface AuthorMeta {
  authorId: string;
  authorLabel: string;
}

// `${userId}:${childId}` -> 해석된 메타 (null = 소유자/라벨없음).
// 계정 전환 대비 userId 를 키에 포함. 한 번 조회하면 세션 내 재사용.
const cache = new Map<string, AuthorMeta | null>();

/**
 * 현재 사용자가 이 아이에 대해 "초대받은 가족"인지 조회하여 작성자 메타를 반환.
 * 소유자이거나 권한이 없거나 닉네임이 없으면 null (라벨 미표시).
 */
export async function resolveAuthorMeta(childId: string | null | undefined): Promise<AuthorMeta | null> {
  const userId = useAuthStore.getState().userId;
  if (!childId || childId === 'default' || !userId) return null;

  const key = `${userId}:${childId}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  try {
    const res = await coparentingApi.myPermissions(childId);
    const data = res.data?.data as { role?: string; nickname?: string } | undefined;
    // 소유자(owner)는 nickname 자체가 없고, 요구사항상 본인 기록은 라벨 미표시.
    if (!data || data.role === 'owner' || !data.nickname) {
      cache.set(key, null);
      return null;
    }
    const meta: AuthorMeta = { authorId: userId, authorLabel: data.nickname };
    cache.set(key, meta);
    return meta;
  } catch {
    // 권한 없음(403) / 오프라인 → 라벨 미표시로 graceful.
    cache.set(key, null);
    return null;
  }
}

// `${userId}:${childId}` -> 편집 가능 여부 캐시.
const editCache = new Map<string, boolean>();

/**
 * 현재 사용자가 이 아이의 육아 기록을 "편집"할 수 있는지 조회.
 * - 소유자(owner): 항상 true
 * - 공동육아 멤버: permissions 에 'editRecords' 가 있어야 true (열람 전용이면 false)
 * - childId 미지정 / 조회 실패(오프라인 등): true (기존 동작 유지 — 소유자 오프라인 차단 방지,
 *   열람 전용 멤버는 서버가 어차피 editRecords 로 차단하므로 안전).
 */
export async function resolveCanEditRecords(childId: string | null | undefined): Promise<boolean> {
  const userId = useAuthStore.getState().userId;
  if (!childId || childId === 'default' || !userId) return true;

  const key = `${userId}:${childId}`;
  const cached = editCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const res = await coparentingApi.myPermissions(childId);
    const data = res.data?.data as { role?: string; permissions?: string[] } | undefined;
    const can = !!data && (data.role === 'owner' || (data.permissions ?? []).includes('editRecords'));
    editCache.set(key, can);
    return can;
  } catch {
    return true; // 조회 실패 → fail-open (서버가 최종 권한 검사 수행)
  }
}

/** 신규 기록에 작성자 메타 주입. meta 가 없으면(소유자/legacy) 원본 그대로 반환. */
export function stampAuthor(record: TrackerRecord, meta: AuthorMeta | null): TrackerRecord {
  if (!meta) return record;
  return { ...record, authorId: meta.authorId, authorLabel: meta.authorLabel };
}

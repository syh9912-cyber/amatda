/**
 * 공동육아(coparenting) 권한 — 클라이언트 공용 레이어.
 *
 * 정석 원칙:
 *  1) 서버가 진실의 원천(getChildIfAccessible 로 항상 강제). 이 모듈은 UX 게이팅용.
 *  2) 못 쓰는 기능은 화면에서 비활성/안내 → "로컬엔 되는데 공유 안 됨" 착각 제거.
 *  3) 권한 조회 실패(오프라인 등)는 fail-open — 소유자 오프라인 차단을 막고,
 *     실제 차단은 서버가 수행(쓰기 요청이 403/404 로 거부됨).
 *
 * 권한 키(서버 ALL_PERMISSIONS 와 1:1):
 *  viewRecords/editRecords, viewCoaching/useCoaching, viewGrowth,
 *  viewTimeline/editTimeline, viewProfile/editProfile, manageFamily
 */
import { useEffect, useState, useCallback } from 'react';
import { coparentingApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export type Permission =
  | 'viewRecords' | 'editRecords'
  | 'viewCoaching' | 'useCoaching'
  | 'viewGrowth'
  | 'viewTimeline' | 'editTimeline'
  | 'viewProfile' | 'editProfile'
  | 'manageFamily';

export interface ChildPermissions {
  isOwner: boolean;
  role: string;
  permissions: string[];
}

// `${userId}:${childId}` -> 권한 스냅샷. 세션 내 재사용(초대/권한변경은 드묾).
const cache = new Map<string, ChildPermissions>();

/** 캐시 무효화 — 권한 변경/탈퇴 후 호출(선택). */
export function invalidatePermissions(childId?: string): void {
  if (!childId) { cache.clear(); return; }
  const userId = useAuthStore.getState().userId;
  if (userId) cache.delete(`${userId}:${childId}`);
}

/**
 * 현재 사용자의 이 아이에 대한 권한 조회.
 * - 소유자: { isOwner:true, role:'owner', permissions:[*] }
 * - 멤버: 서버가 준 permissions 배열
 * - childId 미지정 / 조회 실패: null (호출부에서 fail-open 처리)
 */
export async function resolveChildPermissions(
  childId: string | null | undefined,
): Promise<ChildPermissions | null> {
  const userId = useAuthStore.getState().userId;
  if (!childId || childId === 'default' || !userId) return null;

  const key = `${userId}:${childId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await coparentingApi.myPermissions(childId);
    const data = res.data?.data as { role?: string; permissions?: string[] } | undefined;
    if (!data) return null;
    const snapshot: ChildPermissions = {
      isOwner: data.role === 'owner',
      role: data.role ?? 'viewer',
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
    };
    cache.set(key, snapshot);
    return snapshot;
  } catch {
    return null; // 조회 실패 → fail-open (서버가 최종 권한 검사)
  }
}

/** 단발 권한 체크 (비-React). 조회 실패 시 true(fail-open). */
export async function canDo(
  childId: string | null | undefined,
  permission: Permission,
): Promise<boolean> {
  const p = await resolveChildPermissions(childId);
  if (!p) return true; // 미지정/실패 → 허용(서버가 최종 차단)
  return p.isOwner || p.permissions.includes(permission);
}

/**
 * React 훅 — 화면에서 권한 게이팅에 사용.
 * 반환:
 *  - can(permission): boolean — 로딩 중/실패 시 true(fail-open)
 *  - isOwner: boolean
 *  - ready: 권한 조회 완료 여부
 */
export function useChildPermissions(childId: string | null | undefined) {
  const [perms, setPerms] = useState<ChildPermissions | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    resolveChildPermissions(childId)
      .then((p) => { if (alive) { setPerms(p); setReady(true); } })
      .catch(() => { if (alive) { setPerms(null); setReady(true); } });
    return () => { alive = false; };
  }, [childId]);

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!perms) return true; // 로딩 중/실패 → fail-open
      return perms.isOwner || perms.permissions.includes(permission);
    },
    [perms],
  );

  return { can, isOwner: perms?.isOwner ?? true, role: perms?.role ?? 'owner', ready };
}

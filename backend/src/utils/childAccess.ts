import { Response } from 'express';
import { collections } from '../services/firestore';
import { error } from './response';

/**
 * 아이 접근 권한 확인 (소유자 OR 가족 구성원)
 *
 * @param childId   - 아이 ID
 * @param userId    - 요청자 ID
 * @param permission - 필요 권한 (null이면 소유자만)
 * @param res       - Express Response (에러 응답용)
 * @returns { data, role } | null
 */
export interface ChildAccessResult {
  data: Record<string, unknown>;
  role: 'owner' | string;
  permissions: string[];
}

export async function getChildIfAccessible(
  childId: string,
  userId: string | undefined,
  permission: string | null,
  res: Response,
): Promise<ChildAccessResult | null> {
  const doc = await collections.children.doc(childId).get();
  if (!doc.exists) {
    error(res, '자녀를 찾을 수 없습니다', 404);
    return null;
  }

  const data = doc.data() as Record<string, unknown>;

  // 소유자: 모든 권한
  if (data.userId === userId) {
    return { data, role: 'owner', permissions: ['*'] };
  }

  // 가족 구성원 확인
  if (!userId) {
    error(res, '자녀를 찾을 수 없습니다', 404);
    return null;
  }

  const memberSnap = await collections.familyMembers
    .where('childId', '==', childId)
    .where('inviteeUserId', '==', userId)
    .where('status', '==', 'accepted')
    .limit(1)
    .get();

  if (memberSnap.empty) {
    error(res, '자녀를 찾을 수 없습니다', 404);
    return null;
  }

  const member = memberSnap.docs[0].data();
  const memberPerms = (member.permissions as string[]) ?? [];

  // 권한 체크 (null이면 접근만 확인)
  if (permission && !memberPerms.includes(permission)) {
    error(res, '해당 기능에 대한 권한이 없습니다', 403);
    return null;
  }

  return {
    data,
    role: member.role as string,
    permissions: memberPerms,
  };
}

/**
 * 현재 사용자가 접근 가능한 모든 아이 ID 목록
 * (소유 아이 + 가족으로 초대받은 아이)
 */
export async function getAccessibleChildIds(userId: string): Promise<string[]> {
  // 1) 소유 아이
  const ownedSnap = await collections.children
    .where('userId', '==', userId)
    .get();
  const ids = ownedSnap.docs.map((d) => d.id);

  // 2) 가족 멤버로 accepted된 아이
  const memberSnap = await collections.familyMembers
    .where('inviteeUserId', '==', userId)
    .where('status', '==', 'accepted')
    .get();

  for (const doc of memberSnap.docs) {
    const cid = doc.data().childId as string;
    if (!ids.includes(cid)) ids.push(cid);
  }

  return ids;
}

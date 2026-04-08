import { Response } from 'express';
import { collections } from '../services/firestore';
import { error } from './response';

/** 자녀 소유권 확인 후 데이터 반환. 실패 시 res에 에러 응답을 보내고 null 반환 */
export async function getChildIfOwned(
  childId: string,
  userId: string | undefined,
  res: Response,
): Promise<Record<string, unknown> | null> {
  const doc = await collections.children.doc(childId).get();
  if (!doc.exists) {
    error(res, '자녀를 찾을 수 없습니다', 404);
    return null;
  }
  const data = doc.data() as Record<string, unknown>;
  if (data.userId !== userId) {
    error(res, '자녀를 찾을 수 없습니다', 404);
    return null;
  }
  return data;
}

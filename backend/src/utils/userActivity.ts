/**
 * 사용자 활동 시각 갱신 — 휴면 정책(1년 미접속 자동 삭제)의 기준.
 *
 * 갱신 트리거:
 *   - 회원가입 / 로그인 / 소셜 로그인 / refresh token 회전 시
 *   - refresh 는 1시간마다 자동 호출되므로 사실상 앱 사용 = 즉시 활성화로 인식
 *
 * 사용자가 다시 활동하면 휴면 경고 / 삭제 예정도 자동 해제 (recovery).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { collections } from '../services/firestore';
import { logger } from './logger';

/**
 * lastActiveAt 을 server timestamp 로 갱신 + 휴면 경고/삭제 예정이 걸려있다면 해제.
 *
 * fire-and-forget 패턴: 호출자가 await 하지 않아도 안전. 실패는 silent log
 * (휴면 정책은 best-effort — 한 번 누락돼도 다음 활동 시 또 갱신됨).
 *
 * @param userId
 */
export async function touchUserActive(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await collections.users.doc(userId).update({
      lastActiveAt: FieldValue.serverTimestamp(),
      // 휴면 경고 / 삭제 예정 클리어 — 재활동 시 회복
      dormantWarnedAt: FieldValue.delete(),
      scheduledDeleteAt: FieldValue.delete(),
    });
  } catch (err: unknown) {
    // user 문서 없는 경우(이미 삭제) 등은 무시
    const code = (err as { code?: number | string })?.code;
    if (code === 5 || code === 'NOT_FOUND') return;
    logger.warn(
      'userActivity/touchUserActive',
      err instanceof Error ? err.message : String(err),
    );
  }
}

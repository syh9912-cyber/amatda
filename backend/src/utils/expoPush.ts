/**
 * Expo Push API 호출 헬퍼.
 *
 * 가족 공유 푸시 등 즉시 발송용. pushSchedules 컬렉션의 retention 문서
 * (`{userId}_{childId}` 형식)에서 pushToken 을 가져와 발송한다.
 *
 * 비용: Expo Push 는 무료. 일일 발송 제한 없음.
 * 문서: https://docs.expo.dev/push-notifications/sending-notifications/
 */
import { collections } from '../services/firestore';
import { logger } from './logger';

interface ExpoPushMessage {
  to: string; // ExponentPushToken[xxxxx]
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
}

/**
 * 단일 사용자의 push token 조회 (해당 자녀에 대한 retention 문서).
 * pushSchedules/{userId}_{childId} 문서에서 pushToken 필드 추출.
 */
export async function getUserPushToken(
  userId: string,
  childId: string,
): Promise<string | null> {
  try {
    const doc = await collections.pushSchedules.doc(`${userId}_${childId}`).get();
    if (!doc.exists) return null;
    const data = doc.data() as Record<string, unknown>;
    const token = data.pushToken;
    if (typeof token === 'string' && token.startsWith('ExponentPushToken[')) {
      return token;
    }
    return null;
  } catch (err) {
    logger.error('expoPush/getUserPushToken', err);
    return null;
  }
}

/**
 * Expo Push API 로 메시지 발송 (단일 또는 배치).
 * fire-and-forget — 실패해도 호출자에 영향 X (silent log).
 */
export async function sendExpoPush(messages: ExpoPushMessage | ExpoPushMessage[]): Promise<void> {
  const arr = Array.isArray(messages) ? messages : [messages];
  if (arr.length === 0) return;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(arr.map((m) => ({ ...m, sound: m.sound ?? 'default' }))),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn('expoPush/send', `HTTP ${res.status}: ${body.slice(0, 200)}`);
      return;
    }
    logger.info('expoPush/send', `sent ${arr.length} messages`);
  } catch (err) {
    logger.error('expoPush/send', err);
  }
}

/**
 * 여러 사용자에게 같은 메시지 발송 (가족 공유용).
 * 토큰이 없는 사용자는 자동 skip.
 */
export async function sendExpoPushToUsers(
  userIds: string[],
  childId: string,
  notification: { title: string; body: string; data?: Record<string, unknown> },
): Promise<{ sentCount: number; skippedCount: number }> {
  const tokens: string[] = [];
  for (const uid of userIds) {
    const t = await getUserPushToken(uid, childId);
    if (t) tokens.push(t);
  }
  if (tokens.length === 0) {
    return { sentCount: 0, skippedCount: userIds.length };
  }
  await sendExpoPush(
    tokens.map((to) => ({
      to,
      title: notification.title,
      body: notification.body,
      data: notification.data,
    })),
  );
  return { sentCount: tokens.length, skippedCount: userIds.length - tokens.length };
}

/**
 * 체험 종료 24시간 전 푸시 알림 발송 (매시간 cron 실행).
 *
 * 조건:
 *  - users.trialStartedAt 이 약 6일 전 ~ 6일 1시간 전 사이
 *    (= 체험 종료 23시간 ~ 24시간 전, 한 번만 발송)
 *  - users.trialEndingNotifiedAt 이 없음 (중복 발송 방지)
 *  - users.subscriptionTier === 'PAID' (체험 활성 상태)
 *  - users.premiumPlanId 없음 (실제 결제 사용자 제외)
 *
 * Apple/Google 정책 + 한국 전자상거래법 명시: 무료 체험 종료 24h 전 사용자에게
 * 알림 발송 권장 (자동 결제 전 사전 고지).
 */

import * as admin from 'firebase-admin';
import { sendExpoPush } from './expoPush';
import { trialEndingPush, normalizePushLocale } from './pushI18n';
import { logger } from './logger';

export async function runTrialEndingSweep(): Promise<void> {
  const db = admin.firestore();
  const now = Date.now();
  // 체험 6일~6일+1시간 전 사용자 = 종료 23~24시간 전
  const TRIAL_DAYS = 7;
  const NOTIFY_HOURS_BEFORE_END = 24; // 종료 24시간 전 발송
  const startOfWindow = new Date(now - (TRIAL_DAYS * 24 - NOTIFY_HOURS_BEFORE_END + 1) * 3600 * 1000).toISOString();
  const endOfWindow = new Date(now - (TRIAL_DAYS * 24 - NOTIFY_HOURS_BEFORE_END) * 3600 * 1000).toISOString();

  // Firestore: 같은 필드에 대한 범위 쿼리 (>=, <=). trialEndingNotifiedAt 필터는 in-memory.
  const snap = await db.collection('users')
    .where('trialStartedAt', '>=', startOfWindow)
    .where('trialStartedAt', '<=', endOfWindow)
    .limit(500)
    .get();

  let notified = 0;
  let skipped = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.trialEndingNotifiedAt) { skipped++; continue; }
    if (data.subscriptionTier !== 'PAID') { skipped++; continue; }
    if (data.premiumPlanId) { skipped++; continue; } // 이미 정식 결제

    // pushSchedules 에서 사용자 토큰 1개 조회 (다기기 케이스 무시 — 가장 최근 등록)
    const tokenSnap = await db.collection('pushSchedules')
      .where('userId', '==', doc.id)
      .limit(1)
      .get();
    if (tokenSnap.empty) { skipped++; continue; }
    const pushToken = tokenSnap.docs[0].data().pushToken as string | undefined;
    if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) { skipped++; continue; }
    const { title, body } = trialEndingPush(normalizePushLocale(tokenSnap.docs[0].data().locale));

    try {
      await sendExpoPush({
        to: pushToken,
        title,
        body,
        data: { type: 'trial_ending', deeplink: 'amatda://subscription' },
      });
      await doc.ref.update({
        trialEndingNotifiedAt: new Date().toISOString(),
      });
      notified++;
    } catch (e) {
      logger.warn('trial.endingSweep', `send failed userId=${doc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  logger.info(
    'trial.endingSweep',
    `scanned=${snap.size} notified=${notified} skipped=${skipped} window=${startOfWindow}~${endOfWindow}`,
  );
}

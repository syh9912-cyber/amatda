/**
 * 휴면 사용자 자동 정리 — 1년 미접속 → 30일 경고 → 삭제.
 *
 * Cloud Scheduler (매일 새벽 03:30 KST) 에서 호출.
 * PIPA 21조(보유 목적 달성 후 즉시 파기) 및 정보통신망법 시행령 16조(휴면 1년) 충족.
 *
 * 두 단계로 분리:
 *   Stage A — 1차 휴면 경고 발송
 *     조건: lastActiveAt < now - 365일 AND dormantWarnedAt 미설정
 *     동작: 푸시 알림 + dormantWarnedAt = now + scheduledDeleteAt = now + 30일
 *
 *   Stage B — 만료 사용자 영구 삭제
 *     조건: scheduledDeleteAt <= now
 *     동작: cascadeDeleteUserData() — Firestore 전체 + Storage 전체
 *
 * 회복: 사용자가 다시 로그인/refresh 하면 touchUserActive() 가 dormantWarnedAt 과
 *      scheduledDeleteAt 을 모두 클리어 → 자동으로 활성 상태 복귀.
 */
import { Timestamp } from 'firebase-admin/firestore';
import { collections } from '../services/firestore';
import { cascadeDeleteUserData } from './cascadeDelete';
import { sendExpoPush } from './expoPush';
import { logger } from './logger';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DORMANT_THRESHOLD_DAYS = 365; // 1년 미접속 → 휴면 진입
export const DORMANT_WARNING_GRACE_DAYS = 30; // 경고 후 유예 기간
const SWEEP_BATCH_SIZE = 100; // 한 회차 처리 상한 (안전장치)

interface SweepStats {
  warned: number;
  deleted: number;
  errors: number;
}

/**
 * 휴면 사용자 sweep 메인 진입점 — 두 단계 모두 실행.
 * 멱등성 보장 — 같은 시각에 두 번 호출돼도 중복 처리 안 됨.
 */
export async function runDormantUserSweep(): Promise<SweepStats> {
  const stats: SweepStats = { warned: 0, deleted: 0, errors: 0 };
  const startedAt = Date.now();
  logger.info('dormantSweep', 'started');

  // Stage B 먼저 — 이미 경고된 사용자의 만료 처리. 새로 경고할 유저 풀과 분리.
  try {
    stats.deleted = await stageBDeleteExpired();
  } catch (err) {
    stats.errors += 1;
    logger.error('dormantSweep/stageB', err);
  }

  try {
    stats.warned = await stageAWarnDormant();
  } catch (err) {
    stats.errors += 1;
    logger.error('dormantSweep/stageA', err);
  }

  logger.info(
    'dormantSweep',
    `done warned=${stats.warned} deleted=${stats.deleted} errors=${stats.errors} elapsedMs=${Date.now() - startedAt}`,
  );
  return stats;
}

/**
 * Stage A — 1년 미접속 + 미경고 사용자에게 푸시 + scheduledDeleteAt 마킹.
 */
async function stageAWarnDormant(): Promise<number> {
  const threshold = Timestamp.fromMillis(Date.now() - DORMANT_THRESHOLD_DAYS * DAY_MS);

  // lastActiveAt 미존재 사용자(legacy)는 이번 sweep 범위에서 제외 — 다음 활동 시
  // touchUserActive() 가 lastActiveAt 을 채운 뒤부터 카운트 시작.
  // 이렇게 안 하면 출시 직후 모든 기존 사용자가 즉시 휴면 처리됨 → 회귀 위험.
  const candidates = await collections.users
    .where('lastActiveAt', '<', threshold)
    .limit(SWEEP_BATCH_SIZE)
    .get();

  let warned = 0;
  for (const doc of candidates.docs) {
    const data = doc.data() as Record<string, unknown>;
    // 이미 경고 발송된 유저 skip
    if (data.dormantWarnedAt) continue;

    const userId = doc.id;
    try {
      const now = Date.now();
      const scheduledDeleteMs = now + DORMANT_WARNING_GRACE_DAYS * DAY_MS;

      // 1) Firestore 마킹 — 이 두 필드는 Stage B 의 query 키
      await collections.users.doc(userId).update({
        dormantWarnedAt: Timestamp.fromMillis(now),
        scheduledDeleteAt: Timestamp.fromMillis(scheduledDeleteMs),
      });

      // 2) 푸시 알림 발송 — 사용자가 등록한 모든 push token 으로
      await notifyDormantUser(userId, scheduledDeleteMs).catch((err) => {
        // 푸시 실패해도 마킹은 유효 — 사용자가 앱 켜면 인앱에서도 안내 가능
        logger.warn('dormantSweep/push', err instanceof Error ? err.message : String(err));
      });

      warned += 1;
    } catch (err) {
      logger.error('dormantSweep/warn', err);
    }
  }
  return warned;
}

/**
 * Stage B — scheduledDeleteAt <= now 사용자 영구 삭제.
 */
async function stageBDeleteExpired(): Promise<number> {
  const now = Timestamp.now();
  const candidates = await collections.users
    .where('scheduledDeleteAt', '<=', now)
    .limit(SWEEP_BATCH_SIZE)
    .get();

  let deleted = 0;
  for (const doc of candidates.docs) {
    const userId = doc.id;
    try {
      await cascadeDeleteUserData(userId, {
        tryUnlink: true,
        reason: 'dormant-sweep',
      });
      deleted += 1;
    } catch (err) {
      logger.error('dormantSweep/delete', err);
    }
  }
  return deleted;
}

/**
 * 휴면 경고 푸시 발송 — 사용자의 모든 pushSchedules 토큰으로.
 */
async function notifyDormantUser(userId: string, scheduledDeleteMs: number): Promise<void> {
  const tokensSnap = await collections.pushSchedules
    .where('userId', '==', userId)
    .limit(20)
    .get();

  const tokens = new Set<string>();
  tokensSnap.docs.forEach((d) => {
    const t = (d.data() as { pushToken?: unknown }).pushToken;
    if (typeof t === 'string' && /^ExponentPushToken\[/.test(t)) {
      tokens.add(t);
    }
  });

  if (tokens.size === 0) {
    logger.info('dormantSweep/notify', `userId=${userId} no-push-token`);
    return;
  }

  const deleteDate = new Date(scheduledDeleteMs);
  const dateStr = `${deleteDate.getFullYear()}.${String(deleteDate.getMonth() + 1).padStart(2, '0')}.${String(deleteDate.getDate()).padStart(2, '0')}`;

  await sendExpoPush(
    Array.from(tokens).map((to) => ({
      to,
      title: '아맞다 — 휴면 계정 안내',
      body: `1년 동안 미접속하셔서 ${dateStr}에 계정과 사진이 자동 삭제됩니다. 앱을 열어주시면 보관이 연장돼요.`,
      data: { type: 'dormant-warning', scheduledDeleteAt: scheduledDeleteMs },
    })),
  );

  logger.info('dormantSweep/notify', `userId=${userId} tokens=${tokens.size}`);
}

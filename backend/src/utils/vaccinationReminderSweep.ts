/**
 * 예방접종 알림 발송 sweep.
 *
 * vaccination.ts 의 POST /schedule-alerts 가 pushSchedules 에 저장하는
 * type='vaccination_reminder' pending 문서(D-2 / D-1, KST 9시 예약)를 순회해,
 * scheduledAt 이 지난 것을 Expo Push 로 실제 발송한다.
 * (이전엔 예약만 되고 이 발송 디스패처가 없어서 접종 알림이 하나도 안 갔음.)
 *
 * 설계:
 * - 조회: where('type','==','vaccination_reminder') 단일 필드(Firestore 자동 인덱스) +
 *   status/scheduledAt 은 메모리 필터. 복합 인덱스 배포를 피한다(admin.ts 와 동일 원칙).
 *   미래(아직 안 됨) 문서는 그대로 두고, 처리한 문서는 삭제해 작업셋을 pending 만으로 유지.
 * - 토큰: pushSchedules/{userId}_{childId} 의 pushToken (getUserPushToken 재사용).
 * - title/body: 예약 시점에 한국어로 미리 렌더돼 있음(접종은 한국 전용 기능) → 그대로 발송.
 * - 신선도 창(FRESH_WINDOW_MS): scheduledAt 이 이 창보다 더 오래 지난 "묵은" 예약은
 *   발송하지 않고 삭제한다. (디스패처 없던 기간에 쌓인 과거 예약이 첫 실행에서
 *   한꺼번에 "지난 접종 알림"으로 쏟아지는 것을 방지 — 매우 중요.)
 * - 멱등: 발송/스킵/만료 후 문서를 삭제 → 재발송 불가.
 * - 비용: Expo Push 무료.
 *
 * 규모 커지면: (type,status,scheduledAt) 복합 인덱스 + scheduledAt 범위 쿼리로 전환.
 */
import { collections } from '../services/firestore';
import { logger } from './logger';
import { sendExpoPush, getUserPushToken } from './expoPush';

// scheduledAt 이 (now - 이 값)보다 더 오래 지났으면 "묵은" 예약 → 발송 안 함.
const FRESH_WINDOW_MS = 12 * 60 * 60 * 1000; // 12시간

interface VaccReminderDoc {
  userId?: string;
  type?: string;
  title?: string;
  body?: string;
  data?: { childId?: string; vaccineId?: string; dDay?: number };
  scheduledAt?: string;
  status?: string;
}

export async function runVaccinationReminderSweep(now: Date = new Date()): Promise<void> {
  const nowMs = now.getTime();
  let sent = 0;
  let staleDropped = 0;
  let skipped = 0;

  const snap = await collections.pushSchedules
    .where('type', '==', 'vaccination_reminder')
    .get();

  for (const doc of snap.docs) {
    try {
      const d = doc.data() as VaccReminderDoc;
      if (d.status && d.status !== 'pending') continue;

      const at = d.scheduledAt ? new Date(d.scheduledAt).getTime() : NaN;
      if (isNaN(at)) {
        await doc.ref.delete(); // 손상 문서
        skipped++;
        continue;
      }
      if (at > nowMs) continue; // 아직 발송 시각 안 됨 → 유지

      // 묵은 예약(디스패처 부재 기간 누적분 등) → 발송 없이 폐기
      if (nowMs - at > FRESH_WINDOW_MS) {
        await doc.ref.delete();
        staleDropped++;
        continue;
      }

      const userId = d.userId;
      const childId = d.data?.childId;
      const title = d.title;
      const body = d.body;
      if (!userId || !childId || !title || !body) {
        await doc.ref.delete();
        skipped++;
        continue;
      }

      const token = await getUserPushToken(userId, childId);
      if (!token) {
        // 알림 미허용/토큰 없음 — scheduledAt 이 이미 지났으니 재시도 무의미 → 폐기
        await doc.ref.delete();
        skipped++;
        continue;
      }

      await sendExpoPush({
        to: token,
        title,
        body,
        data: { type: 'vaccination_reminder', ...(d.data ?? {}) },
      });
      await doc.ref.delete();
      sent++;
    } catch (e) {
      logger.error('vaccinationReminderSweep/item', e);
    }
  }

  logger.info(
    'vaccinationReminderSweep',
    `done sent=${sent} staleDropped=${staleDropped} skipped=${skipped}`,
  );
}

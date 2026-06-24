/**
 * 예측 알람 sweep — 15분마다 실행.
 *
 * pushSchedules(토큰 저장소) 순회 → 각 자녀의 최근 3일 패턴 슬롯 계산 →
 * (슬롯시각 - offsetMin)이 지금 15분 창에 들고, 끄지(disabled) 않았고, 오늘 아직 안 보냈으면
 * Expo Push 발송. 중복방지는 pushSchedules doc 의 predictiveSent 필드(날짜+발송 key)로 처리.
 *
 * 데이터 없으면 슬롯이 없어 자동으로 알람 안 감. 무료(Expo Push + Functions 무료 한도).
 */
import { collections } from '../services/firestore';
import { logger } from './logger';
import { sendExpoPush } from './expoPush';
import {
  computeAlarmSlotsForChild,
  alarmPushText,
  kstDateStr,
  kstMinutesOfDay,
} from '../services/predictiveAlarm';

const WINDOW_MIN = 15; // cron 주기와 동일

export async function runPredictiveAlarmSweep(now: Date = new Date()): Promise<void> {
  const nowMin = kstMinutesOfDay(now);
  const today = kstDateStr(now);
  let sent = 0;

  const snap = await collections.pushSchedules.get();
  for (const doc of snap.docs) {
    try {
      const d = doc.data() as {
        childId?: string;
        pushToken?: string;
        predictiveSent?: { date?: string; keys?: string[] };
      };
      const token = d.pushToken;
      const childId = d.childId;
      if (!childId || typeof token !== 'string' || !/^Expo(?:nent)?PushToken\[/.test(token)) continue;

      const childDoc = await collections.children.doc(childId).get();
      if (!childDoc.exists) continue;
      const childName = typeof childDoc.data()?.name === 'string' ? (childDoc.data()?.name as string) : undefined;
      const pa = (childDoc.data()?.predictiveAlarm ?? {}) as {
        enabled?: boolean;
        offsetMin?: number;
        disabledKeys?: string[];
      };
      if (pa.enabled === false) continue;
      const offset = typeof pa.offsetMin === 'number' ? pa.offsetMin : 30;
      const disabled = new Set(Array.isArray(pa.disabledKeys) ? pa.disabledKeys : []);

      const slots = await computeAlarmSlotsForChild(childId, now);
      if (slots.length === 0) continue;

      const sentToday =
        d.predictiveSent?.date === today ? new Set(d.predictiveSent.keys ?? []) : new Set<string>();
      const fired: string[] = [];

      for (const slot of slots) {
        if (disabled.has(slot.key) || sentToday.has(slot.key)) continue;
        const fireMin = slot.timeMin - offset;
        if (fireMin < 0) continue; // 자정 직후 슬롯(offset 빼면 전날)은 스킵
        if (fireMin >= nowMin && fireMin < nowMin + WINDOW_MIN) {
          const { title, body } = alarmPushText(slot, offset, childName);
          await sendExpoPush({
            to: token,
            title,
            body,
            data: { type: 'predictiveAlarm', childId, slot: slot.key },
          });
          fired.push(slot.key);
          sentToday.add(slot.key);
          sent++;
        }
      }

      if (fired.length > 0) {
        await doc.ref.set({ predictiveSent: { date: today, keys: [...sentToday] } }, { merge: true });
      }
    } catch (e) {
      logger.error('predictiveAlarmSweep/item', e);
    }
  }
  logger.info('predictiveAlarmSweep', `done sent=${sent}`);
}

import type { DaySummary, TrackerRecord } from '../types';

/**
 * Cross-day 수면 분배 정책 (2026-04-29):
 *   - 자정을 넘긴 수면은 시작 날 / 다음 날에 각각 자정 기준으로 분할 카운트
 *   - records 안에 있는 sleep 중 endTime이 'M/D HH:MM' 형식이면
 *     → 시작 날: time(HH:MM) ~ 24:00 만 카운트
 *   - crossDayWakes(어제 시작 → 오늘 새벽 기상한 가상 엔트리)는
 *     → 다음 날: 00:00 ~ wake(HH:MM) 만 카운트
 *   - 일반 same-day sleep은 duration 그대로 카운트
 */
export function computeSummary(
  records: TrackerRecord[],
  crossDayWakes: TrackerRecord[] = [],
): DaySummary {
  let diaperCount = 0;
  let feedingCount = 0;
  let totalMl = 0;
  let totalSleepMinutes = 0;
  let peeCount = 0;
  let poopCount = 0;
  let formulaMl = 0;
  let breastMin = 0;
  let breastLeftMin = 0;
  let breastRightMin = 0;
  let breastCount = 0;
  let solidCount = 0;

  for (const r of records) {
    if (r.type === 'diaper') {
      diaperCount += 1;
      if (r.subType === 'pee') peeCount += 1;
      else if (r.subType === 'poop') poopCount += 1;
      else if (r.subType === 'both') { peeCount += 1; poopCount += 1; }
    }
    if (r.type === 'feeding') {
      feedingCount += 1;
      if (r.amount) totalMl += r.amount;
      if (r.subType === 'formula' && r.amount) formulaMl += r.amount;
      if (r.subType === 'breast') {
        breastCount += 1;
        if (r.duration) {
          breastMin += r.duration;
          if (r.note === '왼쪽') breastLeftMin += r.duration;
          else if (r.note === '오른쪽') breastRightMin += r.duration;
        }
      }
      if (r.subType === 'baby_food' || r.subType === 'snack') solidCount += 1;
    }
    if (r.type === 'sleep' && r.duration) {
      // endTime이 'M/D HH:MM' 형식이면 자정을 넘긴 수면 → 오늘분만 카운트
      if (r.endTime && /^\d+\/\d+\s/.test(r.endTime)) {
        const [hStr, mStr] = (r.time || '00:00').split(':');
        const startMin = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);
        const todayPortion = Math.max(0, 24 * 60 - startMin);
        totalSleepMinutes += Math.min(todayPortion, r.duration);
      } else {
        totalSleepMinutes += r.duration;
      }
    }
  }

  // 어제 시작 → 오늘 새벽 기상한 cross-day 수면: 00:00 ~ wakeHHMM 만 카운트
  for (const r of crossDayWakes) {
    if (r.type === 'sleep' && r.time) {
      const [hStr, mStr] = r.time.split(':');
      const wakeMin = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);
      const todayPortion = r.duration
        ? Math.min(wakeMin, r.duration)
        : wakeMin;
      totalSleepMinutes += todayPortion;
    }
  }

  return {
    diaperCount, feedingCount, totalMl, totalSleepMinutes,
    peeCount, poopCount, formulaMl, breastMin, breastLeftMin, breastRightMin,
    breastCount, solidCount,
  };
}

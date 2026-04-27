import type { DaySummary, TrackerRecord } from '../types';

export function computeSummary(records: TrackerRecord[]): DaySummary {
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
      totalSleepMinutes += r.duration;
    }
  }

  return {
    diaperCount, feedingCount, totalMl, totalSleepMinutes,
    peeCount, poopCount, formulaMl, breastMin, breastLeftMin, breastRightMin,
    breastCount, solidCount,
  };
}

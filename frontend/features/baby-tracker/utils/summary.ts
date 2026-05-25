import type { DaySummary, TrackerRecord } from '../types';

/**
 * 모유 수유 ml 추정 — 연령(개월) 기반 분당 ml × duration(분).
 *
 * 의학/공식 자료 종합 (KellyMom, Medela, NCBI Lactation Studies, WHO):
 *   - **일일 권장량 (ml/kg/일)**:
 *     0-1개월: 60, 1-3개월: 150 (peak), 3-6개월: 120, 6-12개월: 점진 감소
 *   - **회당 평균 ml**: 신생아 30~60 / 1-3개월 90~120 / 3-6개월 120~150 / 6-12개월 150~200
 *   - **회당 평균 시간 (분)**: 신생아 25~35 / 1-3개월 15~20 / 3-6개월 10~15 / 6-12개월 5~10 / 12개월+ 5~8
 *   - **빨기 효율 (transfer rate)**: 연령 증가에 따라 상승. 신생아 약함 → 6-12개월 최대 → 이유식 시작 후 감소
 *
 * 추정치 (회당 평균 ml ÷ 회당 평균 시간 + 일반 lactation 가이드):
 *   - 0-1개월: 5ml/분 (빨기 약함, 시간 길어도 적게)
 *   - 1-3개월: 8ml/분
 *   - 3-6개월: 12ml/분
 *   - 6-12개월: 18ml/분 (효율 peak)
 *   - 12개월+: 12ml/분 (이유식 병행, 본격 감소)
 *
 * 정확도 한계:
 *   - 개인차 큼 (아기/엄마/시간대)
 *   - 정확 측정 = 병원 lactation 검사 (체중차/Pre-post weighing) 만 가능
 *   - 이 값은 **참고 추정**, UI 표시 시 "추정" 명시 권장
 */
const BREAST_ML_PER_MIN_BY_MONTH: { maxMonth: number; mlPerMin: number }[] = [
  { maxMonth: 1, mlPerMin: 5 },
  { maxMonth: 3, mlPerMin: 8 },
  { maxMonth: 6, mlPerMin: 12 },
  { maxMonth: 12, mlPerMin: 18 },
  { maxMonth: Infinity, mlPerMin: 12 },
];

export function getBreastMlPerMin(ageMonths: number): number {
  for (const row of BREAST_ML_PER_MIN_BY_MONTH) {
    if (ageMonths <= row.maxMonth) return row.mlPerMin;
  }
  return 12; // fallback
}

export function estimateBreastMl(durationMin: number, ageMonths: number = 6): number {
  if (!durationMin || durationMin <= 0) return 0;
  const rate = getBreastMlPerMin(ageMonths);
  return Math.round(durationMin * rate);
}

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
  ageMonths: number = 6,
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
          // 모유는 amount 안 받으니 duration 기반 ml 추정 → totalMl 에 합산.
          //   연령별 분당 ml 차등 (신생아 약함, 6-12개월 peak, 이유식 후 감소).
          totalMl += estimateBreastMl(r.duration, ageMonths);
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

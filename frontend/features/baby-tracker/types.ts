/**
 * Baby-tracker shared types.
 * Extracted from app/(main)/baby-tracker.tsx — do not change field shapes without
 * auditing storage format / backend compatibility.
 */

export type RecordType = 'diaper' | 'feeding' | 'sleep' | 'medication' | 'custom';

export type DiaperSubType = 'pee' | 'poop' | 'both';
export type FeedingSubType = 'breast' | 'formula' | 'baby_food' | 'snack';
export type SleepSubType = 'nap' | 'night';
export type MedicationSubType = 'fever' | 'antibiotic' | 'vitamin' | 'other';

export interface TrackerRecord {
  id: string;
  type: RecordType;
  subType: string;
  time: string;
  endTime?: string;
  amount?: number;
  duration?: number;
  note?: string;
  // 정렬 안정화 — 같은 분에 여러 기록이 있을 때 '누른 순서' 보장 키.
  // sleep 의 경우 sleep_start 누른 시점 (sleepSession.startTime), 다른 type 은 추가 시점.
  // 옛 데이터엔 없을 수 있어 optional. 정렬 fallback 은 records.index.
  createdAt?: string;
  // 공동육아 작성자 표기 — 초대받은 가족이 기록한 경우에만 채워짐.
  // 소유자(owner) 본인 기록 / 옛 데이터엔 없음 → 라벨 미표시(graceful).
  authorId?: string;
  authorLabel?: string; // 비정규화 닉네임 ("엄마"/"아빠"). 작성 시점 스냅샷.
}

export interface DaySummary {
  diaperCount: number;
  feedingCount: number;
  totalMl: number;
  totalSleepMinutes: number;
  peeCount: number;
  poopCount: number;
  formulaMl: number;
  breastMin: number;
  breastLeftMin: number;
  breastRightMin: number;
  breastCount: number;
  solidCount: number;
}

export interface TrackerMetric {
  metric: string;
  value: number;
  level: string;
  title: string;
  emoji: string;
  comment: string;
  advice: string;
  standardRange?: string;
  standardDetail?: string;
}

export interface TrackerAnalysisResult {
  trackerMetrics: TrackerMetric[];
  overallSummary: string;
}

export interface SleepSession {
  startTime: string; // ISO
  startDate: string; // YYYY-MM-DD (local)
  /** 시작 시점에 사용자가 메모를 남긴 경우 (시간 지정 입력에서 메모와 함께 시작) */
  note?: string;
}

export type BreastSide = 'left' | 'right';

export interface BreastSession {
  side: BreastSide;
  startTime: string; // ISO
  startDate: string; // YYYY-MM-DD
  /** 시작 시점 메모 (선택) */
  note?: string;
}

export interface DayStat {
  dateLabel: string;
  dateStr: string;
  diaper: number;
  feeding: number; // 횟수
  feedingMl: number; // 총 수유량 (분유 + 모유 추정) — 하위 호환
  formulaMl: number; // 분유 (amount 합)
  breastMl: number; // 모유 추정 (시간 × 20ml/분)
  sleepMin: number;
}

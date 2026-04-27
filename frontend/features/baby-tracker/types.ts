/**
 * Baby-tracker shared types.
 * Extracted from app/(main)/baby-tracker.tsx — do not change field shapes without
 * auditing storage format / backend compatibility.
 */

export type RecordType = 'diaper' | 'feeding' | 'sleep';

export type DiaperSubType = 'pee' | 'poop' | 'both';
export type FeedingSubType = 'breast' | 'formula' | 'baby_food' | 'snack';
export type SleepSubType = 'nap' | 'night';

export interface TrackerRecord {
  id: string;
  type: RecordType;
  subType: string;
  time: string;
  endTime?: string;
  amount?: number;
  duration?: number;
  note?: string;
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
}

export type BreastSide = 'left' | 'right';

export interface BreastSession {
  side: BreastSide;
  startTime: string; // ISO
  startDate: string; // YYYY-MM-DD
}

export interface DayStat {
  dateLabel: string;
  dateStr: string;
  diaper: number;
  feeding: number;
  feedingMl: number;
  sleepMin: number;
}

export interface DailyTrackingData {
  feedingType: 'breast' | 'formula' | 'mixed';
  feedingCount: number;
  poopCount: number;
  peeCount: number;
  napCount: number;
  totalSleepHours: number;
}

export interface TrackingRecord {
  id: string;
  childId: string;
  date: string;
  feeding: { type: string; count: number };
  diaper: { poop: number; pee: number; total: number };
  sleep: { naps: number; totalHours: number };
}

export type FeedingType = 'breast' | 'formula' | 'mixed';

export const FEEDING_LABELS: Record<FeedingType, string> = {
  breast: '모유',
  formula: '분유',
  mixed: '혼합',
};

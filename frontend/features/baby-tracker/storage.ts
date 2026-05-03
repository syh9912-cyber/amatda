/**
 * AsyncStorage-backed persistence for baby-tracker.
 *
 * IMPORTANT — storage key names are part of the on-device data format and MUST
 * NOT be renamed. Changing any of these keys will orphan existing user records.
 */

import type { BreastSession, DayStat, SleepSession, TrackerRecord } from './types';
import { computeSummary } from './utils/summary';
import { formatDate } from './utils/time';

/* ---- key helpers ---- */

export function getStorageKey(childId: string, dateStr: string): string {
  return `baby_tracker_${childId}_${dateStr}`;
}

export function getSleepSessionKey(childId: string): string {
  return `baby_tracker_sleep_session_${childId}`;
}

export function getBreastSessionKey(childId: string): string {
  return `baby_tracker_breast_session_${childId}`;
}

/* ---- AsyncStorage wrapper (dynamic import + fallback) ---- */

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let _storage: StorageLike | null = null;

export async function getStorage(): Promise<StorageLike | null> {
  if (_storage) return _storage;
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    _storage = mod.default;
    return _storage;
  } catch {
    // fallback: in-memory storage
    const mem: Record<string, string> = {};
    _storage = {
      getItem: async (k: string) => mem[k] ?? null,
      setItem: async (k: string, v: string) => { mem[k] = v; },
    };
    return _storage;
  }
}

/* ---- sleep session ---- */

export async function loadSleepSession(childId: string): Promise<SleepSession | null> {
  const storage = await getStorage();
  if (!storage) return null;
  const raw = await storage.getItem(getSleepSessionKey(childId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'startTime' in parsed &&
      'startDate' in parsed
    ) {
      return parsed as SleepSession;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveSleepSession(childId: string, session: SleepSession | null): Promise<void> {
  const storage = await getStorage();
  if (!storage) return;
  if (session) {
    await storage.setItem(getSleepSessionKey(childId), JSON.stringify(session));
  } else {
    await storage.setItem(getSleepSessionKey(childId), '');
  }
}

/* ---- breast session ---- */

export async function loadBreastSession(childId: string): Promise<BreastSession | null> {
  const storage = await getStorage();
  if (!storage) return null;
  const raw = await storage.getItem(getBreastSessionKey(childId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'side' in parsed &&
      'startTime' in parsed &&
      'startDate' in parsed
    ) {
      return parsed as BreastSession;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveBreastSession(childId: string, session: BreastSession | null): Promise<void> {
  const storage = await getStorage();
  if (!storage) return;
  if (session) {
    await storage.setItem(getBreastSessionKey(childId), JSON.stringify(session));
  } else {
    await storage.setItem(getBreastSessionKey(childId), '');
  }
}

/* ---- 하단 안내문 노출 카운터 (10회 후 자동 숨김) ---- */

const HINT_COUNTER_KEY = 'amatda_baby_tracker_hint_count';
const HINT_MAX = 10;

export async function loadHintRemaining(): Promise<number> {
  const storage = await getStorage();
  if (!storage) return HINT_MAX;
  const raw = await storage.getItem(HINT_COUNTER_KEY);
  if (raw == null || raw === '') return HINT_MAX;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return HINT_MAX;
  return Math.max(0, Math.min(HINT_MAX, n));
}

export async function decrementHint(): Promise<number> {
  const remaining = await loadHintRemaining();
  if (remaining <= 0) return 0;
  const next = remaining - 1;
  const storage = await getStorage();
  if (storage) await storage.setItem(HINT_COUNTER_KEY, String(next));
  return next;
}

/* ---- daily records ---- */

export async function loadRecords(childId: string, dateStr: string): Promise<TrackerRecord[]> {
  const storage = await getStorage();
  if (!storage) return [];
  const raw = await storage.getItem(getStorageKey(childId, dateStr));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as TrackerRecord[];
    return [];
  } catch {
    return [];
  }
}

export async function saveRecords(childId: string, dateStr: string, records: TrackerRecord[]): Promise<void> {
  const storage = await getStorage();
  if (!storage) return;
  await storage.setItem(getStorageKey(childId, dateStr), JSON.stringify(records));
  // home 화면의 DenseStatsRow가 즉시 재fetch (stack keep으로 useEffect 자동 재실행 안 되는 문제 해결)
  try {
    // dynamic import to avoid hard dep cycle if not loaded
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTrackerStore } = require('../../stores/trackerStore') as typeof import('../../stores/trackerStore');
    useTrackerStore.getState().bump();
  } catch { /* ignore */ }
}

/* ---- multi-day stats (chart data) ---- */

export async function loadRangeStats(childId: string, startDate: Date, endDate: Date): Promise<DayStat[]> {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const stats: DayStat[] = [];
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  // start는 00:00:00, end는 23:59:59.999로 세팅되어 있으므로 올림하면 정확한 일수
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const maxDays = Math.min(Math.max(diffDays, 1), 31); // 최대 1달
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const ds = formatDate(d);
    const recs = await loadRecords(childId, ds);
    const sum = computeSummary(recs);
    stats.push({
      dateLabel: maxDays <= 7 ? dayNames[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}`,
      dateStr: ds,
      diaper: sum.diaperCount,
      feeding: sum.feedingCount,
      feedingMl: sum.totalMl,
      sleepMin: sum.totalSleepMinutes,
    });
  }
  return stats;
}

// 하위 호환용
export async function loadWeekStats(childId: string, endDate: Date): Promise<DayStat[]> {
  const start = new Date(endDate);
  start.setDate(start.getDate() - 6);
  return loadRangeStats(childId, start, endDate);
}

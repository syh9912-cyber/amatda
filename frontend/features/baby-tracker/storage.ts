/**
 * AsyncStorage-backed persistence for baby-tracker.
 *
 * IMPORTANT — storage key names are part of the on-device data format and MUST
 * NOT be renamed. Changing any of these keys will orphan existing user records.
 *
 * 2026-05-08: 서버 sync 추가 (offline-first).
 *   - write: 로컬 즉시 + 서버 PUT fire-and-forget
 *   - read 시 캐시가 비어있으면 syncDayFromServer/syncRangeFromServer 로 복구
 *   - babyTracker.tsx 마운트 시 최근 N일 일괄 fetch → 데이터 삭제 후 자동 복구
 */

import type { BreastSession, DayStat, SleepSession, TrackerRecord } from './types';
import { computeSummary } from './utils/summary';
import { formatDate } from './utils/time';
import { babyTrackerApi } from '../../services/api';

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
  // 서버 sync (fire-and-forget) — 실패해도 로컬엔 저장됨
  babyTrackerApi.putSessions(childId, { sleepSession: session }).catch(() => {});
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
  // 서버 sync (fire-and-forget)
  babyTrackerApi.putSessions(childId, { breastSession: session }).catch(() => {});
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

/* ---- formula default amount ---- */

export async function loadFormulaDefault(childId: string): Promise<number> {
  const storage = await getStorage();
  if (!storage) return 0;
  const raw = await storage.getItem(`baby_tracker_formula_default_${childId}`);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n <= 0 ? 0 : n;
}

export async function saveFormulaDefault(childId: string, amount: number): Promise<void> {
  const storage = await getStorage();
  if (!storage) return;
  await storage.setItem(`baby_tracker_formula_default_${childId}`, amount > 0 ? String(amount) : '0');
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
  // 서버 sync (fire-and-forget) — 데이터 삭제 / 재설치 시 복구 가능하도록.
  // 실패해도 로컬엔 저장돼 있고, 다음 sync 라운드에 재시도 효과(같은 records 다시 PUT)가 있음.
  babyTrackerApi.putDay(childId, dateStr, records as unknown[]).catch(() => {});
  // home 화면의 DenseStatsRow가 즉시 재fetch (stack keep으로 useEffect 자동 재실행 안 되는 문제 해결)
  try {
    // dynamic import to avoid hard dep cycle if not loaded
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTrackerStore } = require('../../stores/trackerStore') as typeof import('../../stores/trackerStore');
    useTrackerStore.getState().bump();
  } catch { /* ignore */ }
}

/* ---- server sync (offline-first 복구) ---- */

/**
 * 서버에서 단일 날짜 records 를 가져와 로컬 캐시에 머지.
 * 로컬에 이미 있으면 서버 updatedAt 이 더 최신일 때만 덮어씀(last-write-wins).
 * 마운트 시 보이는 날짜 1~2개 fetch 에 사용.
 */
export async function syncDayFromServer(childId: string, dateStr: string): Promise<TrackerRecord[] | null> {
  try {
    const res = await babyTrackerApi.getDay(childId, dateStr);
    const data = res.data?.data as { records?: TrackerRecord[] } | undefined;
    const records = Array.isArray(data?.records) ? data.records : [];
    const storage = await getStorage();
    if (storage) {
      await storage.setItem(getStorageKey(childId, dateStr), JSON.stringify(records));
    }
    return records;
  } catch {
    return null;
  }
}

/**
 * 서버에서 from~to 범위의 days 를 일괄 fetch → 로컬 캐시에 일괄 저장.
 * baby-tracker.tsx 마운트 시 호출 — 데이터 삭제 / 재설치 후 자동 복구의 핵심.
 */
export async function syncRangeFromServer(childId: string, from: string, to: string): Promise<void> {
  try {
    const res = await babyTrackerApi.getDaysRange(childId, from, to);
    const data = res.data?.data as { days?: Array<{ date: string; records: TrackerRecord[] }> } | undefined;
    const days = data?.days ?? [];
    const storage = await getStorage();
    if (!storage) return;
    for (const d of days) {
      if (typeof d.date !== 'string') continue;
      const records = Array.isArray(d.records) ? d.records : [];
      await storage.setItem(getStorageKey(childId, d.date), JSON.stringify(records));
    }
  } catch {
    /* offline / 서버 미응답 시 silent — 기존 로컬 캐시 사용 */
  }
}

/**
 * 서버에서 진행 중인 sleep/breast 세션 fetch → 로컬에 머지.
 * baby-tracker.tsx 마운트 시 호출 — 다른 기기에서 시작한 세션도 복구.
 */
export async function syncSessionsFromServer(childId: string): Promise<{
  sleepSession: SleepSession | null;
  breastSession: BreastSession | null;
} | null> {
  try {
    const res = await babyTrackerApi.getSessions(childId);
    const data = res.data?.data as {
      sleepSession?: SleepSession | null;
      breastSession?: BreastSession | null;
    } | undefined;
    const storage = await getStorage();
    const sleepSession = data?.sleepSession ?? null;
    const breastSession = data?.breastSession ?? null;
    if (storage) {
      if (sleepSession) {
        await storage.setItem(getSleepSessionKey(childId), JSON.stringify(sleepSession));
      } else {
        await storage.setItem(getSleepSessionKey(childId), '');
      }
      if (breastSession) {
        await storage.setItem(getBreastSessionKey(childId), JSON.stringify(breastSession));
      } else {
        await storage.setItem(getBreastSessionKey(childId), '');
      }
    }
    return { sleepSession, breastSession };
  } catch {
    return null;
  }
}

/* ---- multi-day stats (chart data) ---- */

export async function loadRangeStats(
  childId: string,
  startDate: Date,
  endDate: Date,
  ageMonths: number = 6,
): Promise<DayStat[]> {
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
    const sum = computeSummary(recs, [], ageMonths);
    stats.push({
      dateLabel: maxDays <= 7 ? dayNames[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}`,
      dateStr: ds,
      diaper: sum.diaperCount,
      feeding: sum.feedingCount,
      feedingMl: sum.totalMl,
      formulaMl: sum.formulaMl,
      // 총 수유 ml - 분유 ml = 모유 추정 ml (computeSummary 가 totalMl 에 합산해둠)
      breastMl: Math.max(0, sum.totalMl - sum.formulaMl),
      sleepMin: sum.totalSleepMinutes,
    });
  }
  return stats;
}

// 하위 호환용
export async function loadWeekStats(childId: string, endDate: Date, ageMonths: number = 6): Promise<DayStat[]> {
  const start = new Date(endDate);
  start.setDate(start.getDate() - 6);
  return loadRangeStats(childId, start, endDate, ageMonths);
}

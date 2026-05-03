/**
 * 임산부 데일리 미션 — 연속 달성 streak 추적
 *
 * - 매일 두 미션(물 8잔 + 영양제) 모두 완료 시 streak +1
 * - 어제 완료 안 했으면 streak 리셋(1로 시작)
 * - milestone(3/7/14/30/60/100일)에 도달하면 reachedMilestone 반환
 *
 * AsyncStorage 키: amatda_mom_mission_streak_{childId}
 */

let _storage: { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> } | null | undefined;
async function getStorage() {
  if (_storage !== undefined) return _storage;
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    _storage = mod.default;
  } catch {
    _storage = null;
  }
  return _storage;
}

const KEY = (childId: string) => `amatda_mom_mission_streak_${childId}`;

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;
export type StreakMilestone = typeof STREAK_MILESTONES[number];

export interface StreakState {
  lastDate: string; // YYYY-MM-DD (마지막으로 미션 완료한 날)
  currentStreak: number;
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function loadStreak(childId: string): Promise<StreakState> {
  const storage = await getStorage();
  if (!storage) return { lastDate: '', currentStreak: 0 };
  try {
    const raw = await storage.getItem(KEY(childId));
    if (!raw) return { lastDate: '', currentStreak: 0 };
    const parsed = JSON.parse(raw) as StreakState;
    return parsed;
  } catch {
    return { lastDate: '', currentStreak: 0 };
  }
}

/**
 * 오늘 두 미션 모두 완료 → streak 갱신.
 * 이미 오늘 갱신했으면 변화 없이 그대로 반환.
 * @returns { state, reachedMilestone } reachedMilestone는 이번 호출로 새로 도달한 milestone (없으면 null)
 */
export async function recordMissionComplete(childId: string): Promise<{
  state: StreakState;
  reachedMilestone: StreakMilestone | null;
}> {
  const storage = await getStorage();
  const today = todayKey();
  const yesterday = yesterdayKey();
  const prev = await loadStreak(childId);

  // 이미 오늘 기록됨 — 변경 없음
  if (prev.lastDate === today) {
    return { state: prev, reachedMilestone: null };
  }

  // 어제 완료 → 연속 streak +1, 아니면 리셋(1)
  const nextStreak = prev.lastDate === yesterday ? prev.currentStreak + 1 : 1;
  const next: StreakState = { lastDate: today, currentStreak: nextStreak };

  if (storage) {
    try { await storage.setItem(KEY(childId), JSON.stringify(next)); } catch { /* ignore */ }
  }

  // milestone 검사
  const milestone = (STREAK_MILESTONES as readonly number[]).includes(nextStreak)
    ? (nextStreak as StreakMilestone)
    : null;

  return { state: next, reachedMilestone: milestone };
}

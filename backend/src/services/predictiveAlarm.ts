/**
 * 예측 알람 — 최근 3일 아기시간 기록으로 "패턴 슬롯"을 계산한다.
 *
 * 슬롯 = 규칙적인 수유/수면/기상 시각(대표값). 각 슬롯의 offsetMin(기본 30분) 전에
 * "곧 어제(최근) 그 시간이에요, 준비해주세요" Expo Push를 보낸다.
 *
 * - 데이터가 없으면 슬롯이 안 나옴 → 알람도 안 옴 (자동).
 * - 수유는 하루 여러 번 → 비슷한 시간끼리 묶어(클러스터) 대표 시각만 슬롯화.
 * - 슬롯 key는 `{type}_{HH}` (시간대 버킷) — 패턴이 바뀌어도 사용자가 끈(disabled) 슬롯 유지용.
 */
import { collections } from './firestore';

export type AlarmType = 'feeding' | 'sleep' | 'wake';

export interface AlarmSlot {
  key: string;       // 'feeding_07'
  type: AlarmType;
  timeMin: number;   // 자정 기준 분 (대표 시각, KST 벽시계)
  label: string;     // '수유' | '수면' | '기상'
}

const TYPE_LABEL: Record<AlarmType, string> = { feeding: '수유', sleep: '수면', wake: '기상' };
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC Date → KST 'YYYY-MM-DD' */
export function kstDateStr(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC Date → KST 자정 기준 분(0~1439) */
export function kstMinutesOfDay(d: Date): number {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return k.getUTCHours() * 60 + k.getUTCMinutes();
}

/** 'HH:MM' 또는 'M/D HH:MM' → 자정 기준 분 (실패 시 null) */
function parseHHMM(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * 시각(분) 배열을 windowMin 이내로 클러스터링 → minCount 이상인 클러스터의 평균만 반환.
 * (불규칙한 1회성은 제외, 규칙적인 패턴만 슬롯화)
 */
function clusterTimes(times: number[], windowMin: number, minCount: number): number[] {
  if (times.length === 0) return [];
  const sorted = [...times].sort((a, b) => a - b);
  const clusters: number[][] = [];
  let cur: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - cur[cur.length - 1] <= windowMin) cur.push(sorted[i]);
    else { clusters.push(cur); cur = [sorted[i]]; }
  }
  clusters.push(cur);
  return clusters
    .filter((c) => c.length >= minCount)
    .map((c) => Math.round(c.reduce((s, v) => s + v, 0) / c.length));
}

function makeSlot(type: AlarmType, timeMin: number): AlarmSlot {
  const hour = Math.floor(timeMin / 60);
  return { key: `${type}_${String(hour).padStart(2, '0')}`, type, timeMin, label: TYPE_LABEL[type] };
}

/** 같은 key(시간대) 중복 제거 — 먼저 온 것 유지 */
function dedupByKey(slots: AlarmSlot[]): AlarmSlot[] {
  const seen = new Set<string>();
  const out: AlarmSlot[] = [];
  for (const s of slots.sort((a, b) => a.timeMin - b.timeMin)) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    out.push(s);
  }
  return out;
}

/**
 * 자녀의 최근 3일(어제~3일전, KST) 기록으로 알람 슬롯 계산.
 * @param now 현재 UTC 시각 (KST 날짜 산출용)
 */
export async function computeAlarmSlotsForChild(childId: string, now: Date): Promise<AlarmSlot[]> {
  const days: string[] = [];
  for (let i = 1; i <= 3; i++) days.push(kstDateStr(new Date(now.getTime() - i * 86400000)));

  const feeding: number[] = [];
  const sleep: number[] = [];
  const wake: number[] = [];

  for (const date of days) {
    const doc = await collections.babyTrackerDays.doc(`${childId}_${date}`).get();
    if (!doc.exists) continue;
    const records = (doc.data()?.records ?? []) as Array<Record<string, unknown>>;
    for (const r of records) {
      const t = parseHHMM(r.time);
      if (r.type === 'feeding' && t != null) feeding.push(t);
      if (r.type === 'sleep') {
        if (t != null) sleep.push(t);
        const w = parseHHMM(r.endTime);
        if (w != null) wake.push(w);
      }
    }
  }

  const slots: AlarmSlot[] = [];
  // 수유: 하루 여러 번 → 75분 윈도우, 2회 이상 반복된 패턴만
  for (const tm of clusterTimes(feeding, 75, 2)) slots.push(makeSlot('feeding', tm));
  // 수면/기상: 보통 1~2회 → 90분 윈도우, 2회 이상
  for (const tm of clusterTimes(sleep, 90, 2)) slots.push(makeSlot('sleep', tm));
  for (const tm of clusterTimes(wake, 90, 2)) slots.push(makeSlot('wake', tm));

  return dedupByKey(slots);
}

/** 슬롯 → 푸시 문구 */
export function alarmPushText(slot: AlarmSlot, offsetMin: number): { title: string; body: string } {
  const hh = String(Math.floor(slot.timeMin / 60)).padStart(2, '0');
  const mm = String(slot.timeMin % 60).padStart(2, '0');
  const emoji = slot.type === 'feeding' ? '🍼' : slot.type === 'sleep' ? '😴' : '☀️';
  return {
    title: `${emoji} 곧 ${slot.label} 시간이에요`,
    body: `${offsetMin}분 후(${hh}:${mm}쯤) 평소 ${slot.label}하던 시간이에요. 미리 준비해볼까요?`,
  };
}

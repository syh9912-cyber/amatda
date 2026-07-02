/**
 * checkup.ts — 다음 검진 일정 (AsyncStorage 기반)
 *
 * 저장 위치: AsyncStorage `amatda_next_checkup_${childId}` → ISO date "YYYY-MM-DD"
 *
 * 왜 AsyncStorage?
 *  - 임시 reminder 용도 (검진 끝나면 사용자가 다음 일정 다시 입력)
 *  - Firestore 스키마 변경 0
 *  - 백엔드 영향 0
 *  - PDF 앨범 생성에 자동 미포함 (PDF는 albumPhotos만 봄)
 *
 * 동기화 트리거:
 *  - useFeverStore와 동일 패턴으로 useCheckupStore 만들어 home에서 즉시 반영
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import i18n from '../i18n';

const KEY = (childId: string) => `amatda_next_checkup_${childId}`;

interface CheckupState {
  /** 트리거용 — set/clear 시마다 증가. home의 useEffect deps에 사용. */
  version: number;
  bump: () => void;
}

export const useCheckupStore = create<CheckupState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

/** 저장된 다음 검진 일자 ISO ("YYYY-MM-DD") 반환. 없으면 null. */
export async function getNextCheckup(childId: string): Promise<string | null> {
  if (!childId) return null;
  try {
    const v = await AsyncStorage.getItem(KEY(childId));
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    return v;
  } catch {
    return null;
  }
}

/** 다음 검진 일자 저장. ISO "YYYY-MM-DD" 형식만 허용. */
export async function setNextCheckup(childId: string, isoDate: string): Promise<void> {
  if (!childId || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return;
  await AsyncStorage.setItem(KEY(childId), isoDate);
  useCheckupStore.getState().bump();
}

/** 다음 검진 삭제. */
export async function clearNextCheckup(childId: string): Promise<void> {
  if (!childId) return;
  await AsyncStorage.removeItem(KEY(childId));
  useCheckupStore.getState().bump();
}

/** ISO date → D-day. 오늘이면 0, 내일이면 1, 어제면 -1. */
export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + 'T00:00:00');
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

/** D-day → 표시용 라벨. */
export function formatDday(days: number): string {
  if (days === 0) return 'D-Day';
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}

/** ISO date → 현지화된 상세 날짜 ("2026-05-15 (월)"). */
export function formatKoreanDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const weekdays = [
    i18n.t('components.observationCard.weekday.sun'),
    i18n.t('components.observationCard.weekday.mon'),
    i18n.t('components.observationCard.weekday.tue'),
    i18n.t('components.observationCard.weekday.wed'),
    i18n.t('components.observationCard.weekday.thu'),
    i18n.t('components.observationCard.weekday.fri'),
    i18n.t('components.observationCard.weekday.sat'),
  ];
  const dow = weekdays[d.getDay()];
  return i18n.t('checkup.dateFormat', { yyyy, mm, dd, dow });
}

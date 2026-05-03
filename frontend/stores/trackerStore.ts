/**
 * trackerStore — 육아기록(dailyTracking) 갱신 트리거
 *
 * baby-tracker.tsx에서 기록 추가/수정/삭제 시 bump() 호출 →
 * home의 DenseStatsRow가 useEffect deps에 alertVersion을 두어 재실행
 *
 * (feverStore와 동일 패턴, stack keep으로 useEffect가 자동 재실행 안 되는 문제 해결)
 */

import { create } from 'zustand';

interface TrackerState {
  version: number;
  bump: () => void;
}

export const useTrackerStore = create<TrackerState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

/**
 * feverStore — 고열 알림 상태 트리거
 *
 * 목적: fever.tsx에서 체온 측정 시 home 화면의 useFeverAlert hook이
 *       자동으로 재실행되도록 하기 위한 트리거 변수.
 *
 * 사용 패턴:
 *   - fever.tsx에서 측정 저장 직후: useFeverStore.getState().bump()
 *   - home.tsx useFeverAlert: deps에 alertVersion 포함
 *
 * 왜 zustand?
 *   - useFocusEffect는 progress doc 기록상 hang 발생 (스플래시조차 안 시작)
 *   - AppState 리스너는 in-app 화면 전환(home ↔ fever)엔 active 유지라 안 잡힘
 *   - polling은 무거움 (AsyncStorage 매 N초 읽기)
 *   → 명시적 트리거가 가장 정확하고 가벼움
 */

import { create } from 'zustand';

interface FeverState {
  /** 트리거용 버전 — bump() 호출 시마다 증가. home 화면이 deps로 사용. */
  alertVersion: number;
  /** fever 측정 후 호출 → home의 useFeverAlert 재실행 유도 */
  bump: () => void;
}

export const useFeverStore = create<FeverState>((set) => ({
  alertVersion: 0,
  bump: () => set((s) => ({ alertVersion: s.alertVersion + 1 })),
}));

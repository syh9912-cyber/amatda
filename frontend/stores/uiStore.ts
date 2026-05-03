import { create } from 'zustand';

/**
 * 전역 UI 상태 — 모달/오버레이 노출 시 다른 floating 요소(SOS 등)를 숨기는 용도.
 *
 * 사용:
 *  - 모달 열 때: useUiStore.getState().pushOverlay()
 *  - 모달 닫을 때: useUiStore.getState().popOverlay()
 *  - SOS 버튼 등: useUiStore((s) => s.overlayCount) === 0 일 때만 렌더
 *
 * 카운터 방식 (boolean이 아닌 정수) — 동시에 여러 모달이 열려도 정확.
 */
interface UiState {
  overlayCount: number;
  pushOverlay: () => void;
  popOverlay: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  overlayCount: 0,
  pushOverlay: () => set((s) => ({ overlayCount: s.overlayCount + 1 })),
  popOverlay: () => set((s) => ({ overlayCount: Math.max(0, s.overlayCount - 1) })),
}));

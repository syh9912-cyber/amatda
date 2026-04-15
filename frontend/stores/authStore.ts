import { create } from 'zustand';
import { saveAuth, loadAuthAsync, clearAuth } from '../services/storage';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  // 통합 로그인 완료 (토큰 + 유저 정보 동시 저장 → saveAuth 누락 없음)
  setAuth: (params: { accessToken: string; refreshToken: string; userId: string; email: string }) => void;
  // 토큰만 갱신 (refresh 시) — userId/email은 이미 스토어에 있음
  setTokens: (access: string, refresh: string) => void;
  setUser: (userId: string, email: string) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  email: null,
  isAuthenticated: false,
  isHydrated: false,

  // ✅ 로그인 완료 시 항상 이 메서드 사용 — 토큰+유저를 원자적으로 저장
  setAuth: ({ accessToken, refreshToken, userId, email }) => {
    set({ accessToken, refreshToken, userId, email, isAuthenticated: true });
    saveAuth({ accessToken, refreshToken, userId, email });
  },

  // ✅ refresh 토큰 갱신 시 — userId/email은 스토어에 이미 있음
  setTokens: (access, refresh) => {
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true });
    const state = get();
    if (state.userId && state.email) {
      saveAuth({
        accessToken: access,
        refreshToken: refresh,
        userId: state.userId,
        email: state.email,
      });
    }
  },

  setUser: (userId, email) => {
    set({ userId, email });
    const state = get();
    if (state.accessToken && state.refreshToken) {
      saveAuth({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        userId,
        email,
      });
    }
  },

  logout: () => {
    clearAuth();
    set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      email: null,
      isAuthenticated: false,
    });
  },

  hydrate: async () => {
    try {
      const saved = await loadAuthAsync();
      if (saved.accessToken && saved.refreshToken) {
        set({
          ...saved,
          isAuthenticated: true,
          isHydrated: true,
        });
      } else {
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },
}));

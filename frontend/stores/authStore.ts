import { create } from 'zustand';
import { saveAuth, loadAuthAsync, clearAuth } from '../services/storage';
import { setUser as sentrySetUser, clearUser as sentryClearUser } from './../services/sentry';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  // 통합 로그인 완료 (토큰 + 유저 정보 동시 저장 → saveAuth 누락 없음)
  setAuth: (params: { accessToken: string; refreshToken: string; userId: string; email: string }) => Promise<void>;
  // 토큰만 갱신 (refresh 시) — userId/email은 이미 스토어에 있음
  setTokens: (access: string, refresh: string) => Promise<void>;
  setUser: (userId: string, email: string) => Promise<void>;
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
  setAuth: async ({ accessToken, refreshToken, userId, email }) => {
    set({ accessToken, refreshToken, userId, email, isAuthenticated: true });
    await saveAuth({ accessToken, refreshToken, userId, email });
    // Sentry 사용자 식별 — 어떤 유저가 크래시 났는지 대시보드에서 확인 가능
    try { sentrySetUser(userId, email); } catch { /* ignore */ }
  },

  // ✅ refresh 토큰 갱신 시 — userId/email은 스토어에 이미 있음
  setTokens: async (access, refresh) => {
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true });
    const state = get();
    let userId = state.userId;
    let email = state.email;

    // hydrate 완료 전 race condition 방어:
    // 앱 재시작 직후 refresh 인터셉터가 먼저 호출될 경우
    // 스토어에 userId/email이 아직 null → SecureStore에서 직접 읽어 보완
    if (!userId || !email) {
      try {
        const saved = await loadAuthAsync();
        if (saved.userId) userId = saved.userId;
        if (saved.email) email = saved.email;
      } catch { /* ignore */ }
    }

    if (userId && email) {
      await saveAuth({ accessToken: access, refreshToken: refresh, userId, email });
    }
  },

  setUser: async (userId, email) => {
    set({ userId, email });
    const state = get();
    if (state.accessToken && state.refreshToken) {
      await saveAuth({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        userId,
        email,
      });
    }
  },

  logout: () => {
    // #5 보안: 서버측 refresh token 패밀리 무효화 — fire-and-forget
    //   실패해도 로컬 상태는 즉시 클리어 (로컬 로그아웃은 절대 차단하지 않음).
    //   순환 import 회피를 위해 dynamic import.
    const refreshToken = get().refreshToken;
    if (refreshToken) {
      import('../services/api')
        .then(({ authApi }) => authApi.logout(refreshToken).catch(() => { /* best-effort */ }))
        .catch(() => { /* ignore */ });
    }
    clearAuth();
    set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      email: null,
      isAuthenticated: false,
    });
    // Sentry 사용자 식별 해제
    try { sentryClearUser(); } catch { /* ignore */ }
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
        // 앱 재시작 시 Sentry 사용자 복원
        if (saved.userId) {
          try { sentrySetUser(saved.userId, saved.email ?? undefined); } catch { /* ignore */ }
        }
      } else {
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },
}));

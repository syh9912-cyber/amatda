import { create } from 'zustand';
import { saveAuth, loadAuthAsync, clearAuth } from '../services/storage';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
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
  },
}));

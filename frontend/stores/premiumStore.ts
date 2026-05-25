import { create } from 'zustand';
import { premiumApi } from '../services/api';

interface PremiumStatus {
  tier: 'FREE' | 'PAID';
  trialActive: boolean;
  premiumActive: boolean;
  trialDaysLeft?: number;
  /** 체험판 한 번이라도 사용했는지 (재시작 차단용) */
  trialUsed?: boolean;
}

interface PremiumStoreState {
  status: PremiumStatus | null;
  isLoading: boolean;
  lastFetched: number | null;
  /** 프리미엄 상태 조회 (5분 캐시 — 불필요한 중복 호출 방지) */
  fetchStatus: () => Promise<void>;
  /** 캐시 무효화 후 강제 재조회 (결제 완료 직후 호출) */
  invalidate: () => Promise<void>;
  /** 로그아웃 시 상태 초기화 */
  reset: () => void;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

export const usePremiumStore = create<PremiumStoreState>((set, get) => ({
  status: null,
  isLoading: false,
  lastFetched: null,

  fetchStatus: async () => {
    const { isLoading, lastFetched } = get();

    // 이미 로딩 중이면 중복 호출 스킵
    if (isLoading) return;

    // 5분 이내 캐시가 있으면 재조회 생략
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return;

    set({ isLoading: true });

    try {
      const res = await premiumApi.status();
      const data = res.data?.data as Partial<PremiumStatus> | undefined;
      set({
        status: {
          tier: (data?.tier as 'FREE' | 'PAID') ?? 'FREE',
          trialActive: Boolean(data?.trialActive),
          premiumActive: Boolean(data?.premiumActive),
          trialDaysLeft: data?.trialDaysLeft,
          trialUsed: Boolean(data?.trialUsed),
        },
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch {
      // API 실패 → 보수적으로 PAID 처리 (VIP 사용자가 광고를 보는 회귀 방지)
      set({
        status: { tier: 'PAID', trialActive: false, premiumActive: false },
        isLoading: false,
        lastFetched: Date.now(),
      });
    }
  },

  invalidate: async () => {
    set({ lastFetched: null });
    await get().fetchStatus();
  },

  reset: () => set({ status: null, isLoading: false, lastFetched: null }),
}));

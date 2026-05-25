import { useEffect } from 'react';
import { usePremiumStore } from '../stores/premiumStore';

const ADS_ENABLED = process.env.EXPO_PUBLIC_ADS_ENABLED === 'true';
const ADS_FORCE_SHOW = process.env.EXPO_PUBLIC_ADS_FORCE_SHOW === 'true';

/**
 * 광고 표시 여부를 결정하는 훅.
 *
 * - ADS_ENABLED=false → 항상 false (광고 없음)
 * - ADS_FORCE_SHOW=true → 항상 true (테스트용)
 * - VIP(PAID) / 체험판 → false (광고 없음)
 * - FREE → true (광고 표시)
 *
 * 프리미엄 상태는 premiumStore(Zustand)에서 전역 캐시로 관리.
 * 5분 이내 중복 API 호출 없음.
 */
export function useShowAds(): boolean {
  const status = usePremiumStore((s) => s.status);
  const fetchStatus = usePremiumStore((s) => s.fetchStatus);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    fetchStatus();
  }, [fetchStatus]);

  if (!ADS_ENABLED) return false;
  if (ADS_FORCE_SHOW) return true;
  if (!status) return false; // 로딩 중 → 광고 미노출

  // VIP / 체험판: 어떤 경우에도 광고 없음
  if (status.tier === 'PAID') return false;
  if (status.trialActive) return false;
  if (status.premiumActive) return false;

  // FREE 확정일 때만 광고 표시
  return status.tier === 'FREE';
}

import { useEffect, useState } from 'react';
import { premiumApi } from '../services/api';

const ADS_ENABLED = process.env.EXPO_PUBLIC_ADS_ENABLED === 'true';
const ADS_FORCE_SHOW = process.env.EXPO_PUBLIC_ADS_FORCE_SHOW === 'true';

interface PremiumStatus {
  tier: 'FREE' | 'PAID' | string;
  trialActive: boolean;
  premiumActive: boolean;
  trialDaysLeft?: number;
}

/**
 * 광고 표시 여부 결정.
 *
 * 표시 조건 (모두 충족):
 *   1) EXPO_PUBLIC_ADS_ENABLED=true (env)
 *   2) ADS_FORCE_SHOW=true 이거나, 사용자가 무료 tier
 *
 * 무료 tier 판정 (모두 충족):
 *   - tier가 'PAID'가 아님
 *   - trialActive === false
 *   - premiumActive === false
 *
 * → 백엔드의 effectiveTier만으로 판단하던 기존 로직이 어떤 이유로
 *    PAID 사용자에게 광고가 노출되는 회귀를 방지하는 다중 방어.
 */
export function useShowAds(): boolean {
  const [status, setStatus] = useState<PremiumStatus | null>(null);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    let cancelled = false;
    premiumApi.status()
      .then((res) => {
        const data = res.data?.data as Partial<PremiumStatus> | undefined;
        if (!cancelled) {
          setStatus({
            tier: data?.tier ?? 'FREE',
            trialActive: Boolean(data?.trialActive),
            premiumActive: Boolean(data?.premiumActive),
            trialDaysLeft: data?.trialDaysLeft,
          });
        }
      })
      .catch(() => {
        // API 실패 시 보수적으로 PAID 처리 — 광고 미노출 (오인 노출 방지)
        // 이전엔 FREE 처리해 광고를 보였으나, PAID 사용자가 광고를 보는
        // 회귀가 더 큰 문제이므로 fail-safe 방향을 PAID로 전환.
        if (!cancelled) {
          setStatus({ tier: 'PAID', trialActive: false, premiumActive: false });
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (!ADS_ENABLED) return false;
  if (ADS_FORCE_SHOW) return true;
  if (!status) return false;                    // 로딩 중 → 광고 미노출

  // 유료/체험판 사용자는 어떤 경우에도 광고 미노출
  if (status.tier === 'PAID') return false;
  if (status.trialActive) return false;
  if (status.premiumActive) return false;

  // 명시적으로 FREE이고 다른 활성 상태가 없을 때만 광고
  return status.tier === 'FREE';
}

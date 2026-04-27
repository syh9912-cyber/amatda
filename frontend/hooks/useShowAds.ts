import { useEffect, useState } from 'react';
import { premiumApi } from '../services/api';

const ADS_ENABLED = process.env.EXPO_PUBLIC_ADS_ENABLED === 'true';
const ADS_FORCE_SHOW = process.env.EXPO_PUBLIC_ADS_FORCE_SHOW === 'true';

export function useShowAds(): boolean {
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    let cancelled = false;
    premiumApi.status()
      .then((res) => {
        const data = res.data?.data as { tier?: string } | undefined;
        if (!cancelled) setTier(data?.tier ?? 'FREE');
      })
      .catch(() => {
        if (!cancelled) setTier('FREE');
      });
    return () => { cancelled = true; };
  }, []);

  if (!ADS_ENABLED) return false;
  if (ADS_FORCE_SHOW) return true;
  return tier === 'FREE';
}

/**
 * 화면 하단 배너 광고 슬롯.
 *
 * - VIP / 체험판: 광고 안 보임 (`useShowAds()` false)
 * - FREE + ADS_MOCK=true: 회색 mock 박스
 * - FREE + 실제 빌드: react-native-google-mobile-ads BannerAd 동적 로드
 *
 * 보안/안전:
 *   - native 모듈 dynamic require — Expo Go 등에서 크래시 방지
 *   - Google 공식 테스트 광고 ID 사용 (계정 정지 위험 차단)
 *   - 모듈 또는 unit ID 부재 시 silent null 반환
 *
 * 2026-05-26: minHeight 보장 + mobileAds().initialize() 호출 추가.
 *   광고 로드 전에 영역이 0×0 으로 안 보이던 문제 / 초기화 누락으로 광고 안 뜨던 문제 수정.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useShowAds } from '../../hooks/useShowAds';

const ADS_MOCK = process.env.EXPO_PUBLIC_ADS_MOCK === 'true';
const UNIT_ID_ANDROID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
const UNIT_ID_IOS = process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adModule: any | null | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadAdMob(): any | null {
  if (_adModule !== undefined) return _adModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _adModule = require('react-native-google-mobile-ads');
  } catch {
    _adModule = null;
  }
  return _adModule;
}

// 한 번만 초기화 — 첫 번째 AdSlot 렌더 시 실행.
let _initialized = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function initAdMob(mod: any): Promise<void> {
  if (_initialized) return;
  _initialized = true;
  try {
    const defaultExport = mod.default;
    if (typeof defaultExport === 'function') {
      await defaultExport().initialize();
    }
  } catch {
    // init 실패해도 BannerAd 가 자체 재시도 함 — silent
  }
}

/**
 * Ad size variants:
 * - 'banner' (default): 320×50, 화면 하단 고정용
 * - 'medium': 300×250 사각형, 빈 공간 채우기용 (예: 음성기록 화면)
 */
export type AdSize = 'banner' | 'medium';

interface AdSlotProps {
  variant?: AdSize;
}

export function AdSlot({ variant = 'banner' }: AdSlotProps) {
  const show = useShowAds();
  const [adReady, setAdReady] = useState(false);
  const initStartedRef = useRef(false);

  // 모듈 로드 + 초기화 (실제 빌드, !ADS_MOCK 경로에서만)
  useEffect(() => {
    if (!show || ADS_MOCK) return;
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    const mod = loadAdMob();
    if (!mod) return;
    initAdMob(mod).finally(() => setAdReady(true));
  }, [show]);

  if (!show) return null;

  const isMedium = variant === 'medium';
  const placeholderStyle = isMedium ? styles.mediumBox : styles.banner;
  const mediumLabel = '광고 영역 (테스트 — 300×250)';
  const bannerLabel = '광고 영역 (테스트 — 50pt)';

  if (ADS_MOCK) {
    return (
      <View style={placeholderStyle}>
        <Text style={styles.label}>{isMedium ? mediumLabel : bannerLabel}</Text>
      </View>
    );
  }

  const unitId = Platform.OS === 'ios' ? UNIT_ID_IOS : UNIT_ID_ANDROID;
  if (!unitId) {
    return (
      <View style={placeholderStyle}>
        <Text style={styles.label}>광고 unit ID 미설정</Text>
      </View>
    );
  }

  const mod = loadAdMob();
  if (!mod?.BannerAd) {
    return (
      <View style={placeholderStyle}>
        <Text style={styles.label}>광고 모듈 미로딩 (APK 재설치 필요)</Text>
      </View>
    );
  }

  const BannerAd = mod.BannerAd;
  const sizes = mod.BannerAdSize ?? {};
  // medium → 300×250, banner → ANCHORED_ADAPTIVE 우선
  const size = isMedium
    ? (sizes.MEDIUM_RECTANGLE ?? 'MEDIUM_RECTANGLE')
    : (sizes.ANCHORED_ADAPTIVE_BANNER ?? sizes.BANNER ?? 'BANNER');

  return (
    <View style={isMedium ? styles.mediumContainer : styles.bannerContainer}>
      {!adReady && (
        <Text style={styles.loadingLabel}>광고 로딩 중...</Text>
      )}
      <BannerAd
        unitId={unitId}
        size={size}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 50,
    backgroundColor: '#E8E8E8',
    borderTopWidth: 1,
    borderTopColor: '#D0D0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  loadingLabel: {
    fontSize: 10,
    color: '#BBB',
    position: 'absolute',
  },
  bannerContainer: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  /* MEDIUM_RECTANGLE — 300×250 빈공간 채움용 */
  mediumBox: {
    width: 300,
    height: 250,
    backgroundColor: '#E8E8E8',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  mediumContainer: {
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

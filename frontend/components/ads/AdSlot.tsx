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
 */
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

export function AdSlot() {
  const show = useShowAds();
  if (!show) return null;

  if (ADS_MOCK) {
    return (
      <View style={styles.banner}>
        <Text style={styles.label}>광고 영역 (테스트 — 50pt)</Text>
      </View>
    );
  }

  const unitId = Platform.OS === 'ios' ? UNIT_ID_IOS : UNIT_ID_ANDROID;
  if (!unitId) return null;

  const mod = loadAdMob();
  if (!mod?.BannerAd) return null;

  const BannerAd = mod.BannerAd;
  const sizes = mod.BannerAdSize ?? {};
  // ANCHORED_ADAPTIVE_BANNER 우선 (최신), 없으면 BANNER (320x50 표준)
  const size = sizes.ANCHORED_ADAPTIVE_BANNER ?? sizes.BANNER ?? 'BANNER';

  return (
    <View style={styles.bannerContainer}>
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
  bannerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
});

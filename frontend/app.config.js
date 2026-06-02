// app.json을 기반으로 하면서 environment variable에서
// google-services.json 경로를 주입하기 위한 dynamic config.
// Expo는 app.config.js가 있으면 이 파일을 우선 사용하고,
// config 파라미터로 app.json 내용을 받아올 수 있다.
module.exports = ({ config }) => {
  const androidConfig = { ...(config.android || {}) };

  if (process.env.GOOGLE_SERVICES_JSON) {
    androidConfig.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  } else {
    // 로컬 개발: frontend/google-services.json 이 존재하면 그것을 사용
    androidConfig.googleServicesFile = './google-services.json';
  }

  // iOS Firebase 설정 — @react-native-firebase 가 GoogleService-Info.plist 요구.
  const iosConfig = { ...(config.ios || {}) };
  if (process.env.GOOGLE_SERVICES_PLIST) {
    iosConfig.googleServicesFile = process.env.GOOGLE_SERVICES_PLIST;
  } else {
    iosConfig.googleServicesFile = './GoogleService-Info.plist';
  }

  // expo-font 플러그인 + Pretendard 폰트 임베드
  const existingPlugins = Array.isArray(config.plugins) ? [...config.plugins] : [];
  const fontsPlugin = [
    'expo-font',
    {
      fonts: [
        './assets/fonts/Pretendard-Regular.otf',
        './assets/fonts/Pretendard-Medium.otf',
        './assets/fonts/Pretendard-SemiBold.otf',
        './assets/fonts/Pretendard-Bold.otf',
      ],
    },
  ];
  const hasFont = existingPlugins.some(
    (p) => p === 'expo-font' || (Array.isArray(p) && p[0] === 'expo-font'),
  );
  if (!hasFont) existingPlugins.push(fontsPlugin);

  // Sentry React Native 플러그인 — APK 빌드 시 source map 자동 업로드
  // SENTRY_AUTH_TOKEN은 EAS Secret으로 주입됨
  const sentryPlugin = [
    '@sentry/react-native/expo',
    {
      organization: 'sy-labs',
      project: 'react-native', // Sentry 프로젝트 slug (대시보드에서 확인)
      url: 'https://sentry.io/',
    },
  ];
  const hasSentry = existingPlugins.some(
    (p) => p === '@sentry/react-native/expo' ||
           (Array.isArray(p) && p[0] === '@sentry/react-native/expo'),
  );
  if (!hasSentry) existingPlugins.push(sentryPlugin);

  // AdMob (Google Mobile Ads) — 배너 광고용
  // App ID 는 EAS env 로 주입 (production 빌드에서만 실제 ID, dev/preview 는 테스트 ID)
  // 현재 placeholder 는 Google 공식 테스트 App ID — 실제 발급 후 EAS env 로 교체
  const ADMOB_ANDROID_APP_ID = process.env.ADMOB_ANDROID_APP_ID || 'ca-app-pub-3940256099942544~3347511713';
  const ADMOB_IOS_APP_ID = process.env.ADMOB_IOS_APP_ID || 'ca-app-pub-3940256099942544~1458002511';
  const adMobPlugin = [
    'react-native-google-mobile-ads',
    {
      androidAppId: ADMOB_ANDROID_APP_ID,
      iosAppId: ADMOB_IOS_APP_ID,
      // iOS: 광고 ID 추적 사용자 동의 안 받으니 SK Ad Network 만 사용 (ATT 프롬프트 X 가능)
      // user_tracking_usage_description 미설정 시 Apple 심사관이 ATT 안 묻는 앱으로 판단
    },
  ];
  const hasAdMob = existingPlugins.some(
    (p) => p === 'react-native-google-mobile-ads' ||
           (Array.isArray(p) && p[0] === 'react-native-google-mobile-ads'),
  );
  if (!hasAdMob) existingPlugins.push(adMobPlugin);

  // 네이티브 빌드 속성 — iOS 최소 배포 타겟 상향.
  // @react-native-firebase v24(firebase-ios-sdk 12.9) 등 일부 pod 이 기본(15.1)보다
  // 높은 deployment target 을 요구 → 16.0 으로 통일 (CocoaPods 설치 실패 해결).
  const buildPropsPlugin = [
    'expo-build-properties',
    {
      ios: { deploymentTarget: '16.0' },
    },
  ];
  const hasBuildProps = existingPlugins.some(
    (p) => p === 'expo-build-properties' ||
           (Array.isArray(p) && p[0] === 'expo-build-properties'),
  );
  if (!hasBuildProps) existingPlugins.push(buildPropsPlugin);

  // Firebase (Analytics) — google-services.json 자동 통합 + 네이티브 모듈 링크.
  // @react-native-firebase/app 이 first plugin. analytics 는 app 위에 동작.
  const hasFirebase = existingPlugins.some(
    (p) => p === '@react-native-firebase/app' ||
           (Array.isArray(p) && p[0] === '@react-native-firebase/app'),
  );
  if (!hasFirebase) existingPlugins.push('@react-native-firebase/app');

  return {
    ...config,
    android: androidConfig,
    ios: iosConfig,
    plugins: existingPlugins,
  };
};

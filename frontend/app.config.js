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

  return {
    ...config,
    android: androidConfig,
    plugins: existingPlugins,
  };
};

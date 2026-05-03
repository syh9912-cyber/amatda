import * as Sentry from '@sentry/react-native';

// DSN 우선순위: EAS env (빌드 시 주입) → 하드코딩 fallback (OTA로 즉시 활성)
// DSN은 의도적으로 공개 안전한 식별자 (Sentry 설계상 클라이언트 임베드 전제)
const FALLBACK_DSN =
  'https://dd7124a12d7082892c04cee84ecc0aac@o4511325473865728.ingest.us.sentry.io/4511325488873472';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || FALLBACK_DSN;

// Expo Router 화면 자동 추적용 navigation integration (한 번만 생성)
export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export function initSentry(): void {
  if (__DEV__ || !SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    attachScreenshot: true,
    enableNativeFramesTracking: true,
    integrations: [navigationIntegration],
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
    console.error('[Sentry]', error, context);
    return;
  }
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export function setUser(userId: string, email?: string): void {
  Sentry.setUser({ id: userId, email });
}

export function clearUser(): void {
  Sentry.setUser(null);
}

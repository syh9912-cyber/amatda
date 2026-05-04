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
    // PII 보호 — IP/사용자 헤더 등 자동 첨부 끔
    sendDefaultPii: false,
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

export function setUser(userId: string, _email?: string): void {
  // 보안: email 은 Sentry 에 보내지 않음 (PII).
  // 디버깅에 필요하면 userId 로 Firestore users/{userId} 조회.
  // _email 매개변수는 호출부 호환성 유지용 (silently ignored).
  Sentry.setUser({ id: userId });
}

export function clearUser(): void {
  Sentry.setUser(null);
}

import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export function initSentry(): void {
  if (__DEV__ || !SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    attachScreenshot: true,
    enableNativeFramesTracking: true,
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

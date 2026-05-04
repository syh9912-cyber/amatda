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

/**
 * #14 PII scrubber — Sentry 로 보내기 직전 민감 정보 제거.
 *  - Authorization / Cookie 헤더
 *  - request body 의 password / refreshToken / accessToken / phone / email / childName
 *  - extra/breadcrumb 의 동일 필드
 * 보안: 어떤 경로로든 민감 데이터가 외부 SaaS 로 새지 않도록 마지막 방어선.
 */
const PII_KEY_PATTERNS = /^(authorization|cookie|password|refreshtoken|accesstoken|access_token|refresh_token|token|jwt|secret|phone|phonenumber|email|childname|child_name|fcmtoken|fcm_token|pushtoken|push_token|kakao_token|naver_token|google_token)$/i;
const PHONE_PATTERN = /(\+?\d[\d\s\-()]{7,}\d)/g;

function scrubObject(obj: unknown, depth = 0): unknown {
  if (obj == null || depth > 6) return obj;
  if (typeof obj === 'string') {
    // 문자열 내부의 phone-like 패턴 마스킹 (last 4 만 남김)
    return obj.replace(PHONE_PATTERN, (m) => `***${m.slice(-4)}`);
  }
  if (Array.isArray(obj)) return obj.map((v) => scrubObject(v, depth + 1));
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (PII_KEY_PATTERNS.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = scrubObject(v, depth + 1);
      }
    }
    return out;
  }
  return obj;
}

function beforeSendScrub(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  try {
    if (event.request?.headers) event.request.headers = scrubObject(event.request.headers) as Record<string, string>;
    if (event.request?.cookies) event.request.cookies = '[REDACTED]' as unknown as Record<string, string>;
    if (event.request?.data) event.request.data = scrubObject(event.request.data);
    if (event.request?.query_string) event.request.query_string = scrubObject(event.request.query_string) as string | Record<string, string>;
    if (event.extra) event.extra = scrubObject(event.extra) as Record<string, unknown>;
    if (event.contexts) event.contexts = scrubObject(event.contexts) as Sentry.ErrorEvent['contexts'];
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => ({
        ...b,
        data: b.data ? (scrubObject(b.data) as Record<string, unknown>) : b.data,
        message: b.message ? (scrubObject(b.message) as string) : b.message,
      }));
    }
  } catch {
    // scrub 실패 시 — 안전 우선: 이벤트 drop
    return null;
  }
  return event;
}

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
    // #14 PII scrubber
    beforeSend: beforeSendScrub,
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

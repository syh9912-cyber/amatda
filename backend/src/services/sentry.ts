/**
 * Backend Sentry — 운영 에러 자동 수집.
 *
 * DSN: process.env.SENTRY_DSN_BACKEND (Firebase Functions secret)
 *  - 미설정 시 init 스킵, capture 도 no-op (회귀 없음)
 *  - 프론트와 같은 Sentry 프로젝트 사용해도 됨 (tags.runtime: 'backend' 로 구분)
 *
 * 사용:
 *  - logger.error 가 자동으로 Sentry.captureException 호출 → routes 코드 수정 불필요
 *  - Express 에러 핸들러는 setupExpressErrorHandler 가 자동 캡처
 */

import * as Sentry from '@sentry/node';
import type { Express } from 'express';

let initialized = false;

/**
 * #14 PII scrubber — frontend 와 동일 정책. 백엔드는 추가로 webhook payload 의
 * 결제 카드/계좌 정보, JWT 페이로드 등이 흘러갈 수 있어 더 엄격하게 처리.
 */
const PII_KEY_PATTERNS = /^(authorization|cookie|password|refreshtoken|accesstoken|access_token|refresh_token|token|jwt|secret|phone|phonenumber|email|childname|child_name|fcmtoken|fcm_token|pushtoken|push_token|kakao_token|naver_token|google_token|cardnumber|card_number|customerkey|billingkey|webhookbody|raw)$/i;
const PHONE_PATTERN = /(\+?\d[\d\s\-()]{7,}\d)/g;

function scrubObject(obj: unknown, depth = 0): unknown {
  if (obj == null || depth > 6) return obj;
  if (typeof obj === 'string') return obj.replace(PHONE_PATTERN, (m) => `***${m.slice(-4)}`);
  if (Array.isArray(obj)) return obj.map((v) => scrubObject(v, depth + 1));
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (PII_KEY_PATTERNS.test(k)) out[k] = '[REDACTED]';
      else out[k] = scrubObject(v, depth + 1);
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
    if (event.request?.query_string) event.request.query_string = scrubObject(event.request.query_string) as string;
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
    return null;
  }
  return event;
}

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN_BACKEND;
  if (!dsn) {
    console.warn('[sentry] SENTRY_DSN_BACKEND 미설정 — 백엔드 에러 자동 수집 비활성');
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1,
    sendDefaultPii: false, // PII 보호 — IP/email 등 자동 첨부 끔
    beforeSend: beforeSendScrub, // #14 PII scrubber
    initialScope: {
      tags: { runtime: 'backend', service: process.env.K_SERVICE || 'unknown' },
    },
  });
  initialized = true;
}

export function isInitialized(): boolean {
  return initialized;
}

/**
 * Express 에 Sentry 에러 핸들러 부착.
 * 모든 라우트 등록 후 마지막에 호출.
 */
export function attachSentryErrorHandler(app: Express): void {
  if (!initialized) return;
  Sentry.setupExpressErrorHandler(app);
}

/** logger 에서 호출 — DSN 미설정 시 no-op */
export function captureException(err: unknown, extra?: Record<string, unknown>): void {
  if (!initialized) return;
  if (extra) {
    Sentry.withScope((scope) => {
      scope.setExtras(extra);
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }
  // Cloud Functions 는 응답 종료 후 컨테이너가 곧바로 frozen 되어 background flush 가
  // 동작하지 못할 수 있음 → fire-and-forget flush 로 큐 즉시 비우기 시도.
  // 동기 await 가 아니라 응답 지연은 없음. flush 자체 실패는 무시 (transport 이중 보장).
  Sentry.flush(2000).catch(() => {});
}

/**
 * Express 응답 종료 직후 추가 flush 안전망 미들웨어.
 * captureException 의 fire-and-forget 와 함께 이중 보장 — 마지막 요청의 캡처도
 * Functions 컨테이너 frozen 전에 큐를 비울 가능성을 높인다.
 */
export function flushOnFinishMiddleware() {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    res.on('finish', () => {
      if (!initialized) return;
      Sentry.flush(1000).catch(() => {});
    });
    next();
  };
}

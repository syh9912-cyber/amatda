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

// Sentry 는 다른 import 보다 먼저 — instrumentation 이 require 후킹을 사용
import { initSentry, attachSentryErrorHandler, flushOnFinishMiddleware } from './services/sentry';
initSentry();

import express, { Request } from 'express';
import * as functions from 'firebase-functions';
import { env } from './config/env';
import { setupSecurity } from './middleware/security';
import authRoutes from './routes/auth';
import childRoutes from './routes/child';
import questionRoutes from './routes/question';
import foodRoutes from './routes/food';
import observationRoutes from './routes/observation';
import academyRoutes from './routes/academy';
import subscriptionRoutes from './routes/subscription';
import paymentRoutes from './routes/payment';
import weatherRoutes from './routes/weather';
import siblingRoutes from './routes/sibling';
import chatbotRoutes from './routes/chatbot';
import mateRoutes from './routes/mate';
import adRoutes from './routes/ad';
// seed 라우트 제거 — 프로덕션에서 인증 없이 DB 삭제 가능한 보안 취약점
// import seedRoutes from './routes/seed';
import momstagramRoutes from './routes/momstagram';
import coachingRoutes from './routes/coaching/index';
import clinicRoutes from './routes/clinic';
import memoriesRoutes from './routes/memories';
import retentionRoutes from './routes/retention';
import recommendationRoutes from './routes/recommendations';
import growthRoutes from './routes/growth';
import sleepRoutes from './routes/sleep';
import coparentingRoutes from './routes/coparenting';
import sosRoutes from './routes/sos';
import pregnancyRoutes from './routes/pregnancy';
import vaccinationRoutes from './routes/vaccination';
import uploadRoutes from './routes/upload';
import albumRoutes from './routes/album';
import trackerRoutes from './routes/tracker';
import momGroupRoutes from './routes/mom-group';
import momLocationRoutes from './routes/mom-location';
import birthbagShareRoutes from './routes/birthbag-share';

/* ------------------------------------------------------------------ */
/* 🚀 함수 분리 아키텍처 (claude-progress.md 2026-04-16 의도)          */
/*                                                                    */
/*   api 함수         (512MiB / concurrency 20)                        */
/*     - 비코칭 라우트 (인증, 자녀, 앨범, 트래커 등 전부)               */
/*     - DB CRUD 위주, 가벼운 처리                                     */
/*                                                                    */
/*   coachingApi 함수 (1GiB  / concurrency 5)                          */
/*     - /api/coaching/* 만 처리 (AI 코칭 전용)                        */
/*     - Gemini 호출 + RAG 검색 → 메모리/CPU 사용 큼                    */
/*     - 동시처리 5로 제한해 OOM 방지                                  */
/*                                                                    */
/*   효과: 코칭 부하가 다른 API(로그인/앨범 등)에 영향 주지 않음.       */
/* ------------------------------------------------------------------ */

/* ─── 비코칭 라우트용 메인 Express ─── */
const app = express();
// webhook HMAC 검증을 위해 raw body 보존 — req.body 는 평소대로 파싱된 객체로 사용,
// req.rawBody (Buffer) 는 PortOne 등 webhook 서명 검증 시에만 참조.
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
// 응답 종료 시 Sentry 큐 flush (Cloud Functions frozen 전 이벤트 손실 방지)
app.use(flushOnFinishMiddleware());
setupSecurity(app);

app.use('/api/auth', authRoutes);
app.use('/api/children', childRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/food-guide', foodRoutes);
app.use('/api/observations', observationRoutes);
app.use('/api/academies', academyRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/siblings', siblingRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/mates', mateRoutes);
app.use('/api/ads', adRoutes);
// app.use('/api/seed', seedRoutes); // 프로덕션 제거
app.use('/api/momstagram', momstagramRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/retention', retentionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/sleep', sleepRoutes);
app.use('/api/coparenting', coparentingRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/pregnancy', pregnancyRoutes);
app.use('/api/vaccination', vaccinationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/album', albumRoutes);
app.use('/api/tracker', trackerRoutes);
app.use('/api/mom-group', momGroupRoutes);
app.use('/api/mom-location', momLocationRoutes);
app.use('/api/birthbag-share', birthbagShareRoutes);

/* ─── /api/coaching 안전망 마운트 ───
 *
 * 정석은 coachingApi 함수가 /api/coaching/* 를 처리하는 것 (메모리 1GB).
 * 그러나 이전 빌드/번들이 EXPO_PUBLIC_COACHING_API_URL 누락으로
 * 메인 api URL을 호출할 수 있음 (fallback to API_URL).
 *
 * 그 케이스에서도 코칭이 끊기지 않도록 메인 api에도 /api/coaching 마운트.
 * EAS Cloud env 정비 + 신규 빌드 배포 후에는 트래픽이 자연스럽게
 * coachingApi 함수로 옮겨감 (메모리 분리 효과 회복).
 *
 * ⚠️ 반드시 attachSentryErrorHandler 보다 먼저 등록 — Express 에러
 *    미들웨어는 등록 순서상 라우트 뒤에 와야 catch 됨.
 */
app.use('/api/coaching', coachingRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'api', version: '1.0.0', timestamp: new Date().toISOString() } });
});

// Sentry Express 에러 핸들러 — 모든 라우트 등록 후 마지막에 부착
attachSentryErrorHandler(app);

/* ─── 로컬 개발용 (devApp 통합 — 위에서 이미 마운트됨) ─── */
const isFirebase = process.env.FUNCTIONS_EMULATOR || process.env.GCLOUD_PROJECT || process.env.K_SERVICE;

/* ─── 코칭 전용 Express ─── */
const coachingApp = express();
coachingApp.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
coachingApp.use(flushOnFinishMiddleware());
setupSecurity(coachingApp);
coachingApp.use('/api/coaching', coachingRoutes);
coachingApp.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'coachingApi', version: '1.0.0', timestamp: new Date().toISOString() } });
});
attachSentryErrorHandler(coachingApp);

/* ─── Firebase Functions exports ─── */

/**
 * Firebase Functions Secret Manager 바인딩.
 *
 * 여기 명시된 secret 만 함수 컨테이너의 process.env 에 자동 주입됨.
 * 미명시 secret 은 Secret Manager 에 등록되어 있어도 함수에서 접근 불가.
 *
 * 등록 완료 (2026-05-04):
 *   - TOKEN_ENCRYPTION_KEY     (소셜 access_token AES-256-GCM 암호화)
 *   - SENTRY_DSN_BACKEND       (백엔드 에러 자동 수집)
 *   - GEMINI_API_KEY           (Gemini AI)
 *   - JWT_SECRET, JWT_REFRESH_SECRET (인증 토큰 서명)
 *   - PASSPORT_SALT            (여권 공개 링크 해시)
 *   - KAKAO_*, NAVER_*, GOOGLE_* (소셜 로그인)
 *
 * 결제사 승인 후 등록 예정:
 *   - PORTONE_API_SECRET, PORTONE_WEBHOOK_SECRET, PORTONE_STORE_ID, PORTONE_CHANNEL_KEY_*
 *   - GOOGLE_PUBSUB_AUDIENCE, GOOGLE_PUBSUB_SA_EMAIL
 *   - GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
 *   - APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_BUNDLE_ID
 *
 * Phase 5 완료 후 backend/.env 는 로컬 개발 전용으로 축소되고
 * functions.ignore 에 추가되어 deploy 패키지에서 제외됨.
 */
const REGISTERED_SECRETS: string[] = [
  'TOKEN_ENCRYPTION_KEY',
  'SENTRY_DSN_BACKEND',
  'GEMINI_API_KEY',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'PASSPORT_SALT',
  'KAKAO_JAVASCRIPT_KEY',
  'KAKAO_REST_API_KEY',
  'KAKAO_CLIENT_SECRET',
  'KAKAO_ADMIN_KEY',
  'NAVER_CLIENT_ID',
  'NAVER_CLIENT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

// memory: 512MiB — 비코칭 라우트는 가벼운 CRUD가 다수
// concurrency: 20 — 동시 요청 과다 시 메모리 스파이크 방지
export const api = functions.https.onRequest(
  {
    cors: true,
    invoker: 'public',
    memory: '512MiB',
    concurrency: 20,
    timeoutSeconds: 300,
    secrets: REGISTERED_SECRETS,
  },
  app
);

// memory: 1GiB — 코칭 지식 DB(~900KB) + Gemini 호출 버퍼
// concurrency: 5 — AI 호출 병목 시 OOM 방지 (claude-progress.md 2026-04-16 정책)
export const coachingApi = functions.https.onRequest(
  {
    cors: true,
    invoker: 'public',
    memory: '1GiB',
    concurrency: 5,
    timeoutSeconds: 300,
    secrets: REGISTERED_SECRETS,
  },
  coachingApp
);

// 로컬 개발용 (firebase deploy 시에는 실행하지 않음)
if (!isFirebase && require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`아맞다 Backend running on http://localhost:${env.PORT}`);
    console.log(`  · 비코칭 + 코칭 라우트 모두 같은 포트에서 처리 (devApp)`);
  });
}

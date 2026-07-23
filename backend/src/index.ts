// Sentry 는 다른 import 보다 먼저 — instrumentation 이 require 후킹을 사용
import { initSentry, attachSentryErrorHandler, flushOnFinishMiddleware } from './services/sentry';
initSentry();

import express, { Request } from 'express';
import * as functions from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { env } from './config/env';
import { runDormantUserSweep } from './utils/dormantUserSweep';
import { runTrialEndingSweep } from './utils/trialEndingSweep';
import { runNeighborGroupSweep } from './utils/neighborGroupSweep';
import { runPredictiveAlarmSweep } from './utils/predictiveAlarmSweep';
import { runVaccinationReminderSweep } from './utils/vaccinationReminderSweep';
import { logger } from './utils/logger';
import { setupSecurity } from './middleware/security';
import authRoutes from './routes/auth';
import childRoutes from './routes/child';
import questionRoutes from './routes/question';
import observationRoutes from './routes/observation';
import subscriptionRoutes from './routes/subscription';
import paymentRoutes from './routes/payment';
// seed 라우트 제거 — 프로덕션에서 인증 없이 DB 삭제 가능한 보안 취약점
// import seedRoutes from './routes/seed';
import momstagramRoutes from './routes/momstagram';
import coachingRoutes from './routes/coaching/index';
import clinicRoutes from './routes/clinic';
import memoriesRoutes from './routes/memories';
import retentionRoutes from './routes/retention';
import recommendationRoutes from './routes/recommendations';
import growthRoutes from './routes/growth';
import coparentingRoutes, { sweepExpiredInvites } from './routes/coparenting';
import sosRoutes from './routes/sos';
import pregnancyRoutes from './routes/pregnancy';
import vaccinationRoutes from './routes/vaccination';
import uploadRoutes from './routes/upload';
import albumRoutes from './routes/album';
import trackerRoutes from './routes/tracker';
import babyTrackerRoutes from './routes/babyTracker';
import momGroupRoutes from './routes/mom-group';
import momLocationRoutes from './routes/mom-location';
import birthbagShareRoutes from './routes/birthbag-share';
import kakaoRoutes from './routes/kakao';
import announcementRoutes from './routes/announcement';
import adminRoutes from './routes/admin';

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
app.use('/api/observations', observationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
// app.use('/api/seed', seedRoutes); // 프로덕션 제거
app.use('/api/momstagram', momstagramRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/retention', retentionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/coparenting', coparentingRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/pregnancy', pregnancyRoutes);
app.use('/api/vaccination', vaccinationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/album', albumRoutes);
app.use('/api/tracker', trackerRoutes);
app.use('/api/baby-tracker', babyTrackerRoutes);
app.use('/api/mom-group', momGroupRoutes);
app.use('/api/mom-location', momLocationRoutes);
app.use('/api/birthbag-share', birthbagShareRoutes);
// 카카오 i 오픈빌더 챗봇 skill 서버 — 외부 webhook, 인증 불필요 (URL 비밀로 유지)
app.use('/api/kakao', kakaoRoutes);
app.use('/api/announcement', announcementRoutes);
app.use('/api/admin', adminRoutes);

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
  // 코칭 타사 폴백 — Gemini 전체 과부하 시 OpenAI gpt-5-nano 사용
  'OPENAI_API_KEY',
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
  // 결제 — Google Play RTDN (Pub/Sub) webhook 인증
  'GOOGLE_PUBSUB_AUDIENCE',
  // 결제 — Google Play 영수증 검증 service account (Android Publisher API)
  'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
  // 결제 — Apple App Store Server API (IAP 영수증/거래 검증).
  // 누락 시 process.env 미주입 → isAppleIAPAvailable() false → 검증 503 (Apple 심사 2.1b 실패).
  'APPLE_ISSUER_ID',
  'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY',
  'APPLE_BUNDLE_ID',
  'ADMIN_DASHBOARD_KEY',
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

/* ─── Cloud Scheduler — 휴면 사용자 자동 정리 ───
 *
 * PIPA 21조(보유 목적 달성 후 즉시 파기) + 정보통신망법 시행령 16조(휴면 1년) 충족.
 *
 * 정책:
 *   - 1년 이상 미접속 → 30일 전 푸시 경고 + scheduledDeleteAt 마킹
 *   - scheduledDeleteAt 도래 → 계정 + Storage 전체 cascade 삭제
 *   - 사용자가 다시 로그인하면 touchUserActive() 가 자동으로 회복
 *
 * 일정: 매일 03:30 KST (= 18:30 UTC).
 * 메모리: 512MiB — Firestore 쿼리 + 푸시 발송 위주, 대용량 처리 없음.
 * 타임아웃: 9분 — 한 번에 최대 100명 처리, 충분한 여유.
 */
export const dormantUserSweep = onSchedule(
  {
    schedule: '30 3 * * *',
    timeZone: 'Asia/Seoul',
    memory: '256MiB',
    timeoutSeconds: 540,
    // env.ts 가 모듈 로드 시점에 JWT_SECRET 등을 검증함 — api/coachingApi 와 동일하게
    // 모든 시크릿을 주입해야 모듈 로드 성공. sweep 자체는 Firestore 만 쓰지만, 같은
    // 코드베이스가 로드되므로 검증 통과를 위해 동일 secrets 필요.
    secrets: REGISTERED_SECRETS,
  },
  async () => {
    await runDormantUserSweep();
    // 만료된 미사용 공동육아 초대 정리 (best-effort — 실패해도 휴면 sweep 은 완료)
    try {
      await sweepExpiredInvites();
    } catch (err) {
      logger.error('inviteSweep', err);
    }
  },
);

/**
 * 체험 종료 24시간 전 푸시 알림 (Apple/Google 정책 + 한국 전자상거래법 준수).
 * 매시간 실행 — 정확한 24h 윈도우 안에서 한 번만 발송 (trialEndingNotifiedAt 으로 중복 차단).
 */
export const trialEndingSweep = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Asia/Seoul',
    memory: '256MiB',
    timeoutSeconds: 540,
    secrets: REGISTERED_SECRETS,
  },
  async () => {
    await runTrialEndingSweep();
  },
);

/**
 * 동네 또래맘 커뮤니티(맘그룹) 참여 유도 푸시 — 화·금 19:00 KST (주 2회).
 * 위치를 등록한 사용자에게 "OO구 N개월 또래맘 모임" 형태로 발송 → 탭 시 맘그룹 화면.
 * 저녁 시간대(부모가 앱을 여는 시간) 발송. Expo 무료 푸시.
 */
export const neighborGroupNudge = onSchedule(
  {
    schedule: '0 19 * * 2,5',
    timeZone: 'Asia/Seoul',
    memory: '256MiB',
    timeoutSeconds: 540,
    // env.ts 시크릿 검증 통과 위해 동일 secrets 주입 (sweep 자체는 Firestore/Expo 만 사용)
    secrets: REGISTERED_SECRETS,
  },
  async () => {
    await runNeighborGroupSweep();
  },
);

/**
 * 예측 알람 sweep — 15분마다. 최근 3일 수유/수면/기상 패턴 슬롯의 (시각-offset)이
 * 지금 창에 들면 "곧 ○○ 시간이에요" Expo Push. 데이터 없으면 안 감. 항목별 on/off 반영.
 */
export const predictiveAlarmSweep = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Seoul',
    memory: '256MiB',
    timeoutSeconds: 540,
    secrets: REGISTERED_SECRETS,
  },
  async () => {
    await runPredictiveAlarmSweep();
  },
);

/**
 * 예방접종 알림 발송 sweep — 30분마다.
 * schedule-alerts 가 pushSchedules 에 예약한 vaccination_reminder(D-2/D-1, KST 9시)
 * 중 발송 시각이 지난 것을 Expo Push 로 발송. 묵은 예약(12h 초과)은 발송 없이 폐기.
 * (기존엔 예약만 되고 발송 디스패처가 없어 접종 알림이 안 갔음.)
 */
export const vaccinationReminderSweep = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Seoul',
    memory: '256MiB',
    timeoutSeconds: 300,
    secrets: REGISTERED_SECRETS,
  },
  async () => {
    await runVaccinationReminderSweep();
  },
);

/* ─── Cloud Scheduler — 콜드 스타트 방지 ping ───
 *
 * 5분마다 api / coachingApi 의 /api/health 엔드포인트를 호출해 컨테이너를 웜 상태로 유지.
 * 콜드 스타트(첫 호출 시 5-15초 대기) 가 사라져 사용자 첫 로그인 응답 속도가 개선됨.
 *
 * 비용: Cloud Functions 무료 한도(월 200만 호출)의 0.4% 만 사용 → 사실상 무료.
 *       각 ping 은 단순 200 응답 (DB 호출 없음 / 100ms 이내).
 *
 * 효과:
 *   - 콜드 스타트 발생 빈도 90%+ 감소 (5분 윈도우 내 사용자 진입 시 항상 웜)
 *   - 백엔드 부하 무시 가능 (시간당 12회, 사용자 트래픽과 무관)
 */
export const keepWarm = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Asia/Seoul',
    memory: '256MiB',
    timeoutSeconds: 60,
    // env.ts JWT_SECRET 검증 통과 위해 동일 secrets 주입 (실제 사용 X)
    secrets: REGISTERED_SECRETS,
  },
  async () => {
    const urls = [
      'https://api-usglfifguq-uc.a.run.app/api/health',
      'https://coachingapi-usglfifguq-uc.a.run.app/api/health',
    ];
    const started = Date.now();
    const results = await Promise.allSettled(
      urls.map(async (u) => {
        const res = await fetch(u, { method: 'GET' });
        return `${u} → ${res.status}`;
      }),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    console.log(
      `[keepWarm] pinged=${results.length} ok=${ok} fail=${fail} elapsedMs=${Date.now() - started}`,
    );
    if (fail > 0) {
      results.forEach((r) => {
        if (r.status === 'rejected') {
          console.warn(`[keepWarm] error: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
        }
      });
    }
  },
);

// 로컬 개발용 (firebase deploy 시에는 실행하지 않음)
if (!isFirebase && require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`아맞다 Backend running on http://localhost:${env.PORT}`);
    console.log(`  · 비코칭 + 코칭 라우트 모두 같은 포트에서 처리 (devApp)`);
  });
}

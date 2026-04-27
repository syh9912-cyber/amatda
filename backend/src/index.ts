import express from 'express';
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
app.use(express.json({ limit: '10mb' }));
setupSecurity(app);

app.use('/api/auth', authRoutes);
app.use('/api/children', childRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/food-guide', foodRoutes);
app.use('/api/observations', observationRoutes);
app.use('/api/academies', academyRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
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

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'api', version: '1.0.0', timestamp: new Date().toISOString() } });
});

/* ─── /api/coaching 안전망 마운트 ───
 *
 * 정석은 coachingApi 함수가 /api/coaching/* 를 처리하는 것 (메모리 1GB).
 * 그러나 이전 빌드/번들이 EXPO_PUBLIC_COACHING_API_URL 누락으로
 * 메인 api URL을 호출할 수 있음 (fallback to API_URL).
 *
 * 그 케이스에서도 코칭이 끊기지 않도록 메인 api에도 /api/coaching 마운트.
 * EAS Cloud env 정비 + 신규 빌드 배포 후에는 트래픽이 자연스럽게
 * coachingApi 함수로 옮겨감 (메모리 분리 효과 회복).
 */
app.use('/api/coaching', coachingRoutes);

/* ─── 로컬 개발용 (devApp 통합 — 위에서 이미 마운트됨) ─── */
const isFirebase = process.env.FUNCTIONS_EMULATOR || process.env.GCLOUD_PROJECT || process.env.K_SERVICE;

/* ─── 코칭 전용 Express ─── */
const coachingApp = express();
coachingApp.use(express.json({ limit: '10mb' }));
setupSecurity(coachingApp);
coachingApp.use('/api/coaching', coachingRoutes);
coachingApp.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'coachingApi', version: '1.0.0', timestamp: new Date().toISOString() } });
});

/* ─── Firebase Functions exports ─── */

// memory: 512MiB — 비코칭 라우트는 가벼운 CRUD가 다수
// concurrency: 20 — 동시 요청 과다 시 메모리 스파이크 방지
export const api = functions.https.onRequest(
  {
    cors: true,
    invoker: 'public',
    memory: '512MiB',
    concurrency: 20,
    timeoutSeconds: 300,
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

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
app.use('/api/coaching', coachingRoutes);
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
  res.json({ success: true, data: { status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() } });
});

// Firebase Functions export (public access)
// memory: 512MiB — 코칭 지식 DB(~900KB) + Express + Gemini 버퍼가 기본 256MiB 초과
// concurrency: 20 — 동시 요청 과다 시 메모리 스파이크 방지 (기본 80 → 20)
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

// 로컬 개발용 (firebase deploy 시에는 실행하지 않음)
const isFirebase = process.env.FUNCTIONS_EMULATOR || process.env.GCLOUD_PROJECT || process.env.K_SERVICE;
if (!isFirebase && require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`아맞다 Backend running on http://localhost:${env.PORT}`);
  });
}

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
import seedRoutes from './routes/seed';
import momstagramRoutes from './routes/momstagram';

const app = express();

app.use(express.json());
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
app.use('/api/seed', seedRoutes);
app.use('/api/momstagram', momstagramRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() } });
});

// Firebase Functions export (public access)
export const api = functions.https.onRequest(
  { cors: true, invoker: 'public' },
  app
);

// 로컬 개발용 (firebase deploy 시에는 실행하지 않음)
const isFirebase = process.env.FUNCTIONS_EMULATOR || process.env.GCLOUD_PROJECT || process.env.K_SERVICE;
if (!isFirebase && require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`아맞다 Backend running on http://localhost:${env.PORT}`);
  });
}

import express from 'express';
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

const app = express();

// Middleware
app.use(express.json());
setupSecurity(app);

// Routes
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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.listen(env.PORT, () => {
  console.log(`🚀 아맞다 Backend running on http://localhost:${env.PORT}`);
});

export default app;

import express from 'express';
import { env } from './config/env';
import { setupSecurity } from './middleware/security';
import authRoutes from './routes/auth';
import childRoutes from './routes/child';
import questionRoutes from './routes/question';
import foodRoutes from './routes/food';
import observationRoutes from './routes/observation';

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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.listen(env.PORT, () => {
  console.log(`🚀 아맞다 Backend running on http://localhost:${env.PORT}`);
});

export default app;

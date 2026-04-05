import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.APP_PORT || process.env.PORT || '3001', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  MOCK_AI: process.env.MOCK_AI === 'true',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  MOCK_SOCIAL: process.env.MOCK_SOCIAL === 'true',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY || '',
  NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID || '',
  NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET || '',
};

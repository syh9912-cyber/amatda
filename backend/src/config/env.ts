import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  MOCK_AI: process.env.MOCK_AI === 'true',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
};

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Express } from 'express';

export function setupSecurity(app: Express): void {
  app.set('trust proxy', true);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.openai.com'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    xssFilter: true,
  }));

  app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }));

  // General rate limit
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      standardHeaders: true,
      legacyHeaders: false,
      validate: false,
    })
  );

  // Stricter rate limit for auth endpoints
  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      message: { success: false, error: '인증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      standardHeaders: true,
      legacyHeaders: false,
      validate: false,
    })
  );
}

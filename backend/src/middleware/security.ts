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
        connectSrc: ["'self'"],
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

  // CORS 화이트리스트 — RN 모바일 앱은 Origin 헤더 자체를 보내지 않으므로 영향 없음.
  // 영향 범위: 웹 브라우저에서 직접 호출 (출산가방 공유 페이지가 같은 호스트라 무관).
  // - http(s)://localhost:* 은 로컬 개발용
  // - 운영 호스트는 명시 추가 (admin 콘솔, 추후 웹앱 등)
  // 환경변수 CORS_EXTRA_ORIGINS (콤마구분) 으로 동적 추가 가능.
  const allowedOrigins = new Set<string>([
    'https://amatda-parenting.web.app',
    'https://amatda-parenting.firebaseapp.com',
    ...(process.env.CORS_EXTRA_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ]);
  app.use(cors({
    origin: (origin, cb) => {
      // origin === undefined: 같은-출처 요청 또는 Origin 헤더 없는 클라이언트(모바일 앱) → 허용
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      // 로컬 개발 (localhost / 127.0.0.1 / Expo dev client)
      if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS: origin not allowed: ${origin}`));
    },
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

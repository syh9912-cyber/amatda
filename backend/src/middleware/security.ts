import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Express, Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * rate-limit keyGenerator 전용: Authorization 헤더의 JWT 를 가볍게 디코드해
 * userId 만 추출 (DB 미접근). 위변조/만료된 토큰은 그냥 IP 키로 fallback.
 *
 * 배경: rate-limit 미들웨어는 라우터 단에 mount 되어 authMiddleware 보다
 *   먼저 실행됨 → req.userId 가 비어 있어 항상 IP 키로 떨어졌음. 한국 모바일
 *   통신사 CG-NAT 환경에서는 다수 사용자가 같은 IP 로 묶여 false rate-limit
 *   가능성. 인증 자체는 각 핸들러의 authMiddleware 가 담당하므로 이 함수는
 *   "키 산출"만 책임지며 위변조 토큰을 신뢰하지 않는다.
 */
function rateLimitUserKey(req: Request): string {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      // 알고리즘/issuer/audience 핀 — auth middleware 와 동일 정책 (#1 보안 강화)
      const payload = jwt.verify(header.slice(7), env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'amatda-api',
        audience: 'amatda-app',
      }) as { userId?: string };
      if (payload?.userId) return `user:${payload.userId}`;
    } catch {
      // 만료/위변조 → IP 키 fallback
    }
  }
  return `ip:${req.ip}`;
}

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
  // 영향 범위: 웹 브라우저에서 직접 호출.
  // - http(s)://localhost:* 은 로컬 개발용
  // - 운영 호스트는 명시 추가 (admin 콘솔, 추후 웹앱 등)
  // - 백엔드 자체에서 호스팅하는 페이지(출산가방 공유 등)는 모바일 브라우저가
  //   same-origin POST + Content-Type:json 에서도 preflight 를 보내는 케이스가
  //   있어, 자기 호스트도 명시 허용해야 함 (운영 로그 2026-05-03 CORS 거부 발생).
  // 환경변수 CORS_EXTRA_ORIGINS (콤마구분) 으로 동적 추가 가능.
  const allowedOrigins = new Set<string>([
    'https://amatda-parenting.web.app',
    'https://amatda-parenting.firebaseapp.com',
    'https://api-usglfifguq-uc.a.run.app',         // api 함수 자기 호스트 (출산가방 공유 페이지 등)
    'https://coachingapi-usglfifguq-uc.a.run.app', // coachingApi 함수 자기 호스트
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
      // Cloud Functions / Cloud Run 자기 자신 (변동 가능한 hash 호스트) — *.a.run.app, *.cloudfunctions.net
      // birthbag-share 같이 백엔드가 직접 호스팅하는 페이지가 fetch 시 same-origin preflight 통과시키기 위함.
      if (/^https:\/\/[a-z0-9-]+\.(a\.run\.app|cloudfunctions\.net)$/.test(origin)) {
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

  // Auth rate limit — CG-NAT(한국 모바일 통신사) 환경에서 같은 외부 IP 다수 사용자 공유.
  //   기존 30/15분 → 다중 사용자 빠르게 폭주 + /me 빈도 호출도 카운트되어 정상 사용 차단.
  //   완화책: 200/15분 + /me 제외(자체 빈도 제한 자료 없음).
  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: { success: false, error: '인증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      standardHeaders: true,
      legacyHeaders: false,
      validate: false,
      // /me 는 화면 전환마다 호출되는 idempotent GET — rate limit 카운트 제외.
      skip: (req) => req.path === '/me' || req.path.startsWith('/me/'),
    })
  );

  // Upload rate limit — 사용자당 1시간 30회 (대용량 파일 남용 방지)
  app.use(
    '/api/upload',
    rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 30,
      keyGenerator: rateLimitUserKey,
      message: { success: false, error: '업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      standardHeaders: true,
      legacyHeaders: false,
      validate: false,
    })
  );

  // Stricter rate limit for coaching (Gemini billable). 사용자당 분리.
  // keyGenerator 가 JWT 를 직접 디코드해 userId 추출 (DB 무접근). 한국 모바일
  // CG-NAT 환경에서 IP 충돌로 false rate-limit 되는 문제 방지.
  app.use(
    '/api/coaching',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 60, // 사용자당 15분 60회 (4초당 1회 평균)
      keyGenerator: rateLimitUserKey,
      message: { success: false, error: 'AI 코칭 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      standardHeaders: true,
      legacyHeaders: false,
      validate: false,
    })
  );
}

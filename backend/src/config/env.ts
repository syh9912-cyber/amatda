import dotenv from 'dotenv';
dotenv.config();

// JWT 시크릿은 환경(prod/dev) 관계없이 반드시 설정. 프로덕션 자동 감지 의존 시
// K_SERVICE/GCLOUD_PROJECT 가 누락되면 약한 dev 시크릿으로 폴백되는 위험이 있어
// fail-closed: env 가 없으면 무조건 throw.
const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
if (!jwtSecret || !jwtRefreshSecret) {
  throw new Error(
    'FATAL: JWT_SECRET / JWT_REFRESH_SECRET 환경변수가 설정되지 않았습니다. ' +
    '로컬 개발: backend/.env 에 강한 무작위 값으로 지정. ' +
    '프로덕션: Cloud Run/Functions secret 으로 등록.'
  );
}

// 여권(passport) 공개 링크 해시용 salt. 유출 시 임의 아이 여권 조회가 가능하므로
// fallback 하드코딩 금지 — 미설정 시 서버 기동 자체를 실패시킨다(fail-closed).
const passportSalt = process.env.PASSPORT_SALT;
if (!passportSalt) {
  throw new Error('FATAL: PASSPORT_SALT 환경변수가 설정되지 않았습니다.');
}

/**
 * 여권 salt getter. 호출 시점에 미설정이면 throw 한다.
 * (로컬 개발 환경에서도 PASSPORT_SALT 를 반드시 .env 에 지정해야 한다.)
 */
export function getPassportSalt(): string {
  const salt = process.env.PASSPORT_SALT;
  if (!salt) {
    throw new Error('PASSPORT_SALT 환경변수가 설정되지 않았습니다.');
  }
  return salt;
}

export const env = {
  PORT: parseInt(process.env.APP_PORT || process.env.PORT || '3001', 10),
  JWT_SECRET: jwtSecret, // 위에서 throw 보장 — 항상 정의됨
  JWT_REFRESH_SECRET: jwtRefreshSecret, // 위에서 throw 보장
  MOCK_AI: process.env.MOCK_AI === 'true',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  MOCK_SOCIAL: process.env.MOCK_SOCIAL === 'true',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  KAKAO_JAVASCRIPT_KEY: process.env.KAKAO_JAVASCRIPT_KEY || '',
  KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY || '',
  KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET || '',
  KAKAO_ADMIN_KEY: process.env.KAKAO_ADMIN_KEY || '',
  NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID || '',
  NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET || '',

  // ─── 결제 (Phase 1, 키 발급 후 채움) ───
  // PortOne v2 (https://portone.io)
  PORTONE_STORE_ID: process.env.PORTONE_STORE_ID || '',           // store-XXXX
  PORTONE_API_SECRET: process.env.PORTONE_API_SECRET || '',       // 서버용 시크릿
  PORTONE_WEBHOOK_SECRET: process.env.PORTONE_WEBHOOK_SECRET || '',
  // 채널 키 (PortOne 콘솔에서 PG/간편결제별 발급)
  PORTONE_CHANNEL_KEY_TOSS: process.env.PORTONE_CHANNEL_KEY_TOSS || '',
  PORTONE_CHANNEL_KEY_KAKAO: process.env.PORTONE_CHANNEL_KEY_KAKAO || '',
  PORTONE_CHANNEL_KEY_NAVER: process.env.PORTONE_CHANNEL_KEY_NAVER || '',

  // Google Play Billing — 영수증 검증용 서비스 계정 JSON (전체 JSON 한 줄로 인코딩)
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '',
  GOOGLE_PLAY_PACKAGE_NAME: process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.sylabs.amatda',

  // Apple App Store — App Store Server API
  APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID || 'com.sylabs.amatda',
  APPLE_ISSUER_ID: process.env.APPLE_ISSUER_ID || '',
  APPLE_KEY_ID: process.env.APPLE_KEY_ID || '',
  APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY || '',           // .p8 파일 내용
  APPLE_SHARED_SECRET: process.env.APPLE_SHARED_SECRET || '',       // (구) shared secret 방식 사용 시
};

/** 결제 시스템 사용 가능 여부 (실제 키가 등록되어 있는지) */
export function isPortOneAvailable(): boolean {
  return !!process.env.PORTONE_STORE_ID && !!process.env.PORTONE_API_SECRET;
}

export function isGooglePlayBillingAvailable(): boolean {
  return !!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
}

export function isAppleIAPAvailable(): boolean {
  return !!process.env.APPLE_ISSUER_ID && !!process.env.APPLE_KEY_ID && !!process.env.APPLE_PRIVATE_KEY;
}

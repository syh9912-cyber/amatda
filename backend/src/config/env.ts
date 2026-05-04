import dotenv from 'dotenv';
// 운영(Cloud Functions): backend/.env 는 일반 env (APP_PORT 등), secret 은 Secret Manager.
// 로컬 개발: backend/.env (일반) + backend/.env.local (secret) 둘 다 로드.
//   .env.local 은 git/deploy 모두 ignore — 로컬 개발자별 secret 보관용.
//   override:true 로 .env.local 가 우선 (.env 와 같은 키가 있으면 .env.local 값 사용).
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

/**
 * Secret Manager 값 trim — Firebase Secret 업로드 시 trailing newline 이 들어가는 경우가 있어
 * 비교 (e.g. info.aud !== env.GOOGLE_CLIENT_ID) 가 실패함. 모든 env 값을 안전하게 trim.
 * 이전 TOKEN_ENCRYPTION_KEY 도 같은 문제 (utils/crypto.ts 에서 별도 trim) — 여기서 일괄 처리.
 */
const E = (key: string, fallback = ''): string => (process.env[key] ?? fallback).trim();

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
  /**
   * Google OAuth 메인 client_id (web/server 용).
   * Android/iOS 앱은 별도 client_id를 가질 수 있어 GOOGLE_ALLOWED_AUDIENCES 로 보완.
   */
  GOOGLE_CLIENT_ID: E('GOOGLE_CLIENT_ID'),
  /**
   * Google OAuth 허용 audience 목록 — 콤마(,) 구분.
   * 예: "ANDROID_CLIENT_ID,IOS_CLIENT_ID" — 모바일 앱 client_id 들 등록.
   * GOOGLE_CLIENT_ID 외에도 이 목록의 client_id 가 token 의 aud/azp 에 매칭되면 통과.
   * 미설정 시 GOOGLE_CLIENT_ID 만 검사 (기존 동작 유지).
   */
  GOOGLE_ALLOWED_AUDIENCES: E('GOOGLE_ALLOWED_AUDIENCES'),
  KAKAO_JAVASCRIPT_KEY: E('KAKAO_JAVASCRIPT_KEY'),
  KAKAO_REST_API_KEY: E('KAKAO_REST_API_KEY'),
  KAKAO_CLIENT_SECRET: E('KAKAO_CLIENT_SECRET'),
  KAKAO_ADMIN_KEY: E('KAKAO_ADMIN_KEY'),
  /**
   * Kakao Developers 콘솔 → 내 애플리케이션 → 앱 키 페이지의 "ID" 값 (정수).
   * Kakao /v1/user/access_token_info 응답의 app_id 와 strict 비교 — 다른 카카오 앱 토큰 거부 (#3 보안).
   * 미설정 시 strict 검증 비활성 (개발환경 호환).
   */
  KAKAO_APP_ID: E('KAKAO_APP_ID'),
  NAVER_CLIENT_ID: E('NAVER_CLIENT_ID'),
  NAVER_CLIENT_SECRET: E('NAVER_CLIENT_SECRET'),

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

  // ─── Webhook 인증 ───
  // Google Pub/Sub Push subscription 의 OIDC JWT audience.
  // 일반적으로 webhook URL (예: https://api-XXXX-uc.a.run.app/api/payment/webhook/google)
  // 또는 Pub/Sub subscription 생성 시 명시한 oidc_token.audience 값.
  // 미설정 시 Google webhook 은 모두 거부 (fail-closed).
  GOOGLE_PUBSUB_AUDIENCE: process.env.GOOGLE_PUBSUB_AUDIENCE || '',
  // 선택: Pub/Sub push 가 사용하는 service account email — 설정 시 sub claim 도 검증.
  GOOGLE_PUBSUB_SA_EMAIL: process.env.GOOGLE_PUBSUB_SA_EMAIL || '',
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

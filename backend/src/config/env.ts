import dotenv from 'dotenv';
dotenv.config();

// 프로덕션에서 JWT 시크릿 미설정 시 서버 시작 차단
const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
const isProduction = !!process.env.K_SERVICE || !!process.env.GCLOUD_PROJECT;
if (isProduction && (!jwtSecret || !jwtRefreshSecret)) {
  throw new Error('FATAL: JWT_SECRET / JWT_REFRESH_SECRET 환경변수가 설정되지 않았습니다.');
}

// 여권(passport) 공개 링크 해시용 salt. 유출 시 임의 아이 여권 조회가 가능하므로
// fallback 하드코딩 금지 — 미설정 시 서버 기동 자체를 실패시킨다(fail-closed).
const passportSalt = process.env.PASSPORT_SALT;
if (isProduction && !passportSalt) {
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
  JWT_SECRET: jwtSecret || 'dev-secret-local-only',
  JWT_REFRESH_SECRET: jwtRefreshSecret || 'dev-refresh-secret-local-only',
  MOCK_AI: process.env.MOCK_AI === 'true',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  MOCK_SOCIAL: process.env.MOCK_SOCIAL === 'true',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  KAKAO_JAVASCRIPT_KEY: process.env.KAKAO_JAVASCRIPT_KEY || '',
  KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY || '',
  KAKAO_CLIENT_SECRET: process.env.KAKAO_CLIENT_SECRET || '',
  NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID || '',
  NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET || '',
};

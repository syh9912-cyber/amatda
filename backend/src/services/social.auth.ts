import { env } from '../config/env';
import { createPublicKey } from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export type SocialProvider = 'GOOGLE' | 'KAKAO' | 'NAVER' | 'APPLE';

/**
 * 토큰 거부(만료·위조·다른 앱 토큰 등) — 사용자가 재로그인하면 풀리는 상황.
 *
 * 배경(2026-07-18): 토큰 검증 실패를 statusCode 마커 없는 plain Error 로 던지고 있어서
 * auth.ts 의 4xx 분기(`status >= 400 && status < 500`)가 절대 참이 되지 않았고, 정상적인
 * 토큰 거부까지 전부 500 + logger.error 로 떨어졌다. 그 결과 (a) 토큰이 만료된 실사용자가
 * "다시 로그인해주세요" 대신 "오류가 발생했습니다"를 보고 이탈하고, (b) 평범한 토큰 만료가
 * error 로그로 쌓여 진짜 장애를 가렸다.
 *
 * 상세 사유는 여기서 warn 으로 남기고, 클라이언트에는 안전한 문구만 전달한다
 * (app_id·project_id·provider 에러바디 등 내부 정보 노출 방지).
 */
function tokenRejected(provider: string, detail: string): Error & { statusCode: number } {
  logger.warn(`social.auth/${provider}`, detail);
  const err = new Error(
    '소셜 로그인 인증이 만료되었거나 유효하지 않아요. 다시 로그인해주세요.',
  ) as Error & { statusCode: number };
  err.statusCode = 401;
  return err;
}

export interface SocialUserInfo {
  provider: SocialProvider;
  socialId: string;
  email: string | null;
  name: string | null;
  accessToken: string;  // unlink 시 사용 (관리자 키 없는 provider용)
}

/** Mock 소셜 인증 응답 */
function mockSocialUser(provider: SocialProvider): SocialUserInfo {
  const mockId = `mock_${provider.toLowerCase()}_${Date.now()}`;
  return {
    provider,
    socialId: mockId,
    email: `${provider.toLowerCase()}_user@mock.amatda.com`,
    name: `${provider} 테스트 유저`,
    accessToken: 'mock_access_token',
  };
}

/**
 * Google 토큰 검증 — tokeninfo 로 audience(client_id) 확인 후 userinfo 조회.
 * 다른 GCP 앱의 access_token 으로 우리 사용자 가장 시도 차단.
 */
async function verifyGoogleToken(accessToken: string): Promise<SocialUserInfo> {
  // 1. audience 검증 — 우리 GOOGLE_CLIENT_ID 또는 같은 GCP 프로젝트의 client_id 면 허용.
  //
  //   배경: 같은 GCP 프로젝트 안에 Web/Android/iOS 별로 client_id 가 따로 발급됨.
  //   GoogleSignin 네이티브 SDK 가 반환하는 access_token 의 aud/azp 는 webClientId 가
  //   아니라 Android(또는 iOS) 자동 발급 client_id 일 수 있음.
  //
  //   보안: project_id 가 같으면 우리 앱(같은 GCP 프로젝트) 임. 다른 프로젝트 토큰은 거부.
  //   추가 강화: 명시 GOOGLE_ALLOWED_AUDIENCES 가 설정되면 strict 매칭 우선 사용.
  if (env.GOOGLE_CLIENT_ID) {
    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    if (!infoRes.ok) throw tokenRejected('google', 'Google 토큰 audience 검증 실패');
    const info = await infoRes.json() as { aud?: string; azp?: string };

    // GCP project_id 추출 — Google client_id 형식: `{PROJECT_NUMBER}-{UNIQUE}.apps.googleusercontent.com`
    const projectIdOf = (id: string | undefined): string | null => {
      if (!id) return null;
      const m = id.match(/^(\d+)-[^.]+\.apps\.googleusercontent\.com$/);
      return m ? m[1] : null;
    };
    const ourProjectId = projectIdOf(env.GOOGLE_CLIENT_ID);
    if (!ourProjectId) {
      throw new Error('서버 GOOGLE_CLIENT_ID 형식 오류');
    }
    const audProject = projectIdOf(info.aud);
    const azpProject = projectIdOf(info.azp);

    // 명시 strict 허용 목록 (있으면 같이 검사)
    const strictAllowed = new Set<string>();
    strictAllowed.add(env.GOOGLE_CLIENT_ID);
    if (env.GOOGLE_ALLOWED_AUDIENCES) {
      env.GOOGLE_ALLOWED_AUDIENCES.split(',').map((s) => s.trim()).filter(Boolean).forEach((id) => strictAllowed.add(id));
    }
    const strictMatch = (info.aud && strictAllowed.has(info.aud)) || (info.azp && strictAllowed.has(info.azp));
    const projectMatch = audProject === ourProjectId || azpProject === ourProjectId;

    if (!strictMatch && !projectMatch) {
      // PII 안전 진단 — project_id 만 서버 로그에 남김 (클라이언트에는 안전 문구만)
      throw tokenRejected(
        'google',
        `Google 토큰 audience 불일치 — expected project=${ourProjectId}, got audProject=${audProject} azpProject=${azpProject}`,
      );
    }
  }
  // 2. 사용자 정보 조회
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw tokenRejected('google', 'Google userinfo 조회 실패 — 토큰 만료·무효 추정');
  const data = await res.json() as { sub: string; email?: string; email_verified?: boolean; name?: string };
  return {
    provider: 'GOOGLE',
    socialId: data.sub,
    // email_verified=false 이면 email 신뢰 X (가짜 이메일로 자동 연결 방지)
    email: data.email_verified ? (data.email ?? null) : null,
    name: data.name ?? null,
    accessToken,
  };
}

/**
 * Kakao 토큰 검증 — access_token_info 로 app_id 확인 후 사용자 정보 조회.
 * 다른 카카오 앱의 access_token 으로 우리 사용자 가장 시도 차단.
 */
async function verifyKakaoToken(accessToken: string): Promise<SocialUserInfo> {
  // 1. app_id 검증 — strict equality (#3 보안 강화)
  if (env.KAKAO_REST_API_KEY) {
    const infoRes = await fetch('https://kapi.kakao.com/v1/user/access_token_info', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) throw tokenRejected('kakao', '카카오 access_token_info 조회 실패 — 토큰 만료·무효 추정');
    const info = await infoRes.json() as { app_id?: number };
    if (!info.app_id) {
      throw tokenRejected('kakao', '카카오 토큰 app_id 불명 — 의심스러운 토큰');
    }
    // KAKAO_APP_ID 환경변수가 설정돼 있으면 strict 비교 — 다른 카카오 앱 토큰 거부.
    // 미설정 시 (개발환경 등) 0/null 만 차단.
    if (env.KAKAO_APP_ID) {
      const expectedAppId = Number.parseInt(env.KAKAO_APP_ID, 10);
      if (Number.isNaN(expectedAppId)) {
        throw new Error('서버 설정 오류: KAKAO_APP_ID 가 정수가 아닙니다');
      }
      if (info.app_id !== expectedAppId) {
        // 받은 app_id 는 서버 로그에만 (클라이언트 노출 금지)
        throw tokenRejected('kakao', `카카오 토큰 app_id 불일치 — 다른 앱 토큰 거부 (받음: ${info.app_id})`);
      }
    }
  }
  // 2. 사용자 정보 조회
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw tokenRejected('kakao', '카카오 user/me 조회 실패 — 토큰 만료·무효 추정');
  const data = await res.json() as {
    id: number;
    kakao_account?: {
      email?: string;
      is_email_valid?: boolean;
      is_email_verified?: boolean;
      profile?: { nickname?: string };
    };
  };
  // 카카오 email 은 is_email_verified=true 인 경우만 신뢰 (자동 연결 takeover 방지)
  const ka = data.kakao_account;
  const trustedEmail = ka?.email && ka?.is_email_valid !== false && ka?.is_email_verified === true
    ? ka.email
    : null;
  return {
    provider: 'KAKAO',
    socialId: String(data.id),
    email: trustedEmail,
    name: ka?.profile?.nickname ?? null,
    accessToken,
  };
}

/** Naver 토큰 검증 — verify endpoint 로 client_id 확인 후 사용자 조회 (#4 보안 강화) */
async function verifyNaverToken(accessToken: string): Promise<SocialUserInfo> {
  const res = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw tokenRejected('naver', '네이버 nid/me 조회 실패 — 토큰 만료·무효 추정');
  // resultcode/message 같이 받아 정상 응답인지 추가 검증
  const data = await res.json() as {
    resultcode?: string;
    message?: string;
    response?: { id?: string; email?: string; name?: string };
  };
  if (data.resultcode !== '00' || !data.response?.id) {
    // provider 에러 메시지는 서버 로그에만 (클라이언트 노출 금지)
    throw tokenRejected('naver', `네이버 토큰 검증 실패: ${data.message ?? 'unknown'}`);
  }
  /**
   * 네이버는 verifyIdToken 같은 명시 audience 검증 endpoint 가 없지만,
   * `id` 필드는 NAVER_CLIENT_ID 별로 namespace 가 분리됨 — 같은 네이버 사용자라도
   * 우리 앱의 NAVER_CLIENT_ID 와 다른 앱에서 받은 토큰의 id 는 다른 값.
   * 따라서 **다른 네이버 앱 토큰으로 우리 user 의 socialId 와 매칭되는 충돌은 사실상 불가능.**
   *
   * 추가 방어: email 은 네이버에서 검증된 경우만 사용. (네이버는 가입 시 email 인증)
   * email 이 없거나 검증 안된 경우 socialId 만으로 사용자 매칭.
   */
  return {
    provider: 'NAVER',
    socialId: data.response.id,
    email: data.response.email ?? null,
    name: data.response.name ?? null,
    accessToken,
  };
}

/**
 * Apple Sign In 검증 — identityToken(RS256 JWT)을 Apple 공개키(JWKS)로 검증.
 * 정석: 서명 검증 + iss(Apple) + aud(우리 bundleId) + exp(jwt.verify 자동) 확인.
 * 다른 앱용으로 발급된 Apple 토큰으로 우리 사용자 가장 차단.
 *
 * aud 는 네이티브 Sign in with Apple 에서 앱 bundleId. (공개값 — 시크릿 아님)
 */
const APPLE_AUD = 'com.sylabs.amatda';
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_KEYS_TTL_MS = 60 * 60 * 1000; // 공개키 1시간 캐시

interface AppleJwk { kty: string; kid: string; use: string; alg: string; n: string; e: string; }
let appleKeysCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;

async function fetchAppleKeys(): Promise<AppleJwk[]> {
  const res = await fetch(APPLE_KEYS_URL);
  if (!res.ok) throw new Error('Apple 공개키 조회 실패');
  const data = await res.json() as { keys: AppleJwk[] };
  appleKeysCache = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

async function getAppleSigningKey(kid: string): Promise<AppleJwk> {
  let keys = (appleKeysCache && Date.now() - appleKeysCache.fetchedAt < APPLE_KEYS_TTL_MS)
    ? appleKeysCache.keys
    : await fetchAppleKeys();
  let key = keys.find((k) => k.kid === kid);
  if (!key) {
    // kid 회전 가능 — 캐시 무시하고 1회 강제 갱신 후 재탐색
    keys = await fetchAppleKeys();
    key = keys.find((k) => k.kid === kid);
  }
  if (!key) throw tokenRejected('apple', 'Apple 토큰 서명 키(kid) 불일치');
  return key;
}

async function verifyAppleToken(identityToken: string): Promise<SocialUserInfo> {
  // 1) 헤더에서 kid 추출
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header?.kid) {
    throw tokenRejected('apple', 'Apple identityToken 형식 오류');
  }
  // 2) Apple 공개키로 서명 + iss/aud/exp 검증
  const jwk = await getAppleSigningKey(decoded.header.kid);
  // Node 내장 crypto 로 JWK→공개키 (새 의존성 없이). JsonWebKey 전역 타입 부재 → 파라미터 타입으로 캐스팅.
  const pubKey = createPublicKey(
    { key: jwk, format: 'jwk' } as unknown as Parameters<typeof createPublicKey>[0],
  );
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(identityToken, pubKey, {
      algorithms: ['RS256'],
      issuer: APPLE_ISSUER,
      audience: APPLE_AUD,
    }) as jwt.JwtPayload;
  } catch (e) {
    throw tokenRejected('apple', `Apple 토큰 검증 실패: ${e instanceof Error ? e.message : 'unknown'}`);
  }
  if (!payload.sub) throw tokenRejected('apple', 'Apple 토큰에 sub(사용자 식별자) 없음');
  // email 은 email_verified=true 인 경우만 신뢰 (가짜 이메일 자동 연결 takeover 방지)
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  const email = (emailVerified && typeof payload.email === 'string') ? payload.email : null;
  return {
    provider: 'APPLE',
    socialId: payload.sub,            // Apple 고유 사용자 ID (앱별 namespace)
    email,
    name: null,                       // Apple 토큰엔 이름 미포함 (최초 1회 네이티브 응답에만)
    accessToken: identityToken,       // unlink 미사용 — 저장만
  };
}

/** 소셜 프로바이더별 토큰 검증 통합 */
export async function verifySocialToken(
  provider: SocialProvider,
  accessToken: string
): Promise<SocialUserInfo> {
  if (env.MOCK_SOCIAL) {
    return mockSocialUser(provider);
  }

  switch (provider) {
    case 'GOOGLE': return verifyGoogleToken(accessToken);
    case 'KAKAO': return verifyKakaoToken(accessToken);
    case 'NAVER': return verifyNaverToken(accessToken);
    case 'APPLE': return verifyAppleToken(accessToken);
    default: throw new Error(`지원하지 않는 소셜 프로바이더: ${provider}`);
  }
}

// ──────────────────────────────────────────────────────────
// Authorization Code -> Access Token 교환 (서버사이드)
// ──────────────────────────────────────────────────────────

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

interface NaverTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

/** Kakao 인가 코드 -> 액세스 토큰 교환 */
async function exchangeKakaoCode(
  code: string,
  redirectUri: string,
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.KAKAO_REST_API_KEY,
    redirect_uri: redirectUri,
    code,
  });

  // client_secret이 설정된 경우에만 포함
  if (env.KAKAO_CLIENT_SECRET) {
    params.set('client_secret', env.KAKAO_CLIENT_SECRET);
  }

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    // 인가 코드 만료·재사용·redirect_uri 불일치 = 사용자 재시도로 풀림. provider 에러바디는 로그에만.
    const errBody = await res.text();
    throw tokenRejected('kakao', `카카오 토큰 교환 실패: ${errBody}`);
  }

  const data = (await res.json()) as KakaoTokenResponse;
  return data.access_token;
}

/** Naver 인가 코드 -> 액세스 토큰 교환 */
async function exchangeNaverCode(
  code: string,
  redirectUri: string,
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.NAVER_CLIENT_ID,
    client_secret: env.NAVER_CLIENT_SECRET,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch('https://nid.naver.com/oauth2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    // 인가 코드 만료·재사용·redirect_uri 불일치 = 사용자 재시도로 풀림. provider 에러바디는 로그에만.
    const errBody = await res.text();
    throw tokenRejected('naver', `네이버 토큰 교환 실패: ${errBody}`);
  }

  const data = (await res.json()) as NaverTokenResponse;
  return data.access_token;
}

/**
 * 인가 코드 -> 토큰 교환 -> 사용자 정보 조회 통합
 * 프론트에서 client_secret 없이 인가 코드만 받아 백엔드에서 처리
 */
export async function exchangeCodeAndVerify(
  provider: SocialProvider,
  code: string,
  redirectUri: string,
): Promise<SocialUserInfo> {
  if (env.MOCK_SOCIAL) {
    return mockSocialUser(provider);
  }

  let accessToken: string;

  switch (provider) {
    case 'KAKAO':
      accessToken = await exchangeKakaoCode(code, redirectUri);
      break;
    case 'NAVER':
      accessToken = await exchangeNaverCode(code, redirectUri);
      break;
    default:
      throw new Error(
        `${provider}는 코드 교환 방식을 지원하지 않습니다. accessToken으로 /auth/social을 사용하세요.`,
      );
  }

  // 교환된 토큰으로 사용자 정보 조회 (accessToken은 verifySocialToken 결과에 포함됨)
  return verifySocialToken(provider, accessToken);
}

// ──────────────────────────────────────────────────────────
// 소셜 계정 연결 끊기 (탈퇴 시 호출)
// ──────────────────────────────────────────────────────────

/**
 * 카카오 unlink — Admin Key 우선, 없으면 사용자 access_token으로 시도.
 * https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#unlink
 */
async function unlinkKakao(socialId: string, accessToken: string | null): Promise<void> {
  if (env.KAKAO_ADMIN_KEY) {
    const params = new URLSearchParams({ target_id_type: 'user_id', target_id: socialId });
    const res = await fetch('https://kapi.kakao.com/v1/user/unlink', {
      method: 'POST',
      headers: {
        Authorization: `KakaoAK ${env.KAKAO_ADMIN_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`카카오 admin unlink 실패: ${res.status} ${body}`);
    }
    return;
  }
  if (accessToken) {
    const res = await fetch('https://kapi.kakao.com/v1/user/unlink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`카카오 user unlink 실패: ${res.status} ${body}`);
    }
  }
}

/**
 * 네이버 unlink — grant_type=delete + 사용자 access_token.
 * https://developers.naver.com/docs/login/devguide/devguide.md#3-4-3-네이버-로그인-연동-해제하기
 */
async function unlinkNaver(accessToken: string | null): Promise<void> {
  if (!accessToken) throw new Error('네이버 unlink: access_token 없음');
  const params = new URLSearchParams({
    grant_type: 'delete',
    client_id: env.NAVER_CLIENT_ID,
    client_secret: env.NAVER_CLIENT_SECRET,
    access_token: accessToken,
    service_provider: 'NAVER',
  });
  const res = await fetch(`https://nid.naver.com/oauth2.0/token?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`네이버 unlink 실패: ${res.status} ${body}`);
  }
}

/**
 * Google revoke — 사용자 access_token.
 * https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke
 */
async function revokeGoogle(accessToken: string | null): Promise<void> {
  if (!accessToken) throw new Error('Google revoke: access_token 없음');
  const res = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google revoke 실패: ${res.status} ${body}`);
  }
}

/** 소셜 계정 연결 끊기 통합 — 탈퇴 시 호출. 실패해도 user 삭제는 진행해야 하므로 호출부에서 try/catch. */
export async function unlinkSocialAccount(
  provider: SocialProvider,
  socialId: string,
  accessToken: string | null,
): Promise<void> {
  if (env.MOCK_SOCIAL) return;
  switch (provider) {
    case 'KAKAO': return unlinkKakao(socialId, accessToken);
    case 'NAVER': return unlinkNaver(accessToken);
    case 'GOOGLE': return revokeGoogle(accessToken);
    // Apple 토큰 revocation 은 별도 client_secret(.p8 서명 JWT)이 필요 — 탈퇴 시 user/데이터
    // 삭제로 충분(연결 끊김). 추후 Apple revoke(/auth/revoke) 보강 가능.
    case 'APPLE': return;
    default: throw new Error(`unlink 지원 안 됨: ${provider}`);
  }
}

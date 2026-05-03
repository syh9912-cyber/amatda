import { env } from '../config/env';

export type SocialProvider = 'GOOGLE' | 'KAKAO' | 'NAVER';

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

/** Google 토큰 검증 */
async function verifyGoogleToken(accessToken: string): Promise<SocialUserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Google 토큰 검증 실패');
  const data = await res.json() as { sub: string; email?: string; name?: string };
  return {
    provider: 'GOOGLE',
    socialId: data.sub,
    email: data.email ?? null,
    name: data.name ?? null,
    accessToken,
  };
}

/** Kakao 토큰 검증 (access token으로 사용자 정보 조회) */
async function verifyKakaoToken(accessToken: string): Promise<SocialUserInfo> {
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('카카오 토큰 검증 실패');
  const data = await res.json() as {
    id: number;
    kakao_account?: { email?: string; profile?: { nickname?: string } };
  };
  return {
    provider: 'KAKAO',
    socialId: String(data.id),
    email: data.kakao_account?.email ?? null,
    name: data.kakao_account?.profile?.nickname ?? null,
    accessToken,
  };
}

/** Naver 토큰 검증 */
async function verifyNaverToken(accessToken: string): Promise<SocialUserInfo> {
  const res = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('네이버 토큰 검증 실패');
  const data = await res.json() as {
    response: { id: string; email?: string; name?: string };
  };
  return {
    provider: 'NAVER',
    socialId: data.response.id,
    email: data.response.email ?? null,
    name: data.response.name ?? null,
    accessToken,
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
    const errBody = await res.text();
    throw new Error(`카카오 토큰 교환 실패: ${errBody}`);
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
    const errBody = await res.text();
    throw new Error(`네이버 토큰 교환 실패: ${errBody}`);
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
    default: throw new Error(`unlink 지원 안 됨: ${provider}`);
  }
}

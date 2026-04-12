import { env } from '../config/env';

export type SocialProvider = 'GOOGLE' | 'KAKAO' | 'NAVER';

export interface SocialUserInfo {
  provider: SocialProvider;
  socialId: string;
  email: string | null;
  name: string | null;
}

/** Mock 소셜 인증 응답 */
function mockSocialUser(provider: SocialProvider): SocialUserInfo {
  const mockId = `mock_${provider.toLowerCase()}_${Date.now()}`;
  return {
    provider,
    socialId: mockId,
    email: `${provider.toLowerCase()}_user@mock.amatda.com`,
    name: `${provider} 테스트 유저`,
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

  // 교환된 토큰으로 사용자 정보 조회
  return verifySocialToken(provider, accessToken);
}

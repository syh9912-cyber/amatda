import { env } from '../config/env';

export type SocialProvider = 'GOOGLE' | 'KAKAO' | 'NAVER';

export interface SocialUserInfo {
  provider: SocialProvider;
  socialId: string;
  email: string | null;
  name: string | null;
}

/** Mock 소셜 인증 응답 */
function mockSocialUser(provider: SocialProvider, accessToken: string): SocialUserInfo {
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

/** Kakao 토큰 검증 */
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
    return mockSocialUser(provider, accessToken);
  }

  switch (provider) {
    case 'GOOGLE': return verifyGoogleToken(accessToken);
    case 'KAKAO': return verifyKakaoToken(accessToken);
    case 'NAVER': return verifyNaverToken(accessToken);
    default: throw new Error(`지원하지 않는 소셜 프로바이더: ${provider}`);
  }
}

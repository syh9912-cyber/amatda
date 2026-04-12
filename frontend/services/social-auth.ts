import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import api from './api';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'GOOGLE' | 'KAKAO' | 'NAVER';

export interface SocialLoginResult {
  provider: SocialProvider;
  accessToken?: string;
  authCode?: string;
  redirectUri?: string;
  directLogin?: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    email: string;
    nickname: string | null;
    isNewUser: boolean;
  };
}

const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'amatda' });
const KAKAO_KEY = '0aa17590759470d930a9720d273b8a8f';
const KAKAO_CALLBACK = 'https://api-usglfifguq-uc.a.run.app/api/auth/kakao/callback';

/**
 * 카카오 로그인 — 인앱 브라우저 + 딥링크 자동복귀
 * 1. 인앱 브라우저(Custom Chrome Tab)로 카카오 로그인
 * 2. 백엔드가 토큰교환 + 로그인 완료 후 딥링크로 리디렉트
 * 3. 인앱 브라우저가 딥링크 감지 → 자동 닫힘 → 앱 복귀
 */
async function kakaoLogin(): Promise<SocialLoginResult | null> {
  const state = `kakao_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const appRedirect = 'amatda://auth/callback';

  const authUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${KAKAO_KEY}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_CALLBACK)}` +
    `&response_type=code` +
    `&state=${state}`;

  // 인앱 브라우저로 열기 (Custom Chrome Tab / SFSafariViewController)
  const result = await WebBrowser.openAuthSessionAsync(authUrl, appRedirect);

  if (result.type !== 'success' || !('url' in result)) return null;

  // 딥링크 URL에서 토큰 파싱
  const paramStr = result.url.split('?')[1] || '';
  const params = new URLSearchParams(paramStr);

  const errorMsg = params.get('error');
  if (errorMsg) return null;

  const accessToken = params.get('accessToken');
  const userId = params.get('userId');
  if (!accessToken || !userId) return null;

  return {
    provider: 'KAKAO',
    directLogin: {
      accessToken,
      refreshToken: params.get('refreshToken') || '',
      userId,
      email: params.get('email') || '',
      nickname: params.get('nickname') || null,
      isNewUser: params.get('isNewUser') === 'true',
    },
  };
}

/**
 * 구글/네이버 — AuthSession 방식
 */
async function authSessionLogin(provider: SocialProvider): Promise<SocialLoginResult | null> {
  const configs: Record<string, { clientId: string; authEndpoint: string; tokenEndpoint: string; scopes: string[] }> = {
    GOOGLE: {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
      authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      scopes: ['openid', 'profile', 'email'],
    },
    NAVER: {
      clientId: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || '',
      authEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
      tokenEndpoint: 'https://nid.naver.com/oauth2.0/token',
      scopes: [],
    },
  };

  const config = configs[provider];
  if (!config || !config.clientId) {
    return { provider, accessToken: `mock_token_${provider}_${Date.now()}` };
  }

  const discovery: AuthSession.DiscoveryDocument = {
    authorizationEndpoint: config.authEndpoint,
    tokenEndpoint: config.tokenEndpoint,
  };

  const request = new AuthSession.AuthRequest({
    clientId: config.clientId,
    scopes: config.scopes,
    redirectUri: REDIRECT_URI,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: provider === 'GOOGLE',
    extraParams: provider === 'NAVER' ? { state: `naver_${Date.now()}` } : undefined,
  });

  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params.code) return null;

  const code = result.params.code;
  if (provider === 'GOOGLE') {
    const tokenResult = await AuthSession.exchangeCodeAsync(
      { clientId: config.clientId, code, redirectUri: REDIRECT_URI,
        extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined },
      discovery,
    );
    return { provider, accessToken: tokenResult.accessToken };
  }

  return { provider, authCode: code, redirectUri: REDIRECT_URI };
}

export async function socialLogin(provider: SocialProvider): Promise<SocialLoginResult | null> {
  if (provider === 'KAKAO') return kakaoLogin();
  return authSessionLogin(provider);
}

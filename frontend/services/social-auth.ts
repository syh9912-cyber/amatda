import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'GOOGLE' | 'KAKAO' | 'NAVER';

const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'amatda',
});

// Google OAuth
const GOOGLE_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  scopes: ['openid', 'profile', 'email'],
};

// Kakao OAuth
const KAKAO_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || '',
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
  scopes: ['profile_nickname', 'account_email'],
};

// Naver OAuth
const NAVER_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || '',
  authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  tokenEndpoint: 'https://nid.naver.com/oauth2.0/token',
  scopes: [],
};

function getDiscovery(provider: SocialProvider): AuthSession.DiscoveryDocument {
  const config = provider === 'GOOGLE' ? GOOGLE_CONFIG
    : provider === 'KAKAO' ? KAKAO_CONFIG
    : NAVER_CONFIG;

  return {
    authorizationEndpoint: config.authorizationEndpoint,
    tokenEndpoint: config.tokenEndpoint,
  };
}

function getClientId(provider: SocialProvider): string {
  if (provider === 'GOOGLE') return GOOGLE_CONFIG.clientId;
  if (provider === 'KAKAO') return KAKAO_CONFIG.clientId;
  return NAVER_CONFIG.clientId;
}

function getScopes(provider: SocialProvider): string[] {
  if (provider === 'GOOGLE') return GOOGLE_CONFIG.scopes;
  if (provider === 'KAKAO') return KAKAO_CONFIG.scopes;
  return NAVER_CONFIG.scopes;
}

export async function socialLogin(provider: SocialProvider): Promise<{
  accessToken: string;
  provider: SocialProvider;
} | null> {
  const clientId = getClientId(provider);
  const discovery = getDiscovery(provider);
  const scopes = getScopes(provider);

  // 클라이언트 ID가 없으면 Mock 모드
  if (!clientId) {
    return {
      accessToken: `mock_token_${provider}_${Date.now()}`,
      provider,
    };
  }

  try {
    const request = new AuthSession.AuthRequest({
      clientId,
      scopes,
      redirectUri: REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: provider === 'GOOGLE',
      extraParams: provider === 'NAVER' ? { state: `naver_${Date.now()}` } : undefined,
    });

    const result = await request.promptAsync(discovery);

    if (result.type !== 'success' || !result.params.code) {
      return null;
    }

    // Authorization Code → Access Token 교환
    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        code: result.params.code,
        redirectUri: REDIRECT_URI,
        extraParams: request.codeVerifier
          ? { code_verifier: request.codeVerifier }
          : undefined,
      },
      discovery
    );

    return {
      accessToken: tokenResult.accessToken,
      provider,
    };
  } catch {
    return null;
  }
}

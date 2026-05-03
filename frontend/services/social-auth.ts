import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

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

/**
 * 카카오 로그인 — 네이티브 SDK (Android/iOS)
 * KakaoTalk 앱 → 즉시 토큰 반환, 브라우저/딥링크 불필요
 */
async function kakaoLogin(): Promise<SocialLoginResult | null> {
  if (Platform.OS === 'web') {
    // 웹은 AuthSession 방식 유지
    return kakaoWebLogin();
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { login } = require('@react-native-seoul/kakao-login');
    const tokenResult = await login();
    console.log('[KakaoLogin] native SDK success');
    return {
      provider: 'KAKAO',
      accessToken: tokenResult.accessToken,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[KakaoLogin] native SDK error:', msg);
    throw new Error(`카카오 SDK: ${msg}`);
  }
}

/** 웹 전용 카카오 로그인 (브라우저 방식) */
async function kakaoWebLogin(): Promise<SocialLoginResult | null> {
  const KAKAO_KEY = '0aa17590759470d930a9720d273b8a8f';
  const KAKAO_CALLBACK = 'https://api-usglfifguq-uc.a.run.app/api/auth/kakao/callback';
  const appRedirect = 'amatda://auth/callback';

  const authUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${KAKAO_KEY}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_CALLBACK)}` +
    `&response_type=code`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, appRedirect);
  if (result.type !== 'success' || !('url' in result)) return null;

  const paramStr = result.url.split('?')[1] || '';
  const params = new URLSearchParams(paramStr);
  if (params.get('error')) return null;

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
 * 네이버 로그인 — 네이티브 SDK (Android/iOS)
 * 네이버 앱/브라우저 → 즉시 accessToken 반환
 * 웹은 AuthSession 방식 유지
 */
async function naverLogin(): Promise<SocialLoginResult | null> {
  if (Platform.OS === 'web') {
    return authSessionLogin('NAVER');
  }

  const consumerKey = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || '';
  const consumerSecret = process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET || '';
  const serviceUrlScheme = process.env.EXPO_PUBLIC_NAVER_URL_SCHEME || 'naverlogin';

  if (!consumerKey || !consumerSecret) {
    throw new Error('네이버 로그인 환경변수(EXPO_PUBLIC_NAVER_CLIENT_ID/SECRET)가 설정되지 않았습니다.');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NaverLoginModule = require('@react-native-seoul/naver-login');
    const NaverLogin = NaverLoginModule.default ?? NaverLoginModule;

    NaverLogin.initialize({
      appName: '아맞다',
      consumerKey,
      consumerSecret,
      serviceUrlSchemeIOS: serviceUrlScheme,
      disableNaverAppAuthIOS: false,
    });

    const result = await NaverLogin.login();
    // SDK v3+: { successResponse, failureResponse }
    const accessToken =
      result?.successResponse?.accessToken ??
      result?.accessToken ??
      null;

    if (!accessToken) {
      const failMsg =
        result?.failureResponse?.message ??
        result?.failureResponse?.lastErrorCodeFromNaverSDK ??
        '알 수 없는 오류';
      throw new Error(`네이버 로그인 실패: ${failMsg}`);
    }

    console.log('[NaverLogin] native SDK success');
    return {
      provider: 'NAVER',
      accessToken,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[NaverLogin] native SDK error:', msg);
    throw new Error(`네이버 SDK: ${msg}`);
  }
}

/**
 * 구글 로그인 — 네이티브 SDK (Android/iOS)
 * Google Play Services / Apple Sign-In Panel → idToken + accessToken 반환
 */
async function googleLogin(): Promise<SocialLoginResult | null> {
  if (Platform.OS === 'web') {
    return authSessionLogin('GOOGLE');
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  if (!webClientId) {
    throw new Error('구글 로그인 환경변수(EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)가 설정되지 않았습니다.');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin') as {
      GoogleSignin: {
        configure: (opts: { webClientId: string; offlineAccess?: boolean }) => void;
        hasPlayServices: () => Promise<boolean>;
        signIn: () => Promise<unknown>;
        getTokens: () => Promise<{ idToken: string; accessToken: string }>;
      };
      statusCodes: Record<string, string>;
    };

    GoogleSignin.configure({
      webClientId,
      offlineAccess: false,
    });

    await GoogleSignin.hasPlayServices();
    await GoogleSignin.signIn();
    const tokens = await GoogleSignin.getTokens();

    if (!tokens?.accessToken) {
      throw new Error('accessToken을 받지 못했습니다.');
    }

    console.log('[GoogleLogin] native SDK success');
    return {
      provider: 'GOOGLE',
      accessToken: tokens.accessToken,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // 사용자가 취소하거나 진행 중인 경우 null 반환
    const code = (err as { code?: string } | null)?.code;
    if (code === 'SIGN_IN_CANCELLED' || code === '12501' || code === 'SIGN_IN_REQUIRED') {
      return null;
    }
    console.error('[GoogleLogin] native SDK error:', msg);
    throw new Error(`구글 SDK: ${msg}`);
  }
}

/**
 * 네이버 웹 전용 — AuthSession 방식 (모바일은 네이티브 SDK 경유)
 */
async function authSessionLogin(provider: SocialProvider): Promise<SocialLoginResult | null> {
  const configs: Record<string, { clientId: string; authEndpoint: string; tokenEndpoint: string; scopes: string[] }> = {
    GOOGLE: {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
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
  if (provider === 'NAVER') return naverLogin();
  if (provider === 'GOOGLE') return googleLogin();
  return authSessionLogin(provider);
}

/**
 * 디바이스 측 소셜 SDK 토큰 캐시 정리 (logout만 — 안전).
 *
 * 중요: unlink는 호출하지 않음. 이유:
 *  1. 백엔드가 이미 서버측 unlink REST를 호출함 (auth.ts deleteAccount)
 *  2. 서버 unlink로 토큰이 이미 무효화된 상태에서 디바이스가 다시 unlink 시도하면
 *     네이티브 SDK가 예외 발생 → JS try/catch 우회 → 앱 크래시 (Android에서 발생)
 *  3. logout()만 호출하면 디바이스 캐시 정리만 하므로 안전
 *
 * 모든 호출은 best-effort + 타임아웃 보호 — 실패해도 진행. 웹은 no-op.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null as T | null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function clearAllSocialSessions(): Promise<void> {
  if (Platform.OS === 'web') return;

  // 카카오 — logout만
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const KakaoMod = require('@react-native-seoul/kakao-login');
    if (typeof KakaoMod.logout === 'function') {
      await withTimeout(KakaoMod.logout(), 3000);
    }
  } catch {
    /* SDK 미설치 또는 미로그인 — 무시 */
  }

  // 네이버 — logout만
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NaverMod = require('@react-native-seoul/naver-login');
    const NaverLogin = NaverMod.default ?? NaverMod;
    if (typeof NaverLogin.logout === 'function') {
      await withTimeout(NaverLogin.logout(), 3000);
    }
  } catch {
    /* SDK 미설치 또는 미로그인 — 무시 */
  }

  // 구글 — signOut만 (revokeAccess는 unlink와 같은 위험)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    if (typeof GoogleSignin.signOut === 'function') {
      await withTimeout(GoogleSignin.signOut(), 3000);
    }
  } catch {
    /* SDK 미설치 또는 미로그인 — 무시 */
  }
}

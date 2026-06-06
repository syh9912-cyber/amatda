import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'GOOGLE' | 'KAKAO' | 'NAVER' | 'APPLE';

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
 * 네이버 로그인 — 네이티브 SDK 패턴 (한국 앱 표준).
 *
 * 2026-05-08 결정: 백엔드 OAuth callback 패턴에서 SDK 패턴으로 되돌림.
 *   배경: 네이버는 RFC 의 client_secret 보호 모델보다 콘솔 화이트리스트(패키지명/Bundle ID)
 *   기반 모델을 표준으로 채택. 한국 앱 대부분이 SDK 패턴 사용. UX 우수.
 *   secret 노출에 대한 실질적 위험은 콘솔 화이트리스트로 mitigated.
 *
 * 흐름:
 *   - 네이버 앱 설치 → 즉시 토큰 반환
 *   - 미설치 → SDK 가 in-app browser 열기 → 로그인 → 토큰 반환
 *   - 백엔드 /auth/social → 토큰 verify → user 생성/매칭 → JWT 발급
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
 * AuthSession 기반 OAuth 2.0 authorization code grant.
 *   - GOOGLE: 모바일은 native SDK 사용, web 만 이 함수 사용
 *   - NAVER: 모든 플랫폼이 이 함수 사용 (2026-05-08 client_secret 보안 fix)
 *
 * 네이버 콘솔에 등록할 Callback URL 은 첫 호출 시 콘솔에 찍히는 REDIRECT_URI 값.
 * Expo dev client / preview / production 빌드별로 값이 다를 수 있어 빌드 후 확인 필수.
 */
async function authSessionLogin(provider: SocialProvider): Promise<SocialLoginResult | null> {
  // 콘솔에 redirect URI 출력 — 네이버 개발자 콘솔 등록 시 정확한 값 확인용
  console.log(`[social-auth] ${provider} REDIRECT_URI:`, REDIRECT_URI);

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
    if (!__DEV__) {
      throw new Error(`[social-auth] ${provider} clientId 미설정 — 프로덕션에서 mock 토큰 불가`);
    }
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

/**
 * Apple 로그인 — iOS 네이티브 (expo-apple-authentication).
 * App Store 정책 4.8: 타사 소셜로그인 제공 시 iOS 에 Apple 로그인 필수.
 * identityToken(JWT)을 백엔드 /auth/social (provider=APPLE)에서 서명 검증.
 * 네이티브 모듈 동적 require + fallback (정적 import 금지 규칙).
 */
async function appleLogin(): Promise<SocialLoginResult | null> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple 로그인은 iOS에서만 지원됩니다.');
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AppleAuthentication = require('expo-apple-authentication');
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      throw new Error('이 기기에서는 Apple 로그인을 사용할 수 없습니다.');
    }
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential?.identityToken) {
      throw new Error('Apple identityToken 을 받지 못했습니다.');
    }
    console.log('[AppleLogin] native success');
    return {
      provider: 'APPLE',
      accessToken: credential.identityToken, // 백엔드에서 검증
    };
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    // 사용자가 시트를 취소 → null (에러 아님)
    if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') return null;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AppleLogin] error:', msg);
    throw new Error(`Apple 로그인: ${msg}`);
  }
}

export async function socialLogin(provider: SocialProvider): Promise<SocialLoginResult | null> {
  if (provider === 'KAKAO') return kakaoLogin();
  if (provider === 'NAVER') return naverLogin();
  if (provider === 'GOOGLE') return googleLogin();
  if (provider === 'APPLE') return appleLogin();
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

  // 네이버 — logout만 (unlink는 위험: 백엔드가 이미 unlink 처리)
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

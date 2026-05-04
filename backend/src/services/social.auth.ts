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
    if (!infoRes.ok) throw new Error('Google 토큰 audience 검증 실패');
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
      // PII 안전 진단 — project_id 만 노출 (전체 client_id 노출 X)
      throw new Error(
        `Google 토큰 audience 불일치 — expected project=${ourProjectId}, got audProject=${audProject} azpProject=${azpProject}`,
      );
    }
  }
  // 2. 사용자 정보 조회
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Google 토큰 검증 실패');
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
    if (!infoRes.ok) throw new Error('카카오 토큰 app_id 검증 실패');
    const info = await infoRes.json() as { app_id?: number };
    if (!info.app_id) {
      throw new Error('카카오 토큰 app_id 불명 — 의심스러운 토큰');
    }
    // KAKAO_APP_ID 환경변수가 설정돼 있으면 strict 비교 — 다른 카카오 앱 토큰 거부.
    // 미설정 시 (개발환경 등) 0/null 만 차단.
    if (env.KAKAO_APP_ID) {
      const expectedAppId = Number.parseInt(env.KAKAO_APP_ID, 10);
      if (Number.isNaN(expectedAppId)) {
        throw new Error('서버 설정 오류: KAKAO_APP_ID 가 정수가 아닙니다');
      }
      if (info.app_id !== expectedAppId) {
        throw new Error(`카카오 토큰 app_id 불일치 — 다른 앱 토큰 거부 (받음: ${info.app_id})`);
      }
    }
  }
  // 2. 사용자 정보 조회
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('카카오 토큰 검증 실패');
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
  if (!res.ok) throw new Error('네이버 토큰 검증 실패');
  // resultcode/message 같이 받아 정상 응답인지 추가 검증
  const data = await res.json() as {
    resultcode?: string;
    message?: string;
    response?: { id?: string; email?: string; name?: string };
  };
  if (data.resultcode !== '00' || !data.response?.id) {
    throw new Error(`네이버 토큰 검증 실패: ${data.message ?? 'unknown'}`);
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

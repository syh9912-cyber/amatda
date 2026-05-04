import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { success, error } from '../utils/response';
import {
  verifySocialToken,
  exchangeCodeAndVerify,
  unlinkSocialAccount,
  SocialProvider,
} from '../services/social.auth';
import { collections, genId, db } from '../services/firestore';
import { findOrCreateSocialUser } from '../services/socialUser.service';
import { authMiddleware } from '../middleware/auth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';
import { encryptToken, decryptToken } from '../utils/crypto';

const router = Router();

/**
 * JWT 표준 클레임 정책 (#1 출시 전 보안 강화):
 *   - alg: HS256 명시 핀 (sign + verify 모두) — 알고리즘 confusion 공격 차단
 *   - iss: 'amatda-api' — 발급자 명시
 *   - aud: 'amatda-app' — 대상 명시
 *   - typ: 'access' | 'refresh' — 클레임으로 토큰 종류 구분 (시크릿만으로 구분하지 않음)
 *   - jti: crypto.randomUUID() — 토큰 고유 식별자 (revoke / rotation 추적용)
 */
const JWT_ISSUER = 'amatda-api';
const JWT_AUDIENCE = 'amatda-app';
const JWT_ALGO: jwt.Algorithm = 'HS256';

interface AccessTokenPayload {
  userId: string;
  typ: 'access';
}
/**
 * Refresh token 페이로드 — `jti` 는 jsonwebtoken 의 jwtid 옵션이 자동으로 설정 (JWT 표준 클레임).
 * payload 에 jti 직접 넣으면 "Bad options.jwtid" 충돌 발생 → 절대 넣지 말 것.
 * verify 시 payload 에 자동으로 jti 가 포함되어 돌아옴.
 */
interface RefreshTokenPayload {
  userId: string;
  typ: 'refresh';
  fam: string; // familyId — 같은 로그인 세션의 refresh chain
  jti?: string; // verify 결과에서만 사용 (sign 시 직접 넣지 않음)
}

const REFRESH_EXPIRES_DAYS = 7;

/**
 * Refresh token 가족 단위로 발급 (#2 RFC 6819 rotation).
 * 새 로그인이면 familyId 새로 만들고, refresh 시엔 기존 familyId 유지 + 회전.
 */
async function generateTokens(userId: string, familyId?: string) {
  const refreshJti = randomUUID();
  const fam = familyId ?? randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  // Firestore 에 새 jti 등록 — 사용 추적용
  await collections.refreshTokens.doc(refreshJti).set({
    jti: refreshJti,
    familyId: fam,
    userId,
    used: false,
    revoked: false,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  const accessToken = jwt.sign(
    { userId, typ: 'access' } satisfies AccessTokenPayload,
    env.JWT_SECRET,
    { algorithm: JWT_ALGO, expiresIn: '1h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
  );
  // payload 에는 jti 넣지 않음 — jwtid 옵션이 자동으로 표준 claim 으로 설정.
  const refreshToken = jwt.sign(
    { userId, typ: 'refresh', fam },
    env.JWT_REFRESH_SECRET,
    { algorithm: JWT_ALGO, expiresIn: `${REFRESH_EXPIRES_DAYS}d`, issuer: JWT_ISSUER, audience: JWT_AUDIENCE, jwtid: refreshJti },
  );
  return { accessToken, refreshToken, refreshJti, familyId: fam };
}

/**
 * 토큰 패밀리 전체 무효화 — refresh 토큰 reuse 가 감지되면 호출.
 * 탈취 시나리오: 공격자 A가 B 의 refresh 토큰 사용 → A 와 B 모두 즉시 로그아웃.
 */
async function revokeRefreshTokenFamily(familyId: string, reason: string): Promise<void> {
  const snap = await collections.refreshTokens.where('familyId', '==', familyId).get();
  const batch = db.batch();
  snap.docs.forEach((d) => {
    batch.update(d.ref, { revoked: true, revokedReason: reason, revokedAt: new Date().toISOString() });
  });
  if (!snap.empty) await batch.commit();
  logger.warn('auth/refresh-revoke-family', `familyId=${familyId} reason=${reason} count=${snap.size}`);
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, parentRole } = req.body;
    if (!email || !password) { error(res, '이메일과 비밀번호를 입력해주세요'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { error(res, '올바른 이메일 형식을 입력해주세요'); return; }
    if (password.length < 8) { error(res, '비밀번호는 8자 이상이어야 합니다'); return; }

    const existing = await collections.users.where('email', '==', email).limit(1).get();
    if (!existing.empty) { error(res, '이미 가입된 이메일입니다', 409); return; }

    const id = genId();
    const passwordHash = await bcrypt.hash(password, 12);
    await collections.users.doc(id).set({
      email, passwordHash, authProvider: 'LOCAL', socialId: null,
      subscriptionTier: 'FREE', createdAt: FieldValue.serverTimestamp(),
      parentRole: parentRole || '',
    });

    const tokens = await generateTokens(id);
    success(res, { user: { id, email }, ...tokens }, 201);
  } catch (e) {
    logger.error('auth/register', e);
    error(res, '회원가입 처리 중 오류가 발생했습니다', 500);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { error(res, '이메일과 비밀번호를 입력해주세요'); return; }

    const snap = await collections.users.where('email', '==', email).limit(1).get();
    if (snap.empty) { error(res, '이메일 또는 비밀번호가 올바르지 않습니다', 401); return; }

    const doc = snap.docs[0];
    const user = doc.data();
    if (!user.passwordHash) { error(res, '이메일 또는 비밀번호가 올바르지 않습니다', 401); return; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { error(res, '이메일 또는 비밀번호가 올바르지 않습니다', 401); return; }

    const tokens = await generateTokens(doc.id);
    success(res, { user: { id: doc.id, email: user.email }, ...tokens });
  } catch (e) {
    logger.error('auth/login', e);
    error(res, '로그인 처리 중 오류가 발생했습니다', 500);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { error(res, '리프레시 토큰이 필요합니다'); return; }
    // 알고리즘/issuer/audience 모두 검증 — 알고리즘 confusion / 다른 시스템 토큰 거부
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, {
      algorithms: [JWT_ALGO],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as RefreshTokenPayload;
    if (payload.typ !== 'refresh' || !payload.jti || !payload.fam) {
      error(res, '유효하지 않은 리프레시 토큰입니다', 401);
      return;
    }
    const jti = payload.jti; // narrowing 보존을 위해 const 로 추출

    // #2 RFC 6819 rotation + reuse detection.
    // 트랜잭션으로 jti 상태 read+update 를 원자적으로 처리 — 두 클라이언트가 동시에 같은 jti
    // 사용 시도해도 한쪽만 성공.
    const result = await db.runTransaction(async (tx) => {
      const ref = collections.refreshTokens.doc(jti);
      const doc = await tx.get(ref);
      if (!doc.exists) {
        // DB 에 없는 jti — 이전 시스템 또는 이미 정리된 토큰 → 거부 + 패밀리 무효화 시도
        return { ok: false as const, reason: 'jti not found' };
      }
      const data = doc.data() as { used: boolean; revoked: boolean; familyId: string; userId: string };
      if (data.revoked) {
        return { ok: false as const, reason: 'revoked', familyId: data.familyId };
      }
      if (data.used) {
        // ⚠️ Reuse detected — 토큰 탈취 가능성 → 패밀리 전체 무효화
        return { ok: false as const, reason: 'reuse-detected', familyId: data.familyId };
      }
      // 정상 사용 — used 마킹
      tx.update(ref, { used: true, usedAt: new Date().toISOString() });
      return { ok: true as const, userId: data.userId, familyId: data.familyId };
    });

    if (!result.ok) {
      if (result.reason === 'reuse-detected' && result.familyId) {
        await revokeRefreshTokenFamily(result.familyId, 'refresh-token-reuse');
      }
      error(res, '유효하지 않은 리프레시 토큰입니다', 401);
      return;
    }

    // 새 토큰 발급 — 같은 familyId 유지 (회전)
    const tokens = await generateTokens(result.userId, result.familyId);
    // 새 토큰 발급되면 이전 jti의 replacedBy 필드에 새 jti 기록 (감사 추적)
    await collections.refreshTokens.doc(jti).update({ replacedBy: tokens.refreshJti });
    success(res, tokens);
  } catch (e) {
    // 만료/위변조 등 정상 흐름에서도 발생 — info 레벨로 기록하되 운영 에러는 추적 가능하게
    logger.warn('auth/refresh', e instanceof Error ? e.message : String(e));
    error(res, '유효하지 않은 리프레시 토큰입니다', 401);
  }
});

// POST /api/auth/logout — 서버측 refresh token 무효화 (#5 보안)
//   클라이언트가 refreshToken 을 보내면 해당 토큰 + 같은 패밀리 전체 revoke.
//   accessToken 은 1시간 단명이므로 자연 만료 대기.
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      // 클라이언트가 토큰 없이 로그아웃 호출해도 200 — 멱등성 보장
      success(res, { message: 'logged out' });
      return;
    }
    // 서명 검증 — 위조된 토큰으로 다른 사용자 패밀리 무효화 못하도록
    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, {
        algorithms: [JWT_ALGO],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as RefreshTokenPayload;
    } catch {
      // 위조/만료 — 멱등성: 어차피 revoke 할 것 없음
      success(res, { message: 'logged out' });
      return;
    }
    if (payload.fam) {
      await revokeRefreshTokenFamily(payload.fam, 'user-logout');
    }
    success(res, { message: 'logged out' });
  } catch (e) {
    logger.error('auth/logout', e);
    // 로그아웃은 best-effort — 실패해도 200 (클라이언트는 어차피 로컬 토큰 삭제)
    success(res, { message: 'logged out' });
  }
});

// POST /api/auth/social
router.post('/social', async (req: Request, res: Response) => {
  try {
    const { provider, accessToken } = req.body;
    if (!provider || !accessToken) { error(res, 'provider와 accessToken이 필요합니다'); return; }

    const validProviders: SocialProvider[] = ['GOOGLE', 'KAKAO', 'NAVER'];
    const upperProvider = provider.toUpperCase() as SocialProvider;
    if (!validProviders.includes(upperProvider)) { error(res, '지원하지 않는 소셜 로그인입니다'); return; }

    const socialUser = await verifySocialToken(upperProvider, accessToken);

    // race-safe transaction: socialIdIndex/{provider}_{socialId} 결정적 ID 로 동시 가입 방지
    const { userId, email: userEmail, nickname, isNewUser } =
      await findOrCreateSocialUser(upperProvider, socialUser);

    // 마지막 소셜 access_token 저장 (탈퇴 시 unlink REST 호출용)
    await collections.users.doc(userId).update({
      lastSocialAccessToken: encryptToken(socialUser.accessToken),
      lastSocialAccessTokenAt: FieldValue.serverTimestamp(),
    });

    const childSnap = await collections.children.where('userId', '==', userId).limit(1).get();
    const tokens = await generateTokens(userId);
    success(res, {
      user: { id: userId, email: userEmail, nickname, authProvider: upperProvider },
      ...tokens,
      isNewUser,                     // user 문서가 새로 생성됐는지
      needsOnboarding: childSnap.empty,  // 자녀 등록 필요 여부 (별개 정보)
    });
  } catch (e) {
    logger.error('auth/social', e);
    const msg = e instanceof Error ? e.message : '소셜 로그인 처리 중 오류가 발생했습니다';
    error(res, msg, 500);
  }
});

// POST /api/auth/social-code
// 프론트에서 인가 코드를 받아 백엔드에서 토큰 교환 후 로그인 처리 (Kakao, Naver)
router.post('/social-code', async (req: Request, res: Response) => {
  try {
    const { provider, code, redirectUri } = req.body;
    if (!provider || !code || !redirectUri) {
      error(res, 'provider, code, redirectUri가 필요합니다');
      return;
    }

    const validProviders: SocialProvider[] = ['KAKAO', 'NAVER'];
    const upperProvider = provider.toUpperCase() as SocialProvider;
    if (!validProviders.includes(upperProvider)) {
      error(res, 'social-code는 KAKAO, NAVER만 지원합니다. Google은 /auth/social을 사용하세요.');
      return;
    }

    // 인가 코드 -> 토큰 교환 -> 사용자 정보 조회
    const socialUser = await exchangeCodeAndVerify(upperProvider, code, redirectUri);

    // race-safe transaction (위 /social 과 동일)
    const { userId, email: userEmail, nickname, isNewUser } =
      await findOrCreateSocialUser(upperProvider, socialUser);

    // 마지막 소셜 access_token 저장 (탈퇴 시 unlink REST 호출용)
    await collections.users.doc(userId).update({
      lastSocialAccessToken: encryptToken(socialUser.accessToken),
      lastSocialAccessTokenAt: FieldValue.serverTimestamp(),
    });

    const childSnap = await collections.children.where('userId', '==', userId).limit(1).get();
    const tokens = await generateTokens(userId);
    success(res, {
      user: { id: userId, email: userEmail, nickname, authProvider: upperProvider },
      ...tokens,
      isNewUser,
      needsOnboarding: childSnap.empty,
    });
  } catch (e) {
    logger.error('auth/social-code', e);
    const msg = e instanceof Error ? e.message : '소셜 로그인 처리 중 오류가 발생했습니다';
    error(res, msg, 500);
  }
});

// 카카오 로그인 임시 저장소 — Firestore 기반 (Cloud Functions 인스턴스 간 공유)
//
// ⚠️ TTL 정책: Firestore native TTL 활성화 필요 — `expiresAt` (Timestamp) 필드 기준.
//   gcloud firestore fields ttls update expiresAt --collection-group=kakaoOAuthState --enable-ttl
//   미설정 시 폴링이 1회 소비 후 doc.delete() 하지만, 사용자가 콜백 페이지를 떠나거나
//   네트워크 문제로 폴링이 결과를 못 받아간 케이스는 누적될 수 있음. TTL 안전망 권장.
const KAKAO_STATE_COLLECTION = 'kakaoOAuthState';
const KAKAO_STATE_TTL_MS = 5 * 60 * 1000; // 5분

// GET /api/auth/kakao/check/:state — 앱에서 폴링으로 결과 확인
router.get('/kakao/check/:state', async (req: Request, res: Response) => {
  try {
    const stateKey = req.params.state as string;
    const docRef = db.collection(KAKAO_STATE_COLLECTION).doc(stateKey);
    const doc = await docRef.get();
    if (!doc.exists) {
      success(res, { status: 'pending' });
      return;
    }
    const data = doc.data()!;
    // TTL 체크
    if (Date.now() > (data.expires as number)) {
      await docRef.delete().catch(() => {});
      success(res, { status: 'pending' });
      return;
    }
    // 결과 반환 후 삭제 (1회 소비)
    await docRef.delete().catch((err) => {
      logger.warn('auth/kakao/check', `result doc delete failed: ${err instanceof Error ? err.message : String(err)}`);
    });
    success(res, { status: 'done', ...data.result as Record<string, unknown> });
  } catch (err) {
    // 폴링 중 일시적 오류 — pending 상태로 클라이언트가 재시도하게 두지만 서버 로그는 남김.
    // 폴링 라우트는 1~2초마다 호출되므로 logger.warn (Sentry 미전송) 사용 — 일시 장애로 Sentry 폭주 방지.
    logger.warn('auth/kakao/check', `polling failed, returning pending: ${err instanceof Error ? err.message : String(err)}`);
    success(res, { status: 'pending' });
  }
});

// GET /api/auth/kakao/callback — 카카오 OAuth callback
// 카카오에서 code를 받아 직접 토큰 교환 + 로그인 처리 후 결과를 HTML로 표시
router.get('/kakao/callback', async (req: Request, res: Response) => {
  const { code, state, error: kakaoError, error_description } = req.query;
  const statePreview = typeof state === 'string' && state.length > 8 ? `${state.slice(0, 8)}…` : '(none)';
  logger.info('auth/kakao/callback', `hit state=${statePreview} hasCode=${!!code} error=${kakaoError || 'none'}`);

  if (kakaoError || !code) {
    const rawMsg = String(error_description || kakaoError || 'no_code');
    res.type('html').send(simpleHtml('로그인 실패', rawMsg + ' — 앱으로 돌아가주세요.'));
    return;
  }

  const stateKey = String(state || '');

  try {
    const redirectUri = 'https://api-usglfifguq-uc.a.run.app/api/auth/kakao/callback';
    const socialUser = await exchangeCodeAndVerify('KAKAO', String(code), redirectUri);

    // race-safe transaction (위 /social, /social-code 와 동일)
    const { userId, email: userEmail, nickname, isNewUser } =
      await findOrCreateSocialUser('KAKAO', socialUser);

    // 마지막 카카오 access_token 저장 (탈퇴 시 unlink REST 호출용)
    await collections.users.doc(userId).update({
      lastSocialAccessToken: encryptToken(socialUser.accessToken),
      lastSocialAccessTokenAt: FieldValue.serverTimestamp(),
    });

    const { accessToken, refreshToken } = await generateTokens(userId);

    // 보안: 토큰을 URL 쿼리/HTML에 절대 포함하지 않음 (브라우저 history/Referer 누출).
    // 앱은 stateKey 만 받아 /api/auth/kakao/check/:state 로 polling 해서 토큰 획득.
    // 카카오 nickname/email 등도 HTML 보간 안 함 (XSS 방어).
    if (!stateKey) {
      logger.warn('auth/kakao/callback', 'state 누락 — CSRF 방어 차단');
      res.status(400).type('html').send(simpleHtml('로그인 실패', 'state 파라미터가 누락되었어요. 앱에서 다시 시도해주세요.'));
      return;
    }
    const expiresMs = Date.now() + KAKAO_STATE_TTL_MS;
    await db.collection(KAKAO_STATE_COLLECTION).doc(stateKey).set({
      result: {
        user: { id: userId, email: userEmail, nickname },
        accessToken, refreshToken, isNewUser,
      },
      expires: expiresMs,
      expiresAt: Timestamp.fromMillis(expiresMs),
    });

    // 딥링크에 stateKey 만 — 토큰은 polling 으로 가져감
    const safeStateKey = encodeURIComponent(stateKey);
    const deepLink = `amatda://auth/callback?state=${safeStateKey}`;
    res.type('html').send(simpleRedirectHtml(deepLink));
  } catch (err) {
    logger.error('auth/kakao/callback', err);
    // 에러도 토큰 없이 — state 만 (앱이 polling 시 result 없으면 실패 처리)
    const safeStateKey = encodeURIComponent(stateKey);
    const errorDeep = `amatda://auth/callback?state=${safeStateKey}&error=1`;
    res.type('html').send(simpleRedirectHtml(errorDeep));
  }
});

/** 카카오 callback 의 안전한 redirect HTML — meta refresh 만 (script 보간 X). */
function simpleRedirectHtml(deepLink: string): string {
  // deepLink 는 우리가 만든 URL 이라 안전하지만 추가 방어로 quotation 만 escape.
  const safe = deepLink.replace(/"/g, '%22');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safe}"></head><body><p style="text-align:center;margin-top:40vh;font-family:sans-serif;color:#999;">앱으로 돌아가는 중...</p></body></html>`;
}

/** 단순 메시지 HTML (이스케이프된 안전한 텍스트만) */
function simpleHtml(title: string, message: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#FFF5EC;"><div style="text-align:center;"><h2>${esc(title)}</h2><p>${esc(message)}</p></div></body></html>`;
}

// PUT /api/auth/nickname — 별명 설정/변경
router.put('/nickname', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { nickname, parentRole } = req.body as { nickname: string; parentRole?: string };
    if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 10) {
      error(res, '별명은 2~10자로 입력해주세요');
      return;
    }
    const updateData: Record<string, unknown> = { nickname: nickname.trim() };
    if (parentRole) updateData.parentRole = parentRole;
    await collections.users.doc(req.userId!).update(updateData);
    success(res, { nickname: nickname.trim(), parentRole: parentRole || '' });
  } catch (e) {
    logger.error('auth/nickname', e);
    error(res, '별명 설정 중 오류', 500);
  }
});

// GET /api/auth/me — 현재 유저 정보 조회
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.users.doc(req.userId!).get();
    if (!doc.exists) { error(res, '계정이 존재하지 않습니다 (재로그인 필요)', 401); return; }
    const data = doc.data() as Record<string, unknown>;
    success(res, {
      id: doc.id,
      email: data.email,
      nickname: data.nickname ?? null,
      authProvider: data.authProvider,
      parentRole: data.parentRole ?? '',
      isOfficial: data.isOfficial === true,
    });
  } catch (e) {
    logger.error('auth/me', e);
    error(res, '정보 조회 중 오류', 500);
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { error(res, '현재 비밀번호와 새 비밀번호를 입력해주세요'); return; }
    if (newPassword.length < 8) { error(res, '새 비밀번호는 8자 이상이어야 합니다'); return; }

    const doc = await collections.users.doc(req.userId!).get();
    if (!doc.exists) { error(res, '사용자를 찾을 수 없습니다', 404); return; }
    const user = doc.data()!;
    if (!user.passwordHash) { error(res, '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다'); return; }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { error(res, '현재 비밀번호가 올바르지 않습니다', 401); return; }

    const newHash = await bcrypt.hash(newPassword, 12);
    await collections.users.doc(req.userId!).update({ passwordHash: newHash });
    success(res, { message: '비밀번호가 변경되었습니다' });
  } catch (e) {
    logger.error('auth/change-password', e);
    error(res, '비밀번호 변경 중 오류가 발생했습니다', 500);
  }
});

// POST /api/auth/set-password — 소셜 로그인 유저가 비밀번호를 처음 설정
router.post('/set-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      error(res, '비밀번호는 8자 이상이어야 합니다');
      return;
    }

    const doc = await collections.users.doc(req.userId!).get();
    if (!doc.exists) { error(res, '사용자를 찾을 수 없습니다', 404); return; }
    const user = doc.data()!;

    // 이미 비밀번호가 있으면 change-password 사용 안내
    if (user.passwordHash) {
      error(res, '이미 비밀번호가 설정되어 있습니다. 변경은 /auth/change-password를 사용하세요.');
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await collections.users.doc(req.userId!).update({ passwordHash: newHash });
    success(res, { message: '비밀번호가 설정되었습니다' });
  } catch (e) {
    logger.error('auth/set-password', e);
    error(res, '비밀번호 설정 중 오류가 발생했습니다', 500);
  }
});

// GET /api/auth/me — 현재 유저 정보 조회 (확장)
// (기존 /me 엔드포인트가 위에 있으므로 여기서는 추가하지 않음)

// DELETE /api/auth/account — required by Google Play & Apple App Store
router.delete('/account', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // 사용자 정보 사전 조회 — unlink 와 socialIdIndex 삭제에 모두 필요
    const userDocBeforeDelete = await collections.users.doc(userId).get();
    const userData = userDocBeforeDelete.data() as Record<string, unknown> | undefined;
    const provider = userData?.authProvider as SocialProvider | undefined;
    const socialId = userData?.socialId as string | undefined;

    // 0. 소셜 계정 연결 끊기 (탈퇴 후 재가입 시 동의 화면부터 다시 시작되도록)
    //    실패해도 user 데이터 삭제는 진행한다.
    try {
      const storedToken = userData?.lastSocialAccessToken as string | undefined;
      // 저장된 토큰이 'gcm:' prefix면 복호화. 평문(legacy)이면 그대로 사용.
      let lastToken: string | null = null;
      if (storedToken) {
        try {
          lastToken = decryptToken(storedToken);
        } catch (decErr) {
          // 키가 회전됐거나 형식 불일치 — unlink 는 admin key fallback 으로 시도
          logger.warn('auth/deleteAccount/decrypt', decErr instanceof Error ? decErr.message : String(decErr));
        }
      }
      if (provider && socialId) {
        await unlinkSocialAccount(provider, socialId, lastToken);
        logger.info('auth/deleteAccount', `unlink OK (${provider})`);
      }
    } catch (e) {
      logger.error('auth/deleteAccount/unlink', e);
    }

    // Firestore batch는 500건 한도 — 모든 삭제 대상을 모아서 분할 커밋.
    // 각 컬렉션 쿼리에는 안전 상한(.limit) 적용 — 아주 큰 사용자는 잔여분이
    // 다음 호출에서 처리되도록 (idempotent retry 가능).
    const refs: FirebaseFirestore.DocumentReference[] = [];
    const COLLECTION_FETCH_LIMIT = 5000; // 컬렉션당 최대 5000건 한 번에

    // 1. Find all children for this user
    const childrenSnap = await collections.children.where('userId', '==', userId).limit(100).get();
    const childIds = childrenSnap.docs.map((d) => d.id);
    childrenSnap.docs.forEach((d) => refs.push(d.ref));

    // 2. Delete ALL related data for each child (GDPR/앱스토어 컴플라이언스)
    for (const childId of childIds) {
      const childSnaps = await Promise.all([
        collections.observations.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.dailyTracking.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.subscriptions.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.coachingSessions.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.followups.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.learnedKnowledge.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.pregnancyRecords.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.albumPhotos.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.momHealthChecks.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.gdmRecords.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.vaccinations.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.dailyTraits.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.milestoneChecks.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.sleepPredictions.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.autoDiaries.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.recommendationCache.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
        collections.analysisUsage.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      ]);
      for (const snap of childSnaps) {
        snap.docs.forEach((d) => refs.push(d.ref));
      }
    }

    // 3. Delete user-level data (userId 기반)
    const userSnaps = await Promise.all([
      collections.chatLogs.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.posts.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.postLikes.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.postComments.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.pushSchedules.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.familyMembers.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.conversationSummaries.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.clinicReviews.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
      // #5 보안: 계정 삭제 시 모든 refresh token revoke — stale token 으로 다시 들어올 수 없게
      collections.refreshTokens.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    ]);
    for (const snap of userSnaps) {
      snap.docs.forEach((d) => refs.push(d.ref));
    }

    // 4. Delete the user document itself + socialIdIndex (재가입 시 깨끗한 상태)
    refs.push(collections.users.doc(userId));
    if (provider && socialId) {
      refs.push(collections.socialIdIndex.doc(`${provider}_${socialId}`));
    }

    // 5. 500건씩 나눠서 batch commit
    const BATCH_LIMIT = 500;
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
      const chunk = refs.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    logger.info('auth/deleteAccount', `userId=${userId} deletedRefs=${refs.length}`);
    success(res, { message: '계정과 모든 관련 데이터가 삭제되었습니다' });
  } catch (err) {
    logger.error('auth/deleteAccount', err);
    error(res, '계정 삭제 중 오류가 발생했습니다', 500);
  }
});

export default router;

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
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

    const tokens = generateTokens(id);
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

    const tokens = generateTokens(doc.id);
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
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
    const tokens = generateTokens(payload.userId);
    success(res, tokens);
  } catch (e) {
    // 만료/위변조 등 정상 흐름에서도 발생 — info 레벨로 기록하되 운영 에러는 추적 가능하게
    logger.warn('auth/refresh', e instanceof Error ? e.message : String(e));
    error(res, '유효하지 않은 리프레시 토큰입니다', 401);
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
    const tokens = generateTokens(userId);
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
    const tokens = generateTokens(userId);
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
    // XSS 방지: HTML 특수문자 이스케이프
    const rawMsg = String(error_description || kakaoError || 'no_code');
    const errMsg = rawMsg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    res.send(`<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#FFF5EC;">
      <div style="text-align:center;"><h2>로그인 실패</h2><p>${errMsg}</p><p>앱으로 돌아가주세요.</p></div>
    </body></html>`);
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

    const { accessToken, refreshToken } = generateTokens(userId);

    // 딥링크로 앱 자동복귀 (인앱 브라우저가 감지 → 자동 닫힘)
    const deepParams = new URLSearchParams({
      accessToken,
      refreshToken,
      userId,
      email: userEmail || '',
      nickname: nickname || '',
      isNewUser: String(isNewUser),
    });
    const deepLink = `amatda://auth/callback?${deepParams.toString()}`;

    // polling 저장소 — Firestore에 저장 (인스턴스 간 공유)
    if (stateKey) {
      const expiresMs = Date.now() + KAKAO_STATE_TTL_MS;
      await db.collection(KAKAO_STATE_COLLECTION).doc(stateKey).set({
        result: {
          user: { id: userId, email: userEmail, nickname },
          accessToken, refreshToken, isNewUser,
        },
        expires: expiresMs,                            // legacy: ms timestamp (in-app 체크용)
        expiresAt: Timestamp.fromMillis(expiresMs),    // Firestore native TTL 필드
      });
    }

    // HTML 리디렉트 (브라우저 호환성 극대화)
    res.send(`<html><head><meta charset="utf-8">
      <meta http-equiv="refresh" content="0;url=${deepLink}">
    </head><body>
      <script>window.location.href="${deepLink}";</script>
      <p style="text-align:center;margin-top:40vh;font-family:sans-serif;color:#999;">앱으로 돌아가는 중...</p>
    </body></html>`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    logger.error('auth/kakao/callback', err);
    const errorDeep = `amatda://auth/callback?error=${encodeURIComponent(msg)}`;
    res.send(`<html><head><meta charset="utf-8">
      <meta http-equiv="refresh" content="0;url=${errorDeep}">
    </head><body>
      <script>window.location.href="${errorDeep}";</script>
      <p style="text-align:center;margin-top:40vh;font-family:sans-serif;color:#999;">앱으로 돌아가는 중...</p>
    </body></html>`);
  }
});

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

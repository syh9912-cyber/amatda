import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { success, error } from '../utils/response';
import {
  verifySocialToken,
  exchangeCodeAndVerify,
  SocialProvider,
} from '../services/social.auth';
import { collections, genId, db } from '../services/firestore';
import { authMiddleware } from '../middleware/auth';

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
    const passwordHash = await bcrypt.hash(password, 10);
    await collections.users.doc(id).set({
      email, passwordHash, authProvider: 'LOCAL', socialId: null,
      subscriptionTier: 'FREE', createdAt: new Date().toISOString(),
      parentRole: parentRole || '',
    });

    const tokens = generateTokens(id);
    success(res, { user: { id, email }, ...tokens }, 201);
  } catch { error(res, '회원가입 처리 중 오류가 발생했습니다', 500); }
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
  } catch { error(res, '로그인 처리 중 오류가 발생했습니다', 500); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { error(res, '리프레시 토큰이 필요합니다'); return; }
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
    const tokens = generateTokens(payload.userId);
    success(res, tokens);
  } catch { error(res, '유효하지 않은 리프레시 토큰입니다', 401); }
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

    // 기존 유저 찾기
    let userId: string | null = null;
    let userEmail: string | null = null;

    const bySocial = await collections.users
      .where('socialId', '==', socialUser.socialId)
      .where('authProvider', '==', upperProvider).limit(1).get();

    if (!bySocial.empty) {
      userId = bySocial.docs[0].id;
      userEmail = bySocial.docs[0].data().email;
    } else if (socialUser.email) {
      const byEmail = await collections.users.where('email', '==', socialUser.email).limit(1).get();
      if (!byEmail.empty) {
        userId = byEmail.docs[0].id;
        userEmail = byEmail.docs[0].data().email;
        await collections.users.doc(userId).update({ socialId: socialUser.socialId, authProvider: upperProvider });
      }
    }

    if (!userId) {
      userId = genId();
      userEmail = socialUser.email;
      await collections.users.doc(userId).set({
        email: socialUser.email, passwordHash: null, authProvider: upperProvider,
        socialId: socialUser.socialId, subscriptionTier: 'FREE', createdAt: new Date().toISOString(),
      });
    }

    const childSnap = await collections.children.where('userId', '==', userId).limit(1).get();
    const tokens = generateTokens(userId);
    success(res, {
      user: { id: userId, email: userEmail, authProvider: upperProvider },
      ...tokens, isNewUser: childSnap.empty,
    });
  } catch (e) {
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

    // 기존 유저 찾기 (기존 /social 엔드포인트와 동일 로직)
    let userId: string | null = null;
    let userEmail: string | null = null;

    const bySocial = await collections.users
      .where('socialId', '==', socialUser.socialId)
      .where('authProvider', '==', upperProvider).limit(1).get();

    if (!bySocial.empty) {
      userId = bySocial.docs[0].id;
      userEmail = bySocial.docs[0].data().email;
    } else if (socialUser.email) {
      const byEmail = await collections.users.where('email', '==', socialUser.email).limit(1).get();
      if (!byEmail.empty) {
        userId = byEmail.docs[0].id;
        userEmail = byEmail.docs[0].data().email;
        await collections.users.doc(userId).update({ socialId: socialUser.socialId, authProvider: upperProvider });
      }
    }

    if (!userId) {
      userId = genId();
      userEmail = socialUser.email;
      await collections.users.doc(userId).set({
        email: socialUser.email, passwordHash: null, authProvider: upperProvider,
        socialId: socialUser.socialId, subscriptionTier: 'FREE', createdAt: new Date().toISOString(),
      });
    }

    const childSnap = await collections.children.where('userId', '==', userId).limit(1).get();
    const tokens = generateTokens(userId);
    success(res, {
      user: { id: userId, email: userEmail, authProvider: upperProvider },
      ...tokens, isNewUser: childSnap.empty,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '소셜 로그인 처리 중 오류가 발생했습니다';
    console.error('[social-code] error:', msg);
    error(res, msg, 500);
  }
});

// 카카오 로그인 임시 저장소 — Firestore 기반 (Cloud Functions 인스턴스 간 공유)
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
    await docRef.delete().catch(() => {});
    success(res, { status: 'done', ...data.result as Record<string, unknown> });
  } catch {
    success(res, { status: 'pending' });
  }
});

// GET /api/auth/kakao/callback — 카카오 OAuth callback
// 카카오에서 code를 받아 직접 토큰 교환 + 로그인 처리 후 결과를 HTML로 표시
router.get('/kakao/callback', async (req: Request, res: Response) => {
  const { code, state, error: kakaoError, error_description } = req.query;
  const statePreview = typeof state === 'string' && state.length > 8 ? `${state.slice(0, 8)}…` : '(none)';
  console.log('[kakao/callback] hit! state:', statePreview, 'hasCode:', !!code, 'error:', kakaoError || 'none');

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

    let userId: string | null = null;
    let userEmail: string | null = null;
    let isNewUser = false;

    const bySocial = await collections.users
      .where('socialId', '==', socialUser.socialId)
      .where('authProvider', '==', 'KAKAO').limit(1).get();

    if (!bySocial.empty) {
      userId = bySocial.docs[0].id;
      userEmail = bySocial.docs[0].data().email as string;
    } else if (socialUser.email) {
      const byEmail = await collections.users.where('email', '==', socialUser.email).limit(1).get();
      if (!byEmail.empty) {
        userId = byEmail.docs[0].id;
        userEmail = byEmail.docs[0].data().email as string;
        await collections.users.doc(userId).update({ socialId: socialUser.socialId, authProvider: 'KAKAO' });
      }
    }

    if (!userId) {
      userId = genId();
      userEmail = socialUser.email;
      isNewUser = true;
      await collections.users.doc(userId).set({
        email: socialUser.email, passwordHash: null, authProvider: 'KAKAO',
        socialId: socialUser.socialId, subscriptionTier: 'FREE', createdAt: new Date().toISOString(),
      });
    }

    const accessToken = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // 기존 유저인 경우 닉네임 조회
    let nickname: string | null = null;
    if (!isNewUser) {
      const userDoc = await collections.users.doc(userId!).get();
      nickname = (userDoc.data()?.nickname as string) ?? null;
    }

    // 딥링크로 앱 자동복귀 (인앱 브라우저가 감지 → 자동 닫힘)
    const deepParams = new URLSearchParams({
      accessToken,
      refreshToken,
      userId: userId!,
      email: userEmail || '',
      nickname: nickname || '',
      isNewUser: String(isNewUser),
    });
    const deepLink = `amatda://auth/callback?${deepParams.toString()}`;

    // polling 저장소 — Firestore에 저장 (인스턴스 간 공유)
    if (stateKey) {
      await db.collection(KAKAO_STATE_COLLECTION).doc(stateKey).set({
        result: {
          user: { id: userId, email: userEmail, nickname },
          accessToken, refreshToken, isNewUser,
        },
        expires: Date.now() + KAKAO_STATE_TTL_MS,
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
    console.error('[kakao/callback] error:', msg);
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
  } catch { error(res, '별명 설정 중 오류', 500); }
});

// GET /api/auth/me — 현재 유저 정보 조회
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.users.doc(req.userId!).get();
    if (!doc.exists) { error(res, '사용자 없음', 404); return; }
    const data = doc.data() as Record<string, unknown>;
    success(res, {
      id: doc.id,
      email: data.email,
      nickname: data.nickname ?? null,
      authProvider: data.authProvider,
      parentRole: data.parentRole ?? '',
    });
  } catch { error(res, '정보 조회 중 오류', 500); }
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

    const newHash = await bcrypt.hash(newPassword, 10);
    await collections.users.doc(req.userId!).update({ passwordHash: newHash });
    success(res, { message: '비밀번호가 변경되었습니다' });
  } catch { error(res, '비밀번호 변경 중 오류가 발생했습니다', 500); }
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

    const newHash = await bcrypt.hash(newPassword, 10);
    await collections.users.doc(req.userId!).update({ passwordHash: newHash });
    success(res, { message: '비밀번호가 설정되었습니다' });
  } catch { error(res, '비밀번호 설정 중 오류가 발생했습니다', 500); }
});

// GET /api/auth/me — 현재 유저 정보 조회 (확장)
// (기존 /me 엔드포인트가 위에 있으므로 여기서는 추가하지 않음)

// DELETE /api/auth/account — required by Google Play & Apple App Store
router.delete('/account', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // Firestore batch는 500건 한도 — 모든 삭제 대상을 모아서 분할 커밋
    const refs: FirebaseFirestore.DocumentReference[] = [];

    // 1. Find all children for this user
    const childrenSnap = await collections.children.where('userId', '==', userId).get();
    const childIds = childrenSnap.docs.map((d) => d.id);
    childrenSnap.docs.forEach((d) => refs.push(d.ref));

    // 2. Delete ALL related data for each child (GDPR/앱스토어 컴플라이언스)
    for (const childId of childIds) {
      const childSnaps = await Promise.all([
        collections.observations.where('childId', '==', childId).get(),
        collections.dailyTracking.where('childId', '==', childId).get(),
        collections.subscriptions.where('childId', '==', childId).get(),
        collections.coachingSessions.where('childId', '==', childId).get(),
        collections.followups.where('childId', '==', childId).get(),
        collections.learnedKnowledge.where('childId', '==', childId).get(),
        collections.pregnancyRecords.where('childId', '==', childId).get(),
        collections.momHealthChecks.where('childId', '==', childId).get(),
        collections.gdmRecords.where('childId', '==', childId).get(),
        collections.vaccinations.where('childId', '==', childId).get(),
        collections.dailyTraits.where('childId', '==', childId).get(),
        collections.milestoneChecks.where('childId', '==', childId).get(),
        collections.sleepPredictions.where('childId', '==', childId).get(),
        collections.autoDiaries.where('childId', '==', childId).get(),
        collections.recommendationCache.where('childId', '==', childId).get(),
        collections.analysisUsage.where('childId', '==', childId).get(),
      ]);
      for (const snap of childSnaps) {
        snap.docs.forEach((d) => refs.push(d.ref));
      }
    }

    // 3. Delete user-level data (userId 기반)
    const userSnaps = await Promise.all([
      collections.chatLogs.where('userId', '==', userId).get(),
      collections.posts.where('userId', '==', userId).get(),
      collections.postLikes.where('userId', '==', userId).get(),
      collections.postComments.where('userId', '==', userId).get(),
      collections.pushSchedules.where('userId', '==', userId).get(),
      collections.familyMembers.where('userId', '==', userId).get(),
      collections.conversationSummaries.where('userId', '==', userId).get(),
      collections.clinicReviews.where('userId', '==', userId).get(),
    ]);
    for (const snap of userSnaps) {
      snap.docs.forEach((d) => refs.push(d.ref));
    }

    // 4. Delete the user document itself
    refs.push(collections.users.doc(userId));

    // 5. 500건씩 나눠서 batch commit
    const BATCH_LIMIT = 500;
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
      const chunk = refs.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    success(res, { message: '계정과 모든 관련 데이터가 삭제되었습니다' });
  } catch {
    error(res, '계정 삭제 중 오류가 발생했습니다', 500);
  }
});

export default router;

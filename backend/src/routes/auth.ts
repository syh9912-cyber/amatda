import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { success, error } from '../utils/response';
import { verifySocialToken, SocialProvider } from '../services/social.auth';
import { collections, genId } from '../services/firestore';

const router = Router();

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { error(res, '이메일과 비밀번호를 입력해주세요'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { error(res, '올바른 이메일 형식을 입력해주세요'); return; }
    if (password.length < 6) { error(res, '비밀번호는 6자 이상이어야 합니다'); return; }

    const existing = await collections.users.where('email', '==', email).limit(1).get();
    if (!existing.empty) { error(res, '이미 가입된 이메일입니다', 409); return; }

    const id = genId();
    const passwordHash = await bcrypt.hash(password, 10);
    await collections.users.doc(id).set({
      email, passwordHash, authProvider: 'LOCAL', socialId: null,
      subscriptionTier: 'FREE', createdAt: new Date().toISOString(),
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

// POST /api/auth/change-password
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { error(res, '현재 비밀번호와 새 비밀번호를 입력해주세요'); return; }
    if (newPassword.length < 6) { error(res, '새 비밀번호는 6자 이상이어야 합니다'); return; }

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

export default router;

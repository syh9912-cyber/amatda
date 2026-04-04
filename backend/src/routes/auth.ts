import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { success, error } from '../utils/response';
import { verifySocialToken, SocialProvider } from '../services/social.auth';

const router = Router();
const prisma = new PrismaClient();

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      error(res, '이메일과 비밀번호를 입력해주세요');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error(res, '올바른 이메일 형식을 입력해주세요');
      return;
    }
    if (password.length < 6) {
      error(res, '비밀번호는 6자 이상이어야 합니다');
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      error(res, '이미 가입된 이메일입니다', 409);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    const tokens = generateTokens(user.id);
    success(res, { user: { id: user.id, email: user.email }, ...tokens }, 201);
  } catch (e) {
    error(res, '회원가입 처리 중 오류가 발생했습니다', 500);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      error(res, '이메일과 비밀번호를 입력해주세요');
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      error(res, '이메일 또는 비밀번호가 올바르지 않습니다', 401);
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      error(res, '이메일 또는 비밀번호가 올바르지 않습니다', 401);
      return;
    }

    const tokens = generateTokens(user.id);
    success(res, { user: { id: user.id, email: user.email }, ...tokens });
  } catch (e) {
    error(res, '로그인 처리 중 오류가 발생했습니다', 500);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      error(res, '리프레시 토큰이 필요합니다');
      return;
    }

    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
    const tokens = generateTokens(payload.userId);
    success(res, tokens);
  } catch (e) {
    error(res, '유효하지 않은 리프레시 토큰입니다', 401);
  }
});

// POST /api/auth/social
router.post('/social', async (req: Request, res: Response) => {
  try {
    const { provider, accessToken } = req.body;
    if (!provider || !accessToken) {
      error(res, 'provider와 accessToken이 필요합니다');
      return;
    }

    const validProviders: SocialProvider[] = ['GOOGLE', 'KAKAO', 'NAVER'];
    const upperProvider = provider.toUpperCase() as SocialProvider;
    if (!validProviders.includes(upperProvider)) {
      error(res, '지원하지 않는 소셜 로그인입니다. (GOOGLE, KAKAO, NAVER)');
      return;
    }

    // 소셜 토큰 검증 → 유저 정보 획득
    const socialUser = await verifySocialToken(upperProvider, accessToken);

    // 기존 유저 찾기 (socialId 우선, email 차선)
    let user = await prisma.user.findFirst({
      where: { socialId: socialUser.socialId, authProvider: upperProvider },
    });

    if (!user && socialUser.email) {
      user = await prisma.user.findUnique({ where: { email: socialUser.email } });
      if (user) {
        // 기존 이메일 계정에 소셜 연동
        user = await prisma.user.update({
          where: { id: user.id },
          data: { socialId: socialUser.socialId, authProvider: upperProvider },
        });
      }
    }

    // 신규 유저 자동 가입
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: socialUser.email,
          authProvider: upperProvider,
          socialId: socialUser.socialId,
        },
      });
    }

    const tokens = generateTokens(user.id);
    success(res, {
      user: { id: user.id, email: user.email, authProvider: user.authProvider },
      ...tokens,
      isNewUser: !user.children?.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '소셜 로그인 처리 중 오류가 발생했습니다';
    error(res, msg, 500);
  }
});

export default router;

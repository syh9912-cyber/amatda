import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { success, error } from '../utils/response';

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

export default router;

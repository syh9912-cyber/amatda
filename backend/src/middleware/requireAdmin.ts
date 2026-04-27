import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { error } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * 관리자 전용 라우트 가드.
 * authMiddleware 뒤에서 사용되어야 하며, req.userId 가 이미 세팅되어 있어야 한다.
 * Firebase Auth custom claim `admin === true` 인 계정만 통과시킨다.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) {
      error(res, '인증이 필요합니다', 401);
      return;
    }

    const user = await admin.auth().getUser(req.userId);
    const isAdmin = user.customClaims?.admin === true;

    if (!isAdmin) {
      error(res, '관리자 권한이 필요합니다', 403);
      return;
    }

    next();
  } catch (err) {
    logger.error('[middleware:requireAdmin]', err, { userId: req.userId });
    error(res, '권한 확인 실패', 500);
  }
}

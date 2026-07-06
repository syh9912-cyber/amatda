import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { error } from '../utils/response';

/**
 * 관리자 대시보드(가입자 목록) 전용 게이트.
 * 기존 authMiddleware(JWT)/requireAdmin(Firebase custom claim) 과 무관한 별도 경로 —
 * 단일 관리자 키를 `x-admin-key` 헤더로 비교(timing-safe)한다.
 */
export function adminDashboardAuth(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = env.ADMIN_DASHBOARD_KEY;
  if (!configuredKey) {
    error(res, '관리자 대시보드가 설정되지 않았습니다', 503);
    return;
  }

  const provided = req.header('x-admin-key') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(configuredKey);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    error(res, '인증 실패', 401);
    return;
  }
  next();
}

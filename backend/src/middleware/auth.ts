import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { setContextUserId } from '../utils/requestContext';

export interface AuthPayload {
  userId: string;
  typ?: 'access' | 'refresh';
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * JWT 표준 클레임 검증 (#1 출시 전 보안 강화):
 *   - alg HS256 핀 — 알고리즘 confusion 차단
 *   - iss/aud 검증 — 다른 시스템 토큰 거부
 *   - typ === 'access' — refresh token 으로 API 호출 차단
 */
const JWT_ISSUER = 'amatda-api';
const JWT_AUDIENCE = 'amatda-app';
const JWT_ALGO: jwt.Algorithm = 'HS256';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '인증이 필요합니다' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGO],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as AuthPayload;
    // typ 클레임으로 access/refresh 구분 — 시크릿이 같다면 typ만으로도 구분 안되지만, 다른 시크릿이라
    // jwt.verify 단계에서 이미 거부됨. 추가 안전망.
    if (payload.typ && payload.typ !== 'access') {
      res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다' });
      return;
    }
    req.userId = payload.userId;
    setContextUserId(payload.userId); // AI 사용량 기록용 — 인증 로직 자체는 무변경
    next();
  } catch {
    res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다' });
  }
}

/**
 * zod 기반 입력 검증 헬퍼.
 *
 * 사용 예:
 *   const body = parseBody(req, res, AskBodySchema);
 *   if (!body) return; // 검증 실패 시 자동으로 400 응답 — 호출자는 그냥 return.
 */
import { Request, Response } from 'express';
import { z, ZodSchema } from 'zod';
import { error } from './response';

function formatZodError(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return '입력 형식이 올바르지 않습니다';
  const path = first.path.length > 0 ? first.path.join('.') : '입력';
  return `${path}: ${first.message}`;
}

/**
 * req.body 를 schema 로 검증. 실패 시 400 응답 후 null 반환.
 * 성공 시 타입 안전한 파싱 결과 반환.
 */
export function parseBody<T>(
  req: Request,
  res: Response,
  schema: ZodSchema<T>,
): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    error(res, formatZodError(result.error), 400);
    return null;
  }
  return result.data;
}

/**
 * req.query 를 schema 로 검증. 실패 시 400 응답 후 null 반환.
 */
export function parseQuery<T>(
  req: Request,
  res: Response,
  schema: ZodSchema<T>,
): T | null {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    error(res, formatZodError(result.error), 400);
    return null;
  }
  return result.data;
}

/**
 * req.params 를 schema 로 검증. 실패 시 400 응답 후 null 반환.
 */
export function parseParams<T>(
  req: Request,
  res: Response,
  schema: ZodSchema<T>,
): T | null {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    error(res, formatZodError(result.error), 400);
    return null;
  }
  return result.data;
}

/**
 * baby-tracker 서버 sync API.
 *
 * 기존 frontend baby-tracker 는 AsyncStorage 만 사용해서 앱 데이터 삭제 / 재설치
 * 시 사용자 입력 기록이 영구 손실됨. 출시 차단 사항으로 식별되어 서버 sync 추가.
 *
 * 데이터 모델:
 *   - babyTrackerDays/{childId}_{date} — day 단위 records 배열
 *   - babyTrackerSessions/{childId}     — 진행 중인 sleep/breast 세션
 *
 * 동기화 전략 (offline-first):
 *   - 클라이언트 write → 로컬 AsyncStorage 즉시 + 서버 PUT fire-and-forget
 *   - 클라이언트 read  → 로컬 캐시 즉시 반환 + 백그라운드 서버 fetch + 머지
 *   - 충돌은 last-write-wins (서버 updatedAt 기준)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { logger } from '../utils/logger';
import { parseBody, parseParams, parseQuery } from '../utils/validate';
import { getChildIfAccessible } from '../utils/childAccess';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const TrackerRecordSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(['diaper', 'feeding', 'sleep', 'medication', 'custom']),
  subType: z.string().max(32),
  time: z.string().regex(TIME_RE),
  endTime: z.string().regex(TIME_RE).optional(),
  amount: z.number().min(0).max(10000).optional(),
  duration: z.number().min(0).max(24 * 60).optional(),
  note: z.string().max(500).optional(),
  createdAt: z.string().max(64).optional(),
});

const DayParamsSchema = z.object({
  childId: z.string().min(1).max(128),
  date: z.string().regex(DATE_RE, 'date 형식은 YYYY-MM-DD'),
});

const ChildParamsSchema = z.object({
  childId: z.string().min(1).max(128),
});

const PutDayBodySchema = z.object({
  records: z.array(TrackerRecordSchema).max(500),
});

const RangeQuerySchema = z.object({
  from: z.string().regex(DATE_RE),
  to: z.string().regex(DATE_RE),
});

const SleepSessionSchema = z.object({
  startTime: z.string().min(1).max(64),
  startDate: z.string().regex(DATE_RE),
  note: z.string().max(500).optional(),
}).nullable();

const BreastSessionSchema = z.object({
  side: z.enum(['left', 'right']),
  startTime: z.string().min(1).max(64),
  startDate: z.string().regex(DATE_RE),
  note: z.string().max(500).optional(),
}).nullable();

const PutSessionsBodySchema = z.object({
  sleepSession: SleepSessionSchema.optional(),
  breastSession: BreastSessionSchema.optional(),
});

/**
 * GET /api/baby-tracker/:childId/days/:date
 * 단일 날짜의 records 조회. 없으면 빈 배열 반환.
 */
router.get('/:childId/days/:date', authMiddleware, async (req: Request, res: Response) => {
  try {
    const params = parseParams(req, res, DayParamsSchema);
    if (!params) return;
    const { childId, date } = params;

    const access = await getChildIfAccessible(childId, req.userId, 'viewRecords', res);
    if (!access) return;

    const doc = await collections.babyTrackerDays.doc(`${childId}_${date}`).get();
    if (!doc.exists) {
      success(res, { childId, date, records: [], updatedAt: null });
      return;
    }
    const data = doc.data() as Record<string, unknown>;
    success(res, {
      childId,
      date,
      records: Array.isArray(data.records) ? data.records : [],
      updatedAt: data.updatedAt ?? null,
    });
  } catch (err) {
    logger.error('babyTracker/get-day', err);
    error(res, '기록 조회 중 오류가 발생했습니다', 500);
  }
});

/**
 * GET /api/baby-tracker/:childId/days?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 범위 조회. 최대 100일.
 */
router.get('/:childId/days', authMiddleware, async (req: Request, res: Response) => {
  try {
    const params = parseParams(req, res, ChildParamsSchema);
    if (!params) return;
    const query = parseQuery(req, res, RangeQuerySchema);
    if (!query) return;
    const { childId } = params;
    const { from, to } = query;

    const access = await getChildIfAccessible(childId, req.userId, 'viewRecords', res);
    if (!access) return;

    // doc id 가 `${childId}_${date}` 라 직접 ID 범위 쿼리는 어려움 → 별도 필드(date)로 쿼리
    const snap = await collections.babyTrackerDays
      .where('childId', '==', childId)
      .where('date', '>=', from)
      .where('date', '<=', to)
      .limit(100)
      .get();

    const days = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        date: data.date as string,
        records: Array.isArray(data.records) ? data.records : [],
        updatedAt: data.updatedAt ?? null,
      };
    });
    success(res, { childId, days });
  } catch (err) {
    logger.error('babyTracker/get-days-range', err);
    error(res, '기록 조회 중 오류가 발생했습니다', 500);
  }
});

/**
 * PUT /api/baby-tracker/:childId/days/:date
 * day records 전체 덮어쓰기 (last-write-wins). offline-first 클라이언트 write 동기화용.
 */
router.put('/:childId/days/:date', authMiddleware, async (req: Request, res: Response) => {
  try {
    const params = parseParams(req, res, DayParamsSchema);
    if (!params) return;
    const body = parseBody(req, res, PutDayBodySchema);
    if (!body) return;
    const { childId, date } = params;

    const access = await getChildIfAccessible(childId, req.userId, 'editRecords', res);
    if (!access) return;

    const docRef = collections.babyTrackerDays.doc(`${childId}_${date}`);
    const updatedAt = new Date().toISOString();
    await docRef.set({
      userId: req.userId,
      childId,
      date,
      records: body.records,
      updatedAt,
    }, { merge: false });

    success(res, { childId, date, records: body.records, updatedAt });
  } catch (err) {
    logger.error('babyTracker/put-day', err);
    error(res, '기록 저장 중 오류가 발생했습니다', 500);
  }
});

/**
 * GET /api/baby-tracker/:childId/sessions
 * 진행 중인 sleep/breast 세션 조회.
 */
router.get('/:childId/sessions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const params = parseParams(req, res, ChildParamsSchema);
    if (!params) return;
    const { childId } = params;

    const access = await getChildIfAccessible(childId, req.userId, 'viewRecords', res);
    if (!access) return;

    const doc = await collections.babyTrackerSessions.doc(childId).get();
    if (!doc.exists) {
      success(res, { childId, sleepSession: null, breastSession: null, updatedAt: null });
      return;
    }
    const data = doc.data() as Record<string, unknown>;
    success(res, {
      childId,
      sleepSession: data.sleepSession ?? null,
      breastSession: data.breastSession ?? null,
      updatedAt: data.updatedAt ?? null,
    });
  } catch (err) {
    logger.error('babyTracker/get-sessions', err);
    error(res, '세션 조회 중 오류가 발생했습니다', 500);
  }
});

/**
 * PUT /api/baby-tracker/:childId/sessions
 * 진행 중인 sleep/breast 세션 저장 (앱 재시작 시 복구). null 명시로 종료.
 */
router.put('/:childId/sessions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const params = parseParams(req, res, ChildParamsSchema);
    if (!params) return;
    const body = parseBody(req, res, PutSessionsBodySchema);
    if (!body) return;
    const { childId } = params;

    const access = await getChildIfAccessible(childId, req.userId, 'editRecords', res);
    if (!access) return;

    const updatedAt = new Date().toISOString();
    const update: Record<string, unknown> = {
      userId: req.userId,
      childId,
      updatedAt,
    };
    if (body.sleepSession !== undefined) update.sleepSession = body.sleepSession;
    if (body.breastSession !== undefined) update.breastSession = body.breastSession;

    await collections.babyTrackerSessions.doc(childId).set(update, { merge: true });
    success(res, { childId, ...update });
  } catch (err) {
    logger.error('babyTracker/put-sessions', err);
    error(res, '세션 저장 중 오류가 발생했습니다', 500);
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { getChildIfAccessible } from '../utils/childAccess';
import { logger } from '../utils/logger';

const router = Router();

interface PushScheduleBody {
  childId: string;
  pushToken: string;
  morning?: boolean;
  afternoon?: boolean;
  evening?: boolean;
  weekly?: boolean;
}

// ───────────────────────────────────────────────
// POST /api/retention/push-schedule
// ───────────────────────────────────────────────
//
// 정리 이력 (parent-level 시스템 제거):
// - GET /daily-card/:childId       — frontend 사용 0, 제거
// - GET /streak/:childId            — STREAK_LEVELS / parent-level 의존, 제거
// - GET /countdown/:childId         — frontend 사용 0, 제거
// - GET /push-content/:childId      — frontend 사용 0, 제거
// - POST /visit                     — streak 입력원, 제거
// - STREAK_LEVELS / getStreakLevel / getNextLevelDays — parent-level 의존, 제거
//
// 유지: /push-schedule (FCM 토큰 + 알림 시간대 저장 — notification-settings, _layout 사용 중)

router.post('/push-schedule', authMiddleware, async (req: Request, res: Response) => {
  try {
    const body = req.body as PushScheduleBody;
    const { childId, pushToken, morning, afternoon, evening, weekly } = body;

    if (!childId || !pushToken) {
      error(res, 'childId와 pushToken은 필수입니다');
      return;
    }

    // 보안: pushToken 형식 검증 — Expo push token 만 허용 (위조 발송 차단).
    // Expo 토큰 형식: ExponentPushToken[xxxxx] 또는 ExpoPushToken[xxxxx]
    if (!/^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(pushToken)) {
      logger.warn('retention/push-schedule', 'invalid pushToken format');
      error(res, 'pushToken 형식이 올바르지 않습니다');
      return;
    }

    // 자녀 소유권 확인
    const childData = await getChildIfAccessible(childId, req.userId, 'viewRecords', res).then(r => r?.data ?? null);
    if (!childData) return;

    const scheduleId = `${req.userId}_${childId}`;
    const scheduleData = {
      userId: req.userId,
      childId,
      pushToken,
      morning: morning ?? true,
      afternoon: afternoon ?? true,
      evening: evening ?? true,
      weekly: weekly ?? true,
      updatedAt: new Date().toISOString(),
    };

    await collections.pushSchedules.doc(scheduleId).set(scheduleData, { merge: true });

    success(res, {
      id: scheduleId,
      ...scheduleData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    error(res, msg, 500);
  }
});

export default router;

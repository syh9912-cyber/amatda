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
  locale?: string; // 'ko' | 'ja' | 'zh-Hant' — 백엔드 푸시 문구 언어 결정용
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
    const { childId, pushToken, morning, afternoon, evening, weekly, locale } = body;

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

    // locale 은 지원 언어만 저장(그 외/미전송은 필드 생략 → 발송 시 ko 폴백)
    const normalizedLocale =
      locale === 'ja' || locale === 'zh-Hant' || locale === 'ko' ? locale : undefined;

    const scheduleId = `${req.userId}_${childId}`;
    const scheduleData: Record<string, unknown> = {
      userId: req.userId,
      childId,
      pushToken,
      morning: morning ?? true,
      afternoon: afternoon ?? true,
      evening: evening ?? true,
      weekly: weekly ?? true,
      updatedAt: new Date().toISOString(),
    };
    if (normalizedLocale) scheduleData.locale = normalizedLocale;

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

// ───────────────────────────────────────────────
// POST /api/retention/screens — 화면 열람(조회) 기록 (관리자 대시보드 표시용)
// body: { screens: [{ s: 화면명, t: epoch ms }] }
//   - 유저당 1문서(screenActivity/{userId})에 최근 30개만 롤링 저장(저장량 상한).
//   - 화면명(경로)만 저장 — 상담 내용 등 PII 없음. 클라는 throttle(백그라운드/15개)로 호출.
//   - fire-and-forget 이라 실패해도 200 성향(유실 허용) — 단 서버 오류는 500.
// ───────────────────────────────────────────────
const MAX_RECENT_SCREENS = 30;
router.post('/screens', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { screens } = req.body as { screens?: Array<{ s?: string; t?: number }> };
    if (!Array.isArray(screens) || screens.length === 0) {
      success(res, { saved: false }); // 멱등 — 빈 배열이면 no-op
      return;
    }
    // 정규화 + 상한 (요청당 최대 50개, 화면명 64자)
    const incoming = screens
      .slice(0, 50)
      .filter((x) => x && typeof x.s === 'string' && x.s.length > 0)
      .map((x) => ({
        s: String(x.s).slice(0, 64),
        t: typeof x.t === 'number' && isFinite(x.t) ? new Date(x.t).toISOString() : new Date().toISOString(),
      }));
    if (incoming.length === 0) { success(res, { saved: false }); return; }

    const ref = collections.screenActivity.doc(req.userId!);
    const snap = await ref.get();
    const prev = snap.exists && Array.isArray(snap.data()!.recentScreens)
      ? (snap.data()!.recentScreens as Array<{ s: string; t: string }>)
      : [];
    const merged = [...prev, ...incoming].slice(-MAX_RECENT_SCREENS); // 최근 N개만 유지
    const expireAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30일 TTL 후보

    await ref.set({
      userId: req.userId!,
      recentScreens: merged,
      updatedAt: new Date().toISOString(),
      expireAt,
    }, { merge: true });

    success(res, { saved: true, count: merged.length });
  } catch (err: unknown) {
    logger.warn('retention/screens', err instanceof Error ? err.message : String(err));
    error(res, '화면 활동 저장 중 오류가 발생했습니다', 500);
  }
});

export default router;

/**
 * announcement — 앱 시작 공지 팝업.
 *
 * 공지는 Firebase Console(또는 관리자)에서 `announcements` 컬렉션에 문서로 작성한다.
 * 클라이언트는 Firestore 에 직접 접근하지 않고 이 엔드포인트(admin SDK)만 호출한다.
 *
 * 문서 필드:
 *   - title:    string   (제목)
 *   - body:     string   (본문)
 *   - imageUrl: string?   (상단 배너 이미지 URL — Storage 업로드 후 URL)
 *   - active:   boolean   (노출 on/off)
 *   - startAt:  Timestamp|string?  (노출 시작 — 없으면 즉시)
 *   - endAt:    Timestamp|string?  (노출 종료 — 없으면 무기한)
 *   - priority: number?   (여러 개 active 면 높은 값 우선)
 *   - createdAt: Timestamp(serverTimestamp)
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { logger } from '../utils/logger';

const router = Router();

interface AnnDoc {
  title?: string;
  body?: string;
  imageUrl?: string | null;
  active?: boolean;
  priority?: number;
  startAt?: unknown;
  endAt?: unknown;
  createdAt?: unknown;
}

/** Firestore Timestamp / ISO string / number(ms) → epoch ms (없으면 null). */
function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === 'object' && typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** GET /api/announcement/active — 현재 노출할 공지 1건 (없으면 null) */
router.get('/active', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    const snap = await collections.announcements.where('active', '==', true).limit(20).get();

    const candidates = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as AnnDoc) }))
      .filter((a) => {
        const s = toMs(a.startAt);
        const e = toMs(a.endAt);
        if (s != null && now < s) return false;
        if (e != null && now > e) return false;
        return true;
      })
      .sort((a, b) => {
        const pa = typeof a.priority === 'number' ? a.priority : 0;
        const pb = typeof b.priority === 'number' ? b.priority : 0;
        if (pb !== pa) return pb - pa;
        return (toMs(b.createdAt) ?? 0) - (toMs(a.createdAt) ?? 0);
      });

    const picked = candidates[0];
    if (!picked) {
      success(res, null);
      return;
    }
    success(res, {
      id: picked.id,
      title: picked.title ?? '',
      body: picked.body ?? '',
      imageUrl: picked.imageUrl ?? null,
    });
  } catch (err) {
    logger.error('announcement/active', err);
    error(res, '공지 조회 실패', 500);
  }
});

export default router;

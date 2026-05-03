import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { isValidLatLng } from '../utils/location';
import { logger } from '../utils/logger';

/**
 * 사용자 위치 등록·조회.
 * users/{userId} 문서에 직접 lat/lng/locationLabel/babyBirthYear 저장.
 *
 * babyBirthYear는 자녀 출생연도 — 동갑 매칭용 색인.
 * 자녀가 여럿이면 가장 최근에 선택한 자녀 기준으로 사용자가 직접 갱신.
 */

const router = Router();

const MAX_LABEL_LEN = 60;

/**
 * 좌표를 약 ~110m 격자로 라운딩 (소수점 3자리 = 1.11km/도 × 1/1000 ≈ 111m).
 * 이유: 정확한 좌표 저장 시 집 주소 역추적 가능 (스토커 위협). 매칭/거리 계산용
 *      목적에는 100m 단위면 충분.
 *
 * 0.001° = 위도 ~111m / 경도 ~111m (한국 위도에서 약 90m).
 */
function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** GET /api/mom-location — 내 등록된 위치 조회 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.users.doc(req.userId!).get();
    const data = doc.exists ? doc.data() : null;
    const lat = data?.lat;
    const lng = data?.lng;
    const label = data?.locationLabel as string | undefined;
    const birthYear = data?.babyBirthYear as number | undefined;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      success(res, { hasLocation: false });
      return;
    }
    success(res, {
      hasLocation: true,
      lat, lng,
      locationLabel: label ?? '',
      babyBirthYear: birthYear ?? null,
      updatedAt: data?.locationUpdatedAt ?? null,
    });
  } catch (err) {
    logger.error('mom-location:get', err, { userId: req.userId });
    error(res, '위치 조회 실패', 500);
  }
});

/** PUT /api/mom-location — 내 위치 등록·갱신 */
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { lat, lng, locationLabel, babyBirthYear } = req.body as {
      lat?: number; lng?: number; locationLabel?: string; babyBirthYear?: number;
    };

    if (!isValidLatLng(lat, lng)) {
      error(res, '위치 좌표가 올바르지 않습니다');
      return;
    }
    const label = (locationLabel ?? '').trim();
    if (label.length > MAX_LABEL_LEN) {
      error(res, `위치 이름은 ${MAX_LABEL_LEN}자 이하로 입력해주세요`);
      return;
    }

    // 프라이버시 보호: 정확한 좌표를 저장하지 않고 ~110m 격자로 라운딩.
    const roundedLat = roundCoord(lat as number);
    const roundedLng = roundCoord(lng as number);

    const update: Record<string, unknown> = {
      lat: roundedLat, lng: roundedLng,
      locationLabel: label,
      locationUpdatedAt: FieldValue.serverTimestamp(),
    };
    if (typeof babyBirthYear === 'number' && babyBirthYear >= 2010 && babyBirthYear <= 2050) {
      update.babyBirthYear = babyBirthYear;
    }

    await collections.users.doc(req.userId!).set(update, { merge: true });
    success(res, { saved: true, lat: roundedLat, lng: roundedLng, locationLabel: label });
  } catch (err) {
    logger.error('mom-location:put', err, { userId: req.userId });
    error(res, '위치 저장 실패', 500);
  }
});

/** DELETE /api/mom-location — 내 위치 삭제 */
router.delete('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    await collections.users.doc(req.userId!).set({
      lat: FieldValue.delete(),
      lng: FieldValue.delete(),
      locationLabel: FieldValue.delete(),
      locationUpdatedAt: FieldValue.delete(),
    }, { merge: true });
    success(res, { deleted: true });
  } catch (err) {
    logger.error('mom-location:delete', err, { userId: req.userId });
    error(res, '위치 삭제 실패', 500);
  }
});

export default router;

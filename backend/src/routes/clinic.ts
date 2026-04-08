import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';

const router = Router();

/** Haversine formula: 두 좌표 간 거리(km) 계산 */
function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 별점 유효성 검사 (1~5 정수) */
function isValidRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

interface RatingsInput {
  kindness: number;
  waitTime: number;
  convenience: number;
  expertise: number;
}

interface ClinicData {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  avgRatings: {
    kindness: number;
    waitTime: number;
    convenience: number;
    expertise: number;
    overall: number;
  };
  reviewCount: number;
  lastReviewAt: string;
}

interface ReviewData {
  userId: string;
  clinicId: string;
  clinicName: string;
  clinicAddress: string;
  latitude: number;
  longitude: number;
  ratings: RatingsInput;
  overallRating: number;
  comment: string;
  visitDate: string;
  childAgeAtVisit: number;
  createdAt: string;
}

// GET /nearby - 주변 소아과 조회
router.get(
  '/nearby',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 5;

      if (isNaN(lat) || isNaN(lng)) {
        error(res, '위도(lat)와 경도(lng)를 입력해주세요');
        return;
      }

      const snap = await collections.clinics.get();

      const nearbyClinics = snap.docs
        .map((doc) => {
          const data = doc.data() as ClinicData;
          const distance = getDistanceKm(
            lat,
            lng,
            data.latitude,
            data.longitude
          );
          return { id: doc.id, ...data, distance: Math.round(distance * 10) / 10 };
        })
        .filter((c) => c.distance <= radius)
        .sort((a, b) => {
          const aRating = a.avgRatings?.overall ?? 0;
          const bRating = b.avgRatings?.overall ?? 0;
          const ratingDiff = bRating - aRating;
          if (ratingDiff !== 0) return ratingDiff;
          return a.distance - b.distance;
        });

      success(res, { clinics: nearbyClinics, count: nearbyClinics.length });
    } catch (err: unknown) {
      console.error('nearby error:', err);
      error(res, '주변 병원 조회 중 오류가 발생했습니다', 500);
    }
  }
);

// POST /review - 후기 작성
router.post(
  '/review',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const {
        clinicName,
        clinicAddress,
        latitude,
        longitude,
        ratings,
        comment,
        visitDate,
        childId,
      } = req.body as {
        clinicName: unknown;
        clinicAddress: unknown;
        latitude: unknown;
        longitude: unknown;
        ratings: unknown;
        comment: unknown;
        visitDate: unknown;
        childId: unknown;
      };

      // 필수 필드 검증
      if (
        typeof clinicName !== 'string' ||
        !clinicName.trim()
      ) {
        error(res, '병원 이름을 입력해주세요');
        return;
      }
      if (
        typeof clinicAddress !== 'string' ||
        !clinicAddress.trim()
      ) {
        error(res, '병원 주소를 입력해주세요');
        return;
      }
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        error(res, '위치 정보(latitude, longitude)가 필요합니다');
        return;
      }
      if (typeof visitDate !== 'string' || !visitDate.trim()) {
        error(res, '방문일을 입력해주세요');
        return;
      }
      if (typeof childId !== 'string' || !childId.trim()) {
        error(res, '자녀 정보(childId)가 필요합니다');
        return;
      }

      // 별점 검증
      if (
        !ratings ||
        typeof ratings !== 'object' ||
        Array.isArray(ratings)
      ) {
        error(res, '별점 정보(ratings)가 필요합니다');
        return;
      }
      const r = ratings as Record<string, unknown>;
      if (
        !isValidRating(r.kindness) ||
        !isValidRating(r.waitTime) ||
        !isValidRating(r.convenience) ||
        !isValidRating(r.expertise)
      ) {
        error(res, '모든 별점은 1~5 사이 정수여야 합니다');
        return;
      }
      const validRatings: RatingsInput = {
        kindness: r.kindness as number,
        waitTime: r.waitTime as number,
        convenience: r.convenience as number,
        expertise: r.expertise as number,
      };

      // 코멘트 검증 (선택, 최대 100자)
      const trimmedComment =
        typeof comment === 'string' ? comment.trim() : '';
      if (trimmedComment.length > 100) {
        error(res, '한마디는 최대 100자까지 입력 가능합니다');
        return;
      }

      // 자녀 월령 계산
      const childDoc = await collections.children.doc(childId).get();
      if (!childDoc.exists) {
        error(res, '자녀 정보를 찾을 수 없습니다', 404);
        return;
      }
      const childData = childDoc.data()!;
      if (childData.userId !== userId) {
        error(res, '본인의 자녀만 선택할 수 있습니다', 403);
        return;
      }
      const birthDate = new Date(childData.birthDate as string);
      const visit = new Date(visitDate);
      const ageMonths =
        (visit.getFullYear() - birthDate.getFullYear()) * 12 +
        (visit.getMonth() - birthDate.getMonth());
      const childAgeAtVisit = Math.max(0, ageMonths);

      // 평균 별점 계산
      const overallRating =
        Math.round(
          ((validRatings.kindness +
            validRatings.waitTime +
            validRatings.convenience +
            validRatings.expertise) /
            4) *
            10
        ) / 10;

      const now = new Date().toISOString();
      const reviewId = genId();

      // 기존 clinic 문서 찾기 (이름+주소 기준)
      const clinicSnap = await collections.clinics
        .where('name', '==', clinicName.trim())
        .where('address', '==', clinicAddress.trim())
        .limit(1)
        .get();

      let clinicId: string;

      if (clinicSnap.empty) {
        // 새 clinic 생성
        clinicId = genId();
        const newClinic: ClinicData = {
          name: clinicName.trim(),
          address: clinicAddress.trim(),
          latitude,
          longitude,
          phone: '',
          avgRatings: {
            kindness: validRatings.kindness,
            waitTime: validRatings.waitTime,
            convenience: validRatings.convenience,
            expertise: validRatings.expertise,
            overall: overallRating,
          },
          reviewCount: 1,
          lastReviewAt: now,
        };
        await collections.clinics.doc(clinicId).set(newClinic);
      } else {
        // 기존 clinic 평균 재계산
        clinicId = clinicSnap.docs[0].id;
        const existing = clinicSnap.docs[0].data() as ClinicData;
        const count = existing.reviewCount;
        const newCount = count + 1;

        const updatedAvg = {
          kindness:
            Math.round(
              ((existing.avgRatings.kindness * count + validRatings.kindness) /
                newCount) *
                10
            ) / 10,
          waitTime:
            Math.round(
              ((existing.avgRatings.waitTime * count + validRatings.waitTime) /
                newCount) *
                10
            ) / 10,
          convenience:
            Math.round(
              ((existing.avgRatings.convenience * count +
                validRatings.convenience) /
                newCount) *
                10
            ) / 10,
          expertise:
            Math.round(
              ((existing.avgRatings.expertise * count +
                validRatings.expertise) /
                newCount) *
                10
            ) / 10,
          overall: 0,
        };
        updatedAvg.overall =
          Math.round(
            ((updatedAvg.kindness +
              updatedAvg.waitTime +
              updatedAvg.convenience +
              updatedAvg.expertise) /
              4) *
              10
          ) / 10;

        await collections.clinics.doc(clinicId).update({
          avgRatings: updatedAvg,
          reviewCount: newCount,
          lastReviewAt: now,
        });
      }

      // 리뷰 저장
      const review: ReviewData = {
        userId,
        clinicId,
        clinicName: clinicName.trim(),
        clinicAddress: clinicAddress.trim(),
        latitude,
        longitude,
        ratings: validRatings,
        overallRating,
        comment: trimmedComment,
        visitDate,
        childAgeAtVisit,
        createdAt: now,
      };
      await collections.clinicReviews.doc(reviewId).set(review);

      success(res, { id: reviewId, ...review }, 201);
    } catch (err: unknown) {
      console.error('review-post error:', err);
      error(res, '후기 작성 중 오류가 발생했습니다', 500);
    }
  }
);

// GET /:clinicId/reviews - 특정 병원 후기 목록
router.get(
  '/:clinicId/reviews',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const clinicId = req.params.clinicId as string;

      const clinicDoc = await collections.clinics.doc(clinicId).get();
      if (!clinicDoc.exists) {
        error(res, '병원을 찾을 수 없습니다', 404);
        return;
      }

      const snap = await collections.clinicReviews
        .where('clinicId', '==', clinicId)
        .get();

      const reviews = snap.docs.map((doc) => {
        const data = doc.data() as ReviewData;
        return {
          id: doc.id,
          ratings: data.ratings,
          overallRating: data.overallRating,
          comment: data.comment,
          visitDate: data.visitDate,
          childAgeAtVisit: data.childAgeAtVisit,
          createdAt: data.createdAt,
        };
      }).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

      success(res, {
        clinic: { id: clinicDoc.id, ...clinicDoc.data() },
        reviews,
        count: reviews.length,
      });
    } catch (err: unknown) {
      console.error('clinic-reviews error:', err);
      error(res, '후기 조회 중 오류가 발생했습니다', 500);
    }
  }
);

// GET /my-reviews - 내 후기 목록
router.get(
  '/my-reviews',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;

      const snap = await collections.clinicReviews
        .where('userId', '==', userId)
        .get();

      const reviews = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })).sort((a, b) => {
        const aDate = String((a as Record<string, unknown>).createdAt ?? '');
        const bDate = String((b as Record<string, unknown>).createdAt ?? '');
        return bDate.localeCompare(aDate);
      });

      success(res, { reviews, count: reviews.length });
    } catch (err: unknown) {
      console.error('my-reviews error:', err);
      error(res, '내 후기 조회 중 오류가 발생했습니다', 500);
    }
  }
);

export default router;

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';

const router = Router();
const prisma = new PrismaClient();

/** 두 좌표간 거리 계산 (km, Haversine) */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// GET /api/academies?lat=X&lng=Y&radius=5&ageMonths=X&type=탐구형
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 5;
    const ageMonths = parseInt(req.query.ageMonths as string, 10);
    const type = req.query.type as string | undefined;

    if (isNaN(lat) || isNaN(lng) || isNaN(ageMonths)) {
      error(res, 'lat, lng, ageMonths 파라미터가 필요합니다');
      return;
    }

    const all = await prisma.academy.findMany({
      where: {
        minAge: { lte: ageMonths },
        maxAge: { gte: ageMonths },
      },
    });

    // 거리 필터 + 기질 매칭
    const filtered = all
      .map((a) => {
        const dist = haversineKm(lat, lng, a.lat, a.lng);
        const traits: string[] = JSON.parse(a.suitableTraits);
        const traitMatch = type ? traits.includes(type) : true;
        return { ...a, distance: Math.round(dist * 100) / 100, suitableTraits: traits, traitMatch };
      })
      .filter((a) => a.distance <= radius)
      .sort((a, b) => {
        // 기질 매칭 우선, 그 다음 거리순
        if (a.traitMatch !== b.traitMatch) return a.traitMatch ? -1 : 1;
        return a.distance - b.distance;
      });

    const isFallback = filtered.length < 3;

    success(res, {
      academies: filtered,
      total: filtered.length,
      fallback: isFallback,
      fallbackMessage: isFallback
        ? '우리 동네엔 아직 추천 장소가 부족해요. 월간 도담 교구 구독을 추천드려요!'
        : null,
    });
  } catch (e) {
    error(res, '학원 조회 중 오류가 발생했습니다', 500);
  }
});

export default router;

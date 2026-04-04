import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';

const router = Router();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 5;
    const ageMonths = parseInt(req.query.ageMonths as string, 10);
    const type = req.query.type as string | undefined;
    if (isNaN(lat) || isNaN(lng) || isNaN(ageMonths)) { error(res, 'lat, lng, ageMonths 파라미터가 필요합니다'); return; }

    const snap = await collections.academies.get();
    type AcademyDoc = { minAge: number; maxAge: number; lat: number; lng: number; suitableTraits: string | string[]; name: string; category: string; [k: string]: unknown };
    const filtered = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as AcademyDoc) }))
      .filter((a) => a.minAge <= ageMonths && a.maxAge >= ageMonths)
      .map((a) => {
        const dist = haversineKm(lat, lng, a.lat as number, a.lng as number);
        const traits: string[] = typeof a.suitableTraits === 'string' ? JSON.parse(a.suitableTraits as string) : a.suitableTraits as string[];
        return { ...a, distance: Math.round(dist * 100) / 100, suitableTraits: traits, traitMatch: type ? traits.includes(type) : true };
      })
      .filter((a) => a.distance <= radius)
      .sort((a, b) => (a.traitMatch === b.traitMatch ? a.distance - b.distance : a.traitMatch ? -1 : 1));

    const isFallback = filtered.length < 3;
    success(res, { academies: filtered, total: filtered.length, fallback: isFallback, fallbackMessage: isFallback ? '우리 동네엔 아직 추천 장소가 부족해요. 월간 도담 교구 구독을 추천드려요!' : null });
  } catch { error(res, '학원 조회 중 오류가 발생했습니다', 500); }
});

export default router;

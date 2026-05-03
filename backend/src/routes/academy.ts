import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { getRecommendedAcademyTypes } from '../services/academy.recommend';
import { isValidLatLng } from '../utils/location';

const router = Router();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** GET /api/academies/recommend - trait-based academy type recommendations */
router.get('/recommend', authMiddleware, (req: Request, res: Response) => {
  try {
    const dominantType = req.query.dominantType as string;
    const ageMonths = parseInt(req.query.ageMonths as string, 10);
    // 입력 파싱 — fallback 값(서울 기본 좌표)은 isValidLatLng 검증을 항상 통과
    const rawLat = parseFloat(req.query.lat as string);
    const rawLng = parseFloat(req.query.lng as string);
    const lat = isValidLatLng(rawLat, rawLng) ? rawLat : 34.815;
    const lng = isValidLatLng(rawLat, rawLng) ? rawLng : 126.463;
    const regionName = (req.query.region as string) || '남악';

    if (!dominantType || isNaN(ageMonths)) {
      error(res, 'dominantType, ageMonths 파라미터가 필요합니다');
      return;
    }

    const recommendations = getRecommendedAcademyTypes(dominantType, ageMonths);

    const withNaverUrls = recommendations.map((rec) => {
      const query = `${rec.searchQuery} ${regionName}`;
      const naverMapUrl = `https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(query)}`;
      return { ...rec, naverMapUrl, lat, lng };
    });

    success(res, {
      dominantType,
      ageMonths,
      region: regionName,
      recommendations: withNaverUrls,
      total: withNaverUrls.length,
    });
  } catch {
    error(res, '학원 추천 조회 중 오류가 발생했습니다', 500);
  }
});

/** GET /api/academies - existing static academy search (fallback) */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 5;
    const ageMonths = parseInt(req.query.ageMonths as string, 10);
    const type = req.query.type as string | undefined;
    if (!isValidLatLng(lat, lng) || isNaN(ageMonths)) { error(res, 'lat, lng (유효 범위), ageMonths 파라미터가 필요합니다'); return; }

    const snap = await collections.academies.get();
    type RecommendReasons = Record<string, string>;
    type AcademyDoc = { minAge: number; maxAge: number; lat: number; lng: number; suitableTraits: string | string[]; recommendReasons?: string | RecommendReasons; name: string; category: string; [k: string]: unknown };
    const filtered = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as AcademyDoc) }))
      .filter((a) => a.minAge <= ageMonths && a.maxAge >= ageMonths)
      .map((a) => {
        const dist = haversineKm(lat, lng, a.lat as number, a.lng as number);
        const traits: string[] = typeof a.suitableTraits === 'string' ? JSON.parse(a.suitableTraits as string) : a.suitableTraits as string[];
        const reasons: RecommendReasons = typeof a.recommendReasons === 'string' ? JSON.parse(a.recommendReasons) : (a.recommendReasons || {});
        const recommendReason = type ? (reasons[type] || null) : null;
        return { ...a, distance: Math.round(dist * 100) / 100, suitableTraits: traits, traitMatch: type ? traits.includes(type) : true, recommendReason };
      })
      .filter((a) => a.distance <= radius)
      .sort((a, b) => (a.traitMatch === b.traitMatch ? a.distance - b.distance : a.traitMatch ? -1 : 1));

    const isFallback = filtered.length < 3;
    success(res, { academies: filtered, total: filtered.length, fallback: isFallback, fallbackMessage: isFallback ? '우리 동네엔 아직 추천 장소가 부족해요. 월간 도담 교구 구독을 추천드려요!' : null });
  } catch { error(res, '학원 조회 중 오류가 발생했습니다', 500); }
});

export default router;

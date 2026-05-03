import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getTraitWeather } from '../services/trait.weather';
import { fetchRealWeather } from '../services/real.weather';
import { getRecommendedActivities } from '../services/weather.activities';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { parseInnateDataFull } from '../utils/parse';
import { isValidLatLng } from '../utils/location';

const DEFAULT_LAT = 34.815;
const DEFAULT_LNG = 126.463;

const router = Router();

router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.children.doc(req.params.childId as string).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    const childData = doc.data()!;
    const innate = parseInnateDataFull(childData.innateData) as { dominantType: string };

    const dominantType: string = innate.dominantType;
    const traitWeather = getTraitWeather(dominantType);

    // 좌표: 쿼리 파라미터 (유효성 검증) → 기본값(남악)
    const rawLat = parseFloat(req.query.lat as string);
    const rawLng = parseFloat(req.query.lng as string);
    const valid = isValidLatLng(rawLat, rawLng);
    const lat = valid ? rawLat : DEFAULT_LAT;
    const lng = valid ? rawLng : DEFAULT_LNG;

    // 실제 날씨 조회 (실패 시 null → fallback)
    const realWeather = await fetchRealWeather(lat, lng);

    if (realWeather) {
      const activities = getRecommendedActivities(
        realWeather.weatherCode,
        dominantType
      );

      success(res, {
        childName: childData.name,
        dominantType,
        realWeather: {
          temperature: realWeather.temperature,
          description: realWeather.description,
          humidity: realWeather.humidity,
          feelsLike: realWeather.feelsLike,
          icon: realWeather.icon,
        },
        traitWeather: {
          weather: traitWeather.weather,
          emoji: traitWeather.emoji,
          message: traitWeather.message,
          tip: traitWeather.tip,
          color: traitWeather.color,
        },
        recommendedActivities: activities,
      });
    } else {
      // fallback: 기존 기질 날씨만 반환
      success(res, {
        childName: childData.name,
        dominantType,
        realWeather: null,
        traitWeather: {
          weather: traitWeather.weather,
          emoji: traitWeather.emoji,
          message: traitWeather.message,
          tip: traitWeather.tip,
          color: traitWeather.color,
        },
        recommendedActivities: [],
      });
    }
  } catch {
    error(res, '날씨 조회 중 오류가 발생했습니다', 500);
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { ACADEMIES } from '../../prisma/seed-data/academies';
import { FOOD_GUIDES } from '../../prisma/seed-data/food-guides';

const router = Router();

/**
 * POST /api/seed/academies
 * 기존 academies 컬렉션을 삭제하고 recommendReasons 포함하여 재시딩
 * 임시 엔드포인트 — 배포 후 1회 호출 뒤 제거
 */
router.post('/academies', async (_req: Request, res: Response) => {
  try {
    // 기존 문서 삭제
    const existing = await collections.academies.get();
    const deleteBatch = collections.academies.firestore.batch();
    existing.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();

    // 새 데이터 시딩
    let count = 0;
    for (const academy of ACADEMIES) {
      await collections.academies.doc().set({
        ...academy,
        suitableTraits: JSON.stringify(academy.suitableTraits),
        recommendReasons: JSON.stringify(academy.recommendReasons),
      });
      count++;
    }

    success(res, { message: `academies 재시딩 완료: ${count}개`, count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    error(res, `academies 시딩 오류: ${msg}`, 500);
  }
});

/**
 * POST /api/seed/food-guides
 * 기존 foodGuides 컬렉션을 삭제하고 recipe/youtubeQuery 포함하여 재시딩
 * 임시 엔드포인트 — 배포 후 1회 호출 뒤 제거
 */
router.post('/food-guides', async (_req: Request, res: Response) => {
  try {
    // 기존 문서 삭제
    const existing = await collections.foodGuides.get();
    const deleteBatch = collections.foodGuides.firestore.batch();
    existing.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();

    // 새 데이터 시딩 (foods를 JSON.stringify — recipe/youtubeQuery 포함)
    let count = 0;
    for (const guide of FOOD_GUIDES) {
      await collections.foodGuides.doc().set({
        targetAgeMin: guide.targetAgeMin,
        targetAgeMax: guide.targetAgeMax,
        suitableType: guide.suitableType,
        foods: JSON.stringify(guide.foods),
      });
      count++;
    }

    success(res, { message: `foodGuides 재시딩 완료: ${count}개`, count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    error(res, `foodGuides 시딩 오류: ${msg}`, 500);
  }
});

export default router;

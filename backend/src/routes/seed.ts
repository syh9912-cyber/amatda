import { Router, Request, Response } from 'express';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { ACADEMIES } from '../../prisma/seed-data/academies';
import { FOOD_GUIDES } from '../../prisma/seed-data/food-guides';
import { FAQ_DATA } from '../../prisma/seed-data/faq';
import { ONBOARDING_QUESTIONS } from '../../prisma/seed-data/onboarding-questions';

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

/**
 * POST /api/seed/faq
 * 기존 faq 컬렉션을 삭제하고 100개 FAQ 데이터를 재시딩
 * 임시 엔드포인트 — 배포 후 1회 호출 뒤 제거
 */
router.post('/faq', async (_req: Request, res: Response) => {
  try {
    // 기존 문서 삭제 (batch는 500개 제한이므로 분할)
    const existing = await collections.faq.get();
    const batchSize = 400;
    for (let i = 0; i < existing.docs.length; i += batchSize) {
      const chunk = existing.docs.slice(i, i + batchSize);
      const batch = collections.faq.firestore.batch();
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // 새 데이터 시딩
    let count = 0;
    for (const faq of FAQ_DATA) {
      await collections.faq.doc().set({
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
      });
      count++;
    }

    success(res, { message: `FAQ 재시딩 완료: ${count}개`, count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    error(res, `FAQ 시딩 오류: ${msg}`, 500);
  }
});

/**
 * POST /api/seed/onboarding-questions
 * 기존 onboardingQuestions 컬렉션을 삭제하고 120개(4그룹x30개, 각 6옵션) 재시딩
 */
router.post('/onboarding-questions', async (_req: Request, res: Response) => {
  try {
    // 기존 문서 삭제 (batch는 500개 제한이므로 분할)
    const existing = await collections.onboardingQuestions.get();
    const batchSize = 400;
    for (let i = 0; i < existing.docs.length; i += batchSize) {
      const chunk = existing.docs.slice(i, i + batchSize);
      const batch = collections.onboardingQuestions.firestore.batch();
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // 새 데이터 시딩
    let count = 0;
    for (const q of ONBOARDING_QUESTIONS) {
      await collections.onboardingQuestions.doc(q.id).set({
        text: q.questionText,
        options: JSON.stringify(q.options),
        ageGroup: q.ageGroup,
        category: q.category,
        order: count,
      });
      count++;
    }

    success(res, { message: `onboardingQuestions 재시딩 완료: ${count}개`, count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    error(res, `onboardingQuestions 시딩 오류: ${msg}`, 500);
  }
});

export default router;

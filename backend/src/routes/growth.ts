/**
 * 성장 분석 API 라우트
 * 사전 구축된 DB 기반으로 성장 상태 + 육아 패턴 분석 제공
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { calculateAge } from '../services/age.calculator';
import { analyzeAll } from '../services/growthAnalysis';
import { getChildIfAccessible } from '../utils/childAccess';

const router = Router();

/* ─── GET /api/growth/analysis/:childId ─── */

router.get('/analysis/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const access = await getChildIfAccessible(childId, req.userId, 'viewGrowth', res);
    if (!access) return;
    const childData = access.data;

    const birthDate = new Date(childData.birthDate as string);
    const { months } = calculateAge(birthDate);
    const gender = (childData.gender as string) === 'F' ? 'F' as const : 'M' as const;
    const height = childData.height as number | null ?? null;
    const weight = childData.weight as number | null ?? null;

    // 쿼리에서 육아기록 데이터 받기 (오늘 날짜 기준)
    const diaperCount = req.query.diaper ? Number(req.query.diaper) : null;
    const feedingCount = req.query.feeding ? Number(req.query.feeding) : null;
    const sleepHours = req.query.sleep ? Number(req.query.sleep) : null;

    const analysis = analyzeAll(
      { gender, months, height, weight },
      { months, diaperCount, feedingCount, sleepHours },
    );

    success(res, analysis);
  } catch (err: unknown) {
    console.error('growth analysis error:', err);
    error(res, '성장 분석 중 오류가 발생했습니다', 500);
  }
});

/* ─── POST /api/growth/update/:childId ─── */
/* 키/몸무게 업데이트 + 분석 결과 반환 */

router.post('/update/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const access = await getChildIfAccessible(childId, req.userId, 'editProfile', res);
    if (!access) return;
    const childData = access.data;

    const { height, weight } = req.body as { height?: number; weight?: number };
    const updates: Record<string, unknown> = {};

    if (typeof height === 'number' && height > 0) updates.height = height;
    if (typeof weight === 'number' && weight > 0) updates.weight = weight;

    if (Object.keys(updates).length === 0) {
      error(res, '키 또는 몸무게를 입력해주세요');
      return;
    }

    // DB 업데이트
    await collections.children.doc(childId).update(updates);

    // 업데이트된 데이터로 분석
    const birthDate = new Date(childData.birthDate as string);
    const { months } = calculateAge(birthDate);
    const gender = (childData.gender as string) === 'F' ? 'F' as const : 'M' as const;
    const finalHeight = (updates.height as number | undefined) ?? (childData.height as number | null) ?? null;
    const finalWeight = (updates.weight as number | undefined) ?? (childData.weight as number | null) ?? null;

    const analysis = analyzeAll(
      { gender, months, height: finalHeight, weight: finalWeight },
      { months },
    );

    success(res, { updated: updates, analysis });
  } catch (err: unknown) {
    console.error('growth update error:', err);
    error(res, '성장 정보 업데이트 중 오류가 발생했습니다', 500);
  }
});

export default router;

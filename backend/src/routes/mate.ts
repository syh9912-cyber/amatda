import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { calculateAge } from '../services/age.calculator';

const router = Router();
const prisma = new PrismaClient();

// 보완 기질 매핑 (서로 보완해주는 기질 조합)
const COMPLEMENT_MAP: Record<string, string[]> = {
  '탐구형': ['활동형', '감성형'],
  '활동형': ['분석형', '조화형'],
  '조화형': ['탐구형', '활동형'],
  '분석형': ['감성형', '조화형'],
  '감성형': ['탐구형', '분석형'],
};

// GET /api/mates/:childId?lat=X&lng=X&radius=5
router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const child = await prisma.child.findFirst({
      where: { id: req.params.childId as string, userId: req.userId },
    });
    if (!child) {
      error(res, '자녀를 찾을 수 없습니다', 404);
      return;
    }

    const innate = JSON.parse(child.innateData);
    const myAge = calculateAge(child.birthDate);
    const complementTypes = COMPLEMENT_MAP[innate.dominantType] ?? [];

    // 다른 유저의 자녀들 중에서 매칭
    const allChildren = await prisma.child.findMany({
      where: { userId: { not: req.userId } },
      include: { user: { select: { id: true } } },
    });

    const matches = allChildren
      .map((c) => {
        const cInnate = JSON.parse(c.innateData);
        const cAge = calculateAge(c.birthDate);
        const ageDiff = Math.abs(myAge.months - cAge.months);
        const isComplement = complementTypes.includes(cInnate.dominantType);
        const isSameAge = ageDiff <= 12; // 1년 이내

        return {
          id: c.id,
          gender: c.gender,
          ageLabel: cAge.label,
          ageMonths: cAge.months,
          dominantType: cInnate.dominantType,
          isComplement,
          isSameAge,
          matchScore: (isComplement ? 40 : 20) + (isSameAge ? 40 : 10) + (c.gender === child.gender ? 10 : 5),
          matchReason: [
            isComplement ? `${innate.dominantType}과 ${cInnate.dominantType}은 서로 보완하는 관계` : `${cInnate.dominantType} 기질`,
            isSameAge ? '비슷한 또래' : `${ageDiff}개월 차이`,
          ],
        };
      })
      .filter((m) => m.matchScore >= 30)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    success(res, {
      myChild: {
        name: child.name,
        dominantType: innate.dominantType,
        ageLabel: myAge.label,
      },
      complementTypes,
      matches,
      total: matches.length,
      message: matches.length === 0
        ? '아직 주변에 매칭 가능한 또래가 없��요. 더 ��은 부모님이 참여하면 매칭이 ���작됩니다!'
        : null,
    });
  } catch (e) {
    error(res, '메이트 매칭 중 오류가 발생했습니다', 500);
  }
});

export default router;

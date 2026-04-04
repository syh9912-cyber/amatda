import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { calculateAge } from '../services/age.calculator';
import { collections } from '../services/firestore';

const router = Router();

const COMPLEMENT_MAP: Record<string, string[]> = {
  '탐구형': ['활동형', '감성형'], '활동형': ['분석형', '조화형'],
  '조화형': ['탐구형', '활동형'], '분석형': ['감성형', '조화형'],
  '감성형': ['탐구형', '분석형'],
};

router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childDoc = await collections.children.doc(req.params.childId as string).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }

    const data = childDoc.data()!;
    const innate = typeof data.innateData === 'string' ? JSON.parse(data.innateData) : data.innateData;
    const myAge = calculateAge(new Date(data.birthDate as string));
    const complementTypes = COMPLEMENT_MAP[innate.dominantType] ?? [];

    const allSnap = await collections.children.where('userId', '!=', req.userId).get();
    const matches = allSnap.docs.map((d) => {
      const c = d.data();
      const cInnate = typeof c.innateData === 'string' ? JSON.parse(c.innateData) : c.innateData;
      const cAge = calculateAge(new Date(c.birthDate as string));
      const ageDiff = Math.abs(myAge.months - cAge.months);
      const isComplement = complementTypes.includes(cInnate.dominantType);
      const isSameAge = ageDiff <= 12;
      return {
        id: d.id, gender: c.gender, ageLabel: cAge.label, ageMonths: cAge.months,
        dominantType: cInnate.dominantType, isComplement, isSameAge,
        matchScore: (isComplement ? 40 : 20) + (isSameAge ? 40 : 10) + (c.gender === data.gender ? 10 : 5),
        matchReason: [isComplement ? `보완 기질 매칭` : cInnate.dominantType, isSameAge ? '비슷한 또래' : `${ageDiff}개월 차이`],
      };
    }).filter((m) => m.matchScore >= 30).sort((a, b) => b.matchScore - a.matchScore).slice(0, 10);

    success(res, { myChild: { name: data.name, dominantType: innate.dominantType, ageLabel: myAge.label }, complementTypes, matches, total: matches.length, message: matches.length === 0 ? '아직 매칭 가능한 또래가 없어요.' : null });
  } catch { error(res, '메이트 매칭 중 오류가 발생했습니다', 500); }
});

export default router;

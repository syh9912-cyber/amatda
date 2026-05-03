import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { calculateAge } from '../services/age.calculator';
import { collections } from '../services/firestore';
import { parseInnateDataFull } from '../utils/parse';

const router = Router();

const COMPLEMENT_MAP: Record<string, string[]> = {
  '탐구형': ['활동형', '감성형'], '활동형': ['분석형', '조화형'],
  '조화형': ['탐구형', '활동형'], '분석형': ['감성형', '조화형'],
  '감성형': ['탐구형', '분석형'],
};

// 매칭 후보 검색 시 안전한 상한 — 1차 필터(연령 ±12개월) 후 메모리에서 점수 계산.
// 실제 운영 시 사용자 동의(mateMatchOptIn) 플래그 추가 권장 (P1 follow-up).
const MATE_QUERY_LIMIT = 500;

router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childDoc = await collections.children.doc(req.params.childId as string).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }

    const data = childDoc.data()!;
    if (!data.birthDate) { error(res, '생년월일이 등록되어야 매칭이 가능해요', 400); return; }

    const innate = parseInnateDataFull(data.innateData) as { dominantType: string };
    const myAge = calculateAge(new Date(data.birthDate as string));
    const complementTypes = COMPLEMENT_MAP[innate.dominantType] ?? [];

    // 연령 기반 1차 필터 — 내 아이 출생일 ±12개월 (= 24개월 윈도우).
    // 이전 코드는 모든 사용자의 모든 children 을 스캔(O(N) Firestore 비용 + PII 대량 노출).
    // 이제 birthDate 범위 쿼리로 대상 모집단을 좁히고 .limit() 으로 안전 상한 적용.
    const myBirth = new Date(data.birthDate as string);
    const minBirth = new Date(myBirth);
    minBirth.setMonth(minBirth.getMonth() - 12);
    const maxBirth = new Date(myBirth);
    maxBirth.setMonth(maxBirth.getMonth() + 12);
    const minBirthStr = minBirth.toISOString().split('T')[0];
    const maxBirthStr = maxBirth.toISOString().split('T')[0];

    const allSnap = await collections.children
      .where('birthDate', '>=', minBirthStr)
      .where('birthDate', '<=', maxBirthStr)
      .orderBy('birthDate', 'asc')
      .limit(MATE_QUERY_LIMIT)
      .get();

    const matches = allSnap.docs
      .filter((d) => d.data().userId !== req.userId)  // 본인 자녀 제외 (앱 코드 단)
      .map((d) => {
        const c = d.data();
        const cInnate = parseInnateDataFull(c.innateData) as { dominantType: string };
        const cAge = calculateAge(new Date(c.birthDate as string));
        const ageDiff = Math.abs(myAge.months - cAge.months);
        const isComplement = complementTypes.includes(cInnate.dominantType);
        const isSameAge = ageDiff <= 12;
        return {
          // PII 최소화 — id 포함 (후속 페이지 라우팅용), 이름/사진/위치/생일 포함 X
          id: d.id, gender: c.gender, ageLabel: cAge.label, ageMonths: cAge.months,
          dominantType: cInnate.dominantType, isComplement, isSameAge,
          matchScore: (isComplement ? 40 : 20) + (isSameAge ? 40 : 10) + (c.gender === data.gender ? 10 : 5),
          matchReason: [isComplement ? '보완 기질 매칭' : cInnate.dominantType, isSameAge ? '비슷한 또래' : `${ageDiff}개월 차이`],
        };
      })
      .filter((m) => m.matchScore >= 30)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    success(res, { myChild: { name: data.name, dominantType: innate.dominantType, ageLabel: myAge.label }, complementTypes, matches, total: matches.length, message: matches.length === 0 ? '아직 매칭 가능한 또래가 없어요.' : null });
  } catch { error(res, '메이트 매칭 중 오류가 발생했습니다', 500); }
});

export default router;

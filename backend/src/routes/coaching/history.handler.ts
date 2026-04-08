import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections } from '../../services/firestore';
import { buildChildContext } from '../../services/coaching/context.builder';

// ─── 성장 마일스톤 데이터 ───

const MILESTONES: Array<{ months: number; label: string; items: string[] }> = [
  { months: 12, label: '12개월', items: ['혼자 서기', '엄마/아빠 말하기', '손가락으로 가리키기'] },
  { months: 18, label: '18개월', items: ['혼자 걷기', '단어 5~10개', '컵으로 마시기', '숟가락 사용 시도'] },
  { months: 24, label: '24개월', items: ['두 단어 조합', '계단 오르기', '간단한 지시 따르기', '또래에 관심'] },
  { months: 30, label: '30개월', items: ['세 단어 이상 문장', '점프하기', '이름 말하기', '옷 벗기 시도'] },
  { months: 36, label: '36개월', items: ['질문하기', '세발자전거', '친구와 놀기', '간단한 대화'] },
  { months: 48, label: '48개월', items: ['긴 문장 사용', '가위질', '혼자 옷 입기', '규칙 이해'] },
  { months: 60, label: '60개월', items: ['숫자 세기', '그림 그리기', '차례 지키기', '감정 표현'] },
];

export function registerHistoryHandlers(router: Router): void {
  // ─── GET /api/coaching/history/:childId ───

  router.get('/history/:childId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { childId } = req.params;
      const snap = await collections.coachingSessions
        .where('userId', '==', req.userId)
        .where('childId', '==', childId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const sessions = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));

      success(res, sessions);
    } catch (err) {
      console.error('History error:', err);
      error(res, '코칭 기록 조회 중 오류가 발생했습니다', 500);
    }
  });

  // ─── GET /api/coaching/followups/:childId ───

  router.get('/followups/:childId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { childId } = req.params;
      const now = new Date().toISOString();

      const snap = await collections.followups
        .where('userId', '==', req.userId)
        .where('childId', '==', childId)
        .where('status', '==', 'pending')
        .orderBy('dueDate', 'asc')
        .get();

      const allFollowups: Array<Record<string, unknown>> = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return { id: d.id, ...data };
      });
      const dueFollowups = allFollowups.filter((f) => {
        const due = f.dueDate as string | undefined;
        return due ? due <= now : false;
      });

      success(res, dueFollowups);
    } catch (err) {
      console.error('Followups error:', err);
      error(res, '팔로업 조회 중 오류가 발생했습니다', 500);
    }
  });

  // ─── GET /api/coaching/milestones/:childId ───

  router.get('/milestones/:childId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const childId = req.params.childId as string;
      const child = await buildChildContext(childId, req.userId!);
      if (!child) { error(res, '자녀 정보 없음', 404); return; }

      // 현재 월령에 해당하는 마일스톤 + 다음 마일스톤
      const current = MILESTONES.filter((m) => m.months <= child.ageMonths).pop();
      const next = MILESTONES.find((m) => m.months > child.ageMonths);

      success(res, {
        childName: child.name,
        ageMonths: child.ageMonths,
        ageInfo: child.ageInfo,
        temperament: child.temperament,
        current: current ? {
          label: `${current.label} 발달 체크`,
          items: current.items,
        } : null,
        next: next ? {
          label: `다음 목표: ${next.label}`,
          monthsUntil: next.months - child.ageMonths,
          items: next.items,
        } : null,
      });
    } catch {
      error(res, '마일스톤 조회 중 오류', 500);
    }
  });
}

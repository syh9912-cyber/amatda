import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections } from '../../services/firestore';
import { buildChildContext } from '../../services/coaching/context.builder';
import { logger } from '../../utils/logger';

export function registerFollowupHandler(router: Router): void {
  // ─── POST /api/coaching/followup/:id/respond ───

  router.post('/followup/:id/respond', authMiddleware, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { answer } = req.body as { answer: string };

      if (!answer) {
        error(res, '답변을 입력해주세요');
        return;
      }

      const doc = await collections.followups.doc(id).get();
      if (!doc.exists) {
        error(res, '팔로업을 찾을 수 없습니다', 404);
        return;
      }

      const followupData = doc.data() as Record<string, unknown>;
      if (followupData.userId !== req.userId) {
        error(res, '권한이 없습니다', 403);
        return;
      }

      // 팔로업 응답 -> 새 코칭 세션으로 처리
      const child = await buildChildContext(
        followupData.childId as string,
        req.userId!
      );
      const temperament = child?.temperament ?? '조화형';

      const positive = answer.includes('좋아') || answer.includes('나아') || answer.includes('줄었');
      const coachingReply = positive
        ? `다행이에요! ${temperament} 기질의 아이에게 잘 맞는 방법을 찾으신 것 같아요. 꾸준히 유지해주세요.`
        : `아직 어려우시군요. ${temperament} 기질의 아이에게는 시간이 좀 더 필요할 수 있어요. 다른 방법을 시도해보시거나, 궁금한 점이 있으면 더 질문해주세요.`;

      await collections.followups.doc(id).update({
        response: answer,
        respondedAt: new Date().toISOString(),
        coachingReply,
        status: 'completed',
      });

      success(res, { coachingReply });
    } catch (err: unknown) {
      logger.error('route', err);
      error(res, '팔로업 응답 중 오류가 발생했습니다', 500);
    }
  });
}

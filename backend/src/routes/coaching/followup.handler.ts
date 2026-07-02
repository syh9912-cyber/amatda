import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections } from '../../services/firestore';
import { buildChildContext } from '../../services/coaching/context.builder';
import { logger } from '../../utils/logger';

// 비한국어 로케일 기질 라벨 (추가형) — 내부 저장 키(탐구형 등)는 한국어 그대로 유지
const TEMPERAMENT_LABEL: Record<'ja' | 'zh-Hant', Record<string, string>> = {
  ja: { 탐구형: '探求タイプ', 활동형: '活動タイプ', 조화형: '調和タイプ', 분석형: '分析タイプ', 감성형: '感性タイプ' },
  'zh-Hant': { 탐구형: '探索型', 활동형: '活動型', 조화형: '協調型', 분석형: '分析型', 감성형: '感性型' },
};
function localizeTemperament(temperament: string, locale?: string): string {
  if (locale === 'ja' || locale === 'zh-Hant') {
    return TEMPERAMENT_LABEL[locale][temperament] ?? temperament;
  }
  return temperament;
}

// 긍정 답변 키워드 감지 — 로케일별 분기(추가형), 기존 한국어 키워드는 무변경
const POSITIVE_KEYWORDS: Partial<Record<'ja' | 'zh-Hant', string[]>> = {
  ja: ['いい', '良い', 'よい', 'マシ', '楽に', '減っ', '落ち着'],
  'zh-Hant': ['好轉', '好多了', '不錯', '改善', '減少', '減輕', '緩解'],
};
function isPositiveAnswer(answer: string, locale?: string): boolean {
  if (locale === 'ja' || locale === 'zh-Hant') {
    return (POSITIVE_KEYWORDS[locale] ?? []).some((kw) => answer.includes(kw));
  }
  return answer.includes('좋아') || answer.includes('나아') || answer.includes('줄었');
}

export function registerFollowupHandler(router: Router): void {
  // ─── POST /api/coaching/followup/:id/respond ───

  router.post('/followup/:id/respond', authMiddleware, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { answer, locale } = req.body as { answer: string; locale?: string };

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
      const temperamentRaw = child?.temperament ?? '조화형';
      const temperament = localizeTemperament(temperamentRaw, locale);

      const positive = isPositiveAnswer(answer, locale);
      let coachingReply: string;
      if (locale === 'ja') {
        coachingReply = positive
          ? `よかったです！${temperament}のお子さんに合う方法が見つかったようですね。続けてみてください。`
          : `まだ難しいのですね。${temperament}のお子さんには、もう少し時間が必要かもしれません。他の方法を試したり、気になることがあればまた質問してください。`;
      } else if (locale === 'zh-Hant') {
        coachingReply = positive
          ? `太好了！看來您找到了適合${temperament}孩子的方法，請繼續保持。`
          : `目前還有點困難呢。${temperament}的孩子可能還需要多一點時間。可以試試其他方法，或有任何疑問都歡迎再提問。`;
      } else {
        coachingReply = positive
          ? `다행이에요! ${temperament} 기질의 아이에게 잘 맞는 방법을 찾으신 것 같아요. 꾸준히 유지해주세요.`
          : `아직 어려우시군요. ${temperament} 기질의 아이에게는 시간이 좀 더 필요할 수 있어요. 다른 방법을 시도해보시거나, 궁금한 점이 있으면 더 질문해주세요.`;
      }

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

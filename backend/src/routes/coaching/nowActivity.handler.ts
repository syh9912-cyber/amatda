import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { collections } from '../../services/firestore';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiJSON } from '../../services/coaching/gemini.client';

function buildMockActivity(
  name: string, temperament: string, ageInfo: string, timeOfDay: string
): Record<string, string> {
  const activities: Record<string, Record<string, { activity: string; duration: string; reason: string }>> = {
    '활동형': {
      '오전': { activity: `${name}이와 함께 음악에 맞춰 신체 놀이를 해보세요. 점프, 스트레칭, 동물 흉내 내기 등을 섞으면 좋아요.`, duration: '15~20분', reason: '활동형 기질의 아이는 오전에 에너지 발산이 중요해요.' },
      '오후': { activity: `${name}이와 블록이나 퍼즐로 조용한 집중 놀이를 해보세요.`, duration: '10~15분', reason: '오후에는 차분한 활동으로 균형을 잡아주면 좋아요.' },
      '저녁': { activity: `${name}이와 오늘 하루 있었던 일을 그림으로 그려보세요.`, duration: '10분', reason: '저녁에는 하루를 정리하는 차분한 활동이 수면에 도움돼요.' },
    },
    '탐구형': {
      '오전': { activity: `${name}이와 물 놀이 실험을 해보세요. 어떤 물건이 뜨고 가라앉는지 관찰해보세요.`, duration: '15~20분', reason: '탐구형 아이는 실험과 관찰을 통해 가장 잘 배워요.' },
      '오후': { activity: `${name}이와 집에 있는 재료로 간단한 요리를 함께 해보세요.`, duration: '20분', reason: '요리는 탐구형 아이의 오감을 자극하는 훌륭한 활동이에요.' },
      '저녁': { activity: `${name}이에게 오늘 가장 궁금했던 것을 물어보고 함께 이야기해보세요.`, duration: '10분', reason: '하루의 호기심을 나누면 탐구형 아이의 사고력이 자라요.' },
    },
  };

  const temperamentActivities = activities[temperament] ?? activities['활동형'];
  const timeActivity = temperamentActivities[timeOfDay] ?? temperamentActivities['오전'];

  return {
    childName: name,
    timeOfDay,
    activity: timeActivity.activity,
    duration: timeActivity.duration,
    reason: timeActivity.reason,
  };
}

export function registerNowActivityHandler(router: Router): void {
  // ─── POST /api/coaching/now-activity ───

  router.post('/now-activity', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { childId } = req.body as { childId: string };
      if (!childId) { error(res, 'childId 필수'); return; }

      const child = await buildChildContext(childId, req.userId!);
      if (!child) { error(res, '자녀 정보 없음', 404); return; }

      // 현재 시간대 판단
      const hour = new Date().getHours();
      let timeOfDay = '오전';
      if (hour >= 12 && hour < 17) timeOfDay = '오후';
      else if (hour >= 17) timeOfDay = '저녁';

      // 최근 고민 조회 (최근 3개 세션)
      const recentSnap = await collections.coachingSessions
        .where('userId', '==', req.userId)
        .where('childId', '==', childId)
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();
      const recentConcerns = recentSnap.docs
        .map((d) => (d.data() as Record<string, unknown>).category as string)
        .filter(Boolean)
        .join(', ') || '없음';

      if (!isGeminiAvailable()) {
        success(res, buildMockActivity(child.name, child.temperament, child.ageInfo, timeOfDay));
        return;
      }

      try {
        const prompt = `너는 영유아 활동 전문가야. 지금 이 순간 아이와 할 수 있는 구체적인 활동 1가지를 추천해.

아이: ${child.name} (${child.ageInfo}, ${child.gender}, ${child.temperament})
현재 시간대: ${timeOfDay}
최근 고민 카테고리: ${recentConcerns}

규칙:
- 기질과 시간대에 맞는 현실적 활동
- 사주/오행 용어 금지

반드시 아래 JSON만 출력해:
{
  "activity": "구체적 활동명과 방법 1~2문장",
  "duration": "예상 소요 시간 (예: 15~20분)",
  "reason": "이 활동이 이 기질의 아이에게 좋은 이유 1문장"
}`;

        const parsed = await callGeminiJSON<Record<string, string>>(prompt, {
          temperature: 0.6,
          maxTokens: 300,
        });

        success(res, {
          childName: child.name,
          timeOfDay,
          activity: parsed.activity || '',
          duration: parsed.duration || '',
          reason: parsed.reason || '',
        });
      } catch {
        success(res, buildMockActivity(child.name, child.temperament, child.ageInfo, timeOfDay));
      }
    } catch {
      error(res, '활동 추천 중 오류', 500);
    }
  });
}

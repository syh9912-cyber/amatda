import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiJSON } from '../../services/coaching/gemini.client';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import { parseBody } from '../../utils/validate';
import { shouldRejectAIResponse } from '../../services/coaching/forbidden.filter';

const FirstTalkBodySchema = z.object({
  childId: z.string().min(1).max(128),
});

// ─── 연령/기질별 대표 고민 ───

// 연령별 자주 묻는 고민 예시 (quickOptions로 노출 — 누르면 그 자체가 자연스러운 질문이 됨)
const STARTER_TOPICS: Record<string, string[]> = {
  infant: ['밤에 자주 깨요', '수유량이 걱정돼요', '낯가림이 심해요'],
  toddler: ['떼를 많이 써요', '편식이 심해요', '잠 들기 힘들어해요'],
  preschool: ['친구랑 잘 못 어울려요', '집중력이 짧아요', '감정 기복이 커요'],
};

// 모든 답변 가능하도록 열린 초대 문구
const OPEN_INVITATION = '지금 육아에서 어려운 점이나 궁금한 게 있으면 무엇이든 편하게 물어봐 주세요!';

function getDefaultGreeting(
  name: string, _ageInfo: string, temperament: string, topics: string[]
): { intro: string; traitSummary: string; suggestedQuestion: string; quickOptions: string[] } {
  const traitDesc: Record<string, string> = {
    '활동형': `${name}이는 에너지가 넘치는 활동형이에요! 충분히 움직일 수 있는 시간을 주면 더 잘 먹고 잘 자요.`,
    '탐구형': `${name}이는 호기심 가득한 탐구형이에요! 새로운 걸 발견하면 집중력이 높아지니 탐색 시간을 충분히 주세요.`,
    '조화형': `${name}이는 따뜻한 조화형이에요! 규칙적인 생활과 미리 알려주기가 아이에게 안정감을 줘요.`,
    '분석형': `${name}이는 꼼꼼한 분석형이에요! 이유를 설명해주면 더 잘 따라오니 "왜"를 알려주세요.`,
    '감성형': `${name}이는 감정이 풍부한 감성형이에요! 감정을 먼저 읽어주고 공감해주면 큰 힘이 돼요.`,
  };

  return {
    intro: `${name}이를 만나서 반가워요!`,
    traitSummary: traitDesc[temperament] ?? `${name}이는 고유한 기질을 가진 아이에요. 아이 성향을 이해하면 육아가 수월해져요.`,
    suggestedQuestion: OPEN_INVITATION,
    quickOptions: topics,
  };
}

export function registerFirstTalkHandler(router: Router): void {
  // ─── POST /api/coaching/first-talk ───

  router.post('/first-talk', authMiddleware, async (req: Request, res: Response) => {
    try {
      const body = parseBody(req, res, FirstTalkBodySchema);
      if (!body) return;
      const { childId } = body;

      const child = await buildChildContext(childId, req.userId!);
      if (!child) {
        error(res, '자녀 정보를 찾을 수 없습니다', 404);
        return;
      }

      // 연령 구간 결정
      let ageGroup = 'infant';
      if (child.ageMonths >= 25 && child.ageMonths <= 72) ageGroup = 'toddler';
      else if (child.ageMonths > 72) ageGroup = 'preschool';

      // 연령별 시작 고민 토픽
      const topics = STARTER_TOPICS[ageGroup] ?? STARTER_TOPICS.toddler;

      // AI에게 첫 인사 생성 요청
      let greeting: {
        intro: string;
        traitSummary: string;
        suggestedQuestion: string;
        quickOptions: string[];
      };

      if (isGeminiAvailable()) {
        try {
          const prompt = `너는 영유아 육아 코치야. 아이가 방금 등록되었어. 부모에게 처음 인사하면서 아이 기질을 짧게 설명하고, 부모가 자유롭게 무엇이든 물어볼 수 있도록 따뜻하게 초대해줘.

아이 정보:
- 나이: ${child.ageInfo}
- 성별: ${child.gender}
- 기질: ${child.temperament}
- 기질 특성: ${child.temperamentDetail}

규칙:
1. suggestedQuestion은 부모가 무엇이든 자유롭게 질문할 수 있도록 초대하는 열린 문구 (예: "지금 육아에서 어려운 점이나 궁금한 게 있으면 무엇이든 편하게 물어봐 주세요!")
2. quickOptions는 3개, 부모가 바로 터치하면 그 자체가 자연스러운 질문/고민이 되는 짧은 표현 (예: "밤에 자주 깨요", "편식이 심해요", "떼를 많이 써요"). 예/아니오 답변 형태 금지.
3. traitSummary는 2문장 이내, 쉬운 말로
4. '사주/오행/천간/지지' 용어 절대 금지

반드시 아래 JSON만 출력해:
{
  "intro": "반갑다는 인사 1문장",
  "traitSummary": "기질 설명 2문장 이내",
  "suggestedQuestion": "자유 질문 초대 문구 1문장",
  "quickOptions": ["고민예시1", "고민예시2", "고민예시3"]
}`;

          greeting = await callGeminiJSON<typeof greeting>(prompt, {
            temperature: 0.5,
            maxTokens: 300,
          });
          // 응답 후처리: 사주/오행 등 금지 용어 검출 시 fallback
          if (shouldRejectAIResponse(greeting, 'firstTalk.handler')) {
            greeting = getDefaultGreeting('아이', child.ageInfo, child.temperament, topics);
          }
        } catch {
          greeting = getDefaultGreeting('아이', child.ageInfo, child.temperament, topics);
        }
      } else {
        greeting = getDefaultGreeting('아이', child.ageInfo, child.temperament, topics);
      }

      // NOTE: 첫 질문을 conversationSummaries에 저장하던 로직은 제거.
      // 이유: FirstTalkCard.tsx가 이미 사용자 답변 앞에 '[코치 질문: ...]' 접두사를
      //       넣어 AI에 맥락을 전달함. history에도 같은 질문을 저장하면 AI가
      //       동일 질문을 중복으로 보고 혼란 → 무관한 주제로 hallucination
      //       (예: '떼' 또는 '음식 변화')하는 회귀가 발생.
      //
      // 결과: 원래 흐름(접두사로 컨텍스트 전달, history 비어있음)이 가장 안정적.

      success(res, {
        childId,
        childName: child.name,
        ageInfo: child.ageInfo,
        temperament: child.temperament,
        ...greeting,
      });
    } catch (err: unknown) {
      logger.error('route', err);
      error(res, '첫 대화 생성 중 오류가 발생했습니다', 500);
    }
  });
}

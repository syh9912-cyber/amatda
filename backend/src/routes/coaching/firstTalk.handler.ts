import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiJSON } from '../../services/coaching/gemini.client';

// ─── 연령/기질별 대표 고민 ───

const TOP_CONCERNS: Record<string, Record<string, { question: string; options: string[] }>> = {
  infant: {
    '활동형': { question: '밤에 자주 깨는 편인가요?', options: ['네, 자주 깨요', '가끔 깨요', '잘 자는 편이에요'] },
    '탐구형': { question: '낯선 곳에 가면 예민해지나요?', options: ['네, 많이 예민해요', '조금 그래요', '괜찮은 편이에요'] },
    '조화형': { question: '엄마와 떨어지면 많이 우나요?', options: ['네, 많이 울어요', '조금 보채요', '괜찮아요'] },
    '분석형': { question: '새로운 음식을 잘 먹나요?', options: ['거부하는 편이에요', '조금 까다로워요', '잘 먹어요'] },
    '감성형': { question: '쉽게 보채거나 칭얼거리나요?', options: ['네, 자주 그래요', '가끔 그래요', '잘 안 그래요'] },
  },
  toddler: {
    '활동형': { question: '가만히 앉아있기 힘들어하나요?', options: ['네, 많이 그래요', '조금 그래요', '괜찮아요'] },
    '탐구형': { question: '"왜?" 질문이 끝이 없나요?', options: ['네, 끊임없어요', '가끔 그래요', '아직 별로 안 해요'] },
    '조화형': { question: '어린이집 갈 때 많이 우나요?', options: ['네, 매일 울어요', '가끔 울어요', '잘 다녀요'] },
    '분석형': { question: '편식이 심한 편인가요?', options: ['네, 심해요', '조금 까다로워요', '잘 먹어요'] },
    '감성형': { question: '사소한 일에도 잘 우나요?', options: ['네, 자주 울어요', '가끔 그래요', '잘 안 울어요'] },
  },
  preschool: {
    '활동형': { question: '친구와 놀 때 거칠게 노나요?', options: ['네, 좀 거칠어요', '가끔 그래요', '순한 편이에요'] },
    '탐구형': { question: '한 가지에 오래 집중하기 어려워하나요?', options: ['네, 많이 그래요', '조금 그래요', '집중 잘해요'] },
    '조화형': { question: '혼자 놀기보다 항상 같이 놀자고 하나요?', options: ['네, 항상 그래요', '가끔 그래요', '혼자도 잘 놀아요'] },
    '분석형': { question: '실수하면 크게 속상해하나요?', options: ['네, 많이 그래요', '조금 그래요', '괜찮아해요'] },
    '감성형': { question: '기분이 자주 바뀌나요?', options: ['네, 자주 바뀌어요', '가끔 그래요', '안정적이에요'] },
  },
};

function getDefaultGreeting(
  name: string, _ageInfo: string, temperament: string, concern: { question: string; options: string[] }
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
    suggestedQuestion: concern.question,
    quickOptions: concern.options,
  };
}

export function registerFirstTalkHandler(router: Router): void {
  // ─── POST /api/coaching/first-talk ───

  router.post('/first-talk', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { childId } = req.body as { childId: string };
      if (!childId) {
        error(res, 'childId는 필수입니다');
        return;
      }

      const child = await buildChildContext(childId, req.userId!);
      if (!child) {
        error(res, '자녀 정보를 찾을 수 없습니다', 404);
        return;
      }

      // 연령 구간 결정
      let ageGroup = 'infant';
      if (child.ageMonths >= 25 && child.ageMonths <= 72) ageGroup = 'toddler';
      else if (child.ageMonths > 72) ageGroup = 'preschool';

      // 기질별 대표 고민
      const concerns = TOP_CONCERNS[ageGroup] ?? TOP_CONCERNS.toddler;
      const concern = concerns[child.temperament] ?? concerns['조화형'];

      // AI에게 첫 인사 생성 요청
      let greeting: {
        intro: string;
        traitSummary: string;
        suggestedQuestion: string;
        quickOptions: string[];
      };

      if (isGeminiAvailable()) {
        try {
          const prompt = `너는 영유아 육아 코치야. 아이가 방금 등록되었어. 부모에게 처음 인사하면서 아이 기질을 짧게 설명하고, 쉬운 첫 질문을 해줘.

아이 정보:
- 이름: ${child.name}
- 나이: ${child.ageInfo}
- 성별: ${child.gender}
- 기질: ${child.temperament}
- 기질 특성: ${child.temperamentDetail}

규칙:
1. suggestedQuestion은 "~나요?" "~인가요?" 형태의 간단한 예/아니오 질문 (15자 내외)
2. quickOptions는 3개, 부모가 바로 터치할 수 있는 짧은 답변 (8자 이내)
3. traitSummary는 2문장 이내, 쉬운 말로
4. '사주/오행/천간/지지' 용어 절대 금지

반드시 아래 JSON만 출력해:
{
  "intro": "반갑다는 인사 1문장",
  "traitSummary": "기질 설명 2문장 이내",
  "suggestedQuestion": "쉬운 예/아니오 질문 1문장",
  "quickOptions": ["짧은답변1", "짧은답변2", "짧은답변3"]
}`;

          greeting = await callGeminiJSON<typeof greeting>(prompt, {
            temperature: 0.5,
            maxTokens: 300,
          });
        } catch {
          greeting = getDefaultGreeting(child.name, child.ageInfo, child.temperament, concern);
        }
      } else {
        greeting = getDefaultGreeting(child.name, child.ageInfo, child.temperament, concern);
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
    } catch {
      error(res, '첫 대화 생성 중 오류가 발생했습니다', 500);
    }
  });
}

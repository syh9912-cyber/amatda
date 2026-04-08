import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiJSON } from '../../services/coaching/gemini.client';

// ─── 연령/기질별 대표 고민 ───

const TOP_CONCERNS: Record<string, Record<string, string>> = {
  infant: {
    '활동형': '밤에 자주 깨서 울어요',
    '탐구형': '낯선 환경에서 예민하게 반응해요',
    '조화형': '분리불안이 심해요',
    '분석형': '새로운 음식을 거부해요',
    '감성형': '쉽게 칭얼거리고 보채요',
  },
  toddler: {
    '활동형': '가만히 앉아 있질 못해요',
    '탐구형': '왜? 질문이 끝이 없어요',
    '조화형': '어린이집 갈 때 너무 울어요',
    '분석형': '편식이 심해졌어요',
    '감성형': '사소한 것에도 많이 울어요',
  },
  preschool: {
    '활동형': '친구를 때리거나 밀어요',
    '탐구형': '집중력이 너무 짧아요',
    '조화형': '혼자 놀지 못하고 항상 엄마를 찾아요',
    '분석형': '실수하면 크게 좌절해요',
    '감성형': '감정 기복이 심해요',
  },
};

function getDefaultGreeting(
  name: string, ageInfo: string, temperament: string, topConcern: string
): { intro: string; traitSummary: string; suggestedQuestion: string; quickOptions: string[] } {
  const traitDesc: Record<string, string> = {
    '활동형': `${name}이는 에너지가 넘치고 활발한 활동형 기질이에요. 새로운 것에 도전하는 걸 좋아하지만, 에너지 발산이 안 되면 짜증이 늘 수 있어요. 충분한 신체 활동과 함께 차분한 시간을 균형 있게 가져주는 게 중요해요.`,
    '탐구형': `${name}이는 호기심이 강하고 관찰력이 뛰어난 탐구형 기질이에요. "왜?"라는 질문으로 세상을 이해하려 하고, 새로운 것을 발견하면 집중력이 높아져요. 충분한 탐색 시간을 주시면 좋아요.`,
    '조화형': `${name}이는 따뜻하고 안정적인 조화형 기질이에요. 규칙적인 생활을 좋아하고, 친숙한 환경에서 편안함을 느껴요. 갑작스러운 변화보다는 미리 알려주고 준비 시간을 주시면 좋아요.`,
    '분석형': `${name}이는 꼼꼼하고 논리적인 분석형 기질이에요. 규칙과 패턴을 좋아하고, 이유를 알면 더 잘 따라와요. 명확한 설명과 예측 가능한 루틴이 아이에게 안정감을 줄 거예요.`,
    '감성형': `${name}이는 감정이 풍부하고 공감 능력이 뛰어난 감성형 기질이에요. 주변 분위기에 민감하게 반응하고, 감정 표현이 다양해요. 아이의 감정을 먼저 읽어주고 공감해주시면 큰 힘이 돼요.`,
  };

  return {
    intro: `${name}이를 만나게 되어 반가워요!`,
    traitSummary: traitDesc[temperament] ?? `${name}이는 고유한 기질을 가진 아이에요. 아이의 성향을 이해하면 육아가 한결 수월해질 거예요.`,
    suggestedQuestion: `${ageInfo} ${temperament} 아이에게 가장 많은 고민이 "${topConcern}"인데, 혹시 ${name}이도 비슷한가요?`,
    quickOptions: ['네, 맞아요!', '아니요, 다른 고민이 있어요', '아직 잘 모르겠어요'],
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
      const topConcern = concerns[child.temperament] ?? concerns['조화형'];

      // AI에게 첫 인사 생성 요청
      let greeting: {
        intro: string;
        traitSummary: string;
        suggestedQuestion: string;
        quickOptions: string[];
      };

      if (isGeminiAvailable()) {
        try {
          const prompt = `너는 영유아 육아 코치야. 아이가 방금 등록되었어. 부모에게 처음 인사하면서 아이 기질을 설명하고 첫 질문을 유도해.

아이 정보:
- 이름: ${child.name}
- 나이: ${child.ageInfo}
- 성별: ${child.gender}
- 기질: ${child.temperament}
- 기질 특성: ${child.temperamentDetail}

반드시 아래 JSON만 출력해:
{
  "intro": "반갑다는 인사 + 아이 이름 호명 (1문장)",
  "traitSummary": "이 아이의 기질을 부모가 이해하기 쉽게 2~3문장으로 설명. '사주/오행' 용어 절대 금지. 기질/성향/에너지로만 표현",
  "suggestedQuestion": "이 기질과 월령에서 가장 흔한 고민을 자연스럽게 물어보는 1문장",
  "quickOptions": ["네, 그래요!", "아니요, 다른 고민이 있어요", "아직 잘 모르겠어요"]
}`;

          greeting = await callGeminiJSON<typeof greeting>(prompt, {
            temperature: 0.6,
            maxTokens: 400,
          });
        } catch {
          greeting = getDefaultGreeting(child.name, child.ageInfo, child.temperament, topConcern);
        }
      } else {
        greeting = getDefaultGreeting(child.name, child.ageInfo, child.temperament, topConcern);
      }

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

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../utils/response';
import { buildChildContext } from '../../services/coaching/context.builder';
import { isGeminiAvailable, callGeminiJSON } from '../../services/coaching/gemini.client';
import { formatAgeKo } from '../../services/age.calculator';

function buildMockPrediction(
  name: string, temperament: string, currentMonths: number, predictedMonths: number, predictedAge: string
): Record<string, unknown> {
  const predictionMap: Record<string, string[]> = {
    '활동형': ['에너지 발산 욕구가 더 커질 수 있어요', '새로운 신체 활동에 도전하려 할 거예요', '규칙 이해가 시작될 시기예요'],
    '탐구형': ['질문이 더 구체적으로 변할 거예요', '스스로 해보겠다는 의지가 강해져요', '집중 시간이 조금씩 늘어날 거예요'],
    '조화형': ['사회성이 발달하면서 친구를 찾기 시작해요', '분리불안이 줄어들 수 있어요', '자기 의견 표현이 늘어나요'],
    '분석형': ['규칙과 패턴에 대한 관심이 높아져요', '실수에 대한 두려움이 나타날 수 있어요', '논리적 사고의 기초가 잡혀요'],
    '감성형': ['감정 표현이 더 다양해져요', '공감 능력이 눈에 띄게 발달해요', '예술적 관심이 생길 수 있어요'],
  };
  const tipMap: Record<string, string[]> = {
    '활동형': ['안전한 활동 공간을 미리 확보해주세요', '새로운 스포츠나 놀이를 찾아보세요', '에너지 발산 후 차분한 시간을 계획해주세요'],
    '탐구형': ['다양한 탐구 재료를 준비해주세요', '아이 질문에 함께 답을 찾아보세요', '실험하고 실패해도 괜찮다는 분위기를 만들어주세요'],
    '조화형': ['소규모 또래 모임을 시작해보세요', '변화를 미리 예고해주세요', '아이의 선택을 존중해주세요'],
    '분석형': ['시각적 스케줄표를 만들어보세요', '실수해도 괜찮다는 경험을 많이 주세요', '단계별 설명을 해주세요'],
    '감성형': ['감정 카드나 감정 그림책을 준비해주세요', '아이 감정을 이름 붙여주는 연습을 해보세요', '차분한 환경을 유지해주세요'],
  };

  return {
    childName: name,
    currentAge: formatAgeKo(currentMonths),
    currentAgeMonths: currentMonths,
    predictedAge,
    predictedAgeMonths: predictedMonths,
    temperament,
    predictions: predictionMap[temperament] ?? predictionMap['조화형'],
    prepTips: tipMap[temperament] ?? tipMap['조화형'],
  };
}

export function registerFuturePredictHandler(router: Router): void {
  // ─── POST /api/coaching/future-predict ───

  router.post('/future-predict', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { childId } = req.body as { childId: string };
      if (!childId) { error(res, 'childId 필수'); return; }

      const child = await buildChildContext(childId, req.userId!);
      if (!child) { error(res, '자녀 정보 없음', 404); return; }

      const predictedAgeMonths = child.ageMonths + 3;
      const predictedAgeInfo = formatAgeKo(predictedAgeMonths);

      if (!isGeminiAvailable()) {
        success(res, buildMockPrediction(child.name, child.temperament, child.ageMonths, predictedAgeMonths, predictedAgeInfo));
        return;
      }

      try {
        const prompt = `너는 영유아 발달 전문가야. 아이의 현재 정보를 바탕으로 3개월 후 어떤 변화가 예상되는지 예측하고 준비 팁을 알려줘.

아이: ${child.name} (${child.ageInfo}, ${child.gender}, ${child.temperament})
기질 특성: ${child.temperamentDetail}
3개월 후 예상 월령: ${predictedAgeInfo}

규칙:
- 사주/오행 용어 절대 금지, 기질/성향/에너지로만 표현
- 발달 단계와 기질을 결합한 현실적 예측

반드시 아래 JSON만 출력해:
{
  "predictions": ["3개월 후 예상 변화 1", "예상 변화 2", "예상 변화 3"],
  "prepTips": ["미리 준비할 것 1", "준비할 것 2", "준비할 것 3"]
}`;

        const parsed = await callGeminiJSON<{
          predictions?: string[];
          prepTips?: string[];
        }>(prompt, {
          temperature: 0.5,
          maxTokens: 400,
        });

        success(res, {
          childName: child.name,
          currentAge: child.ageInfo,
          currentAgeMonths: child.ageMonths,
          predictedAge: predictedAgeInfo,
          predictedAgeMonths,
          temperament: child.temperament,
          predictions: Array.isArray(parsed.predictions) ? parsed.predictions : [],
          prepTips: Array.isArray(parsed.prepTips) ? parsed.prepTips : [],
        });
      } catch {
        success(res, buildMockPrediction(child.name, child.temperament, child.ageMonths, predictedAgeMonths, predictedAgeInfo));
      }
    } catch {
      error(res, '미래 예측 중 오류', 500);
    }
  });
}

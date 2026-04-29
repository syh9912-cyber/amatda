/**
 * 사주 8글자를 Gemini로 명리학적 해석 → 기질 출력 (사주 용어 차단)
 *
 * 동작:
 *   1. 룰 기반 calculateSaju()로 8글자 + 오행 비율 산출 (사전 단계)
 *   2. 이 함수가 8글자를 Gemini에 넘겨 사주 명리 지식으로 해석
 *   3. 출력은 부모용(parent_facing) 필드만 사용 — 내부 사주 분석(internal_saju_analysis)은 폐기
 *   4. 출력에 사주 용어가 섞이면 1회 재시도, 그래도 실패 시 룰 기반 fallback
 *
 * 비용: 아이당 평생 1회 호출 (생년월일 안 바뀜) → 약 1.5원
 */

import { callGeminiJSON, isGeminiAvailable } from './coaching/gemini.client';
import { logger } from '../utils/logger';
import { calculateSaju } from './saju.calculator';

// 월령 (개월수) 계산 헬퍼
function ageMonthsBetween(birthDate: Date, refDate: Date = new Date()): number {
  const months =
    (refDate.getFullYear() - birthDate.getFullYear()) * 12 +
    (refDate.getMonth() - birthDate.getMonth());
  return Math.max(0, months);
}

export interface InterpreterInput {
  pillars: { year: string; month: string; day: string; hour: string };
  fiveElements: { wood: number; fire: number; earth: number; metal: number; water: number };
  childName: string;
  ageMonths: number;
  gender: string;
}

export interface InterpretedDetail {
  personality: string[];
  strengths: string[];
  cautions: string[];
  parentingTips: string[];
  learningStyle: string;
  socialStyle: string;
  stressResponse: string;
  bestActivities: string[];
  bestFoods: string[];
}

export interface InterpretedTrait {
  dominantType: string; // 탐구형 | 활동형 | 조화형 | 분석형 | 감성형
  label: string;
  detail: InterpretedDetail;
}

// ── 사주 용어 차단 (출력 검증용) ──
// 발견 시 재호출
const FORBIDDEN_TERMS = /(사주|오행|천간|지지|일간|일주|월주|년주|시주|신강|신약|재성|관성|인성|식상|비겁|용신|희신|기신|구신|대운|세운|갑목|을목|병화|정화|무토|기토|경금|신금|임수|계수|목기|화기|토기|금기|수기|음양)/g;

// ── Few-Shot 예시 (품질 강제) ──
// AI가 톤·깊이·구체성 기준을 학습하도록 예시 3개를 프롬프트에 박음
const FEW_SHOT_EXAMPLES = `
참고 예시 (이 톤·깊이·구체성으로 출력해라):

[예시1] 신금 일간, 묘월생, 화 강함 → 활동형 분류
{
  "personality": [
    "에너지가 넘치고 표현력이 풍부해요",
    "감정 변화가 빠르고 솔직하게 드러내요",
    "친구들 사이에서 분위기를 주도하는 편이에요",
    "자기 의견이 분명하고 굽히기 어려워해요",
    "경쟁이나 도전 상황에서 더 집중력을 발휘해요"
  ],
  "strengths": [
    "사교성이 좋아 새 친구와 빠르게 가까워져요",
    "도전을 두려워하지 않고 추진력이 강해요",
    "긍정적 에너지로 주변 분위기를 밝게 만들어요",
    "신체 활동 능력이 또래보다 발달되어 있어요",
    "감정 표현이 솔직해서 부모가 마음을 읽기 쉬워요"
  ]
}

[예시2] 갑목 일간, 자월생, 수 강함 → 탐구형 분류
{
  "personality": [
    "호기심이 강해 새로운 환경에 빠르게 흥미를 보여요",
    "혼자 골똘히 생각하는 시간을 좋아해요",
    "한 가지 주제에 깊이 빠져드는 집중력이 있어요",
    "감정보다 이유를 먼저 찾으려 해요",
    "낯선 사람보다 익숙한 환경을 편안해해요"
  ]
}

[예시3] 기토 일간, 미월생, 토 강함 → 조화형 분류
{
  "personality": [
    "온화하고 차분한 성향이에요",
    "다른 사람의 감정을 잘 살펴줘요",
    "급격한 변화보다 익숙한 루틴을 편안해해요",
    "갈등을 피하고 화목한 분위기를 좋아해요",
    "한번 익힌 습관을 꾸준히 지켜요"
  ]
}
`.trim();

// ── 분류 라벨 (5종 고정) ──
const VALID_TYPES = ['탐구형', '활동형', '조화형', '분석형', '감성형'] as const;

function buildPrompt(input: InterpreterInput, strict = false): string {
  const ageInfo =
    input.ageMonths < 12
      ? `${input.ageMonths}개월 영아`
      : input.ageMonths < 72
        ? `${Math.floor(input.ageMonths / 12)}세 ${input.ageMonths % 12}개월 유아`
        : `${Math.floor(input.ageMonths / 12)}세 아동`;

  const elementsLine = `목 ${input.fiveElements.wood}% / 화 ${input.fiveElements.fire}% / 토 ${input.fiveElements.earth}% / 금 ${input.fiveElements.metal}% / 수 ${input.fiveElements.water}%`;

  const strictNote = strict
    ? `
⚠️ 직전 출력에 사주 용어가 섞여 있었다. 이번에는 절대 사주/오행/천간/지지/일간/재성/관성/인성/식상/비겁 어휘를 쓰지 마라. 일상 한국어로만 작성해라.
`
    : '';

  return `너는 한국 정통 명리학에 정통한 육아 코치다. 아래 아이의 사주 8글자를 명리학적으로 깊이 있게 분석한 뒤, 부모에게 전달할 때는 사주 용어 없이 일상 언어로만 풀어 설명해라.

[아이 정보]
- 이름: ${input.childName}
- 성별: ${input.gender}
- 나이: ${ageInfo}

[사주 8글자]
- 년주: ${input.pillars.year}
- 월주: ${input.pillars.month}
- 일주: ${input.pillars.day}  ← 일간(본인)
- 시주: ${input.pillars.hour}

[오행 비율]
${elementsLine}

[출력 규칙 — 매우 중요]
1. 머릿속에서는 명리학 전문 지식(일간 강약, 통근, 투간, 용신/희신)을 활용해 깊이 있게 분석해라
2. 그러나 출력 텍스트에는 사주/오행/천간/지지/일간/재성/관성/인성/식상/비겁/용신/희신/대운 등 명리 용어 절대 금지
3. "에너지", "기질", "성향" 등 일상 표현으로 번역해서 작성
4. dominantType은 반드시 다음 5개 중 하나: 탐구형 / 활동형 / 조화형 / 분석형 / 감성형
5. personality / strengths / cautions / parentingTips 각 5개 항목, 각 1~2문장
6. bestActivities / bestFoods 각 3~5개
7. 안전: 위험 행동 조장 금지, 일반적 육아 조언 범위 내
${strictNote}

${FEW_SHOT_EXAMPLES}

[출력 — 반드시 JSON 객체 하나만, 다른 텍스트 금지]
{
  "dominantType": "탐구형|활동형|조화형|분석형|감성형 중 정확히 하나",
  "label": "기질 한 줄 요약 (사주 용어 금지, 일상 표현으로)",
  "personality": ["문장1", "문장2", "문장3", "문장4", "문장5"],
  "strengths": ["문장1", "문장2", "문장3", "문장4", "문장5"],
  "cautions": ["문장1", "문장2", "문장3", "문장4", "문장5"],
  "parentingTips": ["문장1", "문장2", "문장3", "문장4", "문장5"],
  "learningStyle": "한 문장",
  "socialStyle": "한 문장",
  "stressResponse": "한 문장",
  "bestActivities": ["활동1", "활동2", "활동3", "활동4"],
  "bestFoods": ["음식1", "음식2", "음식3", "음식4"]
}`;
}

interface RawResponse {
  dominantType?: string;
  label?: string;
  personality?: unknown;
  strengths?: unknown;
  cautions?: unknown;
  parentingTips?: unknown;
  learningStyle?: unknown;
  socialStyle?: unknown;
  stressResponse?: unknown;
  bestActivities?: unknown;
  bestFoods?: unknown;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
}

function validate(raw: RawResponse | null | undefined): InterpretedTrait | null {
  if (!raw) return null;
  if (!raw.dominantType || !VALID_TYPES.includes(raw.dominantType as typeof VALID_TYPES[number])) {
    return null;
  }
  const personality = asStringArray(raw.personality);
  const strengths = asStringArray(raw.strengths);
  if (personality.length < 3 || strengths.length < 3) return null;

  return {
    dominantType: raw.dominantType,
    label: typeof raw.label === 'string' ? raw.label : '',
    detail: {
      personality,
      strengths,
      cautions: asStringArray(raw.cautions),
      parentingTips: asStringArray(raw.parentingTips),
      learningStyle: typeof raw.learningStyle === 'string' ? raw.learningStyle : '',
      socialStyle: typeof raw.socialStyle === 'string' ? raw.socialStyle : '',
      stressResponse: typeof raw.stressResponse === 'string' ? raw.stressResponse : '',
      bestActivities: asStringArray(raw.bestActivities),
      bestFoods: asStringArray(raw.bestFoods),
    },
  };
}

function containsForbiddenTerms(trait: InterpretedTrait): boolean {
  const text = JSON.stringify(trait);
  // FORBIDDEN_TERMS는 /g 플래그라 lastIndex 누적되므로 매번 재설정
  FORBIDDEN_TERMS.lastIndex = 0;
  return FORBIDDEN_TERMS.test(text);
}

/**
 * 사주 8글자 → Gemini 해석 → 부모용 기질 출력
 * 실패 시 null 반환 (호출 측에서 룰 기반 fallback 사용)
 */
export async function interpretSajuWithAI(
  input: InterpreterInput,
): Promise<InterpretedTrait | null> {
  if (!isGeminiAvailable()) {
    return null;
  }

  // 1차 시도 — flat JSON 출력 + Gemini JSON 모드
  let trait: InterpretedTrait | null = null;
  let raw1: RawResponse | null = null;
  try {
    raw1 = await callGeminiJSON<RawResponse>(buildPrompt(input, false), {
      temperature: 0.4,
      maxTokens: 4000,
      responseMimeType: 'application/json',
    });
    trait = validate(raw1);
    if (!trait) {
      logger.warn(
        'saju.interpreter',
        '1차 응답 validate 실패. keys=' +
          Object.keys(raw1 ?? {}).join(',') +
          ' / dominantType=' +
          String(raw1?.dominantType) +
          ' / personality.len=' +
          String(Array.isArray(raw1?.personality) ? (raw1?.personality as unknown[]).length : 'N/A'),
      );
    } else {
      logger.info(
        'saju.interpreter',
        '1차 호출 성공: ' + trait.dominantType + ' / personality=' + trait.detail.personality.length,
      );
    }
  } catch (e) {
    logger.warn('saju.interpreter', '1차 호출 실패: ' + String(e));
  }

  // 사주 용어 검출 시 재시도 (1회)
  if (trait && containsForbiddenTerms(trait)) {
    logger.warn('saju.interpreter', '1차 출력에 사주 용어 검출 → 재시도');
    try {
      const raw2 = await callGeminiJSON<RawResponse>(buildPrompt(input, true), {
        temperature: 0.3,
        maxTokens: 4000,
        responseMimeType: 'application/json',
      });
      const retry = validate(raw2);
      if (retry && !containsForbiddenTerms(retry)) {
        trait = retry;
      } else {
        logger.warn('saju.interpreter', '2차 시도도 사주 용어 포함 → null 반환 (룰 fallback)');
        return null;
      }
    } catch (e) {
      logger.warn('saju.interpreter', '2차 호출 실패: ' + String(e));
      return null;
    }
  }

  return trait;
}

/**
 * 룰 기반 calculateSaju() + AI 해석을 합친 고수준 헬퍼.
 *
 * - 8글자/오행은 룰로 정확히 산출
 * - 기질 해석(dominantType, label, detail)은 AI가 우선, 실패 시 룰 fallback
 *
 * 호출 측은 결과를 그대로 innateData JSON으로 저장하면 됨.
 */
export async function calculateSajuWithAI(
  birthDate: Date,
  birthTime: string,
  childName: string,
  gender: string,
): Promise<ReturnType<typeof calculateSaju>> {
  const ruleResult = calculateSaju(birthDate, birthTime);

  try {
    const ai = await interpretSajuWithAI({
      pillars: ruleResult.pillars,
      fiveElements: ruleResult.fiveElements,
      childName,
      ageMonths: ageMonthsBetween(birthDate),
      gender,
    });
    if (ai) {
      // AI 해석 성공 — 룰 기반 detail/dominantType/label을 AI 결과로 덮어쓰기
      // (8글자/오행은 룰 기반 그대로 유지)
      return {
        ...ruleResult,
        dominantType: ai.dominantType,
        label: ai.label || ruleResult.label,
        detail: ai.detail,
      };
    }
  } catch (e) {
    logger.warn('calculateSajuWithAI', 'AI 해석 실패, 룰 fallback 사용: ' + String(e));
  }

  return ruleResult;
}

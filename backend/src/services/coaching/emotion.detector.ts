/**
 * 부모 감정 감지 모듈
 * - 부모의 메시지에서 감정 상태를 파악하여 AI 톤을 조절
 * - 불안한 부모 → 차분하고 안심시키는 톤
 * - 지친 부모 → 공감 + 실용적 조언
 * - 급한 부모 → 핵심만 빠르게
 * - 평범한 질문 → 따뜻하고 친근한 톤
 */

export type ParentEmotion = 'anxious' | 'exhausted' | 'urgent' | 'guilty' | 'neutral';

interface EmotionResult {
  emotion: ParentEmotion;
  confidence: number;
  toneGuide: string;
}

interface EmotionRule {
  patterns: RegExp[];
  emotion: ParentEmotion;
  weight: number;
}

const EMOTION_RULES: EmotionRule[] = [
  // ─── 불안/걱정 ───
  {
    patterns: [
      /걱정|불안|무서워|두려워|겁나|겁이/,
      /괜찮은\s*건가|괜찮을까|정상인가|정상일까/,
      /혹시.*(?:큰\s*병|문제|이상)/,
      /왜\s*(?:이러는|그러는|자꾸)/,
      /병원.*(?:가야|가볼까|갈까)/,
    ],
    emotion: 'anxious',
    weight: 3,
  },
  // ─── 지침/피곤 ───
  {
    patterns: [
      /지치|힘들|못\s*자|잠을?\s*못|피곤|녹초/,
      /미치겠|미칠\s*것\s*같|죽겠|도대체/,
      /언제.*(?:끝|나아질|좋아질)/,
      /매일|맨날|또|계속|반복/,
    ],
    emotion: 'exhausted',
    weight: 2,
  },
  // ─── 급함 ───
  {
    patterns: [
      /지금|당장|빨리|급해|어떡해|어떻게/,
      /갑자기|방금|아까부터/,
      /응급|119|병원/,
    ],
    emotion: 'urgent',
    weight: 2,
  },
  // ─── 죄책감 ───
  {
    patterns: [
      /제\s*탓|내\s*탓|잘못한\s*건|나쁜\s*(?:엄마|아빠)/,
      /못해서|부족해서|소리.*(?:질렀|쳤)/,
      /후회|미안|자책/,
    ],
    emotion: 'guilty',
    weight: 3,
  },
];

const TONE_GUIDES: Record<ParentEmotion, string> = {
  anxious: '부모가 불안해하고 있다. 차분하고 안심시키는 톤으로 답하되, 필요한 정보는 명확히 전달하라. "걱정되시죠"로 공감한 뒤 구체적 판단 기준을 제시하라.',
  exhausted: '부모가 지쳐있다. 먼저 공감하고, 실용적이고 당장 시도할 수 있는 조언 위주로 답하라. 긴 설명보다 핵심 1~2개를 먼저 말하라. 부모의 노력을 인정하는 말을 포함하라.',
  urgent: '급한 상황이다. 불필요한 서론 없이 핵심 판단과 행동 지침을 먼저 말하라. 위험 징후가 있으면 병원 방문을 가장 먼저 안내하라.',
  guilty: '부모가 자책하고 있다. 절대 비난하지 마라. "충분히 잘 하고 계세요"라는 메시지를 담고, 구체적으로 잘한 점을 짚어주라. 누구나 겪는 일임을 언급하라.',
  neutral: '따뜻하고 친근한 톤으로 답하라.',
};

export function detectParentEmotion(message: string): EmotionResult {
  const scores: Record<ParentEmotion, number> = {
    anxious: 0,
    exhausted: 0,
    urgent: 0,
    guilty: 0,
    neutral: 0,
  };

  for (const rule of EMOTION_RULES) {
    let matched = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) {
        matched++;
      }
    }
    if (matched > 0) {
      scores[rule.emotion] += matched * rule.weight;
    }
  }

  // 가장 높은 점수의 감정 선택
  let topEmotion: ParentEmotion = 'neutral';
  let topScore = 0;
  for (const [emotion, score] of Object.entries(scores) as Array<[ParentEmotion, number]>) {
    if (score > topScore) {
      topScore = score;
      topEmotion = emotion;
    }
  }

  // 최소 점수 미만이면 neutral
  if (topScore < 2) {
    topEmotion = 'neutral';
    topScore = 0;
  }

  const confidence = topScore > 0 ? Math.min(topScore / 6, 1) : 0;

  return {
    emotion: topEmotion,
    confidence,
    toneGuide: TONE_GUIDES[topEmotion],
  };
}

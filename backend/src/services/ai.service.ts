import { env } from '../config/env';
import { maskChildName } from '../utils/masking';
import { callGeminiJSON } from './coaching/gemini.client';

interface ExtractedTraits {
  emotions: string[];
  socialStyle: string;
  interests: string[];
  stressResponse: string;
  summary: string;
}

/** Mock AI 응답 — MOCK_AI=true 또는 API 키 없을 때 사용 */
function mockExtractTraits(content: string): ExtractedTraits {
  const emotions: string[] = [];
  const interests: string[] = [];

  if (content.includes('울') || content.includes('슬')) emotions.push('감성적');
  if (content.includes('웃') || content.includes('즐')) emotions.push('긍정적');
  if (content.includes('화') || content.includes('짜증')) emotions.push('표현적');
  if (emotions.length === 0) emotions.push('안정적');

  if (content.includes('책') || content.includes('읽')) interests.push('독서');
  if (content.includes('뛰') || content.includes('놀')) interests.push('신체활동');
  if (content.includes('그림') || content.includes('색칠')) interests.push('미술');
  if (content.includes('노래') || content.includes('음악')) interests.push('음악');
  if (interests.length === 0) interests.push('탐색활동');

  const socialStyle = content.includes('친구')
    ? '사교적'
    : content.includes('혼자')
      ? '독립적'
      : '관찰형';

  const stressResponse = content.includes('울')
    ? '감정표출형'
    : content.includes('조용')
      ? '내면처리형'
      : '전환활동형';

  return {
    emotions,
    socialStyle,
    interests,
    stressResponse,
    summary: `관찰된 감정: ${emotions.join(', ')}. 관심사: ${interests.join(', ')}. 사회성: ${socialStyle}.`,
  };
}

/** Gemini AI로 성향 추출 */
async function extractTraitsWithGemini(
  content: string,
  childName: string
): Promise<ExtractedTraits> {
  const maskedContent = maskChildName(content, childName);

  try {
    const prompt = `당신은 아동 발달 전문가입니다. 부모가 작성한 관찰 일기에서 아이의 성향을 추출해주세요.
반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이 JSON만):
{"emotions":["감정1","감정2"],"socialStyle":"사교적/독립적/관찰형","interests":["관심사1"],"stressResponse":"감정표출형/내면처리형/전환활동형","summary":"한줄 요약"}

관찰 일기:
${maskedContent}`;

    return await callGeminiJSON<ExtractedTraits>(prompt, { temperature: 0.3, maxTokens: 300 });
  } catch {
    return mockExtractTraits(maskedContent);
  }
}

export async function analyzeObservation(
  content: string,
  childName: string
): Promise<ExtractedTraits> {
  if (env.MOCK_AI) {
    return mockExtractTraits(maskChildName(content, childName));
  }
  return extractTraitsWithGemini(content, childName);
}

/** 교차검증 리포트 생성 */
export function generateCrossReport(
  innateData: { dominantType: string; fiveElements: Record<string, number> },
  observedTraits: ExtractedTraits | null
): {
  alignment: string;
  insights: string[];
  recommendations: string[];
} {
  if (!observedTraits) {
    return {
      alignment: '관찰 데이터 부족',
      insights: ['관찰 일기를 작성하면 더 정확한 분석이 가능합니다.'],
      recommendations: ['일주일에 2~3회 관찰 일기를 작성해보세요.'],
    };
  }

  const insights: string[] = [];
  const recommendations: string[] = [];
  const dominant = innateData.dominantType;

  // 기질-관찰 일치도 분석
  const traitMatch = checkTraitAlignment(dominant, observedTraits);

  if (traitMatch.aligned) {
    insights.push(`기질 분석(${dominant})과 관찰 데이터가 잘 일치합니다.`);
    insights.push(`${observedTraits.socialStyle} 성향이 기질 특성과 부합합니다.`);
  } else {
    insights.push(`기질 분석(${dominant})과 실제 관찰에 일부 차이가 있습니다.`);
    insights.push('환경 요인이 기질 표현에 영향을 줄 수 있습니다.');
  }

  if (observedTraits.interests.length > 0) {
    insights.push(`주요 관심사: ${observedTraits.interests.join(', ')}`);
  }

  // 추천
  if (dominant === '탐구형') {
    recommendations.push('다양한 체험 활동과 실험 놀이를 제공해주세요.');
    recommendations.push('궁금증을 스스로 해결할 시간을 충분히 주세요.');
  } else if (dominant === '활동형') {
    recommendations.push('충분한 신체 활동 시간을 확보해주세요.');
    recommendations.push('에너지를 긍정적으로 발산할 수 있는 활동을 찾아주세요.');
  } else if (dominant === '조화형') {
    recommendations.push('또래와 어울릴 기회를 자주 만들어주세요.');
    recommendations.push('갈등 상황에서 스스로 해결할 기회를 주세요.');
  } else if (dominant === '분석형') {
    recommendations.push('논리적 사고를 자극하는 퍼즐이나 보드게임을 활용하세요.');
    recommendations.push('충분한 혼자만의 시간과 공간을 제공해주세요.');
  } else {
    recommendations.push('감정을 표현할 수 있는 안전한 환경을 만들어주세요.');
    recommendations.push('예술 활동(그림, 음악)으로 감성을 키워주세요.');
  }

  return {
    alignment: traitMatch.aligned ? '높음' : '보통',
    insights,
    recommendations,
  };
}

function checkTraitAlignment(
  dominant: string,
  observed: ExtractedTraits
): { aligned: boolean } {
  const alignmentMap: Record<string, string[]> = {
    '탐구형': ['독서', '탐색활동', '관찰형'],
    '활동형': ['신체활동', '사교적', '표현적'],
    '조화형': ['사교적', '안정적'],
    '분석형': ['독서', '독립적', '관찰형'],
    '감성형': ['미술', '음악', '감성적'],
  };

  const keywords = alignmentMap[dominant] ?? [];
  const allTraits = [
    ...observed.interests,
    observed.socialStyle,
    ...observed.emotions,
  ];

  const matchCount = keywords.filter((k) =>
    allTraits.some((t) => t.includes(k) || k.includes(t))
  ).length;

  return { aligned: matchCount >= 1 };
}

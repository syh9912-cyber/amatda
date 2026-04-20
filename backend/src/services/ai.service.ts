/** 교차검증 리포트 생성 - 기질 분석과 관찰 일기 원문을 비교 */
export function generateCrossReport(
  innateData: { dominantType: string; fiveElements: Record<string, number> },
  recentObservationTexts: string[]
): {
  alignment: string;
  insights: string[];
  recommendations: string[];
} {
  const count = recentObservationTexts.length;
  const dominant = innateData.dominantType;

  if (count === 0) {
    return {
      alignment: '관찰 데이터 부족',
      insights: ['관찰 일기를 작성하면 더 정확한 분석이 가능합니다.'],
      recommendations: ['일주일에 2~3회 관찰 일기를 작성해보세요.'],
    };
  }

  const insights: string[] = [];
  insights.push(`기질 분석: ${dominant}`);
  insights.push(`누적 관찰 일기 ${count}개를 AI 상담 시 맥락으로 활용합니다.`);

  const recommendations: string[] = [];
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
    alignment: count >= 3 ? '높음' : '보통',
    insights,
    recommendations,
  };
}

/** 다자녀 기질 궁합 분석 */

interface ChildTrait {
  name: string;
  dominantType: string;
  fiveElements: Record<string, number>;
}

interface CompatResult {
  childA: string;
  childB: string;
  score: number;
  level: string;
  description: string;
  tips: string[];
}

// 오행 상생: 木→火→土→金→水→木
const GENERATE_MAP: Record<string, string> = {
  wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood',
};

// 오행 상극: 木→土→水→火→金→木
const CONTROL_MAP: Record<string, string> = {
  wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood',
};

function getDominantElement(elements: Record<string, number>): string {
  return Object.entries(elements).sort((a, b) => b[1] - a[1])[0][0];
}

export function analyzeCompatibility(childA: ChildTrait, childB: ChildTrait): CompatResult {
  const elA = getDominantElement(childA.fiveElements);
  const elB = getDominantElement(childB.fiveElements);

  let score = 60; // 기본 점수
  const tips: string[] = [];

  // 상생 관계 체크
  if (GENERATE_MAP[elA] === elB || GENERATE_MAP[elB] === elA) {
    score += 25;
    tips.push(`${childA.name}와(과) ${childB.name}는 서로 에너지를 북돋아주는 관계예요.`);
    tips.push('함께 활동하면 시너지가 크니 협력 놀이를 추천해요.');
  }
  // 같은 오행
  else if (elA === elB) {
    score += 15;
    tips.push('비슷한 성향이라 공감대가 잘 형성돼요.');
    tips.push('같은 관심사를 공유하되 각자만의 시간도 보장해주세요.');
  }
  // 상극 관계
  else if (CONTROL_MAP[elA] === elB || CONTROL_MAP[elB] === elA) {
    score -= 5;
    tips.push('성향 차이가 있어 갈등이 생길 수 있지만, 서로 배울 점이 많아요.');
    tips.push('중재 역할을 해주시고, 각자의 강점을 인정해주세요.');
  }
  // 기타
  else {
    score += 10;
    tips.push('서로 다른 에너지를 가져 다양한 경험을 나눌 수 있어요.');
    tips.push('차이를 존중하는 대화를 자주 해주세요.');
  }

  // 연령 고려 팁
  tips.push('형제자매 Quality Time: 하루 15분 둘만의 시간을 만들어주세요.');

  const level = score >= 80 ? '최고' : score >= 65 ? '좋음' : '보통';
  const description =
    level === '최고'
      ? '환상의 궁합! 서로를 성장시키는 관계예요'
      : level === '좋음'
        ? '좋은 궁합! 함께하면 즐거운 관계예요'
        : '괜찮은 궁합! 차이를 통해 서로 배워요';

  return {
    childA: childA.name,
    childB: childB.name,
    score: Math.min(100, Math.max(0, score)),
    level,
    description,
    tips,
  };
}

export function analyzeAllSiblings(children: ChildTrait[]): CompatResult[] {
  const results: CompatResult[] = [];
  for (let i = 0; i < children.length; i++) {
    for (let j = i + 1; j < children.length; j++) {
      results.push(analyzeCompatibility(children[i], children[j]));
    }
  }
  return results;
}

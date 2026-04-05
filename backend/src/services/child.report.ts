/**
 * child.report.ts
 * 자녀 종합 분석 리포트 생성 (정적 — AI 호출 없음)
 * dominantType + 온보딩 질문 답변으로 상세 리포트를 생성한다.
 */

export interface ChildReport {
  summary: string;
  personality: string[];
  studyStyle: string;
  bestSubjects: string[];
  weakAreas: string[];
  futureFields: string[];
  sportsMatch: string[];
  academyStyle: string;
  goodFoods: string[];
  badFoods: string[];
  educationDirection: string;
  specialTalent: string;
  parentingTip: string;
}

interface AnswerItem {
  questionId: string;
  answer: number;
}

/** dominantType 별 기본 프로파일 */
const BASE_PROFILES: Record<string, ChildReport> = {
  wood: {
    summary: '호기심과 탐구심이 넘치는 아이로, 새로운 것을 발견하고 배우는 데서 큰 즐거움을 느낍니다.',
    personality: [
      '강한 호기심과 탐구 정신',
      '독립적이고 자기주도적인 성향',
      '빠른 이해력과 흡수력',
      '정의감이 강하고 솔직한 표현',
    ],
    studyStyle: '직접 해보고 경험하며 배우는 체험형 학습이 가장 효과적입니다. 교과서보다는 실험, 프로젝트 기반 학습에서 뛰어난 집중력을 보입니다.',
    bestSubjects: ['과학', '수학', '사회탐구', '코딩'],
    weakAreas: ['반복 암기가 필요한 과목', '꼼꼼한 필기/정리'],
    futureFields: ['연구원/과학자', '개발자/엔지니어', '탐험가/다큐멘터리 PD', '창업가'],
    sportsMatch: ['수영', '클라이밍', '태권도', '자전거'],
    academyStyle: '소규모 토론식 수업이나 프로젝트 기반 학습이 적합합니다. 일방적 강의식보다는 질문과 실험이 가능한 환경을 선호합니다.',
    goodFoods: ['녹색 채소(시금치, 브로콜리)', '견과류', '등푸른 생선', '현미밥'],
    badFoods: ['과도한 인스턴트 식품', '고카페인 음료', '인공색소가 많은 과자'],
    educationDirection: '아이의 질문에 성의 있게 답해주고, "왜?"라고 물을 때 함께 찾아보는 시간을 가져주세요. 다양한 체험 활동과 자연 탐구 기회를 자주 만들어 주면 잠재력이 크게 성장합니다.',
    specialTalent: '복잡한 문제를 스스로 분석하고 해결 방법을 찾아가는 문제해결력이 특출납니다.',
    parentingTip: '탐구형 아이는 통제보다 방향 제시가 효과적입니다. "하지 마"보다 "이렇게 해볼까?"로 대화하면 훨씬 잘 따릅니다. 자율성을 최대한 존중하면서 안전한 경계를 잡아주세요.',
  },
  fire: {
    summary: '밝은 에너지와 강한 표현력을 가진 아이로, 사람들 앞에서 빛나는 리더형 기질입니다.',
    personality: [
      '밝고 긍정적인 에너지',
      '표현력이 풍부하고 사교적',
      '리더십과 추진력이 뛰어남',
      '열정적이고 빠른 행동력',
    ],
    studyStyle: '친구와 함께하는 그룹 학습이나 발표, 토론 중심의 수업에서 빛을 발합니다. 경쟁 요소가 있으면 더욱 집중력이 높아집니다.',
    bestSubjects: ['체육', '예술(음악/미술)', '국어(발표/토론)', '사회'],
    weakAreas: ['장시간 집중이 필요한 독서', '세밀한 계산/검산'],
    futureFields: ['리더/경영자', '연예인/크리에이터', '스포츠 선수', '교사/강사'],
    sportsMatch: ['축구', '농구', '댄스', '체조'],
    academyStyle: '활동적이고 참여형 수업이 좋습니다. 앉아서 듣기만 하는 학원보다 발표와 실습이 많은 곳이 맞습니다. 소규모 그룹 과외도 효과적입니다.',
    goodFoods: ['빨간 과일(토마토, 딸기)', '닭가슴살', '계란', '바나나'],
    badFoods: ['과도한 설탕 음식', '자극적인 매운 음식', '탄산음료'],
    educationDirection: '에너지를 올바른 방향으로 쓸 수 있도록 다양한 활동 기회를 주세요. 성취감을 느낄 수 있는 작은 목표를 자주 설정해주면 지속적으로 동기부여가 됩니다.',
    specialTalent: '사람들의 마음을 사로잡는 카리스마와 표현력이 특출납니다. 무대 위에서 더욱 빛나는 아이입니다.',
    parentingTip: '활동형 아이는 억누르면 역효과가 납니다. 충분한 신체 활동 시간을 보장하고, 칭찬과 격려를 아끼지 마세요. 실패해도 "다시 해보자"는 메시지가 아이에게 큰 힘이 됩니다.',
  },
  earth: {
    summary: '안정적이고 배려심이 깊은 아이로, 주변 사람들과의 조화를 소중히 여기며 믿음직한 성격입니다.',
    personality: [
      '깊은 배려심과 공감 능력',
      '안정적이고 차분한 성격',
      '책임감이 강하고 성실함',
      '중재자 역할을 잘 수행',
    ],
    studyStyle: '규칙적이고 안정적인 환경에서 꾸준히 학습하는 것이 가장 효과적입니다. 예습-복습 루틴을 만들면 착실하게 성적이 오릅니다.',
    bestSubjects: ['국어', '도덕/윤리', '생물', '가정/실과'],
    weakAreas: ['빠른 판단이 필요한 시험', '경쟁적 환경에서의 발표'],
    futureFields: ['의사/간호사', '상담사/심리치료사', '교사', '사회복지사'],
    sportsMatch: ['요가', '산책/등산', '배드민턴', '골프'],
    academyStyle: '친한 친구와 함께하는 소규모 공부방이나 1:1 과외가 적합합니다. 경쟁보다 협력을 강조하는 수업 분위기가 아이에게 안정감을 줍니다.',
    goodFoods: ['고구마', '호박', '두부', '잡곡밥', '우유'],
    badFoods: ['찬 음식 과다 섭취', '불규칙한 식사 습관', '자극적인 간식'],
    educationDirection: '아이의 속도를 존중해주세요. 다른 아이와 비교하지 말고, 꾸준한 노력에 대해 칭찬해주면 아이의 자존감이 높아집니다. 안정적 루틴이 학습 성과로 이어집니다.',
    specialTalent: '다른 사람의 감정을 섬세하게 읽고 다독이는 공감 능력이 특출납니다. 팀에서 갈등을 해결하는 핵심 역할을 합니다.',
    parentingTip: '조화형 아이는 변화에 민감합니다. 환경이 바뀔 때 미리 충분히 설명해주고, 안전하다는 느낌을 주세요. 매일 같은 시간에 안아주는 루틴이 큰 안정감을 줍니다.',
  },
  metal: {
    summary: '분석적이고 논리적인 사고력을 가진 아이로, 꼼꼼하고 정확한 것을 추구하며 높은 집중력을 보입니다.',
    personality: [
      '뛰어난 집중력과 분석력',
      '꼼꼼하고 정확한 성격',
      '독립적인 사고와 판단력',
      '목표 지향적이고 체계적',
    ],
    studyStyle: '체계적으로 정리하며 배우는 것을 좋아합니다. 노트 필기, 마인드맵, 단계별 학습법이 효과적이며 혼자 집중하는 시간을 충분히 주는 것이 중요합니다.',
    bestSubjects: ['수학', '과학', '컴퓨터/코딩', '영어(문법)'],
    weakAreas: ['감상문/창의적 글쓰기', '팀 프로젝트에서 타협'],
    futureFields: ['프로그래머/데이터 과학자', '의사/약사', '법률가', '회계사/금융 전문가'],
    sportsMatch: ['바둑/체스', '펜싱', '사격/양궁', '수영'],
    academyStyle: '체계적 커리큘럼이 있는 학원이 잘 맞습니다. 혼자 집중할 수 있는 자습 시간이 포함된 수업이나, 단계별로 레벨업이 가능한 온라인 학습도 효과적입니다.',
    goodFoods: ['흰 살 생선', '배', '무', '쌀밥', '두유'],
    badFoods: ['색소가 많은 음식', '과도한 유제품', '패스트푸드'],
    educationDirection: '완벽주의 성향이 있을 수 있으므로 "틀려도 괜찮아"라는 메시지를 자주 전달해주세요. 자신만의 방식으로 정리할 시간을 충분히 주면 학습 효율이 크게 올라갑니다.',
    specialTalent: '복잡한 정보를 체계적으로 분류하고 패턴을 찾아내는 분석력이 특출납니다. 논리적 사고가 필요한 분야에서 두각을 나타냅니다.',
    parentingTip: '분석형 아이는 "왜"에 대한 논리적 설명이 필요합니다. "그냥 해"라는 말보다 이유를 설명해주면 훨씬 잘 따릅니다. 감정 표현이 서툴 수 있으니 감정 이야기 시간을 의식적으로 만들어 주세요.',
  },
  water: {
    summary: '풍부한 감수성과 창의력을 가진 아이로, 상상력이 넘치고 예술적 감각이 뛰어납니다.',
    personality: [
      '풍부한 감수성과 직관력',
      '뛰어난 창의력과 상상력',
      '적응력이 좋고 유연한 사고',
      '깊은 내면 세계를 가진 아이',
    ],
    studyStyle: '이야기와 이미지로 배우는 것이 가장 효과적입니다. 영상 자료, 그림, 음악을 활용한 학습에서 흡수력이 높아지고, 조용한 환경에서 더 잘 집중합니다.',
    bestSubjects: ['국어(문학/글쓰기)', '미술', '음악', '사회(역사)'],
    weakAreas: ['수학(계산/공식 암기)', '시간 내 빠른 문제 풀이'],
    futureFields: ['예술가/디자이너', '작가/시인', '상담사', '뮤지션/영화감독'],
    sportsMatch: ['발레/무용', '수영', '피겨스케이팅', '자연 산책'],
    academyStyle: '감성을 자극하는 예술 학원이나 창의적 활동 중심의 수업이 적합합니다. 경쟁보다는 자기표현을 중시하는 환경에서 편안하게 실력을 발휘합니다.',
    goodFoods: ['해조류(미역, 김)', '검은콩', '블루베리', '생선', '호두'],
    badFoods: ['자극적인 맛의 음식', '과도한 단 음식', '인스턴트 국물류'],
    educationDirection: '아이의 감정과 상상력을 존중해주세요. "그건 말이 안 돼"라는 부정보다 "재미있는 생각이네!"라는 긍정이 창의력을 키워줍니다. 예술 활동을 꾸준히 접하게 해주세요.',
    specialTalent: '다른 사람이 보지 못하는 아름다움과 의미를 찾아내는 예술적 감각이 특출납니다. 감정을 작품으로 표현하는 능력이 뛰어납니다.',
    parentingTip: '감성형 아이는 부모의 감정에 매우 민감합니다. 아이 앞에서 부정적 감정을 강하게 표현하면 위축될 수 있어요. 아이의 감정을 먼저 인정해주고, 일기나 그림으로 표현하게 도와주세요.',
  },
};

/**
 * 온보딩 답변을 기반으로 프로파일을 미세 조정
 * answer 0 = 첫번째 선택지, 1 = 두번째, 2 = 세번째, 3 = 네번째
 */
function adjustByAnswers(
  base: ChildReport,
  answers: AnswerItem[],
  dominantType: string
): ChildReport {
  const report = { ...base };
  const answerMap = new Map<string, number>();
  answers.forEach((a) => answerMap.set(a.questionId, a.answer));

  // 답변에서 성격 보조 지표를 읽어 리포트를 보강한다
  const vals = Array.from(answerMap.values());
  const hasLeaderTrait = vals[1] === 0; // Q2: 리더역할
  const hasCarefulTrait = vals[1] === 3; // Q2: 관찰함
  const hasActiveTrait = vals[3] === 0; // Q4: 활동적 놀이
  const hasCreativeTrait = vals[3] === 1; // Q4: 그림/만들기
  const hasLogicTrait = vals[3] === 2; // Q4: 퍼즐/게임
  const hasResilientTrait = vals[2] === 0; // Q3: 바로 다시 시도
  const hasSensitiveTrait = vals[2] === 1; // Q3: 속상해함
  const hasLongFocusTrait = vals[6] === 0; // Q7: 매우 길게
  const hasRuleFollower = vals[7] === 0; // Q8: 잘 따름
  const hasQuestionRules = vals[7] === 3; // Q8: 왜 그런지 물어봄
  const preferAlone = vals[8] === 0; // Q9: 혼자 있고 싶음
  const preferActivity = vals[8] === 1; // Q9: 운동/활동
  const earlyBird = vals[10] === 0 || vals[10] === 3; // Q11: 잘 일어남

  // 성격 보강
  if (hasLeaderTrait && !report.personality.some((p) => p.includes('리더'))) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '또래 사이에서 자연스러운 리더 역할을 맡는 편',
    ];
  }
  if (hasCarefulTrait) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '신중하게 관찰한 뒤 행동하는 사려 깊은 성격',
    ];
  }

  // 학습 스타일 보강
  if (hasLogicTrait && dominantType !== 'metal') {
    report.studyStyle += ' 퍼즐이나 게임 요소를 접목하면 더 즐겁게 학습할 수 있습니다.';
  }
  if (hasCreativeTrait && dominantType !== 'water') {
    report.studyStyle += ' 그리기나 만들기와 연결하면 학습 효과가 올라갑니다.';
  }

  // 운동 보강
  if (hasActiveTrait && !report.sportsMatch.includes('달리기')) {
    report.sportsMatch = [...report.sportsMatch.slice(0, 3), '달리기/육상'];
  }

  // 교육 방향 보강
  if (hasResilientTrait) {
    report.educationDirection += ' 이 아이는 회복탄력성이 높으니 도전적인 과제를 적극 제시해주세요.';
  }
  if (hasSensitiveTrait) {
    report.educationDirection += ' 실패에 민감한 편이므로 과정을 칭찬하고 작은 성공 경험을 쌓아주세요.';
  }

  // 양육 팁 보강
  if (hasLongFocusTrait) {
    report.parentingTip += ' 집중 시간이 긴 편이니 몰입할 수 있는 환경을 만들어 주세요.';
  }
  if (hasQuestionRules) {
    report.parentingTip += ' 규칙의 이유를 궁금해하니, 함께 규칙을 만들어보는 것도 좋습니다.';
  }
  if (preferAlone) {
    report.parentingTip += ' 스트레스 시 혼자만의 시간이 필요한 아이입니다. 충분한 개인 공간을 보장해주세요.';
  }
  if (preferActivity) {
    report.parentingTip += ' 스트레스를 신체 활동으로 풀 수 있게 운동 시간을 충분히 확보해주세요.';
  }
  if (earlyBird) {
    report.specialTalent += ' 아침형 생활 패턴이 잘 맞아 오전 학습 효율이 높습니다.';
  }

  return report;
}

/**
 * dominantType의 element key 추출
 * '탐구형' → 'wood', '활동형' → 'fire', etc.
 */
function resolveTypeKey(dominantType: string): string {
  const mapping: Record<string, string> = {
    '탐구형': 'wood',
    '활동형': 'fire',
    '조화형': 'earth',
    '분석형': 'metal',
    '감성형': 'water',
    wood: 'wood',
    fire: 'fire',
    earth: 'earth',
    metal: 'metal',
    water: 'water',
  };
  return mapping[dominantType] ?? 'earth';
}

/** 종합 분석 리포트 생성 */
export function generateChildReport(
  dominantType: string,
  answers: AnswerItem[]
): ChildReport {
  const typeKey = resolveTypeKey(dominantType);
  const base = BASE_PROFILES[typeKey] ?? BASE_PROFILES.earth;
  return adjustByAnswers({ ...base }, answers, typeKey);
}

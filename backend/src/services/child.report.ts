/**
 * child.report.ts
 * 자녀 종합 분석 리포트 생성 (정적 — AI 호출 없음)
 * dominantType + ageGroup + 온보딩 질문 답변으로 상세 리포트를 생성한다.
 */

export interface ReportReasons {
  personality: string;
  studyStyle: string;
  bestSubjects: string;
  futureFields: string;
  sportsMatch: string;
  academyStyle: string;
  foods: string;
}

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
  reasons: ReportReasons;
}

export type AgeGroup = 'infant' | 'kinder' | 'elem_low' | 'elem_high';

interface AnswerItem {
  questionId: string;
  answer: number;
}

// ─────────────────────────────────────────────
// dominantType 별 기본 프로파일
// ─────────────────────────────────────────────
const BASE_PROFILES: Record<string, ChildReport> = {
  wood: {
    summary:
      '호기심과 탐구심이 넘치는 아이로, 새로운 것을 발견하고 배우는 데서 큰 즐거움을 느낍니다.',
    personality: [
      '강한 호기심과 탐구 정신',
      '독립적이고 자기주도적인 성향',
      '빠른 이해력과 흡수력',
      '정의감이 강하고 솔직한 표현',
    ],
    studyStyle:
      '직접 해보고 경험하며 배우는 체험형 학습이 가장 효과적입니다. 교과서보다는 실험, 프로젝트 기반 학습에서 뛰어난 집중력을 보입니다.',
    bestSubjects: ['과학', '수학', '사회탐구', '코딩'],
    weakAreas: ['반복 암기가 필요한 과목', '꼼꼼한 필기/정리'],
    futureFields: [
      '연구원/과학자',
      '개발자/엔지니어',
      '탐험가/다큐멘터리 PD',
      '창업가',
    ],
    sportsMatch: ['수영', '클라이밍', '태권도', '자전거'],
    academyStyle:
      '소규모 토론식 수업이나 프로젝트 기반 학습이 적합합니다. 일방적 강의식보다는 질문과 실험이 가능한 환경을 선호합니다.',
    goodFoods: ['녹색 채소(시금치, 브로콜리)', '견과류', '등푸른 생선', '현미밥'],
    badFoods: ['과도한 인스턴트 식품', '고카페인 음료', '인공색소가 많은 과자'],
    educationDirection:
      '아이의 질문에 성의 있게 답해주고, "왜?"라고 물을 때 함께 찾아보는 시간을 가져주세요. 다양한 체험 활동과 자연 탐구 기회를 자주 만들어 주면 잠재력이 크게 성장합니다.',
    specialTalent:
      '복잡한 문제를 스스로 분석하고 해결 방법을 찾아가는 문제해결력이 특출납니다.',
    parentingTip:
      '탐구형 아이는 통제보다 방향 제시가 효과적입니다. "하지 마"보다 "이렇게 해볼까?"로 대화하면 훨씬 잘 따릅니다. 자율성을 최대한 존중하면서 안전한 경계를 잡아주세요.',
    reasons: {
      personality: '호기심과 탐구 에너지가 강하게 나타나 새로운 것을 스스로 발견하고 이해하려는 성향이 두드러집니다.',
      studyStyle: '직접 체험하고 질문하며 답을 찾아가는 탐구형 에너지가 강하기 때문에 프로젝트 기반 학습이 가장 효과적입니다.',
      bestSubjects: '논리적 사고와 호기심이 뛰어나 과학, 수학 등 탐구가 필요한 과목에서 강점을 보입니다.',
      futureFields: '독립적 사고력과 문제해결력이 강해 연구, 개발, 창업 등 탐구 중심 분야에서 잠재력이 높습니다.',
      sportsMatch: '자기 페이스로 도전하고 성취를 느끼는 개인 스포츠에서 집중력과 끈기를 발휘할 수 있습니다.',
      academyStyle: '일방적 강의보다 질문과 토론이 가능한 환경에서 학습 효율이 크게 올라가는 탐구형 기질입니다.',
      foods: '두뇌 활동이 활발한 탐구형 기질이므로 뇌 발달을 돕는 오메가3와 녹색 채소가 특히 도움이 됩니다.',
    },
  },
  fire: {
    summary:
      '밝은 에너지와 강한 표현력을 가진 아이로, 사람들 앞에서 빛나는 리더형 기질입니다.',
    personality: [
      '밝고 긍정적인 에너지',
      '표현력이 풍부하고 사교적',
      '리더십과 추진력이 뛰어남',
      '열정적이고 빠른 행동력',
    ],
    studyStyle:
      '친구와 함께하는 그룹 학습이나 발표, 토론 중심의 수업에서 빛을 발합니다. 경쟁 요소가 있으면 더욱 집중력이 높아집니다.',
    bestSubjects: ['체육', '예술(음악/미술)', '국어(발표/토론)', '사회'],
    weakAreas: ['장시간 집중이 필요한 독서', '세밀한 계산/검산'],
    futureFields: [
      '리더/경영자',
      '연예인/크리에이터',
      '스포츠 선수',
      '교사/강사',
    ],
    sportsMatch: ['축구', '농구', '댄스', '체조'],
    academyStyle:
      '활동적이고 참여형 수업이 좋습니다. 앉아서 듣기만 하는 학원보다 발표와 실습이 많은 곳이 맞습니다. 소규모 그룹 과외도 효과적입니다.',
    goodFoods: ['빨간 과일(토마토, 딸기)', '닭가슴살', '계란', '바나나'],
    badFoods: ['과도한 설탕 음식', '자극적인 매운 음식', '탄산음료'],
    educationDirection:
      '에너지를 올바른 방향으로 쓸 수 있도록 다양한 활동 기회를 주세요. 성취감을 느낄 수 있는 작은 목표를 자주 설정해주면 지속적으로 동기부여가 됩니다.',
    specialTalent:
      '사람들의 마음을 사로잡는 카리스마와 표현력이 특출납니다. 무대 위에서 더욱 빛나는 아이입니다.',
    parentingTip:
      '활동형 아이는 억누르면 역효과가 납니다. 충분한 신체 활동 시간을 보장하고, 칭찬과 격려를 아끼지 마세요. 실패해도 "다시 해보자"는 메시지가 아이에게 큰 힘이 됩니다.',
    reasons: {
      personality: '활동적인 에너지가 강하고 표현력이 뛰어나 사람들 사이에서 자연스럽게 주목받는 리더형 기질입니다.',
      studyStyle: '경쟁과 상호작용에서 동기부여를 받는 에너지가 강하기 때문에 그룹 학습과 발표 중심 수업이 효과적입니다.',
      bestSubjects: '표현력과 에너지가 풍부해 체육, 예술, 발표가 필요한 과목에서 두각을 나타냅니다.',
      futureFields: '카리스마와 추진력이 뛰어나기 때문에 리더십과 표현이 요구되는 분야에서 잠재력이 높습니다.',
      sportsMatch: '활동적인 에너지가 강하고 표현력이 뛰어나기 때문에 팀 스포츠에서 리더십을 발휘할 수 있습니다.',
      academyStyle: '앉아서 듣기만 하면 에너지가 분산되므로 참여형, 활동형 수업이 집중력을 높여줍니다.',
      foods: '에너지 소모가 크고 성장이 활발한 기질이므로 양질의 단백질과 빠른 에너지 보충 식품이 중요합니다.',
    },
  },
  earth: {
    summary:
      '안정적이고 배려심이 깊은 아이로, 주변 사람들과의 조화를 소중히 여기며 믿음직한 성격입니다.',
    personality: [
      '깊은 배려심과 공감 능력',
      '안정적이고 차분한 성격',
      '책임감이 강하고 성실함',
      '중재자 역할을 잘 수행',
    ],
    studyStyle:
      '규칙적이고 안정적인 환경에서 꾸준히 학습하는 것이 가장 효과적입니다. 예습-복습 루틴을 만들면 착실하게 성적이 오릅니다.',
    bestSubjects: ['국어', '도덕/윤리', '생물', '가정/실과'],
    weakAreas: ['빠른 판단이 필요한 시험', '경쟁적 환경에서의 발표'],
    futureFields: [
      '의사/간호사',
      '상담사/심리치료사',
      '교사',
      '사회복지사',
    ],
    sportsMatch: ['요가', '산책/등산', '배드민턴', '골프'],
    academyStyle:
      '친한 친구와 함께하는 소규모 공부방이나 1:1 과외가 적합합니다. 경쟁보다 협력을 강조하는 수업 분위기가 아이에게 안정감을 줍니다.',
    goodFoods: ['고구마', '호박', '두부', '잡곡밥', '우유'],
    badFoods: ['찬 음식 과다 섭취', '불규칙한 식사 습관', '자극적인 간식'],
    educationDirection:
      '아이의 속도를 존중해주세요. 다른 아이와 비교하지 말고, 꾸준한 노력에 대해 칭찬해주면 아이의 자존감이 높아집니다. 안정적 루틴이 학습 성과로 이어집니다.',
    specialTalent:
      '다른 사람의 감정을 섬세하게 읽고 다독이는 공감 능력이 특출납니다. 팀에서 갈등을 해결하는 핵심 역할을 합니다.',
    parentingTip:
      '조화형 아이는 변화에 민감합니다. 환경이 바뀔 때 미리 충분히 설명해주고, 안전하다는 느낌을 주세요. 매일 같은 시간에 안아주는 루틴이 큰 안정감을 줍니다.',
    reasons: {
      personality: '안정과 조화의 에너지가 강해 주변 사람들을 배려하고 갈등을 해결하는 중재자 역할을 자연스럽게 합니다.',
      studyStyle: '꾸준함과 안정감 속에서 성장하는 기질이므로 규칙적인 루틴과 반복 학습이 가장 큰 효과를 냅니다.',
      bestSubjects: '공감 능력과 성실함이 뛰어나 언어, 윤리, 생물 등 이해와 배려가 필요한 과목에서 강점을 보입니다.',
      futureFields: '깊은 공감 능력과 책임감이 있어 사람을 돕고 돌보는 분야에서 큰 보람과 성과를 얻을 수 있습니다.',
      sportsMatch: '경쟁보다 조화를 중시하는 기질이므로 차분하고 꾸준히 즐길 수 있는 운동이 잘 맞습니다.',
      academyStyle: '안정적인 환경과 친밀한 관계 속에서 학습 효율이 올라가는 기질이므로 소규모 수업이 적합합니다.',
      foods: '소화 기능과 정서 안정이 중요한 기질이므로 따뜻하고 소화가 잘 되는 음식이 건강에 도움이 됩니다.',
    },
  },
  metal: {
    summary:
      '분석적이고 논리적인 사고력을 가진 아이로, 꼼꼼하고 정확한 것을 추구하며 높은 집중력을 보입니다.',
    personality: [
      '뛰어난 집중력과 분석력',
      '꼼꼼하고 정확한 성격',
      '독립적인 사고와 판단력',
      '목표 지향적이고 체계적',
    ],
    studyStyle:
      '체계적으로 정리하며 배우는 것을 좋아합니다. 노트 필기, 마인드맵, 단계별 학습법이 효과적이며 혼자 집중하는 시간을 충분히 주는 것이 중요합니다.',
    bestSubjects: ['수학', '과학', '컴퓨터/코딩', '영어(문법)'],
    weakAreas: ['감상문/창의적 글쓰기', '팀 프로젝트에서 타협'],
    futureFields: [
      '프로그래머/데이터 과학자',
      '의사/약사',
      '법률가',
      '회계사/금융 전문가',
    ],
    sportsMatch: ['바둑/체스', '펜싱', '사격/양궁', '수영'],
    academyStyle:
      '체계적 커리큘럼이 있는 학원이 잘 맞습니다. 혼자 집중할 수 있는 자습 시간이 포함된 수업이나, 단계별로 레벨업이 가능한 온라인 학습도 효과적입니다.',
    goodFoods: ['흰 살 생선', '배', '무', '쌀밥', '두유'],
    badFoods: ['색소가 많은 음식', '과도한 유제품', '패스트푸드'],
    educationDirection:
      '완벽주의 성향이 있을 수 있으므로 "틀려도 괜찮아"라는 메시지를 자주 전달해주세요. 자신만의 방식으로 정리할 시간을 충분히 주면 학습 효율이 크게 올라갑니다.',
    specialTalent:
      '복잡한 정보를 체계적으로 분류하고 패턴을 찾아내는 분석력이 특출납니다. 논리적 사고가 필요한 분야에서 두각을 나타냅니다.',
    parentingTip:
      '분석형 아이는 "왜"에 대한 논리적 설명이 필요합니다. "그냥 해"라는 말보다 이유를 설명해주면 훨씬 잘 따릅니다. 감정 표현이 서툴 수 있으니 감정 이야기 시간을 의식적으로 만들어 주세요.',
    reasons: {
      personality: '분석과 논리의 에너지가 강해 꼼꼼하게 관찰하고 체계적으로 정리하는 것에 뛰어난 능력을 보입니다.',
      studyStyle: '체계와 논리를 중시하는 기질이므로 단계별 학습과 노트 정리를 통해 깊은 이해에 도달합니다.',
      bestSubjects: '논리적 사고력과 집중력이 뛰어나 수학, 과학, 코딩 등 정확성이 요구되는 과목에서 강점을 보입니다.',
      futureFields: '뛰어난 분석력과 체계적 사고가 강점이므로 전문성과 정확성이 요구되는 분야에서 두각을 나타냅니다.',
      sportsMatch: '전략적 사고와 집중력이 뛰어난 기질이므로 두뇌를 활용하는 스포츠에서 실력을 발휘합니다.',
      academyStyle: '자기 속도에 맞춰 체계적으로 학습하는 것을 선호하므로 커리큘럼이 명확한 수업이 효과적입니다.',
      foods: '집중력을 많이 사용하는 기질이므로 뇌 기능을 돕고 면역력을 유지하는 식품이 중요합니다.',
    },
  },
  water: {
    summary:
      '풍부한 감수성과 창의력을 가진 아이로, 상상력이 넘치고 예술적 감각이 뛰어납니다.',
    personality: [
      '풍부한 감수성과 직관력',
      '뛰어난 창의력과 상상력',
      '적응력이 좋고 유연한 사고',
      '깊은 내면 세계를 가진 아이',
    ],
    studyStyle:
      '이야기와 이미지로 배우는 것이 가장 효과적입니다. 영상 자료, 그림, 음악을 활용한 학습에서 흡수력이 높아지고, 조용한 환경에서 더 잘 집중합니다.',
    bestSubjects: ['국어(문학/글쓰기)', '미술', '음악', '사회(역사)'],
    weakAreas: ['수학(계산/공식 암기)', '시간 내 빠른 문제 풀이'],
    futureFields: [
      '예술가/디자이너',
      '작가/시인',
      '상담사',
      '뮤지션/영화감독',
    ],
    sportsMatch: ['발레/무용', '수영', '피겨스케이팅', '자연 산책'],
    academyStyle:
      '감성을 자극하는 예술 학원이나 창의적 활동 중심의 수업이 적합합니다. 경쟁보다는 자기표현을 중시하는 환경에서 편안하게 실력을 발휘합니다.',
    goodFoods: ['해조류(미역, 김)', '검은콩', '블루베리', '생선', '호두'],
    badFoods: ['자극적인 맛의 음식', '과도한 단 음식', '인스턴트 국물류'],
    educationDirection:
      '아이의 감정과 상상력을 존중해주세요. "그건 말이 안 돼"라는 부정보다 "재미있는 생각이네!"라는 긍정이 창의력을 키워줍니다. 예술 활동을 꾸준히 접하게 해주세요.',
    specialTalent:
      '다른 사람이 보지 못하는 아름다움과 의미를 찾아내는 예술적 감각이 특출납니다. 감정을 작품으로 표현하는 능력이 뛰어납니다.',
    parentingTip:
      '감성형 아이는 부모의 감정에 매우 민감합니다. 아이 앞에서 부정적 감정을 강하게 표현하면 위축될 수 있어요. 아이의 감정을 먼저 인정해주고, 일기나 그림으로 표현하게 도와주세요.',
    reasons: {
      personality: '감성과 직관의 에너지가 풍부해 섬세한 감수성과 깊은 내면 세계를 가진 예술가형 기질입니다.',
      studyStyle: '이미지와 이야기에 반응하는 감성 에너지가 강하기 때문에 시청각 자료와 창의적 표현을 통한 학습이 효과적입니다.',
      bestSubjects: '풍부한 감수성과 창의력이 강점이므로 문학, 미술, 음악 등 자기표현이 중요한 과목에서 빛을 발합니다.',
      futureFields: '남다른 감성과 창의력을 가지고 있어 예술, 문학, 상담 등 감정과 표현이 핵심인 분야에서 잠재력이 높습니다.',
      sportsMatch: '우아함과 감성 표현이 뛰어난 기질이므로 미적 감각을 살릴 수 있는 예술적 운동이 잘 맞습니다.',
      academyStyle: '경쟁보다 자기표현을 중시하는 기질이므로 감성을 자극하고 편안한 분위기의 수업이 적합합니다.',
      foods: '감성이 예민한 기질이므로 정서 안정과 두뇌 발달을 돕는 해조류, 견과류 등이 특히 좋습니다.',
    },
  },
};

// ─────────────────────────────────────────────
// 연령대별 리포트 오버레이
// ─────────────────────────────────────────────
interface AgeOverlay {
  summaryPrefix: string;
  studyStyleOverride: Record<string, string>;
  academyStyleOverride: Record<string, string>;
  foodTip: string;
  educationTip: string;
  parentingExtra: string;
}

const AGE_OVERLAYS: Record<AgeGroup, AgeOverlay> = {
  infant: {
    summaryPrefix: '(0~36개월) ',
    studyStyleOverride: {
      wood: '다양한 감각 자극(촉감놀이, 자연탐색)을 통해 호기심을 키워주세요. 안전한 환경에서 자유롭게 탐색하게 두는 것이 이 시기 최고의 학습입니다.',
      fire: '리듬 있는 신체 놀이와 음악 활동이 효과적입니다. 에너지를 발산할 수 있는 대근육 놀이를 충분히 제공해주세요.',
      earth: '규칙적인 루틴 안에서 반복적인 놀이가 안정감과 학습 효과를 동시에 줍니다. 부모와 함께하는 따뜻한 상호작용이 발달의 핵심입니다.',
      metal: '쌓기, 끼우기 등 인과관계를 경험하는 놀이가 좋습니다. 결과를 볼 수 있는 단순한 구조 놀이에서 집중력이 높아집니다.',
      water: '그림책 읽어주기, 자장가, 부드러운 촉감 놀이가 가장 효과적입니다. 감각적으로 풍부한 환경이 이 시기 두뇌 발달을 촉진합니다.',
    },
    academyStyleOverride: {
      wood: '문화센터의 오감발달 프로그램이나 자연관찰 프로그램을 추천합니다.',
      fire: '베이비 체육, 음악 놀이 수업 등 활동적인 문화센터 프로그램이 잘 맞습니다.',
      earth: '엄마(아빠)와 함께하는 애착 놀이 수업이나 소규모 놀이 수업을 추천합니다.',
      metal: '교구 탐색 프로그램이나 조용한 소그룹 놀이 수업이 적합합니다.',
      water: '음악 놀이, 미술 놀이 등 감각 자극 위주의 문화센터 프로그램이 좋습니다.',
    },
    foodTip: '이유식 시기에는 다양한 식재료를 소량씩 접하게 해주세요. 알레르기 반응을 관찰하며 천천히 식경험을 넓혀가는 것이 중요합니다.',
    educationTip: '이 시기는 부모와의 안정적 애착이 모든 발달의 기초입니다. 눈 맞추며 이야기하고, 아이의 신호에 민감하게 반응해주세요.',
    parentingExtra: '영아기에는 "잘했어!"보다 "같이 해보자"가 더 효과적입니다. 결과보다 과정을 함께하는 경험이 아이에게 안전 기지를 만들어줍니다.',
  },
  kinder: {
    summaryPrefix: '(37~72개월) ',
    studyStyleOverride: {
      wood: '놀이 중심의 과학 탐구 활동과 자연 관찰이 효과적입니다. "왜?" 질문에 함께 답을 찾아가는 과정 자체가 최고의 학습입니다.',
      fire: '역할놀이, 발표 놀이, 그룹 활동에서 빛을 발합니다. 친구와 함께하는 협동 놀이를 통해 사회성과 학습이 동시에 성장합니다.',
      earth: '그림 그리기, 점토 놀이 등 차분한 손 활동과 친구와 번갈아 하는 놀이에서 잘 배웁니다. 예측 가능한 루틴 안에서 안정적으로 성장합니다.',
      metal: '숫자, 글자 카드놀이와 규칙이 있는 보드게임이 효과적입니다. 단계별로 어려워지는 퍼즐에서 성취감을 느끼며 성장합니다.',
      water: '동화 구연, 그림 그리기, 음악에 맞춰 춤추기가 학습 효과를 극대화합니다. 상상력을 자유롭게 표현할 수 있는 활동이 중요합니다.',
    },
    academyStyleOverride: {
      wood: '실험/탐구형 유아과학 교실이나 숲체험 프로그램이 잘 맞습니다.',
      fire: '발표와 역할놀이가 포함된 유아 예체능 수업이 적합합니다. 소규모 체육 교실도 좋습니다.',
      earth: '소규모 놀이학교나 또래 친구와 함께하는 창의놀이 수업이 안정감을 줍니다.',
      metal: '사고력 수학, 한글/영어 기초 등 체계적인 학습 놀이 프로그램이 좋습니다.',
      water: '미술, 음악, 창작 놀이 위주의 예술 프로그램이 가장 잘 맞습니다.',
    },
    foodTip: '편식이 시작될 수 있는 시기입니다. 강요보다는 다양한 조리법으로 식재료를 접하게 해주세요. 함께 요리하는 경험이 편식 극복에 효과적입니다.',
    educationTip: '이 시기는 놀이가 곧 학습입니다. 억지로 공부시키기보다 놀이 속에서 자연스럽게 배움이 일어나도록 환경을 만들어주세요.',
    parentingExtra: '유치원 생활을 시작하며 사회성이 급격히 발달합니다. 친구 관계에서 생기는 감정을 집에서 충분히 들어주고 공감해주세요.',
  },
  elem_low: {
    summaryPrefix: '(초등 1~3학년) ',
    studyStyleOverride: {
      wood: '교과서 밖의 심화 학습과 프로젝트 과제가 효과적입니다. 관심 분야 도서를 통한 자기주도 학습에서 뛰어난 성과를 보입니다.',
      fire: '친구와 함께 공부하거나, 게이미피케이션(포인트/레벨) 요소가 있는 학습에서 동기부여가 높아집니다. 경쟁이 아이를 자극합니다.',
      earth: '예습-복습 루틴을 확립하면 꾸준히 성적이 오릅니다. 부모가 옆에서 함께하는 학습 시간이 안정감을 주고 효율을 높입니다.',
      metal: '문제집 단계별 풀기, 오답노트 정리가 매우 효과적입니다. 혼자 집중하는 자습 시간과 체계적 스케줄이 중요합니다.',
      water: '교과 내용을 이야기로 풀어주거나, 마인드맵으로 시각화하면 이해가 빨라집니다. 글쓰기와 예술 활동을 통한 표현형 학습이 좋습니다.',
    },
    academyStyleOverride: {
      wood: '토론식 수업과 체험 학습 위주의 학원이 적합합니다. 일방적 강의보다 질문이 자유로운 환경을 선택하세요.',
      fire: '그룹 과외나 소규모 참여형 학원이 좋습니다. 발표와 활동이 포함된 수업에서 집중력이 높아집니다.',
      earth: '1:1 과외나 소규모 공부방이 잘 맞습니다. 같은 선생님, 같은 친구와 꾸준히 다니는 것이 중요합니다.',
      metal: '체계적 커리큘럼의 학원이나 온라인 학습이 효과적입니다. 자기 속도에 맞춰 레벨업하는 시스템을 선호합니다.',
      water: '예술 학원과 학습 학원을 균형 있게 배치하세요. 학습 학원도 창의적 접근이 가능한 곳이 좋습니다.',
    },
    foodTip: '두뇌 발달과 체력 성장이 동시에 필요한 시기입니다. 오메가3가 풍부한 생선, 칼슘이 풍부한 유제품, 제철 과일을 꾸준히 챙겨주세요.',
    educationTip: '학습 습관이 형성되는 결정적 시기입니다. 매일 일정 시간 공부하는 루틴을 만들되, 양보다 질에 집중하세요. 15분 집중 + 5분 휴식 패턴이 효과적입니다.',
    parentingExtra: '학교생활 적응이 핵심 과제입니다. 매일 학교 이야기를 들어주고, 숙제를 스스로 하되 필요할 때 도와주는 균형을 유지하세요.',
  },
  elem_high: {
    summaryPrefix: '(초등 4~6학년) ',
    studyStyleOverride: {
      wood: '심화 학습과 창의적 문제 해결에서 두각을 나타냅니다. 관심 분야의 깊이 있는 탐구와 자기주도 프로젝트가 성장의 핵심입니다.',
      fire: '발표, 토론, 그룹 프로젝트에서 리더십을 발휘하며 학습합니다. 목표와 보상을 명확히 설정하면 강한 동기부여가 됩니다.',
      earth: '꾸준한 예습-복습과 계획표 관리가 최대 강점입니다. 친한 친구와 함께 스터디그룹을 만들면 시너지가 납니다.',
      metal: '심화 문제 풀이와 체계적 노트 정리가 성적을 크게 끌어올립니다. 논리적 사고력 대회나 수학 올림피아드에 도전해보세요.',
      water: '독서와 글쓰기를 통한 심화 학습이 효과적입니다. 역사, 문학, 예술 분야에서 깊이 있는 지식을 쌓아갈 수 있습니다.',
    },
    academyStyleOverride: {
      wood: '토론식/하브루타 학원이나 코딩/과학 실험 교실이 적합합니다. 자기주도 학습을 도와주는 멘토형 교육이 좋습니다.',
      fire: '소규모 그룹 과외나 참여형 학원이 효과적입니다. 동기부여가 확실한 목표 관리형 학원도 잘 맞습니다.',
      earth: '담임 선생님과 유대가 깊은 소규모 학원이 좋습니다. 일관된 환경에서 꾸준히 다니는 것이 성과로 이어집니다.',
      metal: '선행 학습이 가능한 체계적 학원이나 상위권 대상 심화 수업이 잘 맞습니다. 온라인 인강도 효율적으로 활용합니다.',
      water: '예술 전공 준비 학원과 학습 균형이 중요합니다. 글쓰기 교실이나 독서 토론 프로그램이 인문적 소양을 키워줍니다.',
    },
    foodTip: '성장기 호르몬 변화가 시작되는 시기입니다. 양질의 단백질과 칼슘 섭취를 늘리고, 패스트푸드와 탄산음료 섭취를 줄여주세요.',
    educationTip: '중학교 준비가 시작되는 시기입니다. 자기주도 학습 능력을 키우는 것이 가장 중요하며, 스스로 계획을 세우고 실행하는 연습이 필요합니다.',
    parentingExtra: '사춘기가 시작될 수 있는 시기입니다. 감정 변화를 이해해주고, 간섭보다 대화와 경청의 비중을 높여주세요. 아이의 자율성을 존중하면서 적절한 경계를 유지하세요.',
  },
};

// ─────────────────────────────────────────────
// 답변 기반 보조 분석 함수 (연령대별)
// ─────────────────────────────────────────────

/** 영아기 답변 분석 */
function analyzeInfantAnswers(
  report: ChildReport,
  answerMap: Map<string, number>
): void {
  const env = answerMap.get('infant_1');
  const stubbornness = answerMap.get('infant_2');
  const newToy = answerMap.get('infant_4');
  const sensory = answerMap.get('infant_5');
  const activity = answerMap.get('infant_6');
  const separation = answerMap.get('infant_9');
  const frustration = answerMap.get('infant_11');
  const comfort = answerMap.get('infant_12');
  const social = answerMap.get('infant_13');
  const sleep = answerMap.get('infant_17');
  const focus = answerMap.get('infant_19');
  const routine = answerMap.get('infant_20');

  // 탐색형 아이
  if (env === 0 && newToy === 0) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '새로운 환경과 사물에 적극적으로 다가가는 탐색형',
    ];
  }
  // 신중한 아이
  if (env === 2 && newToy === 1) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '관찰 후 행동하는 신중하고 사려 깊은 성격',
    ];
  }
  // 고집이 강한 아이
  if (stubbornness === 0) {
    report.parentingTip +=
      ' 의지가 강한 아이이므로 "안 돼" 대신 선택지를 제시하세요 ("이거 할까, 저거 할까?").'
    ;
  }
  // 감각 선호 반영
  if (sensory === 2) {
    report.educationDirection +=
      ' 촉감놀이(모래, 물, 점토)를 자주 접하게 해주세요. 감각 발달에 큰 도움이 됩니다.';
  }
  // 활동량 높은 아이
  if (activity === 0) {
    report.sportsMatch = ['베이비 체조', '물놀이', '놀이터 활동', '산책'];
    report.parentingTip +=
      ' 에너지가 넘치는 아이이니 안전한 공간에서 충분히 움직이게 해주세요.';
  }
  // 분리불안 높은 아이
  if (separation === 0) {
    report.educationDirection +=
      ' 분리불안이 있으므로 떨어질 때 짧고 확실한 인사 루틴("곧 올게!")을 만들어주세요.';
  }
  // 회복탄력성
  if (frustration === 3) {
    report.specialTalent +=
      ' 어린 나이에도 끈기 있게 시도하는 회복탄력성이 돋보입니다.';
  }
  // 사회성
  if (social === 0) {
    report.educationDirection +=
      ' 또래와의 상호작용에 관심이 높으니 문화센터 놀이 수업으로 사회성을 키워주세요.';
  }
  // 수면 패턴
  if (sleep === 0) {
    report.specialTalent +=
      ' 규칙적인 수면 리듬을 가지고 있어 전반적인 발달이 안정적입니다.';
  }
  // 집중력
  if (focus === 0) {
    report.specialTalent += ' 또래 대비 집중 시간이 길어 학습 잠재력이 높습니다.';
  }
  // 변화 적응
  if (routine === 2) {
    report.parentingTip +=
      ' 루틴 변화에 민감하니 일과 변경 시 미리 예고해주세요.';
  }
}

/** 유치원기 답변 분석 */
function analyzeKinderAnswers(
  report: ChildReport,
  answerMap: Map<string, number>
): void {
  const adaptation = answerMap.get('kinder_1');
  const rules = answerMap.get('kinder_2');
  const decision = answerMap.get('kinder_3');
  const patience = answerMap.get('kinder_4');
  const curiosity = answerMap.get('kinder_5');
  const interest = answerMap.get('kinder_6');
  const focus = answerMap.get('kinder_7');
  const learnStyle = answerMap.get('kinder_8');
  const friends = answerMap.get('kinder_9');
  const conflict = answerMap.get('kinder_10');
  const leader = answerMap.get('kinder_11');
  const emotionExpr = answerMap.get('kinder_13');
  const failure = answerMap.get('kinder_14');
  const empathy = answerMap.get('kinder_16');
  const play = answerMap.get('kinder_17');
  const imagination = answerMap.get('kinder_18');
  const art = answerMap.get('kinder_19');
  const stamina = answerMap.get('kinder_20');

  // 빠른 적응력
  if (adaptation === 0) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '새 환경에 빠르게 적응하는 사교적 성향',
    ];
  }
  // 규칙 의식
  if (rules === 0) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '규칙을 잘 이해하고 따르는 성실한 모습',
    ];
  }
  if (rules === 3) {
    report.parentingTip +=
      ' 규칙의 이유를 궁금해하니 함께 규칙을 만들어보면 자율성이 자랍니다.';
  }
  // 결정력
  if (decision === 0) {
    report.specialTalent += ' 또래보다 뛰어난 결단력과 자기확신이 돋보입니다.';
  }
  if (decision === 2) {
    report.educationDirection +=
      ' 작은 선택(간식 고르기 등)부터 연습시켜 결정 근육을 키워주세요.';
  }
  // 인내심
  if (patience === 0) {
    report.specialTalent += ' 어려운 과제도 끝까지 해내는 인내심이 강합니다.';
  }
  if (patience === 2) {
    report.educationDirection +=
      ' 과제를 작은 단계로 나눠서 성공 경험을 쌓아주세요.';
  }
  // 호기심 타입
  if (curiosity === 0) {
    report.educationDirection +=
      ' 끊임없이 질문하는 아이이니 "좋은 질문이야!"라고 격려해주세요.';
  }
  // 관심 분야
  if (interest === 0) {
    report.bestSubjects = [
      ...report.bestSubjects.slice(0, 2),
      '자연관찰',
      '과학실험',
    ];
  }
  if (interest === 2) {
    report.bestSubjects = [
      ...report.bestSubjects.slice(0, 2),
      '미술',
      '음악/댄스',
    ];
  }
  // 집중력
  if (focus === 0) {
    report.specialTalent += ' 또래 대비 매우 긴 집중 시간을 보여 학습 잠재력이 높습니다.';
  }
  // 학습 방식
  if (learnStyle === 0) {
    report.studyStyle += ' 직접 체험으로 배울 때 가장 효과적입니다.';
  }
  if (learnStyle === 1) {
    report.studyStyle += ' 시각 자료를 활용하면 이해가 빨라집니다.';
  }
  // 리더십
  if (leader === 0 && !report.personality.some((p) => p.includes('리더'))) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '또래 사이에서 자연스러운 리더 역할',
    ];
  }
  // 사회성
  if (friends === 2) {
    report.educationDirection +=
      ' 혼자 놀기를 선호하지만 소규모 놀이에서 또래 경험을 쌓아주세요.';
  }
  // 갈등 해결
  if (conflict === 0) {
    report.specialTalent += ' 갈등 상황에서 말로 해결하려는 성숙한 모습이 보입니다.';
  }
  // 감정 표현
  if (emotionExpr === 0) {
    report.specialTalent += ' 감정을 말로 잘 표현하는 정서지능이 높은 아이입니다.';
  }
  if (emotionExpr === 2) {
    report.parentingTip +=
      ' 감정 표현이 서투른 편이니 감정 카드 놀이로 감정 어휘를 늘려주세요.';
  }
  // 실패 대응
  if (failure === 0) {
    report.educationDirection += ' 회복탄력성이 높으니 도전적 과제를 적극 제시해주세요.';
  }
  if (failure === 2 || failure === 3) {
    report.educationDirection +=
      ' 실패에 민감하므로 과정을 칭찬하고 작은 성공 경험을 쌓아주세요.';
  }
  // 공감
  if (empathy === 0) {
    report.specialTalent += ' 타인의 감정을 읽고 위로하는 공감 능력이 뛰어납니다.';
  }
  // 놀이 유형
  if (play === 0 && stamina === 0) {
    report.sportsMatch = [
      ...report.sportsMatch.slice(0, 2),
      '유아 체육',
      '수영',
    ];
  }
  // 상상력
  if (imagination === 0) {
    report.specialTalent += ' 풍부한 상상력으로 이야기를 만들어내는 창의력이 돋보입니다.';
  }
  // 예술 관심
  if (art === 0) {
    report.futureFields = [
      ...report.futureFields.slice(0, 2),
      '예술가/디자이너',
      '크리에이터',
    ];
  }
}

/** 초등 저학년 답변 분석 */
function analyzeElemLowAnswers(
  report: ChildReport,
  answerMap: Map<string, number>
): void {
  const studyMethod = answerMap.get('elem_low_1');
  const homework = answerMap.get('elem_low_2');
  const focus = answerMap.get('elem_low_3');
  const exam = answerMap.get('elem_low_4');
  const assertion = answerMap.get('elem_low_5');
  const planning = answerMap.get('elem_low_6');
  const perfectionism = answerMap.get('elem_low_7');
  const challenge = answerMap.get('elem_low_8');
  const friends = answerMap.get('elem_low_9');
  const conflictRes = answerMap.get('elem_low_10');
  const group = answerMap.get('elem_low_12');
  const stress = answerMap.get('elem_low_13');
  const failureRes = answerMap.get('elem_low_14');
  const confidence = answerMap.get('elem_low_15');
  const worry = answerMap.get('elem_low_16');
  const morning = answerMap.get('elem_low_17');
  const organize = answerMap.get('elem_low_18');
  const hobby = answerMap.get('elem_low_20');

  // 학습 방식 반영
  if (studyMethod === 0) {
    report.studyStyle += ' 자기주도 학습 능력이 발달하고 있으니 혼자 공부하는 시간을 보장해주세요.';
  }
  if (studyMethod === 2) {
    report.studyStyle += ' 스터디그룹이나 친구와 함께 공부하면 시너지가 납니다.';
  }
  if (studyMethod === 3) {
    report.studyStyle += ' 체험학습, 실험 키트 등 직접 경험하는 학습 방법을 활용해주세요.';
  }
  // 숙제 태도
  if (homework === 0) {
    report.specialTalent += ' 숙제를 스스로 챙기는 자기관리 능력이 뛰어납니다.';
  }
  if (homework === 2 || homework === 3) {
    report.parentingTip +=
      ' 숙제 시간을 정해두고, 끝나면 자유 시간이라는 보상 구조를 만들어보세요.';
  }
  // 집중력
  if (focus === 0) {
    report.specialTalent += ' 또래 대비 뛰어난 집중력으로 학습 효율이 높습니다.';
  }
  if (focus === 2) {
    report.parentingTip +=
      ' 집중이 어려울 수 있으니 15분 공부 + 5분 휴식 패턴을 만들어주세요.';
  }
  // 시험 태도
  if (exam === 2) {
    report.educationDirection +=
      ' 시험 불안이 있으니 "최선을 다하면 괜찮아"라는 메시지를 자주 전달해주세요.';
  }
  // 자기주장
  if (assertion === 0) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '자기 생각을 당당하게 표현하는 리더 성향',
    ];
  }
  // 계획성
  if (planning === 0) {
    report.specialTalent += ' 체계적으로 계획하고 실행하는 자기관리 능력이 돋보입니다.';
  }
  // 완벽주의
  if (perfectionism === 0) {
    report.parentingTip +=
      ' 완벽주의 성향이 있으니 "80%만 해도 충분해"라는 메시지를 전달해주세요.';
  }
  // 도전 태도
  if (challenge === 0) {
    report.educationDirection +=
      ' 새로운 도전에 열려 있으니 다양한 경험의 기회를 만들어주세요.';
  }
  if (challenge === 3) {
    report.educationDirection +=
      ' 변화를 어려워하니 새 활동 시 충분한 설명과 짧은 체험부터 시작하세요.';
  }
  // 사회성
  if (friends === 0) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '사교적이고 친구를 잘 사귀는 성격',
    ];
  }
  if (friends === 3) {
    report.educationDirection +=
      ' 사회성 발달을 도울 수 있는 소그룹 활동이나 팀 스포츠를 추천합니다.';
  }
  // 갈등 해결
  if (conflictRes === 0) {
    report.specialTalent += ' 대화로 갈등을 풀려는 성숙한 사회 기술이 돋보입니다.';
  }
  // 그룹 활동
  if (group === 0) {
    report.futureFields = [
      ...report.futureFields.slice(0, 3),
      '리더/경영자',
    ];
  }
  // 스트레스 해소
  if (stress === 0) {
    report.parentingTip += ' 운동으로 스트레스를 풀 수 있게 방과 후 활동 시간을 확보해주세요.';
  }
  if (stress === 3) {
    report.parentingTip += ' 혼자만의 시간이 필요한 아이이니 개인 공간을 보장해주세요.';
  }
  // 실패 대응
  if (failureRes === 0) {
    report.educationDirection += ' 회복탄력성이 높으니 도전적인 문제에 적극 노출시켜주세요.';
  }
  if (failureRes === 2) {
    report.educationDirection +=
      ' 실패를 두려워하니 과정 중심 칭찬과 작은 성공 경험이 자신감을 키워줍니다.';
  }
  // 자신감
  if (confidence === 2) {
    report.parentingTip +=
      ' 자신감이 부족한 편이니 잘하는 것을 구체적으로 칭찬해주세요.';
  }
  // 걱정
  if (worry === 3) {
    report.parentingTip +=
      ' 걱정이 많은 아이이니 자기 전 "걱정 이야기 시간"을 만들어 불안을 덜어주세요.';
  }
  // 아침 루틴
  if (morning === 0) {
    report.specialTalent += ' 아침형 생활 패턴이 잘 맞아 오전 학습 효율이 높습니다.';
  }
  // 정리정돈
  if (organize === 0) {
    report.specialTalent += ' 스스로 정리하는 자기관리 능력이 발달해 있습니다.';
  }
  // 취미
  if (hobby === 0) {
    report.sportsMatch = [...report.sportsMatch.slice(0, 2), '달리기/육상', '구기운동'];
  }
  if (hobby === 3) {
    report.futureFields = [
      ...report.futureFields.slice(0, 3),
      '예술가/크리에이터',
    ];
  }
}

/** 초등 고학년 답변 분석 */
function analyzeElemHighAnswers(
  report: ChildReport,
  answerMap: Map<string, number>
): void {
  const favSubject = answerMap.get('elem_high_1');
  const motivation = answerMap.get('elem_high_2');
  const goalSetting = answerMap.get('elem_high_3');
  const reading = answerMap.get('elem_high_4');
  const justice = answerMap.get('elem_high_5');
  const independence = answerMap.get('elem_high_6');
  const leadership = answerMap.get('elem_high_7');
  const competition = answerMap.get('elem_high_8');
  const peerRel = answerMap.get('elem_high_9');
  const digital = answerMap.get('elem_high_10');
  const selfAware = answerMap.get('elem_high_13');
  const stressMgmt = answerMap.get('elem_high_14');
  const future = answerMap.get('elem_high_15');
  const selfEsteem = answerMap.get('elem_high_16');
  const money = answerMap.get('elem_high_17');
  const timeBalance = answerMap.get('elem_high_18');
  const sports = answerMap.get('elem_high_19');
  const dream = answerMap.get('elem_high_20');

  // 선호 과목 반영
  if (favSubject === 0) {
    report.bestSubjects = ['수학', '과학', ...report.bestSubjects.slice(2)];
    report.futureFields = [
      ...report.futureFields.slice(0, 2),
      '과학자/엔지니어',
      'IT/데이터 전문가',
    ];
  }
  if (favSubject === 1) {
    report.bestSubjects = ['국어', '사회', ...report.bestSubjects.slice(2)];
    report.futureFields = [
      ...report.futureFields.slice(0, 2),
      '작가/언론인',
      '교사/상담사',
    ];
  }
  if (favSubject === 2) {
    report.bestSubjects = ['예체능', ...report.bestSubjects.slice(1)];
    report.futureFields = [
      ...report.futureFields.slice(0, 2),
      '예술가/운동선수',
      '크리에이터',
    ];
  }
  // 학습 동기
  if (motivation === 0) {
    report.studyStyle += ' 지적 호기심이 강하니 교과 밖의 심화 자료를 제공해주세요.';
  }
  if (motivation === 2) {
    report.parentingTip +=
      ' 학습 동기가 약할 수 있으니 아이가 관심 있는 분야와 학습을 연결해주세요.';
  }
  if (motivation === 3) {
    report.specialTalent += ' 장래 목표를 위해 공부하는 목적 의식이 뚜렷합니다.';
  }
  // 목표 설정
  if (goalSetting === 0) {
    report.specialTalent +=
      ' 목표를 세우고 꾸준히 실천하는 자기관리 역량이 뛰어납니다.';
  }
  if (goalSetting === 1) {
    report.educationDirection +=
      ' 중간 점검 루틴을 만들어 목표를 끝까지 이어갈 수 있게 도와주세요.';
  }
  // 독서 습관
  if (reading === 0) {
    report.specialTalent += ' 폭넓은 독서 습관으로 배경지식이 풍부합니다.';
  }
  if (reading === 3) {
    report.parentingTip +=
      ' 관심 분야의 짧은 책이나 학습 만화부터 시작해 독서 습관을 점진적으로 만들어주세요.';
  }
  // 정의감
  if (justice === 0) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '불의를 보면 참지 못하는 강한 정의감',
    ];
  }
  // 독립심
  if (independence === 0) {
    report.specialTalent += ' 또래보다 뛰어난 독립심과 자기관리 능력이 돋보입니다.';
  }
  if (independence === 2) {
    report.educationDirection +=
      ' 독립심을 키울 수 있도록 작은 일부터 스스로 결정하게 해주세요.';
  }
  // 리더십
  if (leadership === 0) {
    report.personality = [
      ...report.personality.slice(0, 3),
      '자연스러운 리더십을 발휘하는 카리스마',
    ];
    report.futureFields = [
      ...report.futureFields.slice(0, 3),
      '리더/경영자',
    ];
  }
  // 경쟁심
  if (competition === 0) {
    report.parentingTip +=
      ' 경쟁에서 이기는 것을 매우 중시하니 "최선을 다하는 것이 진짜 이기는 것"이라는 가치관을 심어주세요.';
  }
  if (competition === 3) {
    report.educationDirection +=
      ' 패배 후 회복이 느리니 실패를 성장의 기회로 바라보는 관점을 함께 키워주세요.';
  }
  // 또래 관계
  if (peerRel === 3) {
    report.educationDirection +=
      ' 또래 관계에 어려움을 느끼고 있다면 방과 후 소그룹 활동이나 사회성 프로그램을 고려해보세요.';
  }
  // 디지털 사용
  if (digital === 2) {
    report.parentingTip +=
      ' 스마트폰 사용 조절이 필요합니다. 함께 사용 규칙을 정하고, 대체 활동을 마련해주세요.';
  }
  // 자기 이해
  if (selfAware === 0) {
    report.specialTalent += ' 자기 자신을 객관적으로 파악하는 메타인지 능력이 발달해 있습니다.';
  }
  // 스트레스 관리
  if (stressMgmt === 2) {
    report.parentingTip +=
      ' 스트레스 해소가 어려운 편이니 함께 스트레스 관리법을 찾아보세요(운동, 일기, 대화).';
  }
  if (stressMgmt === 3) {
    report.parentingTip +=
      ' 겉으로 괜찮아 보여도 스트레스가 쌓이는 타입이니 정기적으로 감정을 확인해주세요.';
  }
  // 미래 불안
  if (future === 2) {
    report.educationDirection +=
      ' 미래에 대한 불안이 있으니 "지금 할 수 있는 것"에 집중하게 안내해주세요.';
  }
  // 자존감
  if (selfEsteem === 2) {
    report.parentingTip +=
      ' 자존감이 낮은 편이니 장점을 구체적으로 칭찬하고, 성공 경험을 자주 만들어주세요.';
  }
  if (selfEsteem === 3) {
    report.parentingTip +=
      ' 겉으로는 자신감이 있어 보이지만 내면에 불안이 있을 수 있으니 진솔한 대화 시간을 가져주세요.';
  }
  // 용돈 관리
  if (money === 0) {
    report.specialTalent += ' 돈을 아끼고 저축하는 경제 감각이 발달해 있습니다.';
  }
  // 시간 배분
  if (timeBalance === 0) {
    report.specialTalent += ' 스스로 시간을 관리하는 자기조절력이 뛰어납니다.';
  }
  // 운동
  if (sports === 0) {
    report.sportsMatch = ['축구', '농구', '야구', '배드민턴'];
  }
  if (sports === 1) {
    report.sportsMatch = ['수영', '달리기', '자전거', '클라이밍'];
  }
  // 장래 희망
  if (dream === 0) {
    report.educationDirection +=
      ' 구체적인 꿈이 있으니 관련 체험 프로그램이나 멘토를 연결해주세요.';
  }
}

// ─────────────────────────────────────────────
// 연령대별 오버레이 적용
// ─────────────────────────────────────────────
function applyAgeOverlay(
  report: ChildReport,
  ageGroup: AgeGroup,
  typeKey: string
): void {
  const overlay = AGE_OVERLAYS[ageGroup];
  if (!overlay) return;

  report.summary = overlay.summaryPrefix + report.summary;

  // 연령대별 학습 스타일 오버라이드
  const studyOverride = overlay.studyStyleOverride[typeKey];
  if (studyOverride) {
    report.studyStyle = studyOverride;
  }

  // 연령대별 학원 스타일 오버라이드
  const academyOverride = overlay.academyStyleOverride[typeKey];
  if (academyOverride) {
    report.academyStyle = academyOverride;
  }

  // 음식 팁 추가
  report.goodFoods = [...report.goodFoods, `[${overlay.foodTip}]`];

  // 교육 방향 보강
  report.educationDirection += ' ' + overlay.educationTip;

  // 양육 팁 보강
  report.parentingTip += ' ' + overlay.parentingExtra;
}

// ─────────────────────────────────────────────
// 답변 기반 분석 라우터
// ─────────────────────────────────────────────
function adjustByAnswers(
  report: ChildReport,
  answers: AnswerItem[],
  dominantType: string,
  ageGroup: AgeGroup
): ChildReport {
  const adjusted = { ...report };
  const answerMap = new Map<string, number>();
  answers.forEach((a) => answerMap.set(a.questionId, a.answer));

  switch (ageGroup) {
    case 'infant':
      analyzeInfantAnswers(adjusted, answerMap);
      break;
    case 'kinder':
      analyzeKinderAnswers(adjusted, answerMap);
      break;
    case 'elem_low':
      analyzeElemLowAnswers(adjusted, answerMap);
      break;
    case 'elem_high':
      analyzeElemHighAnswers(adjusted, answerMap);
      break;
    default:
      // 알 수 없는 연령대 — 범용 분석
      analyzeGenericAnswers(adjusted, answerMap, dominantType);
      break;
  }

  return adjusted;
}

/** 범용 분석 (하위 호환) */
function analyzeGenericAnswers(
  report: ChildReport,
  answerMap: Map<string, number>,
  dominantType: string
): void {
  const vals = Array.from(answerMap.values());
  if (vals.length < 3) return;

  const hasLeaderTrait = vals[1] === 0;
  const hasCarefulTrait = vals[1] === 3;
  const hasActiveTrait = vals[3] === 0;
  const hasCreativeTrait = vals[3] === 1;
  const hasLogicTrait = vals[3] === 2;
  const hasResilientTrait = vals[2] === 0;
  const hasSensitiveTrait = vals[2] === 1;

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
  if (hasLogicTrait && dominantType !== 'metal') {
    report.studyStyle += ' 퍼즐이나 게임 요소를 접목하면 더 즐겁게 학습할 수 있습니다.';
  }
  if (hasCreativeTrait && dominantType !== 'water') {
    report.studyStyle += ' 그리기나 만들기와 연결하면 학습 효과가 올라갑니다.';
  }
  if (hasActiveTrait && !report.sportsMatch.includes('달리기')) {
    report.sportsMatch = [...report.sportsMatch.slice(0, 3), '달리기/육상'];
  }
  if (hasResilientTrait) {
    report.educationDirection += ' 이 아이는 회복탄력성이 높으니 도전적인 과제를 적극 제시해주세요.';
  }
  if (hasSensitiveTrait) {
    report.educationDirection += ' 실패에 민감한 편이므로 과정을 칭찬하고 작은 성공 경험을 쌓아주세요.';
  }
}

// ─────────────────────────────────────────────
// dominantType 키 변환
// ─────────────────────────────────────────────
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

/** 월령 → 연령 그룹 변환 */
export function monthsToAgeGroup(months: number): AgeGroup {
  if (months <= 36) return 'infant';
  if (months <= 72) return 'kinder';
  if (months <= 108) return 'elem_low';
  return 'elem_high';
}

// ─────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────

/**
 * 종합 분석 리포트 생성
 * @param dominantType 기질 유형 (wood/fire/earth/metal/water 또는 한글)
 * @param answers 온보딩 답변 배열
 * @param ageGroup 연령 그룹 (없으면 범용 분석)
 */
export function generateChildReport(
  dominantType: string,
  answers: AnswerItem[],
  ageGroup?: AgeGroup
): ChildReport {
  const typeKey = resolveTypeKey(dominantType);
  const base = { ...(BASE_PROFILES[typeKey] ?? BASE_PROFILES.earth) };

  // 배열 필드 깊은 복사
  base.personality = [...base.personality];
  base.bestSubjects = [...base.bestSubjects];
  base.weakAreas = [...base.weakAreas];
  base.futureFields = [...base.futureFields];
  base.sportsMatch = [...base.sportsMatch];
  base.goodFoods = [...base.goodFoods];
  base.badFoods = [...base.badFoods];
  base.reasons = { ...base.reasons };

  // 연령대별 오버레이 적용
  if (ageGroup) {
    applyAgeOverlay(base, ageGroup, typeKey);
  }

  // 답변 기반 미세 조정
  const effectiveAgeGroup = ageGroup ?? 'elem_low';
  return adjustByAnswers(base, answers, typeKey, effectiveAgeGroup);
}

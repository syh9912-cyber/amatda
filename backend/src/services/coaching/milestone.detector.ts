/**
 * 발달 마일스톤 감지 모듈
 * - 임신 주수 / 아이 월령에 따라 현재/다가오는 발달 이정표를 파악
 * - AI가 자연스럽게 "이 시기에는~" 언급할 수 있게 컨텍스트 제공
 */

interface Milestone {
  ageRange: [number, number]; // [시작월, 끝월] (임신은 음수: -10~0)
  area: string;
  description: string;
  parentTip: string;
}

// ─── 임신 주수별 마일스톤 (ageRange를 음수 월로 환산: -10~0) ───
const PREGNANCY_MILESTONES: Milestone[] = [
  // 임신 초기 (1-12주 ≈ -9~-7월)
  { ageRange: [-10, -8], area: '태아발달', description: '심장이 뛰기 시작, 주요 장기 형성 중 (8주 약 1.6cm)', parentTip: '엽산 복용이 가장 중요한 시기예요. 첫 산전검진을 받아보세요' },
  { ageRange: [-10, -8], area: '엄마몸', description: '입덧 시작, 피로감, 가슴 변화', parentTip: '소량씩 자주 먹고, 충분히 쉬세요. 입덧은 대부분 16주면 줄어들어요' },

  // 임신 중기 시작 (13-16주 ≈ -7~-6월)
  { ageRange: [-7, -6], area: '태아발달', description: '태아 얼굴 완성, 손가락/발가락 구분, 성별 확인 가능 (14주 약 8cm)', parentTip: '정밀초음파 시기가 다가와요. 카메라로 초음파 사진을 꼭 남기세요' },
  { ageRange: [-7, -6], area: '엄마몸', description: '입덧 줄어들기 시작, 배가 나오기 시작', parentTip: '가장 편안한 안정기 시작이에요. 가벼운 운동을 시작하기 좋아요' },

  // 임신 중기 (17-24주 ≈ -6~-4월)
  { ageRange: [-6, -4], area: '태아발달', description: '태동 느끼기 시작! 청각 발달, 눈을 뜰 수 있음 (20주 약 25cm)', parentTip: '태동을 느끼면 말을 걸어주세요. 태교 음악도 이 시기부터 효과적이에요' },
  { ageRange: [-6, -4], area: '검진', description: '정밀초음파(20-24주), 임신성 당뇨 검사(24-28주)', parentTip: '이 시기 검진이 중요해요. 정밀초음파로 태아 구조를 확인합니다' },

  // 임신 후기 시작 (25-32주 ≈ -4~-2월)
  { ageRange: [-4, -2], area: '태아발달', description: '폐 성숙 진행, 체중 급격히 증가 (28주 약 1kg)', parentTip: '태동 체크를 매일 해주세요. 2시간에 10회 미만이면 병원에 연락하세요' },
  { ageRange: [-4, -2], area: '준비', description: '분만 병원 결정, 출산 가방 준비 시작', parentTip: '입원 가방을 36주 전에 준비해두면 마음이 편해요' },

  // 만삭 (33-40주 ≈ -2~0월)
  { ageRange: [-2, 0], area: '태아발달', description: '폐 성숙 완료, 출산 준비 완료 (38주 약 3kg)', parentTip: '진통 징후(이슬, 규칙적 배 뭉침, 양수 파수)를 알아두세요' },
  { ageRange: [-2, 0], area: '준비', description: '매주 NST 검사, 진통 징후 모니터링', parentTip: '호흡법을 연습하시고, 출산 계획서를 병원과 공유해주세요' },
];

const MILESTONES: Milestone[] = [
  // 0~3개월
  { ageRange: [0, 3], area: '감각', description: '목 가누기 시작, 눈 맞춤 가능', parentTip: '바닥 시간(tummy time)을 조금씩 늘려주세요' },
  { ageRange: [0, 3], area: '정서', description: '사회적 미소 시작', parentTip: '아이가 웃으면 같이 웃어주는 게 애착 형성에 중요해요' },

  // 4~6개월
  { ageRange: [4, 6], area: '운동', description: '뒤집기, 손으로 물건 잡기', parentTip: '안전한 바닥에서 자유롭게 움직일 시간을 주세요' },
  { ageRange: [4, 6], area: '식사', description: '이유식 시작 시기', parentTip: '새로운 음식은 3~5일 간격으로 하나씩 시도해보세요' },

  // 7~9개월
  { ageRange: [7, 9], area: '운동', description: '앉기, 기기(크롤링) 시작', parentTip: '가구 모서리 보호대를 미리 설치해두세요' },
  { ageRange: [7, 9], area: '정서', description: '낯가림, 분리불안 시작', parentTip: '낯가림은 정상 발달이에요. 억지로 안기게 하지 않아도 괜찮아요' },

  // 10~12개월
  { ageRange: [10, 12], area: '언어', description: '첫 단어(맘마, 빠빠) 시기', parentTip: '아이가 내는 소리를 따라하며 대화처럼 반응해주세요' },
  { ageRange: [10, 12], area: '운동', description: '잡고 서기, 첫 걸음마 준비', parentTip: '보행기보다는 가구를 잡고 자연스럽게 서는 연습이 좋아요' },

  // 13~18개월
  { ageRange: [13, 18], area: '운동', description: '걸음마, 혼자 걷기', parentTip: '넘어져도 크게 놀라지 마세요. 스스로 일어나는 것도 발달이에요' },
  { ageRange: [13, 18], area: '언어', description: '10~50개 단어 사용 가능', parentTip: '그림책 읽어주기가 언어 발달에 큰 도움이 돼요' },
  { ageRange: [13, 18], area: '행동', description: '떼쓰기 시작, 자기주장', parentTip: '이 시기 떼는 자아 발달의 신호예요. 단호하되 따뜻하게 대응하세요' },

  // 19~24개월
  { ageRange: [19, 24], area: '언어', description: '두 단어 조합(엄마 줘), 50~200개 단어', parentTip: '아이 말을 반복하되, 올바른 문장으로 확장해서 말해주세요' },
  { ageRange: [19, 24], area: '사회성', description: '병행 놀이, 소유 개념 형성', parentTip: '또래와 나누기가 안 되는 건 정상이에요. 강요하지 마세요' },

  // 25~36개월
  { ageRange: [25, 36], area: '배변', description: '배변 훈련 적기', parentTip: '아이가 관심을 보일 때 시작하세요. 강제하면 역효과예요' },
  { ageRange: [25, 36], area: '사회성', description: '상상 놀이, 역할 놀이', parentTip: '인형 놀이, 소꿉놀이는 사회성과 언어 발달에 좋아요' },
  { ageRange: [25, 36], area: '정서', description: '질투, 소유욕, 반항기(미운 세살)', parentTip: '감정에 이름 붙여주세요: "화가 났구나", "속상했구나"' },

  // 37~48개월
  { ageRange: [37, 48], area: '사회성', description: '친구 개념, 협동 놀이 시작', parentTip: '놀이터나 문화센터에서 또래 경험을 늘려주세요' },
  { ageRange: [37, 48], area: '언어', description: '왜? 질문 폭발기', parentTip: '"왜?"에 진지하게 답해주면 호기심과 사고력이 자라요' },

  // 49~60개월
  { ageRange: [49, 60], area: '인지', description: '숫자/글자 관심, 규칙 이해', parentTip: '놀이 속에서 자연스럽게 숫자/글자를 접하게 해주세요' },
  { ageRange: [49, 60], area: '사회성', description: '유치원 적응기', parentTip: '등원 거부가 2주 이상 지속되면 선생님과 상의해보세요' },

  // 61~72개월
  { ageRange: [61, 72], area: '인지', description: '초등 입학 준비기', parentTip: '학습보다 자기 이름 쓰기, 숫자 10까지, 혼자 옷 입기가 더 중요해요' },
  { ageRange: [61, 72], area: '정서', description: '자존감 형성 중요 시기', parentTip: '결과보다 과정을 칭찬해주세요: "잘했어" 대신 "열심히 했구나"' },

  // 초등 저학년 (73~108개월)
  { ageRange: [73, 96], area: '학습', description: '학습 습관 형성기', parentTip: '매일 10~15분 독서 습관부터 만들어주세요' },
  { ageRange: [73, 96], area: '사회성', description: '친구 관계 중요도 급상승', parentTip: '친구 갈등은 직접 해결하도록 돕되, 폭력/따돌림은 즉시 개입하세요' },
  { ageRange: [97, 108], area: '정서', description: '자아정체성 탐색, 비교 시작', parentTip: '다른 아이와 비교하지 말고, 본인의 성장에 초점을 맞춰주세요' },

  // 초등 고학년 (109~144개월)
  { ageRange: [109, 132], area: '정서', description: '사춘기 전조, 감정 기복', parentTip: '감정 변화가 심해져도 무시하지 말고, 들어주는 것만으로 충분해요' },
  { ageRange: [109, 144], area: '건강', description: '성조숙증 주의 시기', parentTip: '여아 8세/남아 9세 이전 2차 성징이 보이면 소아과 상의하세요' },
];

export interface MilestoneContext {
  current: string[];
  upcoming: string[];
  combined: string;
}

/** 임신 주수를 음수 월령으로 변환 (40주 = 10개월, 주수→월: -10+floor(weeks/4)) */
export function pregnancyWeeksToAgeMonths(weeks: number): number {
  return Math.floor(weeks / 4) - 10;
}

export function getMilestoneContext(ageMonths: number, isPregnant = false, pregnancyWeeks?: number): MilestoneContext {
  // 임산부: 임신 주수 기반 마일스톤
  if (isPregnant && pregnancyWeeks !== undefined) {
    const pregAge = pregnancyWeeksToAgeMonths(pregnancyWeeks);

    const current = PREGNANCY_MILESTONES
      .filter((m) => pregAge >= m.ageRange[0] && pregAge <= m.ageRange[1])
      .map((m) => `[${m.area}] ${m.description} - ${m.parentTip}`);

    const upcoming = PREGNANCY_MILESTONES
      .filter((m) => m.ageRange[0] > pregAge && m.ageRange[0] <= pregAge + 2)
      .map((m) => `곧 다가올 [${m.area}] ${m.description} - ${m.parentTip}`);

    const parts: string[] = [];
    if (current.length > 0) parts.push(...current.slice(0, 2));
    if (upcoming.length > 0) parts.push(upcoming[0]);

    return {
      current,
      upcoming,
      combined: parts.length > 0 ? parts.join('\n') : '',
    };
  }

  // 아이: 월령 기반 마일스톤
  const current = MILESTONES
    .filter((m) => ageMonths >= m.ageRange[0] && ageMonths <= m.ageRange[1])
    .map((m) => `[${m.area}] ${m.description} - ${m.parentTip}`);

  // 다음 단계 마일스톤 (현재 +3개월 범위)
  const upcoming = MILESTONES
    .filter((m) => m.ageRange[0] > ageMonths && m.ageRange[0] <= ageMonths + 3)
    .map((m) => `곧 다가올 [${m.area}] ${m.description} - ${m.parentTip}`);

  const parts: string[] = [];
  if (current.length > 0) parts.push(...current.slice(0, 2));
  if (upcoming.length > 0) parts.push(upcoming[0]);

  return {
    current,
    upcoming,
    combined: parts.length > 0 ? parts.join('\n') : '',
  };
}

/** 전체 마일스톤 타임라인 (임신~육아 연속) — 프론트 마일스톤 화면용 */
export function getFullMilestoneTimeline(): Array<{
  period: string;
  label: string;
  milestones: Array<{ area: string; description: string; tip: string }>;
}> {
  const timeline: Array<{
    period: string;
    label: string;
    milestones: Array<{ area: string; description: string; tip: string }>;
  }> = [];

  // 임신 마일스톤
  const pregGroups = [
    { period: 'pregnant-early', label: '임신 초기 (1-12주)', range: [-10, -8] as [number, number] },
    { period: 'pregnant-mid1', label: '임신 중기 시작 (13-16주)', range: [-7, -6] as [number, number] },
    { period: 'pregnant-mid2', label: '임신 중기 (17-24주)', range: [-6, -4] as [number, number] },
    { period: 'pregnant-late1', label: '임신 후기 (25-32주)', range: [-4, -2] as [number, number] },
    { period: 'pregnant-late2', label: '만삭 (33-40주)', range: [-2, 0] as [number, number] },
  ];

  for (const g of pregGroups) {
    const ms = PREGNANCY_MILESTONES
      .filter((m) => m.ageRange[0] >= g.range[0] && m.ageRange[1] <= g.range[1])
      .map((m) => ({ area: m.area, description: m.description, tip: m.parentTip }));
    if (ms.length > 0) timeline.push({ period: g.period, label: g.label, milestones: ms });
  }

  // 출산 마일스톤
  timeline.push({
    period: 'birth', label: '출산',
    milestones: [{ area: '탄생', description: '아기가 세상에 나왔어요!', tip: '첫 수유(골든아워)를 시도해보세요. 피부접촉이 중요해요' }],
  });

  // 아이 마일스톤
  const childGroups = [
    { period: '0-3m', label: '0~3개월', range: [0, 3] as [number, number] },
    { period: '4-6m', label: '4~6개월', range: [4, 6] as [number, number] },
    { period: '7-9m', label: '7~9개월', range: [7, 9] as [number, number] },
    { period: '10-12m', label: '10~12개월', range: [10, 12] as [number, number] },
    { period: '13-18m', label: '13~18개월', range: [13, 18] as [number, number] },
    { period: '19-24m', label: '19~24개월', range: [19, 24] as [number, number] },
    { period: '25-36m', label: '25~36개월', range: [25, 36] as [number, number] },
    { period: '37-48m', label: '37~48개월', range: [37, 48] as [number, number] },
    { period: '49-60m', label: '49~60개월', range: [49, 60] as [number, number] },
    { period: '61-72m', label: '61~72개월', range: [61, 72] as [number, number] },
    { period: '73-96m', label: '초등 저학년', range: [73, 96] as [number, number] },
    { period: '97-144m', label: '초등 고학년', range: [97, 144] as [number, number] },
  ];

  for (const g of childGroups) {
    const ms = MILESTONES
      .filter((m) => m.ageRange[0] >= g.range[0] && m.ageRange[1] <= g.range[1])
      .map((m) => ({ area: m.area, description: m.description, tip: m.parentTip }));
    if (ms.length > 0) timeline.push({ period: g.period, label: g.label, milestones: ms });
  }

  return timeline;
}

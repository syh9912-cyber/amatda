/**
 * 발달 마일스톤 감지 모듈
 * - 아이의 월령에 따라 현재/다가오는 발달 이정표를 파악
 * - AI가 자연스럽게 "이 시기에는~" 언급할 수 있게 컨텍스트 제공
 */

interface Milestone {
  ageRange: [number, number]; // [시작월, 끝월]
  area: string;
  description: string;
  parentTip: string;
}

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

export function getMilestoneContext(ageMonths: number): MilestoneContext {
  // 현재 해당되는 마일스톤
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

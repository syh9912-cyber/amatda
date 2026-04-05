export interface DailyQuestion {
  dayOfWeek: number; // 0=Sunday ~ 6=Saturday
  question: string;
  hint: string;
}

export const DAILY_QUESTIONS: Record<string, DailyQuestion[]> = {
  infant: [
    {
      dayOfWeek: 0,
      question: '아이에게 오늘 하루를 한마디로 표현한다면?',
      hint: '예: 웃음 가득한 날, 잠이 많았던 날 등',
    },
    {
      dayOfWeek: 1,
      question: '오늘 아이가 가장 오래 바라보거나 만진 것은 무엇이었나요?',
      hint: '예: 모빌, 손가락, 장난감 딸랑이 등',
    },
    {
      dayOfWeek: 2,
      question: '오늘 아이의 기분은 전체적으로 어떠했나요?',
      hint: '예: 대체로 기분 좋았음, 자주 보챔 등',
    },
    {
      dayOfWeek: 3,
      question: '오늘 아이가 새로 보인 반응이나 움직임이 있나요?',
      hint: '예: 처음 뒤집기, 옹알이 소리 변화 등',
    },
    {
      dayOfWeek: 4,
      question: '오늘 다른 사람(가족/또래)을 보았을 때 아이 반응은 어땠나요?',
      hint: '예: 웃음, 울음, 관심 없음 등',
    },
    {
      dayOfWeek: 5,
      question: '오늘 아이의 수유/이유식은 어떠했나요?',
      hint: '예: 잘 먹었음, 새 음식 시도, 거부 등',
    },
    {
      dayOfWeek: 6,
      question: '이번 주 아이에게서 느낀 작은 변화가 있나요?',
      hint: '예: 수면 패턴 변화, 표정 다양해짐 등',
    },
  ],
  toddler: [
    {
      dayOfWeek: 0,
      question: '아이에게 오늘 하루를 한마디로 표현한다면?',
      hint: '예: 활발한 날, 조용히 놀았던 날 등',
    },
    {
      dayOfWeek: 1,
      question: '오늘 아이가 가장 오래 집중한 놀이나 활동은 무엇이었나요?',
      hint: '예: 블록 쌓기, 그림 그리기, 역할놀이 등',
    },
    {
      dayOfWeek: 2,
      question: '오늘 아이의 감정 상태는 전체적으로 어떠했나요?',
      hint: '예: 즐거움, 짜증, 호기심 가득 등',
    },
    {
      dayOfWeek: 3,
      question: '오늘 아이가 새로 시도하거나 배운 것이 있나요?',
      hint: '예: 새 단어, 새 동작, 혼자 시도한 것 등',
    },
    {
      dayOfWeek: 4,
      question: '오늘 아이와 다른 아이(형제/친구)의 상호작용은 어땠나요?',
      hint: '예: 함께 놀기, 장난감 공유, 다툼 등',
    },
    {
      dayOfWeek: 5,
      question: '오늘 아이의 식사/간식 상태는 어떠했나요?',
      hint: '예: 골고루 먹음, 편식, 새 음식 반응 등',
    },
    {
      dayOfWeek: 6,
      question: '이번 주 아이에게서 발견한 새로운 성장 변화가 있나요?',
      hint: '예: 언어 발달, 사회성, 신체 능력 등',
    },
  ],
  elementary: [
    {
      dayOfWeek: 0,
      question: '아이에게 오늘 하루를 한마디로 표현한다면?',
      hint: '예: 성취감 가득한 날, 친구와 즐거웠던 날 등',
    },
    {
      dayOfWeek: 1,
      question: '오늘 아이가 가장 오래 집중한 활동은 무엇이었나요?',
      hint: '예: 독서, 수학 문제, 게임, 운동 등',
    },
    {
      dayOfWeek: 2,
      question: '오늘 아이의 감정 상태는 전체적으로 어떠했나요?',
      hint: '예: 자신감 넘침, 스트레스, 평온함 등',
    },
    {
      dayOfWeek: 3,
      question: '오늘 아이가 새로 도전하거나 성장을 보인 부분이 있나요?',
      hint: '예: 어려운 문제 해결, 새 취미, 자기주도 학습 등',
    },
    {
      dayOfWeek: 4,
      question: '오늘 아이와 친구/형제의 관계는 어떠했나요?',
      hint: '예: 협동 활동, 갈등 해결, 리더십 발휘 등',
    },
    {
      dayOfWeek: 5,
      question: '오늘 아이의 식사와 컨디션은 어떠했나요?',
      hint: '예: 아침 잘 먹음, 피곤해함, 활력 넘침 등',
    },
    {
      dayOfWeek: 6,
      question: '이번 주 아이에게서 발견한 성장 포인트가 있나요?',
      hint: '예: 학습 태도 변화, 관심 분야 확장, 책임감 등',
    },
  ],
};

export function getTodayQuestion(ageGroup: string): DailyQuestion {
  const dayOfWeek = new Date().getDay();
  const group = DAILY_QUESTIONS[ageGroup] ?? DAILY_QUESTIONS.toddler;
  return group.find((q) => q.dayOfWeek === dayOfWeek) ?? group[0];
}

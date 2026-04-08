import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { calculateAge } from '../services/age.calculator';

const router = Router();

// ─── Helper: Firestore JSON 필드 안전 파싱 ───

function safeParse(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as Record<string, unknown>; } catch { return null; }
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

// ─── Helper: 자녀 소유권 확인 ───

async function getChildIfOwned(
  childId: string,
  userId: string | undefined,
  res: Response,
): Promise<Record<string, unknown> | null> {
  const doc = await collections.children.doc(childId).get();
  if (!doc.exists) {
    error(res, '자녀를 찾을 수 없습니다', 404);
    return null;
  }
  const data = doc.data() as Record<string, unknown>;
  if (data.userId !== userId) {
    error(res, '자녀를 찾을 수 없습니다', 404);
    return null;
  }
  return data;
}

// ─── 기질 타입 한글 매핑 ───

const TEMPERAMENT_LABELS: Record<string, string> = {
  explorer: '탐구형',
  active: '활동형',
  creative: '창의형',
  social: '사교형',
  analytical: '분석형',
};

const TEMPERAMENT_EMOJI: Record<string, string> = {
  explorer: '🔍',
  active: '⚡',
  creative: '🎨',
  social: '💬',
  analytical: '🧠',
};

// ─── 기질별 팁 데이터 (각 32개) ───

const TIPS_BY_TEMPERAMENT: Record<string, string[]> = {
  explorer: [
    '새로운 질감의 재료(찰흙, 모래, 물감)를 만져보게 해주세요.',
    '산책 중 눈에 띄는 곤충이나 식물을 함께 관찰해보세요.',
    '"이건 뭘까?" 질문을 많이 해주면 호기심이 자라요.',
    '퍼즐이나 블록 놀이로 문제 해결 능력을 키워주세요.',
    '도서관이나 서점 나들이로 다양한 세계를 경험하게 해주세요.',
    '요리 과정을 함께 보여주면 과학적 사고가 자라요.',
    '돋보기나 망원경 같은 탐구 도구를 선물해보세요.',
    '자연물(돌, 나뭇잎, 조개)을 모아 분류 놀이를 해보세요.',
    '"왜?"라는 질문에 함께 답을 찾아보는 시간을 가져보세요.',
    '실험 놀이(베이킹소다+식초 등)로 과학 원리를 느끼게 해주세요.',
    '지도나 지구본을 보며 다른 나라 이야기를 해주세요.',
    '물놀이 시간에 뜨는 것과 가라앉는 것을 비교해보세요.',
    '별자리 관찰을 통해 우주에 대한 관심을 키워주세요.',
    '동물원이나 아쿠아리움에서 동물 행동을 관찰해보세요.',
    '식물 키우기를 통해 생명의 성장 과정을 배우게 해주세요.',
    '사진 찍기를 통해 관찰력과 표현력을 키워보세요.',
    '시계나 달력으로 시간의 흐름을 함께 이해해보세요.',
    '다양한 소리를 듣고 무슨 소리인지 맞추는 놀이를 해보세요.',
    '냄새 맡기 놀이로 후각 감각을 발달시켜 주세요.',
    '그림자 놀이로 빛과 어둠의 관계를 탐구해보세요.',
    '비 오는 날 우산 쓰고 빗소리를 들으며 산책해보세요.',
    '계절 변화를 기록하는 자연 일기를 함께 써보세요.',
    '색깔 섞기 놀이로 새로운 색을 발견하게 해주세요.',
    '다양한 직업에 대해 이야기하며 꿈을 키워주세요.',
    '잠자기 전 오늘 발견한 것 하나를 이야기해보세요.',
    '체험학습(박물관, 과학관)으로 직접 경험의 기회를 주세요.',
    '같은 물건을 다른 방법으로 사용하는 놀이를 해보세요.',
    '맛보기 놀이로 달고 짜고 시고 쓴 맛을 비교해보세요.',
    '높은 곳에서 주변을 둘러보며 방향 감각을 키워주세요.',
    '숫자 세기를 일상 속에서 자연스럽게 연습해보세요.',
    '이야기의 결말을 직접 만들어보는 놀이를 해보세요.',
    '잠들기 전 내일 탐험할 것 하나를 정해보세요.',
  ],
  active: [
    '점심 후 10분 산책이 낮잠 질을 높여요.',
    '아침에 5분 스트레칭으로 하루를 활기차게 시작해보세요.',
    '실내에서 풍선 배드민턴으로 에너지를 발산시켜 주세요.',
    '계단 오르기 놀이로 대근육 발달을 도와주세요.',
    '춤추기 시간을 정해서 음악과 함께 움직여보세요.',
    '공원에서 자유롭게 뛰어놀 시간을 충분히 주세요.',
    '자전거나 킥보드 타기로 균형 감각을 키워주세요.',
    '물놀이로 에너지를 쓰면서 감각 발달도 도와주세요.',
    '숨바꼭질이나 술래잡기로 사회성도 함께 키워요.',
    '트램폴린이나 매트 위에서 점핑 놀이를 해보세요.',
    '저녁에는 활동량을 줄여 차분한 시간을 가져보세요.',
    '달리기 시합이나 장애물 넘기 놀이를 해보세요.',
    '농구나 축구 등 공놀이로 협응력을 키워주세요.',
    '암벽등반이나 정글짐으로 도전 정신을 길러주세요.',
    '줄넘기는 집중력과 체력을 동시에 키워줘요.',
    '흙장난이나 모래놀이로 촉각 자극을 주세요.',
    '요가 자세 따라하기로 유연성과 집중력을 키워보세요.',
    '가위바위보 달리기 같은 결합 놀이를 해보세요.',
    '비눗방울 쫓기로 시각 추적력을 발달시켜 주세요.',
    '놀이터에서 다양한 기구를 골고루 이용해보세요.',
    '실내 볼링이나 고리 던지기로 정밀 운동을 연습해요.',
    '활동 후 충분한 수분 보충을 잊지 마세요.',
    '잠자기 전 가벼운 마사지로 긴장을 풀어주세요.',
    '음악에 맞춰 행진하기 놀이를 해보세요.',
    '풍선 터뜨리지 않기 릴레이 게임을 해보세요.',
    '발자국 따라 걷기 놀이로 균형 감각을 키워주세요.',
    '동물 흉내내기 놀이로 다양한 움직임을 경험해보세요.',
    '청소 놀이로 신체 활동과 생활 습관을 함께 배워요.',
    '종이비행기 날리기 대회를 열어보세요.',
    '아침 일찍 활동할 시간을 만들면 하루가 안정돼요.',
    '에너지가 넘칠 때는 쿠션으로 장애물 코스를 만들어주세요.',
    '잠들기 전 오늘 가장 신나게 놀았던 순간을 이야기해보세요.',
  ],
  creative: [
    '그림 그리기 시간을 매일 10분씩 정해보세요.',
    '빈 상자로 자유롭게 만들기 놀이를 해보세요.',
    '다양한 음악을 들려주며 감성을 풍부하게 해주세요.',
    '역할 놀이(소꿉놀이, 병원놀이)로 상상력을 키워주세요.',
    '이야기를 지어내는 놀이로 창의력을 자극해주세요.',
    '색종이 접기로 소근육과 집중력을 함께 키워요.',
    '점토나 클레이로 입체적 표현력을 발달시켜 주세요.',
    '노래 만들기나 악기 연주로 음악적 감각을 키워주세요.',
    '사진이나 잡지를 오려서 콜라주 만들기를 해보세요.',
    '무대 놀이를 통해 자기 표현력을 키워주세요.',
    '자연물로 예술 작품을 만들어 보세요.',
    '색칠 공부보다 백지에 자유 그림을 그리게 해주세요.',
    '동화책을 읽고 뒷이야기를 함께 상상해보세요.',
    '패턴 만들기 놀이로 수학적 사고도 키울 수 있어요.',
    '재활용품으로 로봇이나 자동차를 만들어보세요.',
    '물감 불기, 마블링 등 다양한 미술 기법을 시도해보세요.',
    '인형극이나 그림자극을 함께 만들어 공연해보세요.',
    '음식을 예쁘게 담는 활동으로 미적 감각을 키워주세요.',
    '방꾸미기를 함께 하면 공간 감각이 발달해요.',
    '편지 쓰기나 카드 만들기로 마음을 표현하게 해주세요.',
    '블록으로 건물이나 도시를 만들어보세요.',
    '다양한 재질의 천으로 촉감 그림을 만들어보세요.',
    '비 오는 날 창문에 수성펜으로 그림을 그려보세요.',
    '춤이나 몸동작으로 감정을 표현하는 놀이를 해보세요.',
    '꿈 일기를 그림으로 그려보는 시간을 가져보세요.',
    '만화나 그림책의 한 장면을 따라 그려보세요.',
    '계절에 맞는 데코레이션을 함께 만들어보세요.',
    '나만의 보물 상자 꾸미기를 해보세요.',
    '모래 위에 그림 그리기 놀이를 해보세요.',
    '음악 감상 후 느낌을 그림으로 표현해보세요.',
    '패션 놀이로 색 조합 감각을 키워주세요.',
    '잠들기 전 내일 만들 작품을 함께 계획해보세요.',
  ],
  social: [
    '또래 친구와 만나는 시간을 정기적으로 만들어주세요.',
    '감정 카드로 기분을 표현하는 연습을 해보세요.',
    '역할 놀이에서 서로 역할을 바꿔보는 경험을 주세요.',
    '"고마워", "미안해" 표현을 자연스럽게 연습해보세요.',
    '함께 요리하며 협력하는 경험을 제공해보세요.',
    '가족 회의 시간을 만들어 의견을 나누는 연습을 해보세요.',
    '보드게임이나 카드놀이로 규칙 지키기를 배워요.',
    '동화 속 인물의 감정을 함께 이야기해보세요.',
    '형제자매나 친구와 함께하는 프로젝트를 만들어보세요.',
    '공공장소 예절을 놀이로 재미있게 연습해보세요.',
    '동물 돌보기를 통해 공감 능력을 키워주세요.',
    '전화 예절이나 인사하기를 놀이로 배워보세요.',
    '함께 청소하기나 정리하기로 책임감을 키워주세요.',
    '서로의 작품을 칭찬하는 시간을 가져보세요.',
    '갈등 상황에서 해결 방법을 함께 찾아보세요.',
    '파티 준비를 함께 하며 배려를 배우게 해주세요.',
    '짝 맞추기 게임으로 관찰력과 협력을 키워보세요.',
    '다른 문화의 음식이나 놀이를 함께 경험해보세요.',
    '편지나 그림을 친구에게 선물하는 경험을 주세요.',
    '순서 지키기를 놀이에서 자연스럽게 연습해보세요.',
    '감정 온도계로 오늘의 기분을 함께 체크해보세요.',
    '가족 사진을 보며 관계에 대해 이야기해보세요.',
    '이웃 어르신께 인사하는 습관을 길러주세요.',
    '함께 선물을 만들어 특별한 사람에게 전해보세요.',
    '양보하기와 나누기를 칭찬으로 강화해주세요.',
    '친구에게 자기소개하기 연습을 해보세요.',
    '"나는 ~해서 기분이 ~해" 문장을 연습해보세요.',
    '팀 스포츠나 단체 놀이로 협동심을 길러주세요.',
    '서로 다른 의견이 있을 때 경청하는 연습을 해보세요.',
    '영상통화로 멀리 있는 가족과 소통하는 시간을 가져보세요.',
    '이야기 릴레이 놀이로 소통 능력을 키워보세요.',
    '잠들기 전 오늘 고마웠던 사람을 이야기해보세요.',
  ],
  analytical: [
    '숫자 놀이나 패턴 찾기로 논리력을 키워주세요.',
    '퍼즐이나 미로 찾기로 집중력을 높여주세요.',
    '분류하기 놀이(색깔, 모양, 크기별)를 해보세요.',
    '일과표를 함께 만들어 계획하는 습관을 길러주세요.',
    '보드게임이나 체스로 전략적 사고를 키워보세요.',
    '요리할 때 계량 과정을 함께 하면 수학 감각이 자라요.',
    '시계 읽기를 일상에서 자연스럽게 연습해보세요.',
    '도형이나 블록으로 구조물 만들기를 해보세요.',
    '규칙 만들기 놀이로 논리적 사고를 발달시켜 주세요.',
    '비교하기("어떤 게 더 길까?") 놀이를 해보세요.',
    '단계별 지시 따르기 놀이로 순차적 사고를 키워요.',
    '과학 실험으로 원인과 결과를 체험하게 해주세요.',
    '"만약 ~라면?" 가정 질문 놀이를 해보세요.',
    '코딩 교구나 앱으로 논리적 사고를 시작해보세요.',
    '가계부 놀이로 숫자와 돈의 개념을 알려주세요.',
    '기록하는 습관(날씨 일기, 식물 성장 기록)을 키워주세요.',
    '지도 보기나 길 찾기 놀이를 해보세요.',
    '그래프나 차트로 정보를 정리하는 연습을 해보세요.',
    '같은 점과 다른 점 찾기 놀이를 해보세요.',
    '타이머를 사용해 시간 관리를 체험하게 해주세요.',
    '레고 설명서 따라 만들기로 지시 이해력을 키워요.',
    '물건 무게 비교하기 놀이를 해보세요.',
    '달력에 중요한 날을 표시하는 습관을 길러주세요.',
    '온도계 읽기로 과학적 관찰력을 키워보세요.',
    '정리 정돈을 분류 놀이처럼 재미있게 해보세요.',
    '상자 속 물건 맞추기(촉각 추리) 놀이를 해보세요.',
    '동전 분류와 세기로 수학적 감각을 키워주세요.',
    '연결고리 찾기 놀이로 관계 파악 능력을 키워요.',
    '책의 목차를 보며 구조를 이해하는 연습을 해보세요.',
    '스스로 규칙을 만들어 게임을 설계해보세요.',
    '결과를 예측하고 확인하는 놀이를 해보세요.',
    '잠들기 전 오늘 알게 된 것 하나를 이야기해보세요.',
  ],
};

// ─── Helper: 날짜 기반 시드로 팁 인덱스 결정 ───

function getTipIndex(date: string, childId: string, tipsLength: number): number {
  let hash = 0;
  const seed = `${date}-${childId}`;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % tipsLength;
}

// ─── Helper: 시간대 구분 ───

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// ─── Helper: 요일 한글 ───

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

function getDayNameKo(): string {
  return DAY_NAMES_KO[new Date().getDay()];
}

// ─── 스트릭 레벨 정의 ───

interface StreakLevel {
  level: number;
  name: string;
  minDays: number;
  maxDays: number;
}

const STREAK_LEVELS: StreakLevel[] = [
  { level: 1, name: '새싹부모', minDays: 1, maxDays: 3 },
  { level: 2, name: '성장부모', minDays: 4, maxDays: 7 },
  { level: 3, name: '열정부모', minDays: 8, maxDays: 14 },
  { level: 4, name: '베테랑부모', minDays: 15, maxDays: 30 },
  { level: 5, name: '마스터부모', minDays: 31, maxDays: Infinity },
];

function getStreakLevel(streak: number): StreakLevel {
  for (const lvl of STREAK_LEVELS) {
    if (streak >= lvl.minDays && streak <= lvl.maxDays) return lvl;
  }
  return STREAK_LEVELS[0];
}

function getNextLevelDays(streak: number): number {
  const current = getStreakLevel(streak);
  if (current.level >= 5) return 0;
  return current.maxDays + 1 - streak;
}

// ─── 성장 마일스톤 정의 ───

interface Milestone {
  label: string;
  days: number;
}

const MILESTONES: Milestone[] = [
  { label: '100일', days: 100 },
  { label: '첫 돌', days: 365 },
  { label: '두 돌', days: 730 },
  { label: '세 돌', days: 1095 },
  { label: '유치원 입학', days: 72 * 30 },
  { label: '초등 입학', days: 84 * 30 },
];

// ─── 푸시 스케줄 인터페이스 ───

interface PushScheduleBody {
  childId: string;
  pushToken: string;
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  weekly: boolean;
}

// ───────────────────────────────────────────────
// 1. GET /api/retention/daily-card/:childId
// ───────────────────────────────────────────────

router.get('/daily-card/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfOwned(childId, req.userId, res);
    if (!childData) return;

    const name = childData.name as string;
    const birthDate = new Date(childData.birthDate as string);
    const ageInfo = calculateAge(birthDate);

    const fiveElements = safeParse(childData.fiveElements);
    const dominantType = (childData.dominantType as string) ?? 'explorer';
    const temperamentLabel = TEMPERAMENT_LABELS[dominantType] ?? '탐구형';
    const emoji = TEMPERAMENT_EMOJI[dominantType] ?? '✨';

    const today = new Date().toISOString().slice(0, 10);
    const tips = TIPS_BY_TEMPERAMENT[dominantType] ?? TIPS_BY_TEMPERAMENT.explorer;
    const tipIndex = getTipIndex(today, childId, tips.length);
    const tip = tips[tipIndex];

    const timeOfDay = getTimeOfDay();
    const dayName = getDayNameKo();

    const timeGreeting = timeOfDay === 'morning'
      ? '좋은 아침이에요!'
      : timeOfDay === 'afternoon'
        ? '오후도 힘내세요!'
        : '오늘 하루도 수고했어요!';

    const shareText = `${temperamentLabel} ${name}에게 오늘의 팁: ${tip}`;

    success(res, {
      childName: name,
      temperament: temperamentLabel,
      dominantType,
      tip,
      emoji,
      shareText,
      date: today,
      dayOfWeek: dayName,
      timeGreeting,
      ageMonths: ageInfo.months,
      ageGroup: ageInfo.label,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    error(res, msg, 500);
  }
});

// ───────────────────────────────────────────────
// 2. GET /api/retention/streak/:childId
// ───────────────────────────────────────────────

router.get('/streak/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfOwned(childId, req.userId, res);
    if (!childData) return;

    // 코칭 세션에서 날짜별 활동 기록 조회
    const sessionsSnap = await collections.coachingSessions
      .where('childId', '==', childId)
      .where('userId', '==', req.userId)
      .orderBy('createdAt', 'desc')
      .get();

    // 고유 날짜 추출
    const uniqueDates = new Set<string>();
    sessionsSnap.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const createdAt = data.createdAt;
      let dateStr: string;
      if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
        dateStr = (createdAt as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
      } else if (typeof createdAt === 'string') {
        dateStr = createdAt.slice(0, 10);
      } else {
        return;
      }
      uniqueDates.add(dateStr);
    });

    const sortedDates = Array.from(uniqueDates).sort().reverse();

    // 연속 일수 계산
    let currentStreak = 0;
    if (sortedDates.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      if (sortedDates[0] === today || sortedDates[0] === yesterday) {
        currentStreak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const prev = new Date(sortedDates[i - 1]);
          const curr = new Date(sortedDates[i]);
          const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
          if (Math.abs(diffDays - 1) < 0.01) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    // 최장 연속 기록 계산
    let longestStreak = 0;
    let tempStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
      if (Math.abs(diffDays - 1) < 0.01) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    if (sortedDates.length === 0) longestStreak = 0;

    const level = getStreakLevel(currentStreak);
    const nextLevelDays = getNextLevelDays(currentStreak);

    success(res, {
      currentStreak,
      longestStreak,
      level: level.level,
      levelName: level.name,
      nextLevelDays,
      totalSessions: sessionsSnap.size,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    error(res, msg, 500);
  }
});

// ───────────────────────────────────────────────
// 3. GET /api/retention/countdown/:childId
// ───────────────────────────────────────────────

router.get('/countdown/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfOwned(childId, req.userId, res);
    if (!childData) return;

    const name = childData.name as string;
    const birthDate = new Date(childData.birthDate as string);
    const now = new Date();
    const daysSinceBirth = Math.floor(
      (now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    const displayText = `이 세상에 온 지 ${daysSinceBirth}일째`;

    // 다음 마일스톤 찾기
    let nextMilestone: { label: string; daysUntil: number } | null = null;
    for (const ms of MILESTONES) {
      const daysUntil = ms.days - daysSinceBirth;
      if (daysUntil > 0) {
        nextMilestone = { label: ms.label, daysUntil };
        break;
      }
    }

    // 지난 마일스톤들
    const passedMilestones = MILESTONES
      .filter((ms) => ms.days <= daysSinceBirth)
      .map((ms) => ({
        label: ms.label,
        daysSince: daysSinceBirth - ms.days,
      }));

    success(res, {
      childName: name,
      daysSinceBirth,
      displayText,
      nextMilestone,
      passedMilestones,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    error(res, msg, 500);
  }
});

// ───────────────────────────────────────────────
// 4. POST /api/retention/push-schedule
// ───────────────────────────────────────────────

router.post('/push-schedule', authMiddleware, async (req: Request, res: Response) => {
  try {
    const body = req.body as PushScheduleBody;
    const { childId, pushToken, morning, afternoon, evening, weekly } = body;

    if (!childId || !pushToken) {
      error(res, 'childId와 pushToken은 필수입니다');
      return;
    }

    // 자녀 소유권 확인
    const childData = await getChildIfOwned(childId, req.userId, res);
    if (!childData) return;

    const scheduleId = `${req.userId}_${childId}`;
    const scheduleData = {
      userId: req.userId,
      childId,
      pushToken,
      morning: morning ?? true,
      afternoon: afternoon ?? true,
      evening: evening ?? true,
      weekly: weekly ?? true,
      updatedAt: new Date().toISOString(),
    };

    await collections.pushSchedules.doc(scheduleId).set(scheduleData, { merge: true });

    success(res, {
      id: scheduleId,
      ...scheduleData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    error(res, msg, 500);
  }
});

// ───────────────────────────────────────────────
// 5. GET /api/retention/push-content/:childId
// ───────────────────────────────────────────────

router.get('/push-content/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfOwned(childId, req.userId, res);
    if (!childData) return;

    const name = childData.name as string;
    const dominantType = (childData.dominantType as string) ?? 'explorer';
    const temperamentLabel = TEMPERAMENT_LABELS[dominantType] ?? '탐구형';

    const timeOfDay = getTimeOfDay();
    const dayOfWeek = new Date().getDay();
    const isMonday = dayOfWeek === 1;

    // 시간대별 기질 맞춤 활동 추천
    const tips = TIPS_BY_TEMPERAMENT[dominantType] ?? TIPS_BY_TEMPERAMENT.explorer;
    const today = new Date().toISOString().slice(0, 10);
    const tipIndex = getTipIndex(today, childId, tips.length);
    const todayTip = tips[tipIndex];

    type PushType = 'morning' | 'afternoon' | 'evening' | 'weekly';

    interface PushContent {
      title: string;
      body: string;
      type: PushType;
      data: Record<string, string>;
    }

    let content: PushContent;

    if (isMonday && (req.query.type === 'weekly' || !req.query.type)) {
      content = {
        title: '이번 주 육아 리포트',
        body: `이번 주 ${name}의 육아 리포트가 도착했어요! 지난 한 주의 성장을 확인해보세요.`,
        type: 'weekly',
        data: { childId, screen: 'weekly-report' },
      };
    } else if (timeOfDay === 'morning') {
      content = {
        title: `좋은 아침! ${name}의 하루가 시작돼요`,
        body: `어젯밤 ${name}는 잘 잤나요? ${temperamentLabel} 아이를 위한 오늘의 팁: ${todayTip}`,
        type: 'morning',
        data: { childId, screen: 'daily-card' },
      };
    } else if (timeOfDay === 'afternoon') {
      content = {
        title: `${name}와 함께하는 오후`,
        body: `${temperamentLabel} ${name}에게 추천하는 활동: ${todayTip}`,
        type: 'afternoon',
        data: { childId, screen: 'activity' },
      };
    } else {
      content = {
        title: `${name}의 오늘 하루`,
        body: `오늘의 육아일기를 완성해보세요. ${name}와 함께한 소중한 순간을 기록해두면 나중에 큰 선물이 돼요.`,
        type: 'evening',
        data: { childId, screen: 'observation' },
      };
    }

    success(res, content);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    error(res, msg, 500);
  }
});

export default router;

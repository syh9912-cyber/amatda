import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { calculateAge, formatAgeKo } from '../services/age.calculator';
import { safeParse } from '../utils/parse';
import { getChildIfAccessible } from '../utils/childAccess';
import { generatePassportPng } from '../services/passportImage';
import { logger } from '../utils/logger';

const PASSPORT_SALT = 'amatda-passport-2024';

const router = Router();

// ─── Helper: 기질 타입에 맞는 이모지 ───

const TEMPERAMENT_EMOJI: Record<string, string> = {
  explorer: '🔍',
  active: '⚡',
  creative: '🎨',
  social: '💬',
  analytical: '🧠',
};

function getTemperamentEmoji(dominantType: string): string {
  return TEMPERAMENT_EMOJI[dominantType] ?? '✨';
}

// ─── Helper: 공유 코드 생성 (8자 영숫자) ───

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ─── GET /api/memories/year-ago/:childId ───

router.get('/year-ago/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfAccessible(childId, req.userId, 'viewTimeline', res).then(r => r?.data ?? null);
    if (!childData) return;

    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const dayBefore = new Date(oneYearAgo);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(oneYearAgo);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const startISO = dayBefore.toISOString();
    const endISO = dayAfter.toISOString();

    // 코칭 세션 조회 (1년 전 +/-1일, 인덱스 없이)
    const sessionsSnap = await collections.coachingSessions
      .where('childId', '==', childId)
      .get();

    const sessions = sessionsSnap.docs
      .map((d) => {
        const s = d.data();
        return {
          id: d.id,
          message: s.message as string,
          category: s.category as string,
          createdAt: s.createdAt as string,
        };
      })
      .filter((s) => s.createdAt >= startISO && s.createdAt <= endISO)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // 데일리 트래킹 조회 (인덱스 없이)
    const trackingSnap = await collections.dailyTracking
      .where('childId', '==', childId)
      .get();

    const startDate = startISO.slice(0, 10);
    const endDate = endISO.slice(0, 10);
    const tracking = trackingSnap.docs
      .map((d) => {
        const t = d.data();
        return {
          id: d.id,
          date: (t.date as string) ?? '',
          height: (t.height as number) ?? null,
          weight: (t.weight as number) ?? null,
        };
      })
      .filter((t) => t.date >= startDate && t.date <= endDate);

    const hasMemory = sessions.length > 0 || tracking.length > 0;

    if (!hasMemory) {
      success(res, {
        hasMemory: false,
        message: '아직 1년 전 기록이 없어요. 지금부터의 기록이 내년에 소중한 추억이 될 거예요!',
      });
      return;
    }

    // 나이 계산
    const birthDate = new Date(childData.birthDate as string);
    const diffMsThen = oneYearAgo.getTime() - birthDate.getTime();
    const monthsThen = Math.max(0, Math.floor(diffMsThen / (1000 * 60 * 60 * 24 * 30.44)));

    const currentAge = calculateAge(birthDate);

    // 성장 비교 (1년 전 vs 현재 최근 트래킹)
    const yearAgoTracking = tracking[0] ?? null;
    let growthComparison: Record<string, unknown> | null = null;

    if (yearAgoTracking && (yearAgoTracking.height || yearAgoTracking.weight)) {
      const recentSnap = await collections.dailyTracking
        .where('childId', '==', childId)
        .limit(50)
        .get();
      // Sort in-memory to avoid composite index requirement
      recentSnap.docs.sort((a, b) =>
        String(b.data().date ?? '').localeCompare(String(a.data().date ?? ''))
      );

      if (!recentSnap.empty) {
        const recent = recentSnap.docs[0].data();
        growthComparison = {
          yearAgo: {
            height: yearAgoTracking.height,
            weight: yearAgoTracking.weight,
          },
          current: {
            height: (recent.height as number) ?? null,
            weight: (recent.weight as number) ?? null,
          },
        };
      }
    }

    const childName = childData.name as string;
    const memory = `1년 전 ${childName}은(는) ${formatAgeKo(monthsThen)}이었어요`;

    success(res, {
      hasMemory: true,
      date: oneYearAgo.toISOString().slice(0, 10),
      sessions,
      tracking,
      ageAtThat: { months: monthsThen, label: formatAgeKo(monthsThen) },
      currentAge: { months: currentAge.months, label: formatAgeKo(currentAge.months) },
      growthComparison,
      memory,
    });
  } catch (err: unknown) {
    logger.error('memories/year-ago', err);
    error(res, '1년 전 추억 조회 중 오류가 발생했습니다', 500);
  }
});

// ─── GET /api/memories/child-card/:childId ───

router.get('/child-card/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfAccessible(childId, req.userId, 'viewTimeline', res).then(r => r?.data ?? null);
    if (!childData) return;

    const birthDate = new Date(childData.birthDate as string);
    const currentAge = calculateAge(birthDate);
    const innate = safeParse(childData.innateData);

    // 기질 정보
    const dominantType = (innate?.dominantType as string) ?? 'unknown';
    const label = (innate?.label as string) ?? '분석중';

    // 상세 정보
    const detail = safeParse(innate?.detail as unknown);
    const personality = Array.isArray(detail?.personality)
      ? (detail.personality as string[]).slice(0, 3)
      : [];

    // 추천 활동
    const bestActivities = Array.isArray(innate?.bestActivities)
      ? (innate.bestActivities as string[])
      : [];

    // 알레르기 정보 (baseline에서)
    const baseline = safeParse(childData.baseline);
    const allergies = Array.isArray(baseline?.allergies)
      ? (baseline.allergies as string[])
      : [];

    // 육아 팁
    const parentingTips = Array.isArray(innate?.parentingTips)
      ? (innate.parentingTips as string[])
      : [];
    const specialNote = parentingTips.length > 0 ? parentingTips[0] : '';

    // 공개 공유 키 생성 (childId 기반 결정적 해시)
    const shareKey = createHash('sha256')
      .update(childId + PASSPORT_SALT)
      .digest('hex')
      .slice(0, 16);

    const baseUrl = `${req.protocol}://${req.get('host') ?? 'localhost'}`;
    const shareImageUrl = `${baseUrl}/api/memories/passport-view/${childId}?key=${shareKey}`;

    // 성장 데이터 (키/몸무게)
    const heightVal = childData.height as number | null ?? null;
    const weightVal = childData.weight as number | null ?? null;

    // 기질 변화 (innateData에서 5가지 에너지 비율)
    const energyRatios = (innate?.energyRatios as Record<string, number>) ?? null;
    const dominantLabel = (innate?.label as string) ?? null;
    const subType = (innate?.subType as string) ?? null;

    const card = {
      childName: childData.name as string,
      ageInfo: formatAgeKo(currentAge.months),
      gender: childData.gender as string,
      temperament: label,
      temperamentEmoji: getTemperamentEmoji(dominantType),
      photo: (childData.photo as string) ?? null,
      favorites: bestActivities,
      allergies,
      personality,
      specialNote,
      shareCode: generateShareCode(),
      shareImageUrl,
      createdAt: new Date().toISOString(),
      // 성장 데이터 추가
      growth: {
        height: heightVal,
        weight: weightVal,
        birthDate: childData.birthDate as string,
        months: currentAge.months,
      },
      // 기질 상세 추가
      temperamentDetail: {
        dominantType,
        dominantLabel,
        subType,
        energyRatios,
      },
    };

    success(res, card);
  } catch (err: unknown) {
    logger.error('memories/child-card', err);
    error(res, '아이 카드 생성 중 오류가 발생했습니다', 500);
  }
});

// ─── GET /api/memories/child-card-image/:childId ───

router.get('/child-card-image/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfAccessible(childId, req.userId, 'viewTimeline', res).then(r => r?.data ?? null);
    if (!childData) return;

    const birthDate = new Date(childData.birthDate as string);
    const currentAge = calculateAge(birthDate);
    const innate = safeParse(childData.innateData);

    const dominantType = (innate?.dominantType as string) ?? 'unknown';
    const label = (innate?.label as string) ?? '분석중';
    const detail = safeParse(innate?.detail as unknown);
    const personality = Array.isArray(detail?.personality)
      ? (detail.personality as string[]).slice(0, 3) : [];
    const bestActivities = Array.isArray(innate?.bestActivities)
      ? (innate.bestActivities as string[]) : [];

    const birthStr = birthDate.toISOString().slice(0, 10).replace(/-/g, '.');
    const pngBuffer = generatePassportPng({
      childName: childData.name as string,
      ageInfo: formatAgeKo(currentAge.months),
      gender: childData.gender as string,
      birthDate: birthStr,
      temperament: label,
      personality,
      favorites: bestActivities,
      shareCode: generateShareCode(),
    });

    res.set('Content-Type', 'image/png');
    res.set('Content-Length', String(pngBuffer.length));
    res.set('Cache-Control', 'no-store');
    res.send(pngBuffer);
  } catch (err: unknown) {
    logger.error('memories/child-card-image', err);
    error(res, '여권 이미지 생성 중 오류가 발생했습니다', 500);
  }
});

// ─── GET /api/memories/passport-view/:childId (공개 - 인증 불필요) ───

router.get('/passport-view/:childId', async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const key = req.query.key as string;

    // 키 검증
    const expectedKey = createHash('sha256')
      .update(childId + PASSPORT_SALT)
      .digest('hex')
      .slice(0, 16);

    if (!key || key !== expectedKey) {
      error(res, '유효하지 않은 링크입니다', 403);
      return;
    }

    // 아이 데이터 조회 (인증 없이 직접 조회)
    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists) {
      error(res, '아이 정보를 찾을 수 없습니다', 404);
      return;
    }

    const childData = childDoc.data()!;
    const birthDate = new Date(childData.birthDate as string);
    const currentAge = calculateAge(birthDate);
    const innate = safeParse(childData.innateData);

    const label = (innate?.label as string) ?? '분석중';
    const detail = safeParse(innate?.detail as unknown);
    const personality = Array.isArray(detail?.personality)
      ? (detail.personality as string[]).slice(0, 3) : [];
    const bestActivities = Array.isArray(innate?.bestActivities)
      ? (innate.bestActivities as string[]) : [];

    const birthStr = birthDate.toISOString().slice(0, 10).replace(/-/g, '.');
    const pngBuffer = generatePassportPng({
      childName: childData.name as string,
      ageInfo: formatAgeKo(currentAge.months),
      gender: childData.gender as string,
      birthDate: birthStr,
      temperament: label,
      personality,
      favorites: bestActivities,
      shareCode: generateShareCode(),
    });

    res.set('Content-Type', 'image/png');
    res.set('Content-Length', String(pngBuffer.length));
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(pngBuffer);
  } catch (err: unknown) {
    logger.error('memories/passport-view', err);
    error(res, '여권 이미지 조회 실패', 500);
  }
});

// ─── GET /api/memories/timeline/:childId ───

router.get('/timeline/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfAccessible(childId, req.userId, 'viewTimeline', res).then(r => r?.data ?? null);
    if (!childData) return;

    const sessionsSnap = await collections.coachingSessions
      .where('childId', '==', childId)
      .get();

    // 아이 월령 계산
    const birthDate = new Date(childData.birthDate as string);
    const now = new Date();
    const childAgeMonths = (now.getFullYear() - birthDate.getFullYear()) * 12
      + (now.getMonth() - birthDate.getMonth());

    if (sessionsSnap.empty) {
      // 코칭 기록이 없어도 발달 타임라인 표시
      const devTimeline = buildDevelopmentalTimeline(childAgeMonths, childData.name as string);
      success(res, { timeline: devTimeline, months: devTimeline, totalSessions: 0 });
      return;
    }

    // Sort in-memory (ascending by createdAt) to avoid composite index
    const sortedDocs = [...sessionsSnap.docs].sort((a, b) =>
      String(a.data().createdAt ?? '').localeCompare(String(b.data().createdAt ?? ''))
    );

    // 월별 그룹화
    const monthMap = new Map<string, { count: number; categories: Map<string, number>; firstDate: string }>();

    for (const doc of sortedDocs) {
      const data = doc.data();
      const createdAt = data.createdAt as string;
      const monthKey = createdAt.slice(0, 7); // "YYYY-MM"
      const category = (data.category as string) ?? '기타';

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { count: 0, categories: new Map(), firstDate: createdAt });
      }
      const entry = monthMap.get(monthKey)!;
      entry.count += 1;
      entry.categories.set(category, (entry.categories.get(category) ?? 0) + 1);
    }

    // 월별 요약 생성
    const timeline = Array.from(monthMap.entries()).map(([month, info]) => {
      // 가장 많이 물어본 카테고리
      let topCategory = '기타';
      let maxCount = 0;
      for (const [cat, cnt] of info.categories.entries()) {
        if (cnt > maxCount) {
          maxCount = cnt;
          topCategory = cat;
        }
      }

      // 마일스톤 판단
      const milestone = getMilestone(info.count, topCategory);

      return {
        month,
        sessionCount: info.count,
        topCategory,
        milestone,
      };
    });

    success(res, {
      timeline,
      months: timeline,
      totalSessions: sessionsSnap.size,
    });
  } catch (err: unknown) {
    logger.error('memories/timeline', err);
    error(res, '성장 타임라인 조회 중 오류가 발생했습니다', 500);
  }
});

// ─── Helper: 마일스톤 텍스트 ───

function getMilestone(sessionCount: number, topCategory: string): string | null {
  if (sessionCount >= 20) return `이 달은 ${topCategory}에 대해 많이 고민한 시기예요`;
  if (sessionCount >= 10) return `${topCategory} 관련 질문이 활발했어요`;
  if (sessionCount >= 5) return `${topCategory}에 관심을 가지기 시작했어요`;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Developmental Timeline — 코칭 기록 없어도 보여줄 발달 타임라인     */
/* ------------------------------------------------------------------ */

interface DevMilestone {
  month: number;
  label: string;
  milestoneText: string;
  category: string;
}

const DEV_MILESTONES: DevMilestone[] = [
  { month: 1, label: '1개월', milestoneText: '고개를 좌우로 돌리고, 가까운 거리의 얼굴을 응시하기 시작해요', category: '신체발달' },
  { month: 2, label: '2개월', milestoneText: '사회적 미소가 나타나고, "아~", "우~" 옹알이를 시작해요', category: '정서발달' },
  { month: 3, label: '3개월', milestoneText: '머리를 가누기 시작하고, 딸랑이를 잡아 흔들 수 있어요', category: '신체발달' },
  { month: 4, label: '4개월', milestoneText: '뒤집기를 시도하고, 손에 닿는 물건을 잡아서 입으로 가져가요', category: '신체발달' },
  { month: 5, label: '5개월', milestoneText: '낯가림이 시작되고, 이름을 부르면 고개를 돌려요', category: '인지발달' },
  { month: 6, label: '6개월', milestoneText: '이유식을 시작하고, 혼자 앉기를 시도해요. 두 음절 옹알이가 늘어나요', category: '신체발달' },
  { month: 8, label: '8개월', milestoneText: '배밀이나 기기를 시작하고, "까꿍" 놀이에 즐거워해요', category: '신체발달' },
  { month: 10, label: '10개월', milestoneText: '가구를 잡고 일어서고, "엄마", "아빠" 비슷한 소리를 내기 시작해요', category: '언어발달' },
  { month: 12, label: '12개월', milestoneText: '첫 걸음마를 떼고, 의미 있는 첫 단어가 나와요. 컵으로 물 마시기를 시도해요', category: '신체발달' },
  { month: 15, label: '15개월', milestoneText: '혼자 걷기가 안정되고, 3~5개 단어를 사용해요. 숟가락을 잡고 먹으려 해요', category: '신체발달' },
  { month: 18, label: '18개월', milestoneText: '달리기 시작하고, 10~20개 단어를 말해요. 그림책에서 좋아하는 사물을 가리켜요', category: '언어발달' },
  { month: 21, label: '21개월', milestoneText: '계단을 기어 올라가고, 두 단어 조합이 나타나요. 소꿉놀이에 관심을 보여요', category: '인지발달' },
  { month: 24, label: '24개월 (2세)', milestoneText: '두 단어 문장을 말하고, 공을 차고 던져요. 또래에게 관심을 보이기 시작해요', category: '사회성발달' },
  { month: 30, label: '30개월', milestoneText: '세 단어 이상 문장을 사용하고, 점프를 할 수 있어요. 색깔과 모양을 구분해요', category: '인지발달' },
  { month: 36, label: '36개월 (3세)', milestoneText: '"왜?"라는 질문이 폭발적으로 늘어나요. 세발자전거를 타고, 친구와 역할놀이를 해요', category: '인지발달' },
  { month: 42, label: '42개월', milestoneText: '가위질을 시작하고, 4~5개 단어로 된 문장으로 이야기해요. 규칙 있는 놀이가 가능해요', category: '소근육발달' },
  { month: 48, label: '48개월 (4세)', milestoneText: '혼자 옷을 입고, 10까지 셀 수 있어요. 상상 놀이가 정교해지고 친구 관계가 중요해져요', category: '사회성발달' },
  { month: 54, label: '54개월', milestoneText: '연필을 바르게 잡고 글자 비슷한 것을 쓰기 시작해요. 감정 표현이 다양해져요', category: '소근육발달' },
  { month: 60, label: '60개월 (5세)', milestoneText: '자기 이름을 쓰고, 20까지 셀 수 있어요. 차례 지키기, 규칙 이해가 가능해요', category: '인지발달' },
  { month: 66, label: '66개월', milestoneText: '간단한 덧셈 뺄셈 개념이 생기고, 혼자 화장실을 사용해요. 또래와 협동 놀이를 즐겨요', category: '인지발달' },
  { month: 72, label: '72개월 (6세)', milestoneText: '초등 입학 준비 시기! 글자를 읽기 시작하고, 규칙을 이해하며, 자기 의견을 말할 수 있어요', category: '인지발달' },
  { month: 84, label: '7세 (초등 1학년)', milestoneText: '한글을 읽고 쓰며, 수 개념이 확장돼요. 학교생활 적응과 친구 사귀기가 중요한 시기예요', category: '학습발달' },
  { month: 96, label: '8세 (초등 2학년)', milestoneText: '읽기 유창성이 높아지고, 구구단을 배워요. 규칙 기반 게임과 팀 활동을 즐겨요', category: '학습발달' },
  { month: 108, label: '9세 (초등 3학년)', milestoneText: '논리적 사고가 발달하고, 긴 글을 읽고 이해해요. 우정과 공정함에 대한 감각이 예민해져요', category: '인지발달' },
  { month: 120, label: '10세 (초등 4학년)', milestoneText: '추상적 사고가 시작되고, 자기주도 학습 능력이 생겨요. 또래 집단 소속감이 중요해져요', category: '사회성발달' },
  { month: 132, label: '11세 (초등 5학년)', milestoneText: '사춘기가 시작될 수 있어요. 비판적 사고, 토론 능력이 발달하고, 자아 정체성을 탐색해요', category: '정서발달' },
  { month: 144, label: '12세 (초등 6학년)', milestoneText: '중학교 준비 시기! 자기 관리 능력, 시간 관리, 목표 설정 능력이 발달해요', category: '인지발달' },
];

function buildDevelopmentalTimeline(
  childAgeMonths: number,
  childName: string,
): Array<{ month: string; sessionCount: number; topCategory: string; milestoneText: string }> {
  // 아이의 현재 월령까지의 발달 마일스톤 + 다음 예정 마일스톤 표시
  const pastMilestones = DEV_MILESTONES.filter((m) => m.month <= childAgeMonths);
  const futureMilestones = DEV_MILESTONES.filter((m) => m.month > childAgeMonths).slice(0, 2);

  const result: Array<{ month: string; sessionCount: number; topCategory: string; milestoneText: string }> = [];

  // 과거 마일스톤 (달성된 것)
  for (const ms of pastMilestones) {
    result.push({
      month: ms.label,
      sessionCount: 0,
      topCategory: ms.category,
      milestoneText: `${ms.milestoneText}`,
    });
  }

  // 다음 마일스톤 (예정)
  for (const ms of futureMilestones) {
    const daysUntil = Math.max(0, Math.round((ms.month - childAgeMonths) * 30.44));
    result.push({
      month: `${ms.label} (D-${daysUntil}일)`,
      sessionCount: 0,
      topCategory: ms.category,
      milestoneText: `다음 목표: ${ms.milestoneText}`,
    });
  }

  return result.reverse(); // 최신 것이 위에
}

export default router;

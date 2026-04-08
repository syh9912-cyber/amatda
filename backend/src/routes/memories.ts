import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { calculateAge } from '../services/age.calculator';

const router = Router();

// ─── Helper: 개월 수를 한국어 문자열로 변환 ───

function formatAgeKo(months: number): string {
  if (months < 12) return `${months}개월`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (remaining === 0) return `${years}세`;
  return `${years}세 ${remaining}개월`;
}

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

// ─── GET /api/memories/year-ago/:childId ───

router.get('/year-ago/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfOwned(childId, req.userId, res);
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
    console.error('year-ago error:', err);
    error(res, '1년 전 추억 조회 중 오류가 발생했습니다', 500);
  }
});

// ─── GET /api/memories/child-card/:childId ───

router.get('/child-card/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfOwned(childId, req.userId, res);
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
      createdAt: new Date().toISOString(),
    };

    success(res, card);
  } catch (err: unknown) {
    console.error('child-card error:', err);
    error(res, '아이 카드 생성 중 오류가 발생했습니다', 500);
  }
});

// ─── GET /api/memories/timeline/:childId ───

router.get('/timeline/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const childId = req.params.childId as string;
    const childData = await getChildIfOwned(childId, req.userId, res);
    if (!childData) return;

    const sessionsSnap = await collections.coachingSessions
      .where('childId', '==', childId)
      .get();

    if (sessionsSnap.empty) {
      success(res, { timeline: [], months: [], totalSessions: 0 });
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
    console.error('timeline error:', err);
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

export default router;

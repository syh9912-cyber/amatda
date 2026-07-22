import { Router, Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import rateLimit from 'express-rate-limit';
import { adminDashboardAuth } from '../middleware/adminDashboardAuth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { getUsageSummaryMap } from '../utils/apiUsage';
import { logger } from '../utils/logger';

const router = Router();

// 관리자 대시보드 전용 rate limit — 전체 유저 PII 반환 엔드포인트라 무차별 대입/남용 방지.
// 정상 사용은 새로고침 수준이라 15분 30회면 충분(키는 24바이트 엔트로피라 사실상 대입 불가하나 방어심층).
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // Cloud Run 은 'trust proxy'=true 라 express-rate-limit 이 IP 스푸핑 우회 경고(ValidationError)를
  // 매 요청 던짐. 관리자 키는 24바이트 엔트로피라 IP 기반 우회는 실질 위협이 아니므로(키 브루트포스
  // 자체가 불가) 이 검증만 비활성화 — 리미터는 req.ip 기준으로 정상 동작(방어심층 유지).
  validate: { trustProxy: false },
  message: { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
});

interface UserRow {
  id: string;
  email: string;
  nickname: string;
  authProvider: string;
  createdAt: string | null;
  lastActiveAt: string | null;
  status: 'FREE' | 'TRIAL' | 'PAID';
  trialDaysLeft: number;
  premiumExpiresAt: string | null;
  subscriptionPlatform: string | null;
  apiCallCount: number;
  apiTotalTokens: number;
  apiCostUsd: number;
}

function toISO(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  const maybe = v as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString();
  return null;
}

// subscription.ts GET /premium/status 와 동일한 판정 로직(읽기 전용 재사용).
function computeStatus(
  u: Record<string, unknown>,
  now: Date,
): { status: 'FREE' | 'TRIAL' | 'PAID'; trialDaysLeft: number } {
  const tier = (u.subscriptionTier as string) || 'FREE';
  const trialStarted = u.trialStartedAt as string | undefined;
  const premiumExpiresAt = u.premiumExpiresAt as string | undefined;

  let trialDaysLeft = 0;
  let trialActive = false;
  if (trialStarted) {
    const trialEnd = new Date(trialStarted);
    trialEnd.setDate(trialEnd.getDate() + 7);
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    trialDaysLeft = Math.max(0, daysLeft);
    trialActive = daysLeft > 0;
  }

  let premiumActive = false;
  if (tier === 'PAID' && premiumExpiresAt) {
    premiumActive = new Date(premiumExpiresAt).getTime() > now.getTime();
  }

  if (premiumActive) return { status: 'PAID', trialDaysLeft: 0 };
  if (trialActive) return { status: 'TRIAL', trialDaysLeft };
  return { status: 'FREE', trialDaysLeft: 0 };
}

// GET /api/admin/users?days=30&limit=500 — 가입자 목록 + 구독 상태(읽기 전용)
router.get('/users', adminRateLimit, adminDashboardAuth, async (req: Request, res: Response) => {
  try {
    // 접근 감사 로그 — 전체 유저 PII 조회 기록(키 유출 시 추적용)
    logger.info('admin/users', `accessed from ip=${req.ip}`);
    // 관리자 대시보드는 항상 최신을 봐야 함 — 브라우저 캐시/304 로 옛 데이터가 남지 않게 no-store.
    res.set('Cache-Control', 'no-store');
    const daysRaw = req.query.days ? parseInt(String(req.query.days), 10) : undefined;
    const days = daysRaw && daysRaw > 0 ? daysRaw : undefined;
    const limit = Math.min(parseInt(String(req.query.limit ?? '500'), 10) || 500, 1000);

    // createdAt 은 2026-07-16 마이그레이션으로 전 문서 Timestamp 통일됨
    // (레거시 String 9건 → Timestamp, 원본은 createdAtLegacyRaw 백업).
    // 이전에는 타입 혼재로 orderBy/where 가 최신 가입자를 누락시켜 메모리 정렬로 우회했으나,
    // 통일 후 Firestore 쿼리로 복귀 — 유저가 늘어도 필요한 문서만 읽는다.
    // ⚠️ 신규 유저의 createdAt 은 반드시 serverTimestamp() 로 저장할 것(String 쓰면 재발).
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = collections.users;
    if (days) {
      const cutoff = Timestamp.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
      query = query.where('createdAt', '>=', cutoff);
    }
    const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();
    // API 사용량은 가입일 필터(days)와 별개 시간축(전체 누적)이라 항상 전체 기간으로 집계.
    const usageMap = await getUsageSummaryMap();
    const now = new Date();

    // 정렬·days 필터·limit 은 Firestore 쿼리가 처리 — 여기선 표시용 매핑만 한다.
    const users: UserRow[] = snap.docs.map((doc) => {
      const u = doc.data() as Record<string, unknown>;
      const { status, trialDaysLeft } = computeStatus(u, now);
      const usage = usageMap.get(doc.id);
      return {
        id: doc.id,
        email: (u.email as string) || '',
        nickname: (u.nickname as string) || '',
        authProvider: (u.authProvider as string) || '',
        createdAt: toISO(u.createdAt),
        lastActiveAt: toISO(u.lastActiveAt),
        status,
        trialDaysLeft,
        premiumExpiresAt: (u.premiumExpiresAt as string) || null,
        subscriptionPlatform: (u.subscriptionPlatform as string) || null,
        apiCallCount: usage?.callCount ?? 0,
        apiTotalTokens: usage?.totalTokens ?? 0,
        apiCostUsd: usage?.costUsd ?? 0,
      };
    });

    // API 총계는 페이지(limit)로 잘린 users 가 아니라 usageMap 전체(모든 유저)에서 집계 —
    // 표는 페이지 분량이어도 "전체 누적 비용/호출"은 실제 총합을 보여준다.
    let allApiCostUsd = 0;
    let allApiCallCount = 0;
    usageMap.forEach((v) => { allApiCostUsd += v.costUsd; allApiCallCount += v.callCount; });

    // 상태 집계는 조회된 users 기준(= days 필터 통과분, limit 상한 내).
    const summary = {
      total: users.length,
      paid: users.filter((u) => u.status === 'PAID').length,
      trial: users.filter((u) => u.status === 'TRIAL').length,
      free: users.filter((u) => u.status === 'FREE').length,
      totalApiCostUsd: allApiCostUsd,
      totalApiCallCount: allApiCallCount,
    };

    success(res, { users, summary });
  } catch {
    error(res, '조회 중 오류가 발생했습니다', 500);
  }
});

/**
 * GET /api/admin/users/:userId/activity — 특정 유저의 활동 내역(읽기 전용)
 *
 * 설계 메모(2026-07-18):
 * - apiUsageLogs 에는 **기능/엔드포인트 식별 필드가 없다**(userId·provider·model·토큰·비용뿐).
 *   따라서 "AI 호출 1건이 어떤 기능이었나"는 이 데이터만으로 귀속 불가 → AI 호출은 건수·비용
 *   추이로만 보여주고, "무엇을 했는지"는 coachingSessions.category 등 도메인 컬렉션으로 보완한다.
 * - 모든 쿼리를 where('userId','==') **단일 필드**로만 걸고 정렬은 메모리에서 한다.
 *   orderBy 를 섞으면 복합 인덱스가 필요해 배포 없이는 동작하지 않기 때문(현재 데이터량은 소규모).
 * - createdAt 타입이 컬렉션마다 다르다(coachingSessions/posts=ISO string, 나머지=Timestamp).
 *   toISO() 로 정규화 후 병합한다.
 */
router.get('/users/:userId/activity', adminRateLimit, adminDashboardAuth, async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.userId || '').slice(0, 128);
    if (!userId) { error(res, 'userId 가 필요합니다', 400); return; }
    // PII 조회 감사 로그 — 키 유출 시 추적용
    logger.info('admin/user-activity', `uid=${userId} accessed from ip=${req.ip}`);
    // 활동 내역도 항상 최신 — etag/304 로 옛 스냅샷이 남지 않게 no-store.
    res.set('Cache-Control', 'no-store');

    const byUser = (c: FirebaseFirestore.CollectionReference) => c.where('userId', '==', userId);
    const [
      dailySnap, logsSnap, coachingSnap, postsSnap,
      albumSnap, groupSnap, trackerSnap, vaccSnap, childSnap,
    ] = await Promise.all([
      byUser(collections.apiUsageDaily).limit(90).get(),
      byUser(collections.apiUsageLogs).limit(200).get(),
      byUser(collections.coachingSessions).limit(200).get(),
      byUser(collections.posts).limit(100).get(),
      byUser(collections.albumPhotos).limit(200).get(),
      byUser(collections.momGroupPosts).limit(100).get(),
      byUser(collections.babyTrackerDays).limit(200).get(),
      byUser(collections.vaccinations).limit(100).get(),
      byUser(collections.children).limit(20).get(),
    ]);

    const desc = (a: { at: string | null }, b: { at: string | null }) =>
      (b.at ?? '').localeCompare(a.at ?? '');

    // 일별 AI 사용 추이 (최근 30일)
    const daily = dailySnap.docs
      .map((d) => {
        const v = d.data() as Record<string, unknown>;
        return {
          date: (v.date as string) || '',
          callCount: (v.callCount as number) ?? 0,
          totalTokens: (v.totalTokens as number) ?? 0,
          costUsd: (v.costUsd as number) ?? 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    // AI 호출 원본 로그 (기능 구분 불가 — 모델·토큰·비용만)
    const aiCalls = logsSnap.docs
      .map((d) => {
        const v = d.data() as Record<string, unknown>;
        return {
          at: toISO(v.createdAt),
          provider: (v.provider as string) || '',
          model: (v.model as string) || '',
          totalTokens: (v.totalTokens as number) ?? 0,
          costUsd: (v.costUsd as number) ?? 0,
        };
      })
      .sort(desc)
      .slice(0, 50);

    // AI 상담 — 카테고리로 "무엇을 했는지" 파악 가능한 유일한 소스
    const coaching = coachingSnap.docs
      .map((d) => {
        const v = d.data() as Record<string, unknown>;
        const msg = (v.message as string) || '';
        return {
          at: toISO(v.createdAt),
          category: (v.category as string) || '',
          source: (v.source as string) || '',
          redFlag: v.redFlag ? String(v.redFlag).slice(0, 40) : null,
          // 프라이버시: 상담 원문은 앞부분만 (관리자도 전문 열람 불필요)
          preview: msg.slice(0, 30) + (msg.length > 30 ? '…' : ''),
        };
      })
      .sort(desc)
      .slice(0, 50);

    const categoryCounts: Record<string, number> = {};
    coachingSnap.docs.forEach((d) => {
      const c = ((d.data() as Record<string, unknown>).category as string) || '기타';
      categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
    });

    // 기능별 사용량 — 어떤 기능을 실제로 썼는지
    const featureUsage = {
      children: childSnap.size,
      trackerDays: trackerSnap.size,
      aiCoaching: coachingSnap.size,
      album: albumSnap.size,
      vaccination: vaccSnap.size,
      familyFeed: postsSnap.size,
      momGroup: groupSnap.size,
    };

    // 아기시간(베이비 트래커) 상세 — "등록만 하고 안 쓰는지 / 실제로 쓰는지" 판별용.
    // babyTrackerDays 는 하루 1문서에 records 배열을 담으므로, 날짜 수와 총 기록 건수를 나눠 본다.
    let trackerRecordCount = 0;
    let trackerLastDate: string | null = null;
    trackerSnap.docs.forEach((d) => {
      const v = d.data() as Record<string, unknown>;
      const recs = Array.isArray(v.records) ? v.records : [];
      trackerRecordCount += recs.length;
      const date = (v.date as string) || '';
      if (date && (!trackerLastDate || date > trackerLastDate)) trackerLastDate = date;
    });
    const babyTime = {
      daysRecorded: trackerSnap.size,
      totalRecords: trackerRecordCount,
      lastDate: trackerLastDate,
      // 하루라도 실제 기록이 있으면 사용한 것으로 본다(문서만 있고 records 가 빈 경우 제외)
      isUsing: trackerRecordCount > 0,
    };

    const totalCost = logsSnap.docs.reduce(
      (s, d) => s + (((d.data() as Record<string, unknown>).costUsd as number) ?? 0), 0,
    );

    // 최근 열람(화면 조회) — "쓰기"가 아닌 "읽기" 활동까지 파악 (screenActivity/{userId})
    const screenDoc = await collections.screenActivity.doc(userId).get();
    const recentScreens = screenDoc.exists && Array.isArray(screenDoc.data()!.recentScreens)
      ? (screenDoc.data()!.recentScreens as Array<{ s: string; t: string }>).slice(-30).reverse()
      : [];

    success(res, {
      userId,
      featureUsage,
      babyTime,
      categoryCounts,
      totals: { aiCallCount: logsSnap.size, aiCostUsd: totalCost },
      daily,
      aiCalls,
      coaching,
      recentScreens,
      // 관리자 화면에 한계를 명시 — 없는 데이터를 있는 것처럼 오해하지 않도록
      note: 'AI 호출 로그에는 기능 식별 필드가 없어 호출별 기능 귀속은 불가합니다. 기능별 사용량은 도메인 데이터 기준입니다.',
    });
  } catch (err) {
    logger.error('admin/user-activity', err);
    error(res, '조회 중 오류가 발생했습니다', 500);
  }
});

export default router;

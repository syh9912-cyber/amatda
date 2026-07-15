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

export default router;

import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { adminDashboardAuth } from '../middleware/adminDashboardAuth';
import { success, error } from '../utils/response';
import { collections } from '../services/firestore';
import { getUsageSummaryMap } from '../utils/apiUsage';

const router = Router();

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
router.get('/users', adminDashboardAuth, async (req: Request, res: Response) => {
  try {
    const daysRaw = req.query.days ? parseInt(String(req.query.days), 10) : undefined;
    const days = daysRaw && daysRaw > 0 ? daysRaw : undefined;
    const limit = Math.min(parseInt(String(req.query.limit ?? '500'), 10) || 500, 1000);

    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = collections.users;
    if (days) {
      const cutoff = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      );
      query = query.where('createdAt', '>=', cutoff);
    }
    query = query.orderBy('createdAt', 'desc').limit(limit);

    const snap = await query.get();
    // API 사용량은 가입일 필터(days)와 별개 시간축(전체 누적)이라 항상 전체 기간으로 집계.
    const usageMap = await getUsageSummaryMap();
    const now = new Date();
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

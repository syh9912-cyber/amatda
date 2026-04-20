import * as admin from 'firebase-admin';
import { collections } from '../services/firestore';

export type UserTier = 'free' | 'paid';

const tierCache = new Map<string, { tier: UserTier; expiresAt: number }>();
const TIER_TTL_MS = 5 * 60 * 1000;

/** 유저 티어 판정: 유료 구독(만료 전) OR 7일 체험판 → paid, 그 외 free */
export async function getUserTier(userId: string): Promise<UserTier> {
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.tier;

  let tier: UserTier = 'free';
  try {
    const doc = await collections.users.doc(userId).get();
    if (doc.exists) {
      const data = doc.data() as Record<string, unknown>;
      if ((data.subscriptionTier as string) === 'PAID') {
        const exp = data.premiumExpiresAt as string | undefined;
        if (exp && new Date(exp) > new Date()) tier = 'paid';
      }
      if (tier === 'free') {
        const trialStarted = data.trialStartedAt as string | undefined;
        if (trialStarted) {
          const end = new Date(trialStarted);
          end.setDate(end.getDate() + 7);
          if (new Date() < end) tier = 'paid';
        }
      }
    }
  } catch {
    /* 베스트 에포트 */
  }
  tierCache.set(userId, { tier, expiresAt: Date.now() + TIER_TTL_MS });
  return tier;
}

/** 기능별 일일 카운터 단일 문서 ID */
function counterDocId(userId: string, feature: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${userId}_${feature}_${today}`;
}

/** 오늘 사용 횟수 조회 */
export async function getDailyUsage(userId: string, feature: string): Promise<number> {
  try {
    const doc = await collections.rateLimits.doc(counterDocId(userId, feature)).get();
    if (!doc.exists) return 0;
    return ((doc.data() as Record<string, unknown>).count as number) || 0;
  } catch {
    return 0;
  }
}

/** 오늘 사용 횟수 원자적 증가 (best-effort) */
export async function incrementDailyUsage(userId: string, feature: string): Promise<void> {
  try {
    await collections.rateLimits.doc(counterDocId(userId, feature)).set(
      {
        count: admin.firestore.FieldValue.increment(1),
        userId,
        feature,
        date: new Date().toISOString().slice(0, 10),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    /* 베스트 에포트 */
  }
}

/**
 * 무료 유저 일일 한도 검사. 유료 유저는 항상 통과.
 * @returns allowed=false 시 한도 초과
 */
export async function checkDailyLimit(
  userId: string,
  feature: string,
  freeLimit: number,
): Promise<{ allowed: boolean; tier: UserTier; used: number; limit: number | null }> {
  const tier = await getUserTier(userId);
  if (tier === 'paid') {
    return { allowed: true, tier, used: 0, limit: null };
  }
  const used = await getDailyUsage(userId, feature);
  return { allowed: used < freeLimit, tier, used, limit: freeLimit };
}

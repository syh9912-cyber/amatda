import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';
import { logger } from '../utils/logger';

const router = Router();

router.get('/:childId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const snap = await collections.subscriptions
      .where('childId', '==', req.params.childId)
      .where('userId', '==', req.userId!).get();
    success(res, snap.docs.map((d) => {
      const s = d.data();
      return { id: d.id, kitType: s.kitType, status: s.status, nextDeliveryDate: s.nextDeliveryDate };
    }));
  } catch { error(res, '구독 조회 중 오류가 발생했습니다', 500); }
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { childId, kitType } = req.body;
    if (!childId || !kitType) { error(res, 'childId와 kitType을 입력해주세요'); return; }
    const childDoc = await collections.children.doc(childId).get();
    if (!childDoc.exists || childDoc.data()!.userId !== req.userId) { error(res, '자녀를 찾을 수 없습니다', 404); return; }

    const now = new Date();
    const nextDelivery = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
    const id = genId();
    await collections.subscriptions.doc(id).set({ userId: req.userId!, childId, kitType, status: 'ACTIVE', nextDeliveryDate: nextDelivery });
    success(res, { id, kitType, status: 'ACTIVE', nextDeliveryDate: nextDelivery }, 201);
  } catch { error(res, '구독 등록 중 오류가 발생했습니다', 500); }
});

router.put('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await collections.subscriptions.doc(req.params.id as string).get();
    if (!doc.exists || doc.data()!.userId !== req.userId) { error(res, '구독을 찾을 수 없습니다', 404); return; }
    if (doc.data()!.status === 'CANCELLED') { error(res, '이미 해지된 구독입니다'); return; }
    await collections.subscriptions.doc(req.params.id as string).update({ status: 'CANCELLED' });
    success(res, { id: doc.id, status: 'CANCELLED' });
  } catch { error(res, '구독 해지 중 오류가 발생했습니다', 500); }
});

// ─── 프리미엄 구독 시스템 ───

const PLANS = {
  monthly: { id: 'premium_monthly', name: 'VIP 월간', price: 3900, period: 'month' },
  yearly: { id: 'premium_yearly', name: 'VIP 연간', price: 33900, monthlyPrice: 2825, period: 'year' },
};

const PAYMENT_METHODS = [
  { id: 'card', name: '신용/체크카드', icon: 'credit-card' },
  { id: 'kakao', name: '카카오페이', icon: 'kakao' },
  { id: 'naver', name: '네이버페이', icon: 'naver' },
  { id: 'toss', name: '토스페이', icon: 'toss' },
  { id: 'bank', name: '무통장입금', icon: 'bank' },
];

// GET /api/subscription/premium/status — 프리미엄 상태 조회
router.get('/premium/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userDoc = await collections.users.doc(req.userId!).get();
    if (!userDoc.exists) { error(res, '계정이 존재하지 않습니다 (재로그인 필요)', 401); return; }
    const user = userDoc.data() as Record<string, unknown>;

    const tier = (user.subscriptionTier as string) || 'FREE';
    const trialStarted = user.trialStartedAt as string | undefined;
    const premiumStarted = user.premiumStartedAt as string | undefined;
    const premiumExpiresAt = user.premiumExpiresAt as string | undefined;

    const now = new Date();

    // 체험판 상태 계산
    let trialDaysLeft = 0;
    let trialActive = false;
    let showTrialWarning = false;

    if (trialStarted) {
      const trialStart = new Date(trialStarted);
      const trialEnd = new Date(trialStart);
      trialEnd.setDate(trialEnd.getDate() + 7); // 7일 체험
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      trialDaysLeft = Math.max(0, daysLeft);
      trialActive = daysLeft > 0;
      showTrialWarning = daysLeft <= 3 && daysLeft > 0; // 3일 전부터 경고
    }

    // 유료 구독 상태
    let premiumActive = false;
    let premiumDaysLeft = 0;
    if (tier === 'PAID' && premiumExpiresAt) {
      const expires = new Date(premiumExpiresAt);
      premiumDaysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      premiumActive = premiumDaysLeft > 0;
    }

    // 체험판 종료 + 유료 미구독 = 무료
    const effectiveTier = premiumActive || trialActive ? 'PAID' : 'FREE';

    const freeRestrictions = effectiveTier === 'FREE' ? [
      '하루 10회 상담 가능',
      '울음/대변 분석 하루 3회',
      '광고 포함',
    ] : [];

    success(res, {
      tier: effectiveTier,
      trialActive,
      trialDaysLeft,
      showTrialWarning,
      trialWarningMessage: showTrialWarning
        ? `체험판이 ${trialDaysLeft}일 후 종료됩니다. 무료로 전환되면 일부 기능이 제한돼요.`
        : null,
      premiumActive,
      premiumExpiresAt: premiumActive ? premiumExpiresAt : null,
      premiumDaysLeft: premiumActive ? premiumDaysLeft : 0,
      freeRestrictions,
      plans: PLANS,
      paymentMethods: PAYMENT_METHODS,
    });
  } catch {
    error(res, '구독 상태 조회 중 오류', 500);
  }
});

// POST /api/subscription/premium/start-trial — 체험판 시작 (가입 시 자동 호출)
router.post('/premium/start-trial', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userDoc = await collections.users.doc(req.userId!).get();
    if (!userDoc.exists) { error(res, '계정이 존재하지 않습니다 (재로그인 필요)', 401); return; }
    const user = userDoc.data() as Record<string, unknown>;

    if (user.trialStartedAt) {
      error(res, '이미 체험판을 사용하셨습니다');
      return;
    }

    const now = new Date().toISOString();
    await collections.users.doc(req.userId!).update({
      trialStartedAt: now,
      subscriptionTier: 'PAID', // 체험 기간 동안 PAID 취급
    });

    success(res, {
      trialStartedAt: now,
      trialDaysLeft: 30,
      message: '30일 프리미엄 체험이 시작되었습니다!',
    });
  } catch {
    error(res, '체험판 시작 중 오류', 500);
  }
});

// POST /api/subscription/premium/subscribe — DEPRECATED 보안 위험 라우트 차단
//
// 이 라우트는 결제 검증 없이 planId 만으로 PAID 활성화하던 dead code 였음.
// 누구나 호출하면 영구 무료 PAID 가 됐던 CRITICAL 취약점 (보안 점검 2026-05-04 발견).
// 모든 결제 활성화는 반드시 payment.ts (PortOne/Google/Apple 영수증 검증) 경유해야 함.
router.post('/premium/subscribe', authMiddleware, async (_req: Request, res: Response) => {
  logger.warn('subscription.premium.subscribe', '차단된 라우트 호출 — payment.ts 경로 사용 필요');
  error(res, '이 결제 경로는 더 이상 사용되지 않습니다. 앱을 최신 버전으로 업데이트해주세요.', 410);
});

// GET /api/subscription/premium/plans — 요금제 목록
router.get('/premium/plans', async (_req: Request, res: Response) => {
  success(res, {
    plans: [
      {
        ...PLANS.monthly,
        features: [
          '상담이모 무제한',
          '울음/대변 분석 무제한',
          '타임라인 AI 자동기록',
          '타임캡슐 보관',
          '광고 제거',
        ],
      },
      {
        ...PLANS.yearly,
        badge: '28% 할인',
        features: [
          '월간 플랜의 모든 기능',
          '연간 결제 시 28% 할인',
          '월 2,825원꼴',
        ],
      },
    ],
    paymentMethods: PAYMENT_METHODS,
    freeFeatures: [
      '하루 10회 무료 상담',
      'DB 전체 참고 맞춤 답변',
      '대화 맥락 7일 유지',
      '기질 기반 개인화 상담',
      '레드플래그 긴급 안내 (무제한)',
    ],
  });
});

export default router;

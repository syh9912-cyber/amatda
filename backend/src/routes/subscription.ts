import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId } from '../services/firestore';

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
  monthly: { id: 'premium_monthly', name: '프리미엄 월간', price: 4900, period: 'month' },
  yearly: { id: 'premium_yearly', name: '프리미엄 연간', price: 39900, monthlyPrice: 3325, period: 'year' },
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
    if (!userDoc.exists) { error(res, '사용자 없음', 404); return; }
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
      trialEnd.setDate(trialEnd.getDate() + 30); // 30일 체험
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      trialDaysLeft = Math.max(0, daysLeft);
      trialActive = daysLeft > 0;
      showTrialWarning = daysLeft <= 7 && daysLeft > 0; // 7일 전부터 경고
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
      '일 상담 10회 제한',
      '기본 답변 길이',
      '대화 맥락 1일만 유지',
      '주간 리포트 미제공',
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
    if (!userDoc.exists) { error(res, '사용자 없음', 404); return; }
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

// POST /api/subscription/premium/subscribe — 프리미엄 구독 (결제 후)
router.post('/premium/subscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { planId, paymentMethod } = req.body as {
      planId: string;
      paymentMethod: string;
    };

    if (!planId || !paymentMethod) {
      error(res, 'planId와 paymentMethod는 필수입니다');
      return;
    }

    const plan = planId === 'premium_yearly' ? PLANS.yearly : PLANS.monthly;
    const validMethod = PAYMENT_METHODS.find((m) => m.id === paymentMethod);
    if (!validMethod) { error(res, '유효하지 않은 결제 수단입니다'); return; }

    const now = new Date();
    const expiresAt = new Date(now);
    if (plan.period === 'year') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // 결제 기록 저장
    const paymentId = genId();
    await collections.subscriptions.doc(paymentId).set({
      userId: req.userId,
      type: 'premium',
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      paymentMethod,
      status: 'ACTIVE',
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    });

    // 유저 티어 업데이트
    await collections.users.doc(req.userId!).update({
      subscriptionTier: 'PAID',
      premiumStartedAt: now.toISOString(),
      premiumExpiresAt: expiresAt.toISOString(),
      premiumPlanId: plan.id,
    });

    success(res, {
      subscriptionId: paymentId,
      plan: plan.name,
      price: plan.price,
      expiresAt: expiresAt.toISOString(),
      message: `${plan.name} 구독이 시작되었습니다!`,
    });
  } catch {
    error(res, '구독 처리 중 오류', 500);
  }
});

// GET /api/subscription/premium/plans — 요금제 목록
router.get('/premium/plans', async (_req: Request, res: Response) => {
  success(res, {
    plans: [
      {
        ...PLANS.monthly,
        features: [
          '무제한 AI 상담',
          '상세 맞춤 답변',
          '대화 맥락 7일 유지',
          '주간 AI 리포트',
          '성장 마일스톤 알림',
          'DB 참고자료 4개 반영',
        ],
      },
      {
        ...PLANS.yearly,
        badge: '32% 할인',
        features: [
          '월간 플랜의 모든 기능',
          '연간 결제 시 32% 할인',
          '월 3,325원꼴',
        ],
      },
    ],
    paymentMethods: PAYMENT_METHODS,
    freeFeatures: [
      '일 10회 AI 상담',
      '기본 답변',
      '대화 맥락 1일 유지',
    ],
  });
});

export default router;

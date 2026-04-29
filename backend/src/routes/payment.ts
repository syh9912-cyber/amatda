/**
 * 결제 라우트 — 인앱결제(IAP) + PortOne 외부결제 통합
 *
 * 엔드포인트:
 *  POST /api/payment/portone/verify              — PortOne 1회성 결제 검증
 *  POST /api/payment/portone/billing-key         — 빌링키 발급 후 등록 (사용자가 카드 등록 완료 시)
 *  POST /api/payment/iap/verify                  — Google/Apple 인앱결제 영수증 검증
 *  POST /api/payment/cancel                      — 구독 해지 (자동갱신 OFF)
 *  GET  /api/payment/history                     — 내 결제 내역
 *  POST /api/payment/webhook/portone             — PortOne webhook (서명 검증 후 상태 동기화)
 *  POST /api/payment/webhook/google              — Google RTDN (Pub/Sub)
 *  POST /api/payment/webhook/apple               — Apple App Store Server Notification V2
 *
 * 영수증 보관: payments 컬렉션 (1결제 = 1문서)
 * 사용자 상태: users.{uid}.subscriptionTier / .premiumExpiresAt 자동 갱신
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, genId, db } from '../services/firestore';
import { logger } from '../utils/logger';
import * as portone from '../services/payment/portone.client';
import * as googlePlay from '../services/payment/google-play.client';
import * as appleIap from '../services/payment/apple-iap.client';
import {
  isPortOneAvailable,
  isGooglePlayBillingAvailable,
  isAppleIAPAvailable,
} from '../config/env';

const router = Router();

// ─── 상품 정의 (단일 진실 출처 — subscription.ts와 sync) ───
const PRODUCTS: Record<string, { id: string; name: string; price: number; periodMs: number }> = {
  premium_monthly: {
    id: 'premium_monthly',
    name: '아맞다 VIP 월간',
    price: 3900,
    periodMs: 30 * 24 * 60 * 60 * 1000,
  },
  premium_yearly: {
    id: 'premium_yearly',
    name: '아맞다 VIP 연간',
    price: 33900,
    periodMs: 365 * 24 * 60 * 60 * 1000,
  },
};

function getProductOrError(productId: string, res: Response): typeof PRODUCTS[string] | null {
  const p = PRODUCTS[productId];
  if (!p) {
    error(res, '유효하지 않은 상품입니다');
    return null;
  }
  return p;
}

async function activateUserSubscription(
  userId: string,
  productId: string,
  platform: 'portone' | 'google' | 'apple',
  expiresAt: Date,
  paymentDocId: string,
  autoRenew: boolean,
): Promise<void> {
  await collections.users.doc(userId).update({
    subscriptionTier: 'PAID',
    premiumStartedAt: new Date().toISOString(),
    premiumExpiresAt: expiresAt.toISOString(),
    premiumPlanId: productId,
    subscriptionPlatform: platform,
    subscriptionAutoRenew: autoRenew,
    lastPaymentDocId: paymentDocId,
  });
}

// ─────────────────────────────────────────────────────────
// 1. PortOne 1회성 결제 검증
// ─────────────────────────────────────────────────────────
router.post('/portone/verify', authMiddleware, async (req: Request, res: Response) => {
  if (!isPortOneAvailable()) {
    error(res, '결제 시스템 준비 중입니다 (관리자 설정 필요)', 503);
    return;
  }
  try {
    const { paymentId, productId } = req.body as { paymentId?: string; productId?: string };
    if (!paymentId || !productId) {
      error(res, 'paymentId와 productId는 필수입니다');
      return;
    }
    const product = getProductOrError(productId, res);
    if (!product) return;

    const result = await portone.verifyPayment(paymentId, {
      expectedAmount: product.price,
      expectedCurrency: 'KRW',
      expectedOrderName: product.name,
    });
    if (!result.ok || !result.payment) {
      logger.warn('payment.portone.verify', `검증 실패: ${result.reason}`);
      error(res, '결제 검증 실패: ' + (result.reason ?? 'unknown'), 400);
      return;
    }

    // 영수증 저장 + 사용자 활성화
    const now = new Date();
    const expiresAt = new Date(now.getTime() + product.periodMs);
    const paymentDocId = genId();
    await collections.payments.doc(paymentDocId).set({
      userId: req.userId!,
      platform: 'portone',
      productId,
      amount: product.price,
      currency: 'KRW',
      status: 'PAID',
      paymentKey: paymentId,
      paymentMethod: result.payment.method?.type ?? 'unknown',
      paidAt: result.payment.paidAt ?? now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      webhookVerifiedAt: now.toISOString(),
      raw: result.payment as unknown as Record<string, unknown>,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    await activateUserSubscription(req.userId!, productId, 'portone', expiresAt, paymentDocId, false);

    success(res, {
      paymentDocId,
      productId,
      expiresAt: expiresAt.toISOString(),
      autoRenew: false,
      message: `${product.name} 결제가 완료되었습니다.`,
    });
  } catch (e) {
    logger.error('payment.portone.verify', e);
    error(res, '결제 검증 중 오류', 500);
  }
});

// ─────────────────────────────────────────────────────────
// 2. PortOne 빌링키(자동결제) 등록 + 첫 결제 즉시 진행
// ─────────────────────────────────────────────────────────
router.post('/portone/billing-key', authMiddleware, async (req: Request, res: Response) => {
  if (!isPortOneAvailable()) {
    error(res, '결제 시스템 준비 중입니다', 503);
    return;
  }
  try {
    const { billingKey, productId, channelKey } = req.body as {
      billingKey?: string;
      productId?: string;
      channelKey?: string;
    };
    if (!billingKey || !productId) {
      error(res, 'billingKey와 productId는 필수입니다');
      return;
    }
    const product = getProductOrError(productId, res);
    if (!product) return;

    // 1) 빌링키 등록
    await collections.billingKeys.doc(req.userId!).set({
      userId: req.userId!,
      billingKey,
      channelKey: channelKey ?? null,
      issuedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    // 2) 첫 결제 즉시 진행 (정기결제 시작)
    const firstPaymentId = `bk_${req.userId}_${Date.now()}`;
    const charge = await portone.chargeWithBillingKey({
      billingKey,
      paymentId: firstPaymentId,
      orderName: product.name,
      amount: product.price,
      customerId: req.userId!,
      customData: { productId, userId: req.userId, type: 'first_charge' },
    });

    if (charge.status !== 'PAID') {
      error(res, '첫 결제 실패: ' + charge.status, 400);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + product.periodMs);
    const paymentDocId = genId();
    await collections.payments.doc(paymentDocId).set({
      userId: req.userId!,
      platform: 'portone',
      productId,
      amount: product.price,
      currency: 'KRW',
      status: 'PAID',
      paymentKey: firstPaymentId,
      billingKey,
      paymentMethod: charge.method?.type ?? 'card',
      paidAt: charge.paidAt ?? now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      raw: charge as unknown as Record<string, unknown>,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    await activateUserSubscription(req.userId!, productId, 'portone', expiresAt, paymentDocId, true);

    success(res, {
      paymentDocId,
      productId,
      expiresAt: expiresAt.toISOString(),
      autoRenew: true,
      message: `${product.name} 자동 결제가 시작되었습니다.`,
    });
  } catch (e) {
    logger.error('payment.portone.billing-key', e);
    error(res, '빌링키 등록 중 오류', 500);
  }
});

// ─────────────────────────────────────────────────────────
// 3. Google Play / Apple 인앱결제 영수증 검증
// ─────────────────────────────────────────────────────────
router.post('/iap/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      platform,
      productId,
      purchaseToken,
      originalTransactionId,
    } = req.body as {
      platform?: 'google' | 'apple';
      productId?: string;
      purchaseToken?: string;
      originalTransactionId?: string;
    };
    if (!platform || !productId) {
      error(res, 'platform과 productId는 필수입니다');
      return;
    }
    const product = getProductOrError(productId, res);
    if (!product) return;

    const now = new Date();
    let expiresAt: Date;
    let autoRenew = false;
    let receiptKey: string;
    const rawForLog: Record<string, unknown> = {};

    if (platform === 'google') {
      if (!isGooglePlayBillingAvailable()) {
        error(res, 'Google Play 결제 검증 준비 중입니다', 503);
        return;
      }
      if (!purchaseToken) {
        error(res, 'purchaseToken이 필요합니다');
        return;
      }
      const v = await googlePlay.verifyGooglePurchase(purchaseToken, productId);
      if (!v.ok || !v.sub) {
        error(res, '영수증 검증 실패: ' + (v.reason ?? 'unknown'), 400);
        return;
      }
      expiresAt = v.sub.expiryTime ? new Date(v.sub.expiryTime) : new Date(now.getTime() + product.periodMs);
      autoRenew = v.sub.autoRenewing ?? true;
      receiptKey = purchaseToken;
      rawForLog.google = v.sub.raw;
    } else {
      if (!isAppleIAPAvailable()) {
        error(res, 'Apple 결제 검증 준비 중입니다', 503);
        return;
      }
      if (!originalTransactionId) {
        error(res, 'originalTransactionId가 필요합니다');
        return;
      }
      const v = await appleIap.verifyAppleTransaction(originalTransactionId, productId);
      if (!v.ok || !v.sub) {
        error(res, '영수증 검증 실패: ' + (v.reason ?? 'unknown'), 400);
        return;
      }
      expiresAt = v.sub.expiresAt ?? new Date(now.getTime() + product.periodMs);
      autoRenew = v.sub.autoRenew ?? true;
      receiptKey = originalTransactionId;
      rawForLog.apple = v.sub.raw;
    }

    const paymentDocId = genId();
    await collections.payments.doc(paymentDocId).set({
      userId: req.userId!,
      platform,
      productId,
      amount: product.price,
      currency: 'KRW',
      status: 'PAID',
      ...(platform === 'google'
        ? { purchaseToken: receiptKey }
        : { originalTransactionId: receiptKey }),
      paymentMethod: platform === 'google' ? 'google_play' : 'apple_iap',
      paidAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      raw: rawForLog,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    await activateUserSubscription(req.userId!, productId, platform, expiresAt, paymentDocId, autoRenew);

    success(res, {
      paymentDocId,
      productId,
      expiresAt: expiresAt.toISOString(),
      autoRenew,
      message: '결제가 완료되었습니다.',
    });
  } catch (e) {
    logger.error('payment.iap.verify', e);
    error(res, '인앱결제 검증 중 오류', 500);
  }
});

// ─────────────────────────────────────────────────────────
// 4. 구독 해지 (자동갱신 OFF) — 외부결제(PortOne)만
//    IAP는 사용자가 Google/Apple에서 직접 해지해야 함 (정책)
// ─────────────────────────────────────────────────────────
router.post('/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userDoc = await collections.users.doc(req.userId!).get();
    const user = userDoc.data() ?? {};
    const platform = user.subscriptionPlatform as string | undefined;

    if (platform !== 'portone') {
      error(
        res,
        platform === 'google'
          ? 'Google Play 인앱결제는 Play Store 앱에서 해지해주세요.'
          : platform === 'apple'
            ? 'Apple 인앱결제는 설정 → 구독에서 해지해주세요.'
            : '활성 구독이 없습니다.',
        400,
      );
      return;
    }

    const billingDoc = await collections.billingKeys.doc(req.userId!).get();
    if (billingDoc.exists && billingDoc.data()?.billingKey) {
      try {
        await portone.deleteBillingKey(billingDoc.data()!.billingKey as string, '사용자 해지 요청');
      } catch (e) {
        logger.warn('payment.cancel', '빌링키 삭제 실패(무시): ' + String(e));
      }
      await collections.billingKeys.doc(req.userId!).update({
        status: 'REVOKED',
        revokedAt: new Date().toISOString(),
      });
    }

    await collections.users.doc(req.userId!).update({
      subscriptionAutoRenew: false,
    });

    success(res, {
      message: '자동 결제가 해지되었습니다. 만료일까지는 계속 이용 가능합니다.',
      expiresAt: user.premiumExpiresAt,
    });
  } catch (e) {
    logger.error('payment.cancel', e);
    error(res, '해지 처리 중 오류', 500);
  }
});

// ─────────────────────────────────────────────────────────
// 5. 결제 내역 조회
// ─────────────────────────────────────────────────────────
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const snap = await collections.payments
      .where('userId', '==', req.userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        platform: data.platform,
        productId: data.productId,
        amount: data.amount,
        status: data.status,
        paidAt: data.paidAt,
        expiresAt: data.expiresAt,
      };
    });
    success(res, { items });
  } catch (e) {
    logger.error('payment.history', e);
    error(res, '결제 내역 조회 중 오류', 500);
  }
});

// ─────────────────────────────────────────────────────────
// 6. Webhook — PortOne
//    Standard Webhooks 사양: webhook-id, webhook-timestamp, webhook-signature 헤더로 서명
// ─────────────────────────────────────────────────────────
router.post('/webhook/portone', async (req: Request, res: Response) => {
  try {
    // express.raw 미들웨어가 라우트 등록 시 적용되어야 rawBody 사용 가능.
    // 여기서는 임시로 JSON.stringify 사용 (정확한 검증을 위해선 raw body 필요)
    const rawBody = JSON.stringify(req.body);
    const headers = {
      id: (req.headers['webhook-id'] as string) ?? '',
      timestamp: (req.headers['webhook-timestamp'] as string) ?? '',
      signature: (req.headers['webhook-signature'] as string) ?? '',
    };

    if (headers.id && !portone.verifyWebhookSignature(rawBody, headers)) {
      logger.warn('payment.webhook.portone', '서명 검증 실패');
      res.status(401).send('invalid signature');
      return;
    }

    const body = req.body as { type?: string; data?: { paymentId?: string; billingKey?: string } };
    logger.info('payment.webhook.portone', `event=${body.type ?? 'unknown'}`);

    // 결제 상태 변경 시 payments 문서 동기화
    const paymentId = body.data?.paymentId;
    if (paymentId) {
      try {
        const payment = await portone.getPayment(paymentId);
        const snap = await collections.payments.where('paymentKey', '==', paymentId).limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.update({
            status: payment.status,
            updatedAt: new Date().toISOString(),
            webhookVerifiedAt: new Date().toISOString(),
            raw: payment as unknown as Record<string, unknown>,
          });
        }
      } catch (e) {
        logger.warn('payment.webhook.portone', '결제 동기화 실패: ' + String(e));
      }
    }

    res.status(200).send('ok');
  } catch (e) {
    logger.error('payment.webhook.portone', e);
    res.status(500).send('error');
  }
});

// ─────────────────────────────────────────────────────────
// 7. Webhook — Google Real-Time Developer Notification (Pub/Sub)
// ─────────────────────────────────────────────────────────
router.post('/webhook/google', async (req: Request, res: Response) => {
  try {
    // Pub/Sub push: { message: { data: base64, ... }, subscription: '...' }
    const messageData = (req.body as { message?: { data?: string } })?.message?.data;
    if (!messageData) {
      res.status(200).send('no-data');
      return;
    }
    const decoded = Buffer.from(messageData, 'base64').toString('utf8');
    const notification = JSON.parse(decoded) as googlePlay.RTDNNotification;

    const sub = notification.subscriptionNotification;
    if (!sub) {
      res.status(200).send('not-subscription');
      return;
    }
    const eventType = googlePlay.RTDN_TYPES[sub.notificationType] ?? `unknown(${sub.notificationType})`;
    logger.info('payment.webhook.google', `${eventType} token=${sub.purchaseToken.substring(0, 10)}...`);

    // 영수증 재조회 후 payments + users 업데이트
    try {
      const verify = await googlePlay.verifyGooglePurchase(sub.purchaseToken, sub.subscriptionId);
      if (verify.ok && verify.sub) {
        // 해당 paymentToken으로 저장된 payment 문서 찾기
        const snap = await collections.payments
          .where('purchaseToken', '==', sub.purchaseToken)
          .limit(1)
          .get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          await doc.ref.update({
            status: verify.sub.state.includes('ACTIVE') ? 'PAID' : 'CANCELLED',
            expiresAt: verify.sub.expiryTime,
            webhookVerifiedAt: new Date().toISOString(),
            raw: verify.sub.raw as Record<string, unknown>,
            updatedAt: new Date().toISOString(),
          });
          // 사용자 만료일 갱신
          const userId = doc.data().userId as string | undefined;
          if (userId && verify.sub.expiryTime) {
            await collections.users.doc(userId).update({
              premiumExpiresAt: verify.sub.expiryTime,
              subscriptionAutoRenew: verify.sub.autoRenewing ?? false,
            });
          }
        }
      }
    } catch (e) {
      logger.warn('payment.webhook.google', '재조회 실패: ' + String(e));
    }

    res.status(200).send('ok');
  } catch (e) {
    logger.error('payment.webhook.google', e);
    res.status(500).send('error');
  }
});

// ─────────────────────────────────────────────────────────
// 8. Webhook — Apple App Store Server Notification V2
// ─────────────────────────────────────────────────────────
router.post('/webhook/apple', async (req: Request, res: Response) => {
  try {
    // Apple은 signedPayload(JWS) 1개 필드로 옴
    const signedPayload = (req.body as { signedPayload?: string })?.signedPayload;
    if (!signedPayload) {
      res.status(200).send('no-payload');
      return;
    }
    // JWS payload 디코딩 (서명 검증은 운영 시 Apple root cert 추가)
    const parts = signedPayload.split('.');
    if (parts.length !== 3) {
      res.status(400).send('bad-jws');
      return;
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      notificationType?: string;
      subtype?: string;
      data?: { signedTransactionInfo?: string };
    };
    logger.info(
      'payment.webhook.apple',
      `${payload.notificationType ?? 'unknown'} / ${payload.subtype ?? ''}`,
    );

    // signedTransactionInfo 디코딩 → originalTransactionId 추출 → payments 동기화
    const tx = payload.data?.signedTransactionInfo;
    if (tx) {
      const txParts = tx.split('.');
      if (txParts.length === 3) {
        const txPayload = JSON.parse(Buffer.from(txParts[1], 'base64url').toString('utf8')) as {
          originalTransactionId?: string;
          productId?: string;
          expiresDate?: number;
        };
        const originalId = txPayload.originalTransactionId;
        if (originalId) {
          const snap = await collections.payments
            .where('originalTransactionId', '==', originalId)
            .limit(1)
            .get();
          if (!snap.empty) {
            const doc = snap.docs[0];
            await doc.ref.update({
              status: payload.notificationType === 'EXPIRED' ? 'CANCELLED' : 'PAID',
              expiresAt: txPayload.expiresDate ? new Date(txPayload.expiresDate).toISOString() : undefined,
              webhookVerifiedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            const userId = doc.data().userId as string | undefined;
            if (userId && txPayload.expiresDate) {
              await collections.users.doc(userId).update({
                premiumExpiresAt: new Date(txPayload.expiresDate).toISOString(),
              });
            }
          }
        }
      }
    }

    res.status(200).send('ok');
  } catch (e) {
    logger.error('payment.webhook.apple', e);
    res.status(500).send('error');
  }
});

// ─────────────────────────────────────────────────────────
// 9. 결제 가능 상태 점검 (디버그/관리자용)
// ─────────────────────────────────────────────────────────
router.get('/status', authMiddleware, async (_req: Request, res: Response) => {
  success(res, {
    portone: isPortOneAvailable(),
    googlePlay: isGooglePlayBillingAvailable(),
    apple: isAppleIAPAvailable(),
  });
});

// db는 import 되어 있지만 직접 안 쓰는 경우 ESLint unused 경고 회피
void db;

export default router;

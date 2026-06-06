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
import { createHash } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { collections, db } from '../services/firestore';
import { logger } from '../utils/logger';
import * as portone from '../services/payment/portone.client';
import * as googlePlay from '../services/payment/google-play.client';
import * as appleIap from '../services/payment/apple-iap.client';
import * as appleJws from '../services/payment/apple-jws-verifier';
import {
  env,
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
    price: 39900,
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

/**
 * 결제 문서 ID — 멱등성 키.
 * 같은 (platform, key) 조합은 항상 같은 docId 로 매핑되어, verify 가 두 번 호출돼도
 * 문서가 한 개만 생성되고 사용자 활성화도 안전하게 1회만 처리됨.
 *
 * SHA256 hash 사용 이유:
 *   - paymentId / purchaseToken / originalTransactionId 가 '/' 같은 특수문자 또는
 *     1500바이트 한도 초과 가능성 → hash 로 64자 hex 고정
 *   - 원본 키는 paymentKey/purchaseToken/originalTransactionId 필드에 저장되어 query 가능
 */
function paymentDocIdFor(platform: 'portone' | 'google' | 'apple', key: string): string {
  return `${platform}_${createHash('sha256').update(key).digest('hex')}`;
}

/**
 * PG raw 응답에서 PII / 카드정보 / 구매자 개인정보를 제거하고
 * 회계/디버깅에 필요한 화이트리스트 필드만 추출.
 *
 * 보안 점검 결과 (2026-05-04): 기존엔 PG raw 를 통째로 Firestore 에 저장 →
 * card.number(masked) / customer.email / customer.phoneNumber / buyer.* 등이
 * Firestore export / 백업에 동봉돼 GDPR / 결제표준(PCI-DSS) 위반 우려.
 */
function sanitizePortOneRaw(p: unknown): Record<string, unknown> {
  const r = (p ?? {}) as Record<string, unknown>;
  const method = (r.method ?? {}) as Record<string, unknown>;
  const channel = (r.channel ?? {}) as Record<string, unknown>;
  const amount = (r.amount ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    status: r.status,
    storeId: r.storeId,
    orderName: r.orderName,
    paidAt: r.paidAt,
    cancelledAt: r.cancelledAt,
    currency: r.currency,
    amountTotal: amount.total,
    amountPaid: amount.paid,
    methodType: method.type,
    methodProvider: method.provider,
    channelType: channel.type,
    channelKey: channel.key,
    // 명시적 제외: customer, buyer, card, customData (PII / 카드정보)
  };
}

function sanitizeGoogleRaw(p: unknown): Record<string, unknown> {
  // Subscriptions V2 응답 구조:
  //   { subscriptionState, lineItems: [{ productId, expiryTime, autoRenewingPlan: { autoRenewEnabled } }] }
  // V1 (구버전) 응답은 { state, expiryTime, autoRenewing, productId } 였음 — 코드가 V1 가정으로 작성되어
  // V2 호출 결과를 받으면 모든 필드 undefined → Firestore 거부 (raw.state undefined) 에러.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (p ?? {}) as any;
  const lineItem = (r.lineItems?.[0] ?? {}) as Record<string, unknown> & {
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
  };
  const result: Record<string, unknown> = {
    subscriptionState: r.subscriptionState,
    expiryTime: lineItem.expiryTime,
    autoRenewing: lineItem.autoRenewingPlan?.autoRenewEnabled,
    productId: lineItem.productId,
    // 명시적 제외: regionCode, latestOrderId, linkedPurchaseToken, acknowledgementState, externalAccountIdentifiers 등
  };
  // Firestore 는 undefined 값 거부 — sanitize 단계에서 제거.
  for (const k of Object.keys(result)) {
    if (result[k] === undefined) delete result[k];
  }
  return result;
}

function sanitizeAppleRaw(p: unknown): Record<string, unknown> {
  const r = (p ?? {}) as Record<string, unknown>;
  const tx = (r.txInfo ?? {}) as Record<string, unknown>;
  const renew = (r.renewInfo ?? {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {
    productId: tx.productId,
    transactionType: tx.type,
    expiresDate: tx.expiresDate,
    purchaseDate: tx.purchaseDate,
    autoRenewStatus: renew.autoRenewStatus,
    environment: tx.environment,
    // 명시적 제외: appAccountToken / originalTransactionId / signedDate / deviceVerification
  };
  // Firestore 는 undefined 값 거부 — sanitizeGoogleRaw 와 동일하게 제거 (애플 응답 필드 누락 대비).
  for (const k of Object.keys(result)) {
    if (result[k] === undefined) delete result[k];
  }
  return result;
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

    // 멱등성: 같은 paymentId 로 두 번 verify 호출 시 → 두 번째는 기존 결과 그대로 응답
    const paymentDocId = paymentDocIdFor('portone', paymentId);
    const docRef = collections.payments.doc(paymentDocId);
    const existing = await docRef.get();
    if (existing.exists) {
      const data = existing.data()!;
      logger.info('payment.portone.verify', `idempotent hit paymentDocId=${paymentDocId}`);
      success(res, {
        paymentDocId,
        productId: data.productId,
        expiresAt: data.expiresAt,
        autoRenew: false,
        idempotent: true,
        message: `${product.name} 결제가 이미 처리되어 있습니다.`,
      });
      return;
    }

    // 영수증 저장 + 사용자 활성화
    const now = new Date();
    const expiresAt = new Date(now.getTime() + product.periodMs);
    await docRef.set({
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
      raw: sanitizePortOneRaw(result.payment),
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
    // 멱등성: firstPaymentId 는 매 호출 timestamp 로 새로 생성되지만, 만일을 대비해 키 기반 docId
    const paymentDocId = paymentDocIdFor('portone', firstPaymentId);
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
      raw: sanitizePortOneRaw(charge),
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

    // 이중 결제 방지 (안전망) — 이미 활성 구독 중인데 다른 SKU 결제 시 거부.
    //   frontend 가 1차 차단하지만 race condition / 악의적 호출 대비.
    //   같은 SKU 는 paymentDocIdFor 멱등성으로 처리 (같은 receiptKey → 같은 doc).
    //   다른 SKU 는 cross-grade 처리 미구현 → 409 거부.
    try {
      const userSnap = await collections.users.doc(req.userId!).get();
      const userData = userSnap.data() ?? {};
      const currentTier = userData.subscriptionTier as string | undefined;
      const currentExpiresAtStr = userData.premiumExpiresAt as string | undefined;
      const currentProductId = userData.premiumPlanId as string | undefined;
      if (currentTier === 'PAID' && currentExpiresAtStr) {
        const expiresAt = new Date(currentExpiresAtStr);
        if (expiresAt > now && currentProductId && currentProductId !== productId) {
          logger.warn(
            'payment.iap.verify',
            `이중 결제 차단 userId=${req.userId} current=${currentProductId} attempted=${productId}`,
          );
          error(
            res,
            '이미 다른 플랜을 이용 중이에요. 플랜 변경은 Google Play 정기 결제 관리에서 가능해요.',
            409,
          );
          return;
        }
      }
    } catch (e) {
      // 사용자 조회 실패는 진행 차단하지 않음 (verify 단계에서 다시 검증됨)
      logger.warn('payment.iap.verify', `pre-check user lookup failed: ${e instanceof Error ? e.message : String(e)}`);
    }

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
        // 디버깅: 검증 실패 시 reason + sub state 로그 (영수증 토큰은 prefix 만)
        logger.warn(
          'payment.iap.verify',
          `google verify FAILED reason=${v.reason ?? 'unknown'} tokenPrefix=${purchaseToken.substring(0, 12)}... productId=${productId} subState=${v.sub?.state ?? 'none'} subProductId=${v.sub?.productId ?? 'none'}`,
        );
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

    // 멱등성: 같은 영수증으로 두 번 verify 호출 시 → 두 번째는 기존 결과 그대로 응답
    const paymentDocId = paymentDocIdFor(platform, receiptKey);
    const docRef = collections.payments.doc(paymentDocId);
    const existing = await docRef.get();
    if (existing.exists) {
      const data = existing.data()!;
      logger.info('payment.iap.verify', `idempotent hit paymentDocId=${paymentDocId}`);
      success(res, {
        paymentDocId,
        productId: data.productId,
        expiresAt: data.expiresAt,
        autoRenew,
        idempotent: true,
        message: '결제가 이미 처리되어 있습니다.',
      });
      return;
    }

    await docRef.set({
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
      raw: platform === 'google'
        ? sanitizeGoogleRaw((rawForLog as { google?: unknown }).google)
        : sanitizeAppleRaw((rawForLog as { apple?: unknown }).apple),
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
    // raw body 는 index.ts 의 express.json verify 콜백이 보존한 Buffer
    // (req.body 와 별개로 보관 — 다른 라우트 영향 없음).
    // PortOne HMAC 은 원본 byte 단위로 계산되므로 JSON.stringify(req.body) 는 사용 불가
    // (키 순서 / 공백 / 유니코드 이스케이프가 PortOne 원본과 다름 → 검증 깨짐).
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';
    const headers = {
      id: (req.headers['webhook-id'] as string) ?? '',
      timestamp: (req.headers['webhook-timestamp'] as string) ?? '',
      signature: (req.headers['webhook-signature'] as string) ?? '',
    };

    // fail-closed: 시크릿 미설정 시에도 portone.verifyWebhookSignature 자체가 false 반환하도록
    // portone.client.ts 에서 변경. 추가로 헤더 누락도 명시적으로 거부 (이전에는 헤더 없으면 검증 스킵 → 우회 가능).
    if (!headers.id || !headers.timestamp || !headers.signature) {
      logger.warn('payment.webhook.portone', `webhook 서명 헤더 누락 id=${!!headers.id} ts=${!!headers.timestamp} sig=${!!headers.signature}`);
      res.status(401).send('missing signature headers');
      return;
    }
    if (!rawBody) {
      logger.warn('payment.webhook.portone', 'rawBody 없음 (express.json verify 콜백 미설정?)');
      res.status(400).send('empty body');
      return;
    }
    if (!portone.verifyWebhookSignature(rawBody, headers)) {
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
            raw: sanitizePortOneRaw(payment),
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

// Google Pub/Sub OIDC JWT 검증용 — module-level singleton 으로 JWK 캐시 재사용.
const googleOAuthClient = new OAuth2Client();

/**
 * Google Pub/Sub Push subscription 인증 검증.
 * Pub/Sub 는 Authorization: Bearer <OIDC JWT> 헤더로 호출하고, JWT 의 audience 는
 * subscription 생성 시 명시한 oidc_token.audience 와 일치한다.
 *
 * fail-closed: GOOGLE_PUBSUB_AUDIENCE 미설정이거나 토큰 검증 실패 시 false.
 */
async function verifyGooglePubSubAuth(req: Request): Promise<boolean> {
  if (!env.GOOGLE_PUBSUB_AUDIENCE) {
    logger.warn('payment.webhook.google', 'GOOGLE_PUBSUB_AUDIENCE 미설정 — 모든 Google webhook 거부 (fail-closed)');
    return false;
  }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_PUBSUB_AUDIENCE,
    });
    const payload = ticket.getPayload();
    if (!payload) return false;
    // 선택: SA email 검증 (설정된 경우만)
    if (env.GOOGLE_PUBSUB_SA_EMAIL && payload.email !== env.GOOGLE_PUBSUB_SA_EMAIL) {
      logger.warn('payment.webhook.google', `SA email 불일치: ${payload.email} ≠ ${env.GOOGLE_PUBSUB_SA_EMAIL}`);
      return false;
    }
    return true;
  } catch (e) {
    logger.warn('payment.webhook.google', `OIDC 검증 실패: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// 7. Webhook — Google Real-Time Developer Notification (Pub/Sub)
// ─────────────────────────────────────────────────────────
router.post('/webhook/google', async (req: Request, res: Response) => {
  try {
    // OIDC JWT 검증 — Pub/Sub Push 가 첨부한 Bearer 토큰 확인.
    // 미통과 시 401 — 누구나 임의 데이터로 사용자 구독 상태 조작하는 것을 차단.
    if (!(await verifyGooglePubSubAuth(req))) {
      res.status(401).send('unauthorized');
      return;
    }

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
    // 실패 시 500 반환 → Pub/Sub 이 재시도하여 결제 유실 방지
    const verify = await googlePlay.verifyGooglePurchase(sub.purchaseToken, sub.subscriptionId);
    if (verify.ok && verify.sub) {
      const snap = await collections.payments
        .where('purchaseToken', '==', sub.purchaseToken)
        .limit(1)
        .get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        const state = verify.sub.state;
        const isActive = state.includes('ACTIVE') || state.includes('GRACE');
        // RTDN notificationType: 12 = SUBSCRIPTION_REVOKED (환불/즉시회수), 13 = SUBSCRIPTION_EXPIRED
        const isRevoked = sub.notificationType === 12;

        await doc.ref.update({
          status: isActive ? 'PAID' : 'CANCELLED',
          expiresAt: verify.sub.expiryTime,
          webhookVerifiedAt: new Date().toISOString(),
          raw: sanitizeGoogleRaw(verify.sub.raw),
          updatedAt: new Date().toISOString(),
        });

        const userId = doc.data().userId as string | undefined;
        if (userId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const userUpdate: Record<string, any> = {
            subscriptionAutoRenew: verify.sub.autoRenewing ?? false,
          };
          if (isRevoked) {
            // 환불 → 즉시 권한 회수
            userUpdate.subscriptionTier = 'FREE';
            userUpdate.premiumExpiresAt = new Date().toISOString();
          } else if (!isActive) {
            // 만료 / 취소 (잔여 기간 종료) → FREE
            userUpdate.subscriptionTier = 'FREE';
            if (verify.sub.expiryTime) userUpdate.premiumExpiresAt = verify.sub.expiryTime;
          } else if (verify.sub.expiryTime) {
            // ACTIVE/GRACE: 만료일 갱신만
            userUpdate.premiumExpiresAt = verify.sub.expiryTime;
          }
          await collections.users.doc(userId).update(userUpdate);
        }
      }
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
//
// 보안 전략:
//   Apple JWS 의 정석 검증은 Apple Root CA 4개로 인증서 체인을 따라가야 하는데
//   (@apple/app-store-server-library 권장), 출시 전 단계에서 라이브러리 도입 +
//   인증서 관리 부담이 큼. 대신 Google webhook 과 동일한 안전 패턴 적용:
//
//     1) signedTransactionInfo 디코딩 (서명 검증 없이 originalTransactionId 만 추출)
//     2) Apple App Store Server API 에 직접 조회 → 진위 검증
//        - 위조된 originalTransactionId 는 Apple API 가 거부 (404)
//        - 실제 구독 상태(만료일, autoRenew, productId)를 Apple 응답으로 동기화
//     3) Apple API 응답을 신뢰 (notificationType 은 무시 — 가짜 webhook 으로
//        EXPIRED 마크하는 것 차단)
//
// 향후 강화: @apple/app-store-server-library 도입 후 JWS 서명 검증 + Apple Root CA
//          체인 검증 추가 (별도 PR).
router.post('/webhook/apple', async (req: Request, res: Response) => {
  try {
    if (!isAppleIAPAvailable()) {
      // Apple App Store Server API 키 미설정 → 진위 검증 불가능 → 거부
      logger.warn('payment.webhook.apple', 'Apple IAP 키 미설정 — webhook 거부 (fail-closed)');
      res.status(503).send('apple-iap-not-configured');
      return;
    }

    const signedPayload = (req.body as { signedPayload?: string })?.signedPayload;
    if (!signedPayload) {
      res.status(400).send('no-payload');
      return;
    }
    const parts = signedPayload.split('.');
    if (parts.length !== 3) {
      res.status(400).send('bad-jws');
      return;
    }

    // JWS 서명 검증 (Apple 공식 정석) — 검증 실패 시 401.
    // 라이브러리 init 실패 시 verified=false 로 통과 (기존 API 재조회 폴백).
    const jwsResult = await appleJws.verifyAppleNotificationPayload(signedPayload);
    if (!jwsResult.ok) {
      logger.warn('payment.webhook.apple', `JWS 검증 실패 reason=${jwsResult.reason}`);
      res.status(401).send('jws-invalid');
      return;
    }
    if (!jwsResult.verified) {
      logger.info('payment.webhook.apple', `JWS unverified (lib unavailable) — fallback to API recheck`);
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      notificationType?: string;
      subtype?: string;
      data?: { signedTransactionInfo?: string; bundleId?: string; environment?: string };
    };
    logger.info(
      'payment.webhook.apple',
      `${payload.notificationType ?? 'unknown'} / ${payload.subtype ?? ''} env=${payload.data?.environment ?? '?'}`,
    );

    // bundleId 확인 — 다른 앱의 webhook 이 잘못 들어오는 케이스 차단
    if (payload.data?.bundleId && payload.data.bundleId !== env.APPLE_BUNDLE_ID) {
      logger.warn('payment.webhook.apple', `bundleId 불일치: ${payload.data.bundleId} ≠ ${env.APPLE_BUNDLE_ID}`);
      res.status(400).send('bundle-mismatch');
      return;
    }

    const tx = payload.data?.signedTransactionInfo;
    if (!tx) {
      // 일부 notification type 은 transaction 정보 없음 (예: TEST) — 200 OK
      res.status(200).send('no-transaction');
      return;
    }
    const txParts = tx.split('.');
    if (txParts.length !== 3) {
      res.status(400).send('bad-tx-jws');
      return;
    }
    const txPayload = JSON.parse(Buffer.from(txParts[1], 'base64url').toString('utf8')) as {
      originalTransactionId?: string;
      productId?: string;
    };
    const originalId = txPayload.originalTransactionId;
    if (!originalId) {
      res.status(400).send('no-original-tx-id');
      return;
    }

    // 핵심: Apple API 재조회로 진위 검증 + 실제 상태 가져오기
    let appleStatus: Awaited<ReturnType<typeof appleIap.getSubscriptionStatus>>;
    try {
      appleStatus = await appleIap.getSubscriptionStatus(originalId);
    } catch (e) {
      logger.warn(
        'payment.webhook.apple',
        `Apple API 조회 실패 — 위조된 originalId 가능성: ${e instanceof Error ? e.message : String(e)}`,
      );
      res.status(401).send('apple-api-rejected');
      return;
    }

    const snap = await collections.payments
      .where('originalTransactionId', '==', originalId)
      .limit(1)
      .get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      await doc.ref.update({
        status: appleStatus.active ? 'PAID' : 'CANCELLED',
        expiresAt: appleStatus.expiresAt?.toISOString() ?? null,
        webhookVerifiedAt: new Date().toISOString(),
        raw: sanitizeAppleRaw(appleStatus.raw),
        updatedAt: new Date().toISOString(),
      });
      const userId = doc.data().userId as string | undefined;
      if (userId && appleStatus.expiresAt) {
        await collections.users.doc(userId).update({
          premiumExpiresAt: appleStatus.expiresAt.toISOString(),
          subscriptionAutoRenew: appleStatus.autoRenew ?? false,
        });
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

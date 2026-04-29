/**
 * PortOne V2 API 클라이언트
 *
 * 공식 문서: https://developers.portone.io/api/rest-v2
 *
 * 우리가 쓰는 엔드포인트:
 *  - GET    /payments/{paymentId}                          — 결제 단건 조회 (검증)
 *  - POST   /payments/{paymentId}/cancel                   — 결제 취소
 *  - POST   /billing-keys/{billingKey}/payment             — 빌링키로 자동결제
 *  - POST   /billing-keys                                  — 빌링키 발급 (웹훅 또는 SDK 통해)
 *
 * 인증: Authorization: PortOne <API_SECRET>
 */

import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const PORTONE_BASE = 'https://api.portone.io';

interface PortOnePayment {
  id: string;                          // 결제 건 ID (paymentId)
  status: 'PENDING' | 'READY' | 'PAID' | 'FAILED' | 'CANCELLED' | 'PARTIAL_CANCELLED' | 'VIRTUAL_ACCOUNT_ISSUED';
  storeId: string;
  channel: { type: 'LIVE' | 'TEST'; id: string; key: string; name: string };
  method?: { type: string; provider?: string };
  amount: { total: number; paid?: number; cancelled?: number; refund?: number };
  currency: string;                    // 'KRW'
  paidAt?: string;                     // ISO
  cancelledAt?: string;
  customer?: { id?: string; name?: { full?: string } };
  customData?: string;                 // 우리가 결제 요청 시 넣은 메타데이터 (JSON string)
  orderName: string;
  // ... 기타
  [key: string]: unknown;
}

class PortOneApiError extends Error {
  constructor(public statusCode: number, public body: string) {
    super(`PortOne API ${statusCode}: ${body.substring(0, 200)}`);
  }
}

async function callPortOne<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.PORTONE_API_SECRET) {
    throw new Error('PORTONE_API_SECRET 환경변수 미설정');
  }
  const res = await fetch(`${PORTONE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `PortOne ${env.PORTONE_API_SECRET}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    logger.warn('portone.client', `${path} 실패 ${res.status} ${text.substring(0, 300)}`);
    throw new PortOneApiError(res.status, text);
  }
  return JSON.parse(text) as T;
}

/** 결제 단건 조회 (검증용) */
export async function getPayment(paymentId: string): Promise<PortOnePayment> {
  return callPortOne<PortOnePayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/** 결제가 PAID 상태이고 금액·상품이 일치하는지 검증 */
export interface VerifyExpect {
  expectedAmount: number;
  expectedCurrency: 'KRW';
  expectedOrderName?: string;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  payment?: PortOnePayment;
}

export async function verifyPayment(
  paymentId: string,
  expect: VerifyExpect,
): Promise<VerifyResult> {
  let payment: PortOnePayment;
  try {
    payment = await getPayment(paymentId);
  } catch (e) {
    return { ok: false, reason: 'fetch_failed: ' + String(e) };
  }
  if (payment.status !== 'PAID') {
    return { ok: false, reason: 'status_not_paid:' + payment.status, payment };
  }
  if (payment.currency !== expect.expectedCurrency) {
    return { ok: false, reason: 'currency_mismatch:' + payment.currency, payment };
  }
  if (payment.amount.total !== expect.expectedAmount) {
    return {
      ok: false,
      reason: `amount_mismatch:expected=${expect.expectedAmount} got=${payment.amount.total}`,
      payment,
    };
  }
  if (expect.expectedOrderName && payment.orderName !== expect.expectedOrderName) {
    return {
      ok: false,
      reason: `order_name_mismatch:expected=${expect.expectedOrderName} got=${payment.orderName}`,
      payment,
    };
  }
  return { ok: true, payment };
}

/** 결제 취소 (전액 또는 부분) */
export async function cancelPayment(
  paymentId: string,
  reason: string,
  amount?: number,
): Promise<PortOnePayment> {
  const body: Record<string, unknown> = { reason };
  if (amount && amount > 0) body.amount = amount;
  return callPortOne<PortOnePayment>(`/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 빌링키로 자동결제 — 정기결제(매월/매년 자동 갱신) */
export interface BillingChargeArgs {
  billingKey: string;
  paymentId: string;     // 우리가 생성한 unique paymentId
  orderName: string;
  amount: number;
  currency?: 'KRW';
  customerId?: string;
  customData?: Record<string, unknown>;
}

export async function chargeWithBillingKey(args: BillingChargeArgs): Promise<PortOnePayment> {
  const { billingKey, paymentId, orderName, amount, currency = 'KRW', customerId, customData } = args;
  return callPortOne<PortOnePayment>(`/payments/${encodeURIComponent(paymentId)}/billing-key`, {
    method: 'POST',
    body: JSON.stringify({
      billingKey,
      orderName,
      amount: { total: amount },
      currency,
      ...(customerId ? { customer: { id: customerId } } : {}),
      ...(customData ? { customData: JSON.stringify(customData) } : {}),
    }),
  });
}

/** 빌링키 단건 조회 (유효성 확인) */
export async function getBillingKey(billingKey: string): Promise<{ status: string; channels?: unknown[] }> {
  return callPortOne(`/billing-keys/${encodeURIComponent(billingKey)}`);
}

/** 빌링키 삭제 (정기결제 해지) */
export async function deleteBillingKey(billingKey: string, reason: string): Promise<void> {
  await callPortOne(`/billing-keys/${encodeURIComponent(billingKey)}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Webhook 서명 검증 (PortOne v2)
 * — 받은 헤더 'webhook-signature', 'webhook-id', 'webhook-timestamp'를
 *   Standard Webhooks 사양에 따라 HMAC-SHA256 검증
 */
import * as crypto from 'crypto';

export function verifyWebhookSignature(
  rawBody: string,
  headers: { id: string; timestamp: string; signature: string },
): boolean {
  if (!env.PORTONE_WEBHOOK_SECRET) {
    logger.warn('portone.client', 'PORTONE_WEBHOOK_SECRET 미설정 — 서명 검증 스킵 (개발용만)');
    return true;
  }
  // PortOne 시크릿 형식: 'whsec_BASE64' — base64 디코드 필요
  const secretRaw = env.PORTONE_WEBHOOK_SECRET.startsWith('whsec_')
    ? env.PORTONE_WEBHOOK_SECRET.slice(6)
    : env.PORTONE_WEBHOOK_SECRET;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretRaw, 'base64');
  } catch {
    secretBytes = Buffer.from(secretRaw, 'utf8');
  }
  const signedPayload = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedPayload).digest('base64');

  // signature 헤더 형식: 'v1,BASE64 v1,BASE64 ...' 공백으로 구분된 여러 시그니처 가능
  const provided = headers.signature.split(' ');
  for (const item of provided) {
    const [, sig] = item.split(',');
    if (sig && timingSafeEq(sig, expected)) return true;
  }
  return false;
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Apple App Store Server API — 영수증/거래 검증
 *
 * 공식 문서: https://developer.apple.com/documentation/appstoreserverapi
 *
 * 흐름:
 *  1. 클라이언트가 StoreKit 2로 결제 후 transactionId 또는 originalTransactionId 전송
 *  2. 서버가 App Store Server API로 거래 정보 조회 → JWS 검증
 *  3. status가 1(ACTIVE) 이면 PAID 인정
 *
 * 인증: ES256 JWT (issuer + key + .p8 private key)
 */

import * as crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const APPLE_API_BASE = 'https://api.storekit.itunes.apple.com'; // production
// const APPLE_API_BASE_SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com';

interface CachedToken {
  jwt: string;
  expiresAt: number;
}

let _tokenCache: CachedToken | null = null;

function getApplePrivateKey(): string {
  const raw = env.APPLE_PRIVATE_KEY;
  if (!raw) throw new Error('APPLE_PRIVATE_KEY 미설정');
  // .p8 파일은 -----BEGIN PRIVATE KEY----- 로 시작. \n이 \\n으로 escape 되어 있을 수 있음
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

function generateAppleJwt(): string {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.jwt;
  }
  if (!env.APPLE_ISSUER_ID || !env.APPLE_KEY_ID) {
    throw new Error('APPLE_ISSUER_ID 또는 APPLE_KEY_ID 미설정');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: env.APPLE_KEY_ID, typ: 'JWT' };
  const payload = {
    iss: env.APPLE_ISSUER_ID,
    iat: now,
    exp: now + 3600,
    aud: 'appstoreconnect-v1',
    bid: env.APPLE_BUNDLE_ID,
  };
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signingInput = `${enc(header)}.${enc(payload)}`;

  const privateKey = crypto.createPrivateKey({
    key: getApplePrivateKey(),
    format: 'pem',
  });
  const signature = crypto
    .sign(null, Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');

  const jwt = `${signingInput}.${signature}`;
  _tokenCache = { jwt, expiresAt: Date.now() + (3600 - 60) * 1000 };
  return jwt;
}

interface JwsTransactionDecoded {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  type: string; // 'Auto-Renewable Subscription' 등
  bundleId: string;
  inAppOwnershipType?: string;
  [key: string]: unknown;
}

interface JwsRenewalInfoDecoded {
  autoRenewStatus: number; // 0 = off, 1 = on
  expirationIntent?: number;
  isInBillingRetryPeriod?: boolean;
  productId: string;
  [key: string]: unknown;
}

interface SubscriptionStatusResponse {
  data?: Array<{
    subscriptionGroupIdentifier: string;
    lastTransactions: Array<{
      status: number; // 1 = ACTIVE, 2 = EXPIRED, 3 = RETRY, 4 = GRACE, 5 = REVOKED
      originalTransactionId: string;
      signedTransactionInfo: string; // JWS
      signedRenewalInfo: string;     // JWS
    }>;
  }>;
}

/**
 * 거래 상태 조회 (originalTransactionId 기반)
 * — 자동갱신 구독은 originalTransactionId가 사용자 구독 그룹의 고유 ID로 평생 유지됨
 */
export async function getSubscriptionStatus(originalTransactionId: string): Promise<{
  active: boolean;
  status: number;
  expiresAt?: Date;
  productId?: string;
  autoRenew?: boolean;
  raw?: unknown;
}> {
  const jwt = generateAppleJwt();
  const url = `${APPLE_API_BASE}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  const text = await res.text();
  if (!res.ok) {
    // 404 = sandbox 거래일 가능성 → sandbox 재시도
    if (res.status === 404) {
      const sandboxRes = await fetch(
        `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      if (sandboxRes.ok) {
        const sandboxText = await sandboxRes.text();
        return parseStatusResponse(JSON.parse(sandboxText) as SubscriptionStatusResponse);
      }
    }
    logger.warn('apple-iap.client', `subscription status ${res.status}: ${text.substring(0, 300)}`);
    throw new Error('Apple subscription 조회 실패: ' + res.status);
  }
  return parseStatusResponse(JSON.parse(text) as SubscriptionStatusResponse);
}

function parseStatusResponse(data: SubscriptionStatusResponse): {
  active: boolean;
  status: number;
  expiresAt?: Date;
  productId?: string;
  autoRenew?: boolean;
  raw?: unknown;
} {
  const tx = data.data?.[0]?.lastTransactions?.[0];
  if (!tx) return { active: false, status: 0 };
  const txInfo = decodeJws<JwsTransactionDecoded>(tx.signedTransactionInfo);
  const renewInfo = decodeJws<JwsRenewalInfoDecoded>(tx.signedRenewalInfo);
  return {
    active: tx.status === 1 || tx.status === 4, // ACTIVE 또는 GRACE
    status: tx.status,
    expiresAt: txInfo?.expiresDate ? new Date(txInfo.expiresDate) : undefined,
    productId: txInfo?.productId,
    autoRenew: renewInfo?.autoRenewStatus === 1,
    raw: { txInfo, renewInfo },
  };
}

/** JWS payload만 디코딩 (서명 검증은 별도 — 실제 운영 시 Apple root cert로 검증 권장) */
function decodeJws<T>(jws: string): T | null {
  try {
    const parts = jws.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

/** 거래 검증 — productId가 일치하고 active 상태인지 */
export async function verifyAppleTransaction(
  originalTransactionId: string,
  expectedProductId: string,
): Promise<{ ok: boolean; reason?: string; sub?: Awaited<ReturnType<typeof getSubscriptionStatus>> }> {
  let sub: Awaited<ReturnType<typeof getSubscriptionStatus>>;
  try {
    sub = await getSubscriptionStatus(originalTransactionId);
  } catch (e) {
    return { ok: false, reason: 'fetch_failed: ' + String(e) };
  }
  if (sub.productId && sub.productId !== expectedProductId) {
    return { ok: false, reason: `product_mismatch:expected=${expectedProductId} got=${sub.productId}`, sub };
  }
  if (!sub.active) {
    return { ok: false, reason: `inactive_status:${sub.status}`, sub };
  }
  return { ok: true, sub };
}

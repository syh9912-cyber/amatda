/**
 * Google Play Billing 영수증 검증
 *
 * 공식 문서: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
 *
 * 흐름:
 *  1. 클라이언트가 Google Play 결제 후 receipt(purchaseToken) + productId 전송
 *  2. 서버가 Google Play Developer API에 GET 요청 → 구독 상태 검증
 *  3. status가 SUBSCRIPTION_STATE_ACTIVE 이면 PAID로 인정, expiresAt 저장
 *
 * 인증: 서비스 계정 JSON으로 OAuth2 토큰 발급 → API 호출
 */

import { env } from '../../config/env';
import { logger } from '../../utils/logger';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let _serviceAccount: ServiceAccount | null = null;
let _tokenCache: CachedToken | null = null;

function getServiceAccount(): ServiceAccount {
  if (_serviceAccount) return _serviceAccount;
  const raw = env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON 환경변수 미설정');
  }
  try {
    _serviceAccount = JSON.parse(raw) as ServiceAccount;
  } catch (e) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON 파싱 실패: ' + String(e));
  }
  return _serviceAccount;
}

/** 서비스 계정 JWT → OAuth2 access token 발급 (캐싱 50분) */
async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.accessToken;
  }
  const sa = getServiceAccount();
  const jwt = await signServiceAccountJwt(sa);

  const tokenUrl = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error('Google OAuth2 토큰 발급 실패: ' + res.status + ' ' + text.substring(0, 200));
  }
  const data = JSON.parse(text) as { access_token: string; expires_in: number };
  _tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

import * as crypto from 'crypto';

async function signServiceAccountJwt(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(sa.private_key).toString('base64url');
  return `${signingInput}.${signature}`;
}

// ─── 구독 상태 조회 ───

export interface GoogleSubscriptionState {
  state: string; // SUBSCRIPTION_STATE_ACTIVE / IN_GRACE_PERIOD / ON_HOLD / PAUSED / CANCELED / EXPIRED / PENDING
  expiryTime?: string; // ISO
  autoRenewing?: boolean;
  productId: string;
  purchaseToken: string;
  raw: unknown;
}

export async function getSubscriptionV2(
  purchaseToken: string,
): Promise<GoogleSubscriptionState> {
  const token = await getAccessToken();
  const packageName = env.GOOGLE_PLAY_PACKAGE_NAME;
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    // 디버깅: 전체 응답 body + SA email + package name + token 만료 시각 로깅
    const saEmail = _serviceAccount?.client_email ?? 'unknown';
    const cachedExp = _tokenCache?.expiresAt
      ? new Date(_tokenCache.expiresAt).toISOString()
      : 'no-cache';
    logger.warn(
      'google-play.client',
      `subscriptionsv2 ${res.status} url=${url.replace(purchaseToken, 'TOKEN')} sa=${saEmail} tokenExp=${cachedExp} body=${text.substring(0, 1000)}`,
    );
    throw new Error('Google subscription 조회 실패: ' + res.status);
  }
  const data = JSON.parse(text) as {
    subscriptionState?: string;
    lineItems?: Array<{ productId?: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: boolean } }>;
  };

  const lineItem = data.lineItems?.[0];
  return {
    state: data.subscriptionState ?? 'UNKNOWN',
    expiryTime: lineItem?.expiryTime,
    autoRenewing: lineItem?.autoRenewingPlan?.autoRenewEnabled,
    productId: lineItem?.productId ?? '',
    purchaseToken,
    raw: data,
  };
}

/** 구매(영수증)가 활성 상태인지 검증 */
export async function verifyGooglePurchase(
  purchaseToken: string,
  expectedProductId: string,
): Promise<{ ok: boolean; reason?: string; sub?: GoogleSubscriptionState }> {
  let sub: GoogleSubscriptionState;
  try {
    sub = await getSubscriptionV2(purchaseToken);
  } catch (e) {
    return { ok: false, reason: 'fetch_failed: ' + String(e) };
  }
  if (sub.productId && sub.productId !== expectedProductId) {
    return { ok: false, reason: `product_mismatch:expected=${expectedProductId} got=${sub.productId}`, sub };
  }
  const validStates = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'];
  if (!validStates.includes(sub.state)) {
    return { ok: false, reason: 'state_not_active:' + sub.state, sub };
  }
  return { ok: true, sub };
}

/**
 * Real-Time Developer Notification (RTDN) — Pub/Sub로 받는 결제 이벤트
 * 이벤트: SUBSCRIPTION_RENEWED, SUBSCRIPTION_CANCELED, SUBSCRIPTION_EXPIRED 등
 */
export interface RTDNNotification {
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    notificationType: number; // 1~13
    purchaseToken: string;
    subscriptionId: string;
  };
}

export const RTDN_TYPES: Record<number, string> = {
  1: 'SUBSCRIPTION_RECOVERED',
  2: 'SUBSCRIPTION_RENEWED',
  3: 'SUBSCRIPTION_CANCELED',
  4: 'SUBSCRIPTION_PURCHASED',
  5: 'SUBSCRIPTION_ON_HOLD',
  6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
  7: 'SUBSCRIPTION_RESTARTED',
  8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
  9: 'SUBSCRIPTION_DEFERRED',
  10: 'SUBSCRIPTION_PAUSED',
  11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
  12: 'SUBSCRIPTION_REVOKED',
  13: 'SUBSCRIPTION_EXPIRED',
};

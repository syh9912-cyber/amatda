/**
 * 결제 통합 facade — IAP(Google/Apple) + PortOne(외부결제)
 *
 * 사용:
 *   - IAP: purchaseIAP('premium_monthly')
 *   - PortOne: getPortOneCheckoutParams('premium_monthly', 'kakaopay') → WebView 모달 → onResult
 *
 * IAP 검증/PortOne 검증 모두 서버 paymentApi.* 가 처리.
 * 클라이언트는 영수증/paymentId를 서버에 넘겨 검증만 트리거.
 */

import { Platform } from 'react-native';
import { paymentApi } from './api';
import type { PortOneCheckoutParams } from '../components/payment/PortOneWebView';

// expo-iap 네이티브 모듈은 새 EAS 빌드에서만 사용 가능.
// 기존 OTA로 배포된 앱이 이 파일을 import 해도 크래시 안 나도록 동적 로딩.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadIAP(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-iap');
  } catch {
    return null;
  }
}

// Google Play Billing client 는 initConnection() 호출 후 ready 상태가 됨.
// 미호출 시 "Billing client not ready" 에러. 호출 누락 방지 위해 lazy 보장.
let _iapInitialized = false;
let _iapInitPromise: Promise<void> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureIAPInitialized(IAP: any): Promise<void> {
  if (_iapInitialized) return;
  if (!_iapInitPromise) {
    _iapInitPromise = (async () => {
      try {
        if (typeof IAP.initConnection === 'function') {
          await IAP.initConnection();
        }
        _iapInitialized = true;
      } catch (e) {
        _iapInitPromise = null; // 다음 호출에 재시도
        throw e;
      }
    })();
  }
  await _iapInitPromise;
}

// ─── 상품 정의 (백엔드 PRODUCTS와 동일) ───
export type ProductId = 'premium_monthly' | 'premium_yearly';

export const PRODUCT_INFO: Record<ProductId, { name: string; price: number }> = {
  premium_monthly: { name: '아맞다 VIP 월간', price: 3900 },
  premium_yearly: { name: '아맞다 VIP 연간', price: 39900 },
};

// ─── PortOne 환경 (앱 빌드 시 EAS env에서 주입) ───
//  PORTONE_STORE_ID / PORTONE_CHANNEL_KEY_* 는 공개 가능 (서버 시크릿과 별개)
import Constants from 'expo-constants';

interface PortOneEnv {
  storeId: string;
  channelKeyToss: string;
  channelKeyKakao: string;
  channelKeyNaver: string;
}

function getPortOneEnv(): PortOneEnv {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return {
    storeId: extra.PORTONE_STORE_ID ?? process.env.EXPO_PUBLIC_PORTONE_STORE_ID ?? '',
    channelKeyToss:
      extra.PORTONE_CHANNEL_KEY_TOSS ?? process.env.EXPO_PUBLIC_PORTONE_CHANNEL_KEY_TOSS ?? '',
    channelKeyKakao:
      extra.PORTONE_CHANNEL_KEY_KAKAO ?? process.env.EXPO_PUBLIC_PORTONE_CHANNEL_KEY_KAKAO ?? '',
    channelKeyNaver:
      extra.PORTONE_CHANNEL_KEY_NAVER ?? process.env.EXPO_PUBLIC_PORTONE_CHANNEL_KEY_NAVER ?? '',
  };
}

export type PaymentMethod =
  | 'iap'           // 플랫폼 기본 IAP (Google/Apple)
  | 'card'          // PortOne 카드 (토스페이먼츠)
  | 'kakaopay'
  | 'naverpay'
  | 'tosspay'
  | 'transfer'      // 계좌이체
  | 'virtual_account'; // 가상계좌

export interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  available: boolean;
  badge?: string;
  description?: string;
}

export function getPaymentMethodOptions(): PaymentMethodOption[] {
  const env = getPortOneEnv();
  // iOS는 Apple 정책상 IAP 외 외부결제 금지 — PortOne 옵션 완전 차단
  const portOneAvailable = Platform.OS !== 'ios' && !!env.storeId;
  const iapLabel = Platform.OS === 'ios' ? 'Apple App Store' : 'Google Play';
  return [
    { id: 'iap', label: iapLabel, available: true, description: '플랫폼 자동 결제 (권장)' },
    { id: 'kakaopay', label: '카카오페이', available: portOneAvailable && !!env.channelKeyKakao },
    { id: 'naverpay', label: '네이버페이', available: portOneAvailable && !!env.channelKeyNaver },
    { id: 'tosspay', label: '토스페이', available: portOneAvailable && !!env.channelKeyToss },
    { id: 'card', label: '신용/체크카드', available: portOneAvailable && !!env.channelKeyToss },
    { id: 'transfer', label: '계좌이체', available: portOneAvailable && !!env.channelKeyToss },
  ];
}

// ─── PortOne 결제 파라미터 빌더 ───
function pickChannelKey(method: PaymentMethod, env: PortOneEnv): string {
  switch (method) {
    case 'kakaopay':
      return env.channelKeyKakao;
    case 'naverpay':
      return env.channelKeyNaver;
    case 'tosspay':
      return env.channelKeyToss;
    case 'card':
    case 'transfer':
    case 'virtual_account':
    default:
      return env.channelKeyToss; // 토스페이먼츠 PG로 처리
  }
}

function pickPayMethod(method: PaymentMethod): PortOneCheckoutParams['payMethod'] {
  switch (method) {
    case 'kakaopay':
    case 'naverpay':
    case 'tosspay':
      return 'EASY_PAY';
    case 'transfer':
      return 'TRANSFER';
    case 'virtual_account':
      return 'VIRTUAL_ACCOUNT';
    case 'card':
    default:
      return 'CARD';
  }
}

export interface BuildCheckoutOptions {
  productId: ProductId;
  method: Exclude<PaymentMethod, 'iap'>;
  /** 자동결제 빌링키 발급 모드 (정기결제) */
  asBillingKey?: boolean;
  customerId?: string;
  customerName?: string;
}

export function buildPortOneCheckoutParams(opts: BuildCheckoutOptions): PortOneCheckoutParams | null {
  const env = getPortOneEnv();
  const channelKey = pickChannelKey(opts.method, env);
  if (!env.storeId || !channelKey) return null;
  const product = PRODUCT_INFO[opts.productId];
  return {
    storeId: env.storeId,
    channelKey,
    paymentId: `pay_${opts.productId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderName: product.name,
    amount: product.price,
    payMethod: pickPayMethod(opts.method),
    type: opts.asBillingKey ? 'billingKey' : 'payment',
    customerId: opts.customerId,
    customerName: opts.customerName,
  };
}

// ─── IAP — Google/Apple 인앱결제 ───

/** IAP 사용 가능 여부 (현재 빌드에 expo-iap 네이티브 모듈이 있는지) */
export function isIAPSupported(): boolean {
  return loadIAP() !== null;
}

/** IAP 연결 초기화 (앱 진입 시 1회 호출 권장) */
export async function initIAP(): Promise<void> {
  const IAP = loadIAP();
  if (!IAP) return;
  await IAP.initConnection();
}

/** IAP 연결 종료 */
export async function endIAP(): Promise<void> {
  const IAP = loadIAP();
  if (!IAP) return;
  await IAP.endConnection();
}

/** 구독 상품 조회 (가격 표시용). expo-iap 4.x: fetchProducts({skus, type}) */
export async function fetchIAPSubscriptions(): Promise<unknown[]> {
  const IAP = loadIAP();
  if (!IAP) return [];
  const skus = ['premium_monthly', 'premium_yearly'];
  try {
    await ensureIAPInitialized(IAP);
    if (typeof IAP.fetchProducts === 'function') {
      return (await IAP.fetchProducts({ skus, type: 'subs' })) as unknown[];
    }
    // legacy fallback (expo-iap <4.x)
    if (typeof IAP.getSubscriptions === 'function') {
      return (await IAP.getSubscriptions({ skus })) as unknown[];
    }
  } catch {
    /* swallow — empty list 반환 */
  }
  return [];
}

/**
 * Android Google Play Billing v5+: subscription 구매 시 offerToken 필수.
 * fetchProducts 결과에서 첫 번째 base plan offer 의 token 추출.
 */
function extractGoogleOfferToken(sub: unknown, productId: string): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = sub as any;
  const offers =
    s?.subscriptionOfferDetailsAndroid ??
    s?.subscriptionOfferDetails ??
    [];
  if (!Array.isArray(offers) || offers.length === 0) return null;
  // 첫 번째 offer (보통 base plan)의 token 반환
  // 향후 무료 체험 offer 우선순위 분기 가능
  const offer = offers[0];
  return offer?.offerToken ?? null;
}

/**
 * IAP 구매 복원 (Apple/Google 기기 변경 or 재설치 후 사용)
 * — 과거 구매 목록을 조회해 서버 재검증 → 구독 상태 복원
 */
export async function restoreIAP(): Promise<{ ok: boolean; message?: string }> {
  const IAP = loadIAP();
  if (!IAP) return { ok: false, message: '인앱결제 기능을 사용할 수 없습니다.' };

  let purchases: unknown[];
  try {
    await ensureIAPInitialized(IAP);
    purchases = (await IAP.getAvailablePurchases()) as unknown[];
  } catch (e) {
    return { ok: false, message: '구매 내역을 불러오지 못했습니다: ' + String(e) };
  }

  if (!purchases || purchases.length === 0) {
    return { ok: false, message: '복원할 구매 내역이 없습니다.' };
  }

  // 가장 최근 구독 구매를 서버에 재검증
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latest = purchases[0] as any;
  const purchaseToken: string | undefined = latest?.purchaseToken ?? latest?.purchaseTokenAndroid;
  const originalTransactionId: string | undefined =
    latest?.originalTransactionIdentifierIOS ?? latest?.originalTransactionId ?? latest?.transactionId;
  const productId: string | undefined = latest?.productId ?? latest?.productIds?.[0];

  try {
    await paymentApi.verifyIAP({
      platform: Platform.OS === 'ios' ? 'apple' : 'google',
      productId: (productId ?? 'premium_monthly') as ProductId,
      purchaseToken,
      originalTransactionId,
    });
    return { ok: true, message: '구매가 복원되었습니다.' };
  } catch {
    return { ok: false, message: '서버 검증에 실패했습니다. 잠시 후 다시 시도해주세요.' };
  }
}

/**
 * IAP 구독 구매 + 서버 검증
 * — 성공 시 서버가 영수증 검증하고 user.subscriptionTier=PAID 로 갱신
 */
export async function purchaseIAP(productId: ProductId): Promise<{
  ok: boolean;
  message?: string;
  expiresAt?: string;
}> {
  const IAP = loadIAP();
  if (!IAP) {
    return { ok: false, message: '인앱결제 기능은 다음 업데이트에서 사용 가능합니다.' };
  }

  // 0) Billing client connection 보장 (idempotent).
  //    "Billing client not ready" 에러 방지.
  try {
    await ensureIAPInitialized(IAP);
  } catch (e) {
    return { ok: false, message: 'IAP 연결 실패: ' + String(e) };
  }

  // 1) Android Google Play Billing v5+ 는 subscription 구매 시 offerToken 필수.
  //    먼저 상품 정보를 fetch 해 첫 base plan offer token 추출.
  //    iOS 는 offerToken 불필요 (Apple StoreKit 모델).
  let googleOfferToken: string | null = null;
  if (Platform.OS === 'android') {
    try {
      const fetched =
        typeof IAP.fetchProducts === 'function'
          ? await IAP.fetchProducts({ skus: [productId], type: 'subs' })
          : typeof IAP.getSubscriptions === 'function'
            ? await IAP.getSubscriptions({ skus: [productId] })
            : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr = (fetched as any[]) || [];
      const sub = arr.find((s) => s?.id === productId || s?.productId === productId) ?? arr[0];
      googleOfferToken = extractGoogleOfferToken(sub, productId);
      if (!googleOfferToken) {
        return {
          ok: false,
          message: '구독 상품 정보를 불러오지 못했습니다. Play Store 등록 상태를 확인해주세요.',
        };
      }
    } catch (e) {
      return { ok: false, message: '상품 조회 실패: ' + String(e) };
    }
  }

  // 2) 결제 요청 (네이티브 결제창 띄움). expo-iap 4.x platform 분기 형식.
  let purchase: unknown;
  try {
    if (typeof IAP.requestPurchase !== 'function') {
      return { ok: false, message: 'IAP 모듈이 초기화되지 않았습니다.' };
    }
    purchase = await IAP.requestPurchase({
      request: {
        apple: { sku: productId },
        google: {
          skus: [productId],
          subscriptionOffers: googleOfferToken
            ? [{ sku: productId, offerToken: googleOfferToken }]
            : [],
        },
      },
      type: 'subs',
    });
    // requestPurchase 가 Purchase[] 를 반환할 수 있음 → 첫 항목만 사용
    if (Array.isArray(purchase)) {
      purchase = purchase[0];
    }
    if (!purchase) {
      return { ok: false, message: '결제가 취소되었거나 응답을 받지 못했습니다.' };
    }
  } catch (e) {
    return { ok: false, message: 'IAP 결제 취소 또는 실패: ' + String(e) };
  }

  // 2) 영수증 토큰 추출
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = purchase as any;
  const purchaseToken: string | undefined = p?.purchaseToken ?? p?.purchaseTokenAndroid;
  const originalTransactionId: string | undefined =
    p?.originalTransactionIdentifierIOS ?? p?.originalTransactionId ?? p?.transactionId;

  if (Platform.OS === 'android' && !purchaseToken) {
    return { ok: false, message: '영수증 토큰을 찾을 수 없습니다.' };
  }
  if (Platform.OS === 'ios' && !originalTransactionId) {
    return { ok: false, message: '거래 ID를 찾을 수 없습니다.' };
  }

  // 3) 서버 검증 호출
  let verifyOk = false;
  let verifyData: { expiresAt?: string; message?: string } | undefined;
  try {
    const res = await paymentApi.verifyIAP({
      platform: Platform.OS === 'ios' ? 'apple' : 'google',
      productId,
      purchaseToken,
      originalTransactionId,
    });
    verifyData = res.data?.data as { expiresAt?: string; message?: string } | undefined;
    verifyOk = true;
  } catch (e) {
    // 서버 검증 실패 — finishTransaction은 아래서 반드시 호출 (트랜잭션 보류 방지)
    try { await IAP.finishTransaction({ purchase, isConsumable: false }); } catch { /* 무시 */ }
    // raw AxiosError 노출 금지 — 상태코드별 사용자 친화 메시지
    const status = (e as { response?: { status?: number } })?.response?.status;
    const message = status === 503
      ? '결제 서버를 일시적으로 사용할 수 없어요. 잠시 후 다시 시도해주세요.'
      : '결제 검증에 실패했어요. 잠시 후 다시 시도하거나 "구매 복원"을 눌러주세요.';
    return { ok: false, message };
  }

  // 4) 검증 성공 → 트랜잭션 finalize (Apple/Google 모두 필수)
  if (verifyOk) {
    try { await IAP.finishTransaction({ purchase, isConsumable: false }); } catch { /* 무시 */ }
  }

  return { ok: true, expiresAt: verifyData?.expiresAt, message: verifyData?.message };
}

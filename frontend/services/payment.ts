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
import * as IAP from 'expo-iap';
import { paymentApi } from './api';
import type { PortOneCheckoutParams } from '../components/payment/PortOneWebView';

// ─── 상품 정의 (백엔드 PRODUCTS와 동일) ───
export type ProductId = 'premium_monthly' | 'premium_yearly';

export const PRODUCT_INFO: Record<ProductId, { name: string; price: number }> = {
  premium_monthly: { name: '아맞다 VIP 월간', price: 3900 },
  premium_yearly: { name: '아맞다 VIP 연간', price: 33900 },
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
  const portOneAvailable = !!env.storeId;
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

/** IAP 연결 초기화 (앱 진입 시 1회 호출 권장) */
export async function initIAP(): Promise<void> {
  await IAP.initConnection();
}

/** IAP 연결 종료 */
export async function endIAP(): Promise<void> {
  await IAP.endConnection();
}

/** 구독 상품 조회 (가격 표시용) */
export async function fetchIAPSubscriptions(): Promise<unknown[]> {
  const skus = ['premium_monthly', 'premium_yearly'];
  // expo-iap v4 API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (IAP as any).getSubscriptions(skus)) as unknown[];
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
  // 1) 결제 요청 (네이티브 결제창 띄움)
  let purchase: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = IAP as any;
    if (typeof api.requestSubscription === 'function') {
      purchase = await api.requestSubscription({ sku: productId });
    } else if (typeof api.requestPurchase === 'function') {
      purchase = await api.requestPurchase({ sku: productId });
    } else {
      return { ok: false, message: 'IAP 모듈이 초기화되지 않았습니다.' };
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
  try {
    const res = await paymentApi.verifyIAP({
      platform: Platform.OS === 'ios' ? 'apple' : 'google',
      productId,
      purchaseToken,
      originalTransactionId,
    });
    const data = res.data?.data as { expiresAt?: string; message?: string } | undefined;

    // 4) 트랜잭션 finalize
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (IAP as any).finishTransaction({ purchase, isConsumable: false });
    } catch {
      // 무시 (서버는 이미 검증 완료)
    }

    return { ok: true, expiresAt: data?.expiresAt, message: data?.message };
  } catch (e) {
    return { ok: false, message: '서버 검증 실패: ' + String(e) };
  }
}

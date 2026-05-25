/**
 * Firebase Analytics 래퍼 — 운영 KPI 측정용.
 *
 * - fire-and-forget: 실패해도 사용자 흐름 차단 X
 * - 동적 require: native module 없는 dev/Expo Go 에서 크래시 방지
 * - PII 차단: 이메일/이름 등 절대 전송 X (userId hash 만)
 *
 * 사용:
 *   import { analytics } from './services/analytics';
 *   analytics.logScreen('home');
 *   analytics.logSubscriptionStart('yearly');
 *   analytics.setUserId(userId);
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _analyticsModule: any | null | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAnalytics(): any | null {
  if (_analyticsModule !== undefined) return _analyticsModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/analytics');
    _analyticsModule = mod.default ?? mod;
  } catch {
    _analyticsModule = null;
  }
  return _analyticsModule;
}

function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return fn().catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

export const analytics = {
  /** 화면 진입 추적 — expo-router navigation 시 호출 */
  logScreen(screenName: string, screenClass?: string): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() =>
      a().logScreenView({ screen_name: screenName, screen_class: screenClass ?? screenName }),
    );
  },

  /** 로그인 — method: 'email' | 'kakao' | 'naver' | 'google' | 'apple' */
  logLogin(method: string): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() => a().logLogin({ method }));
  },

  /** 회원가입 */
  logSignUp(method: string): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() => a().logSignUp({ method }));
  },

  /** 무료 체험 시작 */
  logTrialStart(): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() => a().logEvent('trial_start', {}));
  },

  /** 구독 결제 시작 — Apple/Google 결제 시트 진입 시점 */
  logSubscriptionStart(plan: 'monthly' | 'yearly', method: 'iap' | 'card'): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() => a().logEvent('begin_checkout', { plan, payment_method: method }));
  },

  /** 결제 완료 (서버 검증 성공 후) */
  logPurchase(plan: 'monthly' | 'yearly', priceKRW: number): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() =>
      a().logEvent('purchase', {
        value: priceKRW,
        currency: 'KRW',
        items: [{ item_id: plan === 'yearly' ? 'premium_yearly' : 'premium_monthly', item_name: plan }],
      }),
    );
  },

  /** 구독 해지 / 환불 */
  logRefund(plan: 'monthly' | 'yearly'): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() => a().logEvent('refund', { plan }));
  },

  /** AI 코칭 메시지 전송 (DAU 행동 지표) */
  logCoachingMessage(category?: string): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() => a().logEvent('coaching_message_sent', { category: category ?? 'general' }));
  },

  /** 자녀 등록 */
  logChildRegistered(ageGroup: 'pregnant' | 'infant' | 'toddler' | 'preschool' | 'elementary'): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() => a().logEvent('child_registered', { age_group: ageGroup }));
  },

  /** 사용자 ID 설정 — userId (Firestore doc id) 만 전송. 이메일/이름 X. */
  setUserId(userId: string | null): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() => a().setUserId(userId));
  },

  /** 사용자 속성 — 예: subscription_tier, parent_role */
  setUserProperty(key: string, value: string | null): void {
    const a = getAnalytics();
    if (!a) return;
    void safe(() => a().setUserProperty(key, value));
  },
};

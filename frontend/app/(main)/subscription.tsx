import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  TextInput,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { Stack } from 'expo-router';
import { BackButton } from '../../components/common/BackButton';
import { premiumApi, paymentApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import {
  PortOneWebView,
  type PortOneCheckoutParams,
  type PortOneResult,
} from '../../components/payment/PortOneWebView';
import {
  buildPortOneCheckoutParams,
  getPaymentMethodOptions,
  purchaseIAP,
  restoreIAP,
  fetchLocalizedPrices,
  type PaymentMethod,
  type ProductId,
  type LocalizedProductPrice,
} from '../../services/payment';
import { analytics } from '../../services/analytics';

const IC_PREMIUM = require('../../assets/premium-badge.png') as ImageSourcePropType;
const IC_CLOCK = require('../../assets/contraction-clock.png') as ImageSourcePropType;
const IC_RIBBON = require('../../assets/preg-ribbon.png') as ImageSourcePropType;

interface PremiumPlan {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  period: 'monthly' | 'yearly';
  features: string[];
  badge?: string;
  discount?: string;
}

interface PremiumStatus {
  tier: 'FREE' | 'PAID';
  trialDaysLeft?: number;
  trialUsed?: boolean;
  currentPlanId?: string;
  expiresAt?: string;
}

const getFallbackPlans = (t: TFunction): PremiumPlan[] => [
  {
    id: 'monthly',
    name: t('subscription.plan.monthlyName'),
    price: 3900,
    priceLabel: t('subscription.plan.monthlyPriceLabel'),
    period: 'monthly',
    features: [
      t('subscription.plan.feature.unlimitedConsult'),
      t('subscription.plan.feature.foodAnalysis300'),
      t('subscription.plan.feature.poopAnalysis300'),
      t('subscription.plan.feature.cryAnalysis300'),
      t('subscription.plan.feature.unlimitedSleepPredict'),
      t('subscription.plan.feature.unlimitedPatternAnalysis'),
      t('subscription.plan.feature.adFree'),
    ],
  },
  {
    id: 'yearly',
    name: t('subscription.plan.yearlyName'),
    price: 39900,
    priceLabel: t('subscription.plan.yearlyPriceLabel'),
    period: 'yearly',
    badge: 'BEST',
    discount: t('subscription.plan.yearlyDiscount'),
    features: [
      t('subscription.plan.feature.allMonthlyFeatures'),
      t('subscription.plan.feature.yearlyPerMonth'),
    ],
  },
];

const getFreeFeatures = (t: TFunction) => [
  { label: t('subscription.compare.consult'), free: t('subscription.compare.dailyTimes', { count: 10 }), premium: t('subscription.compare.unlimited') },
  { label: t('subscription.compare.foodAnalysis'), free: t('subscription.compare.dailyTimes', { count: 2 }), premium: t('subscription.compare.monthlyTimes', { count: 300 }) },
  { label: t('subscription.compare.poopAnalysis'), free: t('subscription.compare.dailyTimes', { count: 2 }), premium: t('subscription.compare.monthlyTimes', { count: 300 }) },
  { label: t('subscription.compare.cryAnalysis'), free: t('subscription.compare.dailyTimes', { count: 2 }), premium: t('subscription.compare.monthlyTimes', { count: 300 }) },
  { label: t('subscription.compare.sleepPredict'), free: t('subscription.compare.dailyTimes', { count: 3 }), premium: t('subscription.compare.unlimited') },
  { label: t('subscription.compare.patternAnalysis'), free: t('subscription.compare.dailyTimes', { count: 3 }), premium: t('subscription.compare.unlimited') },
  { label: t('subscription.compare.autoRecord'), free: 'O', premium: 'O' },
  { label: t('subscription.compare.conversationContext'), free: t('subscription.compare.days', { count: 7 }), premium: t('subscription.compare.days', { count: 7 }) },
  { label: t('subscription.compare.ads'), free: t('subscription.compare.adsPresent'), premium: t('subscription.compare.adsNone') },
];

interface FeatureGuide {
  emoji: string;
  title: string;
  desc: string;
}

const getFeatureGuides = (t: TFunction): FeatureGuide[] => [
  { emoji: '🚫', title: t('subscription.guide.adFree.title'), desc: t('subscription.guide.adFree.desc') },
  { emoji: '💬', title: t('subscription.guide.consult.title'), desc: t('subscription.guide.consult.desc') },
  { emoji: '😢', title: t('subscription.guide.analysis.title'), desc: t('subscription.guide.analysis.desc') },
  { emoji: '📝', title: t('subscription.guide.autoRecord.title'), desc: t('subscription.guide.autoRecord.desc') },
];

// 결제 수단은 services/payment.ts의 getPaymentMethodOptions()로 동적 결정
// (PortOne 환경변수 등록 여부에 따라 자동 표시/숨김)

export default function SubscriptionScreen() {
  const { t, i18n } = useTranslation();
  const [plans, setPlans] = useState<PremiumPlan[]>(() => getFallbackPlans(t));
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('yearly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('iap');
  // PortOne WebView 상태
  const [portOneParams, setPortOneParams] = useState<PortOneCheckoutParams | null>(null);
  const [portOneVisible, setPortOneVisible] = useState(false);
  const paymentMethodOptions = getPaymentMethodOptions(t, i18n.language);
  // 스토어 실제 지역화 가격(비한국어 로케일 표시용) — 한국어는 항상 기존 KRW 라벨 그대로 유지.
  const [localizedPrices, setLocalizedPrices] = useState<Partial<Record<ProductId, LocalizedProductPrice>>>({});

  const loadData = useCallback(async () => {
    try {
      const [plansRes, statusRes] = await Promise.all([
        premiumApi.plans(),
        premiumApi.status(),
      ]);
      if (plansRes.data?.data?.length) {
        setPlans(plansRes.data.data as PremiumPlan[]);
      }
      if (statusRes.data?.data) {
        setStatus(statusRes.data.data as PremiumStatus);
      }
    } catch {
      setStatus({ tier: 'FREE' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (i18n.language === 'ko') return;
    fetchLocalizedPrices().then(setLocalizedPrices).catch(() => {});
  }, [i18n.language]);

  // selectedPlan('yearly'/'monthly') → ProductId('premium_yearly'/...)
  function planToProductId(plan: string): ProductId {
    return plan === 'yearly' ? 'premium_yearly' : 'premium_monthly';
  }

  // 비한국어 로케일 + 스토어 가격 조회 성공 시에만 실제 지역화 가격으로 대체.
  // 한국어이거나 아직 조회 전이면 기존 하드코딩 라벨(KRW) 그대로 — 동작 변화 없음.
  function resolvePriceLabel(plan: PremiumPlan): string {
    if (i18n.language === 'ko') return plan.priceLabel;
    const localized = localizedPrices[planToProductId(plan.period)];
    if (!localized) return plan.priceLabel;
    return plan.period === 'yearly'
      ? t('subscription.plan.pricePerYear', { price: localized.displayPrice })
      : t('subscription.plan.pricePerMonth', { price: localized.displayPrice });
  }

  const handleSubscribe = async () => {
    if (!selectedPlan || !paymentMethod) return;
    const productId = planToProductId(selectedPlan);

    // 0) 이중 결제 방지 — 이미 활성 구독 중이면 차단.
    //    Google Play 의 별도 SKU 구조에서는 자동 cross-grade 가 안 됨 (월간+연간 동시 결제 가능).
    //    플랜 변경은 사용자가 Google Play 정기 결제 관리 페이지에서 직접 변경해야 함.
    if (status?.tier === 'PAID') {
      const expiresAt = status.expiresAt ? new Date(status.expiresAt) : null;
      const stillActive = expiresAt ? expiresAt > new Date() : true;
      if (stillActive) {
        const isIOS = Platform.OS === 'ios';
        const storeLabel = isIOS ? t('subscription.store.appStoreSubscription') : t('subscription.store.googlePlaySubscription');
        const manageUrl = isIOS
          ? 'https://apps.apple.com/account/subscriptions'
          : 'https://play.google.com/store/account/subscriptions';
        Alert.alert(
          t('subscription.alert.alreadySubscribedTitle'),
          t('subscription.alert.alreadySubscribedMessage', { storeLabel }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('subscription.alert.openSubscriptionManagement'),
              onPress: () => {
                Linking.openURL(manageUrl).catch(() => {
                  Alert.alert(t('common.error'), t('subscription.alert.cannotOpenManagementPage'));
                });
              },
            },
          ],
        );
        return;
      }
    }

    // 1) IAP 분기 — Google Play / Apple
    if (paymentMethod === 'iap') {
      setSubscribing(true);
      analytics.logSubscriptionStart(selectedPlan === 'yearly' ? 'yearly' : 'monthly', 'iap');
      try {
        const res = await purchaseIAP(t, productId);
        if (res.ok) {
          const priceKRW = productId === 'premium_yearly' ? 39900 : 3900;
          analytics.logPurchase(productId === 'premium_yearly' ? 'yearly' : 'monthly', priceKRW);
          // 성공 res.message 는 백엔드 한국어 고정 → 항상 i18n 문구 사용
          Alert.alert(t('subscription.alert.subscribeCompleteTitle'), t('subscription.alert.subscribeCompleteMessage'));
          loadData();
        } else {
          Alert.alert(t('subscription.alert.paymentFailedTitle'), res.message ?? t('common.retry'));
        }
      } finally {
        setSubscribing(false);
      }
      return;
    }

    // 2) PortOne 외부결제 — 빌링키(자동결제) 발급
    const checkoutParams = buildPortOneCheckoutParams(t, {
      productId,
      method: paymentMethod,
      asBillingKey: true,
    });
    if (!checkoutParams) {
      Alert.alert(
        t('subscription.alert.paymentPreparingTitle'),
        t('subscription.alert.paymentMethodNotActive'),
      );
      return;
    }
    setPortOneParams(checkoutParams);
    setPortOneVisible(true);
  };

  const handlePortOneResult = async (result: PortOneResult) => {
    setPortOneVisible(false);
    if (result.status !== 'OK') {
      if (result.status === 'FAILED') {
        Alert.alert(t('subscription.alert.paymentFailedTitle'), result.message ?? t('subscription.alert.paymentCancelled'));
      } else {
        Alert.alert(t('subscription.alert.paymentErrorTitle'), result.message ?? t('subscription.alert.paymentErrorOccurred'));
      }
      setPortOneParams(null);
      return;
    }

    setSubscribing(true);
    try {
      const productId = planToProductId(selectedPlan);
      if (result.type === 'billingKey' && result.billingKey) {
        // 빌링키 등록 + 첫 결제
        await paymentApi.registerBillingKey(result.billingKey, productId);
      } else if (result.type === 'payment' && result.paymentId) {
        // 1회성 결제 검증
        await paymentApi.verifyPortOne(result.paymentId, productId);
      } else {
        Alert.alert(t('common.error'), t('subscription.alert.cannotVerifyPaymentInfo'));
        return;
      }
      Alert.alert(t('subscription.alert.subscribeCompleteTitle'), t('subscription.alert.subscribeCompleteMessage'));
      loadData();
    } catch {
      Alert.alert(
        t('subscription.alert.verificationFailedTitle'),
        t('subscription.alert.verificationFailedMessage'),
      );
    } finally {
      setSubscribing(false);
      setPortOneParams(null);
    }
  };

  const handleStartTrial = async () => {
    setSubscribing(true);
    try {
      await premiumApi.startTrial();
      analytics.logTrialStart();
      Alert.alert(t('subscription.alert.trialStartTitle'), t('subscription.alert.trialStartMessage'));
      loadData();
    } catch {
      Alert.alert(t('common.error'), t('subscription.alert.trialStartFailed'));
    } finally {
      setSubscribing(false);
    }
  };

  const handleRedeemCode = async () => {
    const code = promoCode.trim();
    if (!code || redeeming) return;
    setRedeeming(true);
    try {
      const res = await premiumApi.redeemCode(code);
      const months = res.data?.data?.months as number | undefined;
      Alert.alert(
        t('subscription.promo.successTitle'),
        t('subscription.promo.successMessage', { months: months ?? 0 }),
      );
      setPromoCode('');
      loadData();
    } catch (err: unknown) {
      // 서버 에러 문구는 한국어 고정 → 한국어 UI에서만 원문 노출, 그 외엔 일반 안내
      let msg = t('subscription.promo.failedMessage');
      if (err && typeof err === 'object' && 'response' in err) {
        const axErr = err as { response?: { data?: { error?: string } } };
        const serverMsg = axErr.response?.data?.error;
        if (serverMsg && i18n.language === 'ko') msg = serverMsg;
      }
      Alert.alert(t('common.error'), msg);
    } finally {
      setRedeeming(false);
    }
  };

  const handleRestorePurchases = async () => {
    setSubscribing(true);
    try {
      const res = await restoreIAP(t);
      if (res.ok) {
        Alert.alert(t('subscription.alert.restoreCompleteTitle'), res.message ?? t('subscription.alert.restoreCompleteMessage'));
        loadData();
      } else {
        Alert.alert(t('subscription.alert.restoreFailedTitle'), res.message ?? t('subscription.alert.restoreFailedMessage'));
      }
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: t('subscription.screenTitle'), headerShown: true, headerLeft: () => <BackButton /> }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isPaid = status?.tier === 'PAID';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('subscription.screenTitle'), headerShown: true, headerLeft: () => <BackButton /> }} />

      {/* Header */}
      <View style={styles.header}>
        <Image source={IC_PREMIUM} style={styles.crownEmojiImg} resizeMode="contain" />
        <Text style={styles.headerTitle}>{t('subscription.screenTitle')}</Text>
        <Text style={styles.headerSub}>
          {t('subscription.headerSub')}
        </Text>
      </View>

      {/* Current status */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t('subscription.currentPlan')}</Text>
          <View style={[styles.tierBadge, isPaid && styles.tierBadgePaid]}>
            <Text style={[styles.tierText, isPaid && styles.tierTextPaid]}>
              {isPaid ? t('subscription.tierPremium') : t('subscription.tierFree')}
            </Text>
          </View>
        </View>
        {status?.trialDaysLeft !== undefined && status.trialDaysLeft > 0 && (
          <View style={styles.trialRow}>
            <Image source={IC_CLOCK} style={styles.trialIconImg} resizeMode="contain" />
            <Text style={styles.trialText}>
              {t('subscription.trialDaysLeft', { count: status.trialDaysLeft })}
            </Text>
          </View>
        )}
        {isPaid && status?.expiresAt && (
          <Text style={styles.expiresText}>
            {t('subscription.expiresAt', { date: status.expiresAt.split('T')[0] })}
          </Text>
        )}
      </View>

      {/* Feature guide */}
      <Text style={styles.sectionTitle}>{t('subscription.featureGuideTitle')}</Text>
      {getFeatureGuides(t).map((g) => (
        <View key={g.title} style={styles.guideCard}>
          <Text style={styles.guideEmoji}>{g.emoji}</Text>
          <View style={styles.guideContent}>
            <Text style={styles.guideTitle}>{g.title}</Text>
            <Text style={styles.guideDesc}>{g.desc}</Text>
          </View>
        </View>
      ))}

      {/* Plan cards */}
      {!isPaid && (
        <>
          <Text style={styles.sectionTitle}>{t('subscription.selectPlan')}</Text>
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                onPress={() => setSelectedPlan(plan.id)}
                activeOpacity={0.7}
              >
                {plan.badge && (
                  <View style={styles.bestBadge}>
                    <Text style={styles.bestBadgeText}>{plan.badge}</Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <View style={styles.planRadioOuter}>
                    {isSelected && <View style={styles.planRadioInner} />}
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    {plan.discount && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{plan.discount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.planPrice}>{resolvePriceLabel(plan)}</Text>
                </View>
                <View style={styles.featureList}>
                  {plan.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Text style={styles.featureCheck}>{'✓'}</Text>
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Payment method */}
          <Text style={styles.sectionTitle}>{t('subscription.paymentMethod')}</Text>
          <View style={styles.paymentRow}>
            {paymentMethodOptions
              .filter((pm) => pm.available)
              .map((pm) => {
                const isActive = paymentMethod === pm.id;
                return (
                  <TouchableOpacity
                    key={pm.id}
                    style={[styles.paymentBtn, isActive && styles.paymentBtnActive]}
                    onPress={() => setPaymentMethod(pm.id)}
                  >
                    <Text style={[styles.paymentBtnText, isActive && styles.paymentBtnTextActive]}>
                      {pm.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>

          {/* Subscribe button */}
          <TouchableOpacity
            style={[styles.subscribeBtn, subscribing && styles.subscribeBtnDisabled]}
            onPress={handleSubscribe}
            disabled={subscribing}
            accessibilityRole="button"
            accessibilityLabel={t('subscription.a11y.subscribeStart')}
            accessibilityHint={t('subscription.a11y.subscribeStartHint')}
          >
            {subscribing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.subscribeBtnText}>{t('subscription.subscribeButton')}</Text>
            )}
          </TouchableOpacity>

          {/* Free trial — 진행 중이면 숨김(상단 'N일 남음'), 종료/사용했으면 비활성,
              한 번도 시작 안 했을 때만 시작 버튼 노출.
              trialDaysLeft 0(종료)과 undefined(미시작)을 구분해 재시작 차단 */}
          {(() => {
            const trialActive = (status?.trialDaysLeft ?? 0) > 0;
            const trialEnded = status?.trialUsed === true || status?.trialDaysLeft === 0;
            if (trialActive) return null;
            if (trialEnded) {
              return (
                <View style={[styles.trialBtn, styles.trialBtnDisabled]}>
                  <Text style={[styles.trialBtnText, styles.trialBtnTextDisabled]}>
                    {t('subscription.trialAlreadyUsed')}
                  </Text>
                </View>
              );
            }
            return (
              <TouchableOpacity
                style={styles.trialBtn}
                onPress={handleStartTrial}
                disabled={subscribing}
                accessibilityRole="button"
                accessibilityLabel={t('subscription.trialStartButton')}
              >
                <Text style={styles.trialBtnText}>{t('subscription.trialStartButton')}</Text>
              </TouchableOpacity>
            );
          })()}

          {/* 프로모 코드 입력 — 인플루언서 무료 이용권 코드 등 */}
          <View style={styles.promoBox}>
            <Text style={styles.promoLabel}>{t('subscription.promo.label')}</Text>
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder={t('subscription.promo.placeholder')}
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!redeeming}
                maxLength={32}
                accessibilityLabel={t('subscription.promo.label')}
              />
              <TouchableOpacity
                style={[styles.promoBtn, (!promoCode.trim() || redeeming) && styles.promoBtnDisabled]}
                onPress={handleRedeemCode}
                disabled={!promoCode.trim() || redeeming}
                accessibilityRole="button"
                accessibilityLabel={t('subscription.promo.applyButton')}
              >
                {redeeming ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.promoBtnText}>{t('subscription.promo.applyButton')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 자동갱신 / 체험 고지 — Apple/Google 정책 필수 표기 */}
          <Text style={styles.legalNotice}>
            {t('subscription.legalNotice.autoRenew') + '\n' +
            t('subscription.legalNotice.trialAutoCharge') + '\n' +
            t('subscription.legalNotice.cancelBefore24h') + '\n' +
            (Platform.OS === 'ios'
              ? t('subscription.legalNotice.cancelIOS') + '\n'
              : t('subscription.legalNotice.cancelAndroid') + '\n') +
            t('subscription.legalNotice.cancelStillUsableUntilExpiry')}
          </Text>

          {/* 구매 복원 — Apple 필수 제공 */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestorePurchases}
            disabled={subscribing}
            accessibilityRole="button"
            accessibilityLabel={t('subscription.restorePurchasesButton')}
            accessibilityHint={t('subscription.a11y.restorePurchasesHint')}
          >
            <Text style={styles.restoreBtnText}>{t('subscription.restorePurchasesButton')}</Text>
          </TouchableOpacity>

          {/* 구독 관리 / 환불 안내 — Google/Apple 정책 + 한국 전자상거래법 준수 */}
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => {
              const url = Platform.OS === 'ios'
                ? 'https://apps.apple.com/account/subscriptions'
                : 'https://play.google.com/store/account/subscriptions';
              Linking.openURL(url).catch(() => {
                Alert.alert(t('common.error'), t('subscription.alert.cannotOpenSubscriptionManagementPage'));
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={t('subscription.manageOrRefundButton')}
          >
            <Text style={styles.manageBtnText}>{t('subscription.manageOrRefundButton')}</Text>
          </TouchableOpacity>

          <Text style={styles.refundNotice}>
            {t('subscription.refundNotice.title') + '\n' +
            t('subscription.refundNotice.within7DaysUnused') + '\n' +
            t('subscription.refundNotice.within7DaysUsed') + '\n' +
            t('subscription.refundNotice.after14Days') + '\n' +
            t('subscription.refundNotice.seeTerms')}
          </Text>

          {/* 약관 링크 — Apple 결제 화면 권장 */}
          <View style={styles.policyRow}>
            <TouchableOpacity onPress={() => Linking.openURL('https://amatda-parenting.web.app/terms')}>
              <Text style={styles.policyLink}>{t('subscription.termsOfService')}</Text>
            </TouchableOpacity>
            <Text style={styles.policySep}> · </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://amatda-parenting.web.app/privacy')}>
              <Text style={styles.policyLink}>{t('subscription.privacyPolicy')}</Text>
            </TouchableOpacity>
          </View>

          {/* Comparison table */}
          <Text style={styles.sectionTitle}>{t('subscription.compareTitle')}</Text>
          <View style={styles.compareTable}>
            <View style={styles.compareHeaderRow}>
              <Text style={[styles.compareCell, styles.compareLabelCell]}>{t('subscription.compare.featureColumn')}</Text>
              <Text style={[styles.compareCell, styles.compareHeaderText]}>{t('subscription.compare.freeColumn')}</Text>
              <Text style={[styles.compareCell, styles.compareHeaderText, styles.comparePremiumHeader]}>{t('subscription.compare.premiumColumn')}</Text>
            </View>
            {getFreeFeatures(t).map((row) => (
              <View key={row.label} style={styles.compareRow}>
                <Text style={[styles.compareCell, styles.compareLabelCell]}>{row.label}</Text>
                <Text style={[styles.compareCell, styles.compareFreeValue]}>{row.free}</Text>
                <Text style={[styles.compareCell, styles.comparePremiumValue]}>{row.premium}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {isPaid && (
        <View style={styles.paidMessage}>
          <Image source={IC_RIBBON} style={styles.paidEmojiImg} resizeMode="contain" />
          <Text style={styles.paidTitle}>{t('subscription.paidTitle')}</Text>
          <Text style={styles.paidSub}>
            {t('subscription.paidSub')}
          </Text>
        </View>
      )}

      {/* PortOne 결제 WebView (외부결제 진행 중에만 표시) */}
      <PortOneWebView
        visible={portOneVisible}
        params={portOneParams}
        onResult={handlePortOneResult}
        onClose={() => {
          setPortOneVisible(false);
          setPortOneParams(null);
        }}
      />
    </ScrollView>
  );
}

const GOLD = '#FFD700';

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 120 },

  // Header
  header: { alignItems: 'center', marginBottom: SPACING.lg },
  crownEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  crownEmojiImg: { width: 48, height: 48, marginBottom: SPACING.sm },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },

  // Status
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  tierBadge: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  tierBadgePaid: { backgroundColor: GOLD + '30' },
  tierText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tierTextPaid: { color: '#B8860B' },
  trialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  trialIcon: { fontSize: 16, marginRight: SPACING.xs },
  trialIconImg: { width: 18, height: 18, marginRight: SPACING.xs },
  trialText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  expiresText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },

  // Section title
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },

  // Plan cards
  planCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  planCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF9F5',
  },
  bestBadge: {
    position: 'absolute',
    top: -1,
    right: SPACING.lg,
    backgroundColor: GOLD,
    borderBottomLeftRadius: RADIUS.sm,
    borderBottomRightRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
  },
  bestBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: '#5C4400',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  planRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  planRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  planInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  discountBadge: {
    backgroundColor: COLORS.error + '18',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  discountText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.error,
  },
  planPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.primary,
  },
  featureList: { marginLeft: 30 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureCheck: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.secondary,
    fontWeight: '700',
    marginRight: 8,
  },
  featureText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },

  // Payment
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  paymentBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  paymentBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  paymentBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  paymentBtnTextActive: { color: COLORS.primary },

  // Subscribe
  subscribeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: FONT_SIZE.lg,
  },

  // Trial
  trialBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  trialBtnText: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
  // 체험 사용 완료 — disabled 톤
  trialBtnDisabled: {
    borderColor: COLORS.border,
    backgroundColor: '#F5F5F5',
  },
  trialBtnTextDisabled: {
    color: COLORS.textLight,
    fontWeight: '600',
  },

  // Promo code (프로모 코드 입력)
  promoBox: {
    marginBottom: SPACING.lg,
  },
  promoLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  promoRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  promoBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    minWidth: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoBtnDisabled: {
    opacity: 0.5,
  },
  promoBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },

  // Legal notice (자동갱신 고지 — Apple/Google 정책)
  legalNotice: {
    fontSize: 11,
    color: COLORS.textLight,
    lineHeight: 17,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },

  // Policy links (약관·개인정보 — Apple 결제 화면 권장)
  policyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  policyLink: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  policySep: {
    fontSize: 11,
    color: COLORS.textLight,
  },

  // Restore purchases (Apple 필수)
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  restoreBtnText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },

  // 구독 관리 / 환불 안내
  manageBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border ?? '#E0E0E0',
  },
  manageBtnText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  refundNotice: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  // Feature guide
  guideCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  guideEmoji: {
    fontSize: 28,
    marginTop: 2,
  },
  guideContent: {
    flex: 1,
  },
  guideTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  guideDesc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // Compare
  compareTable: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  compareHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.border,
    paddingVertical: SPACING.sm,
  },
  compareRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingVertical: SPACING.sm,
  },
  compareCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    paddingHorizontal: 4,
  },
  compareLabelCell: {
    textAlign: 'left',
    paddingLeft: SPACING.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  compareHeaderText: { fontWeight: '700', color: COLORS.text },
  comparePremiumHeader: { color: COLORS.primary },
  compareFreeValue: { color: COLORS.textLight },
  comparePremiumValue: { color: COLORS.primary, fontWeight: '600' },

  // Paid
  paidMessage: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  paidEmoji: { fontSize: 48, marginBottom: SPACING.md },
  paidEmojiImg: { width: 56, height: 56, marginBottom: SPACING.md },
  paidTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  paidSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
});

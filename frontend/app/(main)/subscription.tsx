import { useState, useEffect, useCallback } from 'react';
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
  type PaymentMethod,
  type ProductId,
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

const FALLBACK_PLANS: PremiumPlan[] = [
  {
    id: 'monthly',
    name: 'VIP 월간',
    price: 3900,
    priceLabel: '3,900원/월',
    period: 'monthly',
    features: [
      '상담이모 무제한',
      '음식 사진 분석 월 300회',
      '대변 분석 월 300회',
      '울음 분석 월 300회',
      'AI 수면 예측 무제한',
      '육아 패턴 분석 무제한',
      '광고 제거',
    ],
  },
  {
    id: 'yearly',
    name: 'VIP 연간',
    price: 39900,
    priceLabel: '39,900원/년',
    period: 'yearly',
    badge: 'BEST',
    discount: '15% 할인',
    features: [
      'VIP 월간의 모든 기능',
      '월 3,325원꼴',
    ],
  },
];

const FREE_FEATURES = [
  { label: '상담이모', free: '하루 10회', premium: '무제한' },
  { label: '음식 사진 분석', free: '하루 2회', premium: '월 300회' },
  { label: '대변 분석', free: '하루 2회', premium: '월 300회' },
  { label: '울음 분석', free: '하루 2회', premium: '월 300회' },
  { label: 'AI 수면 예측', free: '하루 3회', premium: '무제한' },
  { label: '육아 패턴 분석', free: '하루 3회', premium: '무제한' },
  { label: 'AI 자동기록', free: 'O', premium: 'O' },
  { label: '대화 맥락', free: '7일', premium: '7일' },
  { label: '광고', free: '있음', premium: '없음' },
];

interface FeatureGuide {
  emoji: string;
  title: string;
  desc: string;
}

const FEATURE_GUIDES: FeatureGuide[] = [
  { emoji: '🚫', title: '광고 제거', desc: '앱 내 모든 광고가 사라져서 쾌적하게 이용할 수 있어요.' },
  { emoji: '💬', title: '상담이모', desc: '아이 기질에 맞는 맞춤 육아 답변을 받아보세요. 수면, 식사, 행동 등 모든 고민을 상담할 수 있어요.' },
  { emoji: '😢', title: '울음/대변 분석', desc: '상담이모 탭에서 아이 울음소리를 녹음하거나 대변 사진을 찍으면 분석해드려요.' },
  { emoji: '📝', title: '자동기록', desc: '타임라인에서 "오늘 하루 정리" 버튼을 누르면 수유, 수면, 상담 기록을 일기로 만들어줘요.' },
];

// 결제 수단은 services/payment.ts의 getPaymentMethodOptions()로 동적 결정
// (PortOne 환경변수 등록 여부에 따라 자동 표시/숨김)

export default function SubscriptionScreen() {
  const [plans, setPlans] = useState<PremiumPlan[]>(FALLBACK_PLANS);
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('yearly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('iap');
  // PortOne WebView 상태
  const [portOneParams, setPortOneParams] = useState<PortOneCheckoutParams | null>(null);
  const [portOneVisible, setPortOneVisible] = useState(false);
  const paymentMethodOptions = getPaymentMethodOptions();

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

  // selectedPlan('yearly'/'monthly') → ProductId('premium_yearly'/...)
  function planToProductId(plan: string): ProductId {
    return plan === 'yearly' ? 'premium_yearly' : 'premium_monthly';
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
        Alert.alert(
          '이미 구독 중이에요',
          '현재 프리미엄을 이용 중이세요. 플랜 변경은 Google Play 정기 결제 관리에서 가능해요.',
          [
            { text: '취소', style: 'cancel' },
            {
              text: '구독 관리 열기',
              onPress: () => {
                Linking.openURL('https://play.google.com/store/account/subscriptions').catch(() => {
                  Alert.alert('오류', '정기 결제 관리 페이지를 열 수 없어요.');
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
        const res = await purchaseIAP(productId);
        if (res.ok) {
          const priceKRW = productId === 'premium_yearly' ? 39900 : 3900;
          analytics.logPurchase(productId === 'premium_yearly' ? 'yearly' : 'monthly', priceKRW);
          Alert.alert('구독 완료', res.message ?? '프리미엄 기능을 이용해보세요!');
          loadData();
        } else {
          Alert.alert('결제 실패', res.message ?? '다시 시도해주세요.');
        }
      } finally {
        setSubscribing(false);
      }
      return;
    }

    // 2) PortOne 외부결제 — 빌링키(자동결제) 발급
    const checkoutParams = buildPortOneCheckoutParams({
      productId,
      method: paymentMethod,
      asBillingKey: true,
    });
    if (!checkoutParams) {
      Alert.alert(
        '결제 준비 중',
        '선택한 결제 수단은 아직 활성화되지 않았습니다. 다른 수단을 선택해 주세요.',
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
        Alert.alert('결제 실패', result.message ?? '결제가 취소되었습니다.');
      } else {
        Alert.alert('결제 오류', result.message ?? '결제 중 오류가 발생했습니다.');
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
        Alert.alert('오류', '결제 정보를 확인할 수 없습니다.');
        return;
      }
      Alert.alert('구독 완료', '프리미엄 기능을 이용해보세요!');
      loadData();
    } catch {
      Alert.alert(
        '검증 실패',
        '결제는 진행되었지만 서버 검증이 실패했습니다. 잠시 후 다시 확인해주세요.',
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
      Alert.alert('체험 시작', '7일간 프리미엄 기능을 무료로 이용해보세요!');
      loadData();
    } catch {
      Alert.alert('오류', '체험 시작에 실패했습니다.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleRestorePurchases = async () => {
    setSubscribing(true);
    try {
      const res = await restoreIAP();
      if (res.ok) {
        Alert.alert('복원 완료', res.message ?? '구독이 복원되었습니다.');
        loadData();
      } else {
        Alert.alert('복원 실패', res.message ?? '복원할 구매 내역이 없습니다.');
      }
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: '프리미엄 플랜', headerShown: true, headerLeft: () => <BackButton /> }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isPaid = status?.tier === 'PAID';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '프리미엄 플랜', headerShown: true, headerLeft: () => <BackButton /> }} />

      {/* Header */}
      <View style={styles.header}>
        <Image source={IC_PREMIUM} style={styles.crownEmojiImg} resizeMode="contain" />
        <Text style={styles.headerTitle}>프리미엄 플랜</Text>
        <Text style={styles.headerSub}>
          아이 맞춤 육아, 더 깊이있게
        </Text>
      </View>

      {/* Current status */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>현재 플랜</Text>
          <View style={[styles.tierBadge, isPaid && styles.tierBadgePaid]}>
            <Text style={[styles.tierText, isPaid && styles.tierTextPaid]}>
              {isPaid ? 'PREMIUM' : 'FREE'}
            </Text>
          </View>
        </View>
        {status?.trialDaysLeft !== undefined && status.trialDaysLeft > 0 && (
          <View style={styles.trialRow}>
            <Image source={IC_CLOCK} style={styles.trialIconImg} resizeMode="contain" />
            <Text style={styles.trialText}>
              체험 기간 {status.trialDaysLeft}일 남음
            </Text>
          </View>
        )}
        {isPaid && status?.expiresAt && (
          <Text style={styles.expiresText}>
            만료일: {status.expiresAt.split('T')[0]}
          </Text>
        )}
      </View>

      {/* Feature guide */}
      <Text style={styles.sectionTitle}>VIP 혜택 소개</Text>
      {FEATURE_GUIDES.map((g) => (
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
          <Text style={styles.sectionTitle}>플랜 선택</Text>
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
                  <Text style={styles.planPrice}>{plan.priceLabel}</Text>
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
          <Text style={styles.sectionTitle}>결제 수단</Text>
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
            accessibilityLabel="구독 시작"
            accessibilityHint="선택한 플랜으로 결제를 시작합니다"
          >
            {subscribing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.subscribeBtnText}>구독하기</Text>
            )}
          </TouchableOpacity>

          {/* Free trial — trialUsed 면 비활성 + 안내 텍스트 (재시작 차단) */}
          {status?.trialUsed ? (
            <View style={[styles.trialBtn, styles.trialBtnDisabled]}>
              <Text style={[styles.trialBtnText, styles.trialBtnTextDisabled]}>
                이미 체험하셨습니다
              </Text>
            </View>
          ) : !status?.trialDaysLeft ? (
            <TouchableOpacity
              style={styles.trialBtn}
              onPress={handleStartTrial}
              disabled={subscribing}
              accessibilityRole="button"
              accessibilityLabel="7일 무료 체험 시작"
            >
              <Text style={styles.trialBtnText}>7일 무료 체험 시작</Text>
            </TouchableOpacity>
          ) : null}

          {/* 자동갱신 / 체험 고지 — Apple/Google 정책 필수 표기 */}
          <Text style={styles.legalNotice}>
            {'• 구독은 선택한 기간(월간/연간)으로 자동 갱신됩니다.\n' +
            '• 7일 무료 체험 종료 후 선택한 플랜 요금이 자동 청구됩니다.\n' +
            '• 갱신 24시간 전까지 구독을 취소하지 않으면 자동 결제됩니다.\n' +
            '• 구독 취소: 설정 앱 → Apple ID(또는 Google Play 구독) → 구독 관리\n' +
            '• 구독 기간 중 취소해도 만료일까지 이용 가능합니다.'}
          </Text>

          {/* 구매 복원 — Apple 필수 제공 */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestorePurchases}
            disabled={subscribing}
            accessibilityRole="button"
            accessibilityLabel="구매 복원"
            accessibilityHint="이전에 구입한 구독을 복원합니다"
          >
            <Text style={styles.restoreBtnText}>구매 복원</Text>
          </TouchableOpacity>

          {/* 구독 관리 / 환불 안내 — Google/Apple 정책 + 한국 전자상거래법 준수 */}
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => {
              const url = Platform.OS === 'ios'
                ? 'https://apps.apple.com/account/subscriptions'
                : 'https://play.google.com/store/account/subscriptions';
              Linking.openURL(url).catch(() => {
                Alert.alert('오류', '정기 결제 관리 페이지를 열 수 없어요.');
              });
            }}
            accessibilityRole="button"
            accessibilityLabel="구독 취소 또는 환불 요청"
          >
            <Text style={styles.manageBtnText}>구독 취소 / 환불 요청</Text>
          </TouchableOpacity>

          <Text style={styles.refundNotice}>
            {'환불 정책:\n' +
            '• 결제 후 7일 이내 미사용: 100% 환불\n' +
            '• 결제 후 7일 이내 사용 이력 있음: 사용 일수 차감 후 환불\n' +
            '• 결제 후 14일 초과: 회사 귀책 사유 없으면 환불 불가\n' +
            '• 자세한 내용은 [이용약관 > 제12조] 참조'}
          </Text>

          {/* 약관 링크 — Apple 결제 화면 권장 */}
          <View style={styles.policyRow}>
            <TouchableOpacity onPress={() => Linking.openURL('https://amatda-parenting.web.app/terms')}>
              <Text style={styles.policyLink}>이용약관</Text>
            </TouchableOpacity>
            <Text style={styles.policySep}> · </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://amatda-parenting.web.app/privacy')}>
              <Text style={styles.policyLink}>개인정보처리방침</Text>
            </TouchableOpacity>
          </View>

          {/* Comparison table */}
          <Text style={styles.sectionTitle}>무료 vs 프리미엄</Text>
          <View style={styles.compareTable}>
            <View style={styles.compareHeaderRow}>
              <Text style={[styles.compareCell, styles.compareLabelCell]}>기능</Text>
              <Text style={[styles.compareCell, styles.compareHeaderText]}>무료</Text>
              <Text style={[styles.compareCell, styles.compareHeaderText, styles.comparePremiumHeader]}>프리미엄</Text>
            </View>
            {FREE_FEATURES.map((row) => (
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
          <Text style={styles.paidTitle}>프리미엄 이용 중</Text>
          <Text style={styles.paidSub}>
            모든 프리미엄 기능을 이용하고 계세요!
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

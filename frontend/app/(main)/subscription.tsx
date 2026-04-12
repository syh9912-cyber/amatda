import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { premiumApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

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
      'AI 맞춤 육아 코칭 무제한',
      'AI 자동 육아일기',
      '성장 타임캡슐',
      '또래 비교 인사이트',
      '대화 맥락 7일 유지',
      '주간 AI 리포트',
    ],
  },
  {
    id: 'yearly',
    name: 'VIP 연간',
    price: 33900,
    priceLabel: '33,900원/년',
    period: 'yearly',
    badge: 'BEST',
    discount: '28% 할인',
    features: [
      'VIP 월간의 모든 기능',
      '월 2,825원꼴',
    ],
  },
];

const FREE_FEATURES = [
  { label: 'AI 상담', free: '레벨업으로 증가', premium: '무제한' },
  { label: 'AI 자동 일기', free: '-', premium: 'O' },
  { label: '타임캡슐', free: '-', premium: 'O' },
  { label: '또래 비교', free: '-', premium: 'O' },
  { label: '대화 맥락', free: '3일', premium: '7일' },
];

const PAYMENT_METHODS = [
  { id: 'card', label: '카드' },
  { id: 'kakao', label: '카카오' },
  { id: 'naver', label: '네이버' },
  { id: 'toss', label: '토스' },
  { id: 'bank', label: '무통장' },
] as const;

type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id'];

export default function SubscriptionScreen() {
  const [plans, setPlans] = useState<PremiumPlan[]>(FALLBACK_PLANS);
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('yearly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('card');

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

  const handleSubscribe = async () => {
    if (!selectedPlan || !paymentMethod) return;
    setSubscribing(true);
    try {
      await premiumApi.subscribe(selectedPlan, paymentMethod);
      Alert.alert('구독 완료', '프리미엄 기능을 이용해보세요!');
      loadData();
    } catch {
      Alert.alert('오류', '구독 처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleStartTrial = async () => {
    setSubscribing(true);
    try {
      await premiumApi.startTrial();
      Alert.alert('체험 시작', '7일간 프리미엄 기능을 무료로 이용해보세요!');
      loadData();
    } catch {
      Alert.alert('오류', '체험 시작에 실패했습니다.');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: '프리미엄 플랜', headerShown: true }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isPaid = status?.tier === 'PAID';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '프리미엄 플랜', headerShown: true }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.crownEmoji}>{'👑'}</Text>
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
            <Text style={styles.trialIcon}>{'⏳'}</Text>
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
            {PAYMENT_METHODS.map((pm) => {
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
          >
            {subscribing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.subscribeBtnText}>구독하기</Text>
            )}
          </TouchableOpacity>

          {/* Free trial */}
          {!status?.trialDaysLeft && (
            <TouchableOpacity
              style={styles.trialBtn}
              onPress={handleStartTrial}
              disabled={subscribing}
            >
              <Text style={styles.trialBtnText}>7일 무료 체험 시작</Text>
            </TouchableOpacity>
          )}

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
          <Text style={styles.paidEmoji}>{'🎉'}</Text>
          <Text style={styles.paidTitle}>프리미엄 이용 중</Text>
          <Text style={styles.paidSub}>
            모든 프리미엄 기능을 이용하고 계세요!
          </Text>
        </View>
      )}
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

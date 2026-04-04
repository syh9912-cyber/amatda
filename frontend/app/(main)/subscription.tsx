import { useState, useEffect } from 'react';
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
import { subscriptionApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Sub {
  id: string;
  kitType: string;
  status: string;
  nextDeliveryDate: string;
}

const KIT_OPTIONS = [
  {
    type: 'sensory',
    name: '오감 탐색 교구',
    desc: '촉각, 시각, 청각을 자극하는 월간 교구 세트',
    age: '0~36개월',
    price: '29,900원/월',
  },
  {
    type: 'thinking',
    name: '사고력 교구',
    desc: '논리, 수리, 공간지각 발달을 위한 교구 세트',
    age: '37~72개월',
    price: '34,900원/월',
  },
  {
    type: 'learning',
    name: '학습 교구',
    desc: '기질 맞춤 학습 보조 교구 + 워크북',
    age: '73개월+',
    price: '39,900원/월',
  },
];

export default function SubscriptionScreen() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const selectedChild = useChildStore((s) => s.selectedChild);

  useEffect(() => {
    if (selectedChild) loadSubs();
  }, [selectedChild?.id]);

  const loadSubs = async () => {
    if (!selectedChild) return;
    try {
      const res = await subscriptionApi.list(selectedChild.id);
      setSubs(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (kitType: string) => {
    if (!selectedChild) return;
    setSubscribing(true);
    try {
      await subscriptionApi.create(selectedChild.id, kitType);
      Alert.alert('구독 완료', '다음 달부터 교구가 배송됩니다!');
      loadSubs();
    } catch {
      Alert.alert('오류', '구독 등록에 실패했습니다');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '월간 도담 교구', headerShown: true }} />

      {selectedChild && (
        <Text style={styles.heading}>
          {selectedChild.name}을 위한 교구 구독
        </Text>
      )}

      {/* 현재 구독 */}
      {loading ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : subs.length > 0 ? (
        <View style={styles.activeSection}>
          <Text style={styles.sectionTitle}>현재 구독 중</Text>
          {subs.map((sub) => (
            <View key={sub.id} style={styles.activeCard}>
              <View style={styles.activeDot} />
              <View style={styles.activeInfo}>
                <Text style={styles.activeType}>
                  {KIT_OPTIONS.find((k) => k.type === sub.kitType)?.name ?? sub.kitType}
                </Text>
                <Text style={styles.activeDate}>
                  다음 배송: {sub.nextDeliveryDate}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{sub.status}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* 구독 옵션 */}
      <Text style={styles.sectionTitle}>교구 플랜</Text>
      {KIT_OPTIONS.map((kit) => {
        const isSubscribed = subs.some((s) => s.kitType === kit.type);
        return (
          <View key={kit.type} style={styles.kitCard}>
            <Text style={styles.kitName}>{kit.name}</Text>
            <Text style={styles.kitDesc}>{kit.desc}</Text>
            <View style={styles.kitMeta}>
              <Text style={styles.kitAge}>{kit.age}</Text>
              <Text style={styles.kitPrice}>{kit.price}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.subBtn,
                isSubscribed && styles.subBtnDisabled,
                subscribing && styles.subBtnDisabled,
              ]}
              onPress={() => handleSubscribe(kit.type)}
              disabled={isSubscribed || subscribing}
            >
              <Text style={styles.subBtnText}>
                {isSubscribed ? '구독 중' : '구독하기'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },
  heading: {
    fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  activeSection: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text,
    marginBottom: SPACING.md,
  },
  activeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  activeDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.success, marginRight: SPACING.md,
  },
  activeInfo: { flex: 1 },
  activeType: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  activeDate: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: {
    backgroundColor: COLORS.success + '20', borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  statusText: { fontSize: FONT_SIZE.xs, color: COLORS.success, fontWeight: '600' },
  kitCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
  },
  kitName: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  kitDesc: {
    fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    lineHeight: 20, marginTop: SPACING.xs, marginBottom: SPACING.md,
  },
  kitMeta: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  kitAge: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  kitPrice: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
  subBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center',
  },
  subBtnDisabled: { backgroundColor: COLORS.border },
  subBtnText: { color: '#FFF', fontWeight: '600', fontSize: FONT_SIZE.md },
});

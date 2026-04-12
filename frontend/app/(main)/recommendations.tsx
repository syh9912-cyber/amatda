import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';

interface CategoryItem {
  icon: ReturnType<typeof require>;
  label: string;
  description: string;
  category: string;
  color: string;
  bgColor: string;
}

const CATEGORIES: CategoryItem[] = [
  {
    icon: require('../../assets/cat-eating.png'),
    label: '음식 추천',
    description: '기질에 맞는 영양 식단과 레시피',
    category: '음식',
    color: '#FF8C5A',
    bgColor: '#FFF0E6',
  },
  {
    icon: require('../../assets/cat-growth.png'),
    label: '생활습관',
    description: '수면, 위생, 루틴 등 생활 가이드',
    category: '생활습관',
    color: '#4ECDC4',
    bgColor: '#E8FAF8',
  },
  {
    icon: require('../../assets/cat-social.png'),
    label: '학원 추천',
    description: '기질과 발달에 맞는 교육 활동',
    category: '학원',
    color: '#7C83EC',
    bgColor: '#EEEDFC',
  },
  {
    icon: require('../../assets/play-activity.png'),
    label: '놀이학습',
    description: '집에서 할 수 있는 놀이와 활동',
    category: '놀이학습',
    color: '#FFB344',
    bgColor: '#FFF8E1',
  },
];

export default function RecommendationsScreen() {
  const selectedChild = useChildStore((s) => s.selectedChild);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'맞춤 추천'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* 소개 카드 */}
      <View style={styles.introCard}>
        <Image source={require('../../assets/mascot-happy.png')} style={styles.introImage} resizeMode="contain" />
        <Text style={styles.introTitle}>
          {selectedChild
            ? `${selectedChild.name}을(를) 위한 맞춤 추천`
            : '우리 아이 맞춤 추천'}
        </Text>
        <Text style={styles.introDesc}>
          {'아이의 기질과 발달 단계에 맞춘\n실천 가능한 추천을 확인해보세요'}
        </Text>
      </View>

      {/* 카테고리 카드 */}
      {CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.label}
          style={styles.card}
          onPress={() =>
            router.push({
              pathname: '/(main)/recommendation-list',
              params: { category: cat.category },
            })
          }
          activeOpacity={0.7}
        >
          <View style={[styles.iconWrap, { backgroundColor: cat.bgColor }]}>
            <Image source={cat.icon} style={styles.cardIcon} resizeMode="contain" />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardLabel}>{cat.label}</Text>
            <Text style={styles.cardDesc}>{cat.description}</Text>
          </View>
          <Text style={[styles.cardArrow, { color: cat.color }]}>{'>'}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, paddingTop: 56, paddingBottom: 120 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  backArrow: { fontSize: 24, color: COLORS.text, fontWeight: '300', paddingRight: SPACING.sm },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },

  introCard: {
    backgroundColor: COLORS.primaryLight, borderRadius: 20,
    padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.lg,
  },
  introEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  introTitle: {
    fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text,
    textAlign: 'center', marginBottom: SPACING.xs,
  },
  introDesc: {
    fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: SPACING.md, marginBottom: SPACING.sm,
    ...SHADOWS.soft,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  cardEmoji: { fontSize: 26 },
  cardIcon: { width: 32, height: 32 },
  introImage: { width: 64, height: 64, marginBottom: SPACING.sm },
  cardTextWrap: { flex: 1 },
  cardLabel: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  cardArrow: { fontSize: 20, fontWeight: '300' },
});

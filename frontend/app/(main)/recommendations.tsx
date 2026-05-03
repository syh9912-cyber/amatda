import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { AdSlot } from '../../components/ads/AdSlot';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';

interface CategoryItem {
  icon: ReturnType<typeof require>;
  label: string;
  description: string;
  category: string;
  color: string;
  bgColor: string;
}

const PARENTING_CATEGORIES: CategoryItem[] = [
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

type Trimester = 'early' | 'mid' | 'late';

function getTrimester(week: number): Trimester {
  if (week <= 13) return 'early';
  if (week <= 27) return 'mid';
  return 'late';
}

function getPregnancyCategories(trimester: Trimester): CategoryItem[] {
  const FOOD_DESC: Record<Trimester, string> = {
    early: '입덧 완화 식단과 엽산 식품',
    mid: '철분·칼슘 풍부한 임산부 영양 식단',
    late: '체중 관리와 부종 완화 식단',
  };
  const EXERCISE_DESC: Record<Trimester, string> = {
    early: '가벼운 산책과 스트레칭',
    mid: '임산부 요가와 케겔 운동',
    late: '분만 호흡법과 출산 준비 운동',
  };
  const PRENATAL_DESC: Record<Trimester, string> = {
    early: '태교 시작과 초기 음악·도서',
    mid: '집중 태교와 추천 그림책',
    late: '아기와 교감하는 태교 마무리',
  };
  const SUPPLY_DESC: Record<Trimester, string> = {
    early: '초기 임산부 필수 준비물',
    mid: '아기방·기저귀·옷 준비 가이드',
    late: '출산가방과 신생아 필수품',
  };

  return [
    {
      icon: require('../../assets/cat-eating.png'),
      label: '임산부 음식',
      description: FOOD_DESC[trimester],
      category: '임산부음식',
      color: '#FF8C5A',
      bgColor: '#FFF0E6',
    },
    {
      icon: require('../../assets/preg-foot.png'),
      label: '운동·요가',
      description: EXERCISE_DESC[trimester],
      category: '임산부운동',
      color: '#4ECDC4',
      bgColor: '#E8FAF8',
    },
    {
      icon: require('../../assets/preg-leaf.png'),
      label: '태교·책',
      description: PRENATAL_DESC[trimester],
      category: '태교',
      color: '#7C83EC',
      bgColor: '#EEEDFC',
    },
    {
      icon: require('../../assets/preg-bag.png'),
      label: '출산용품',
      description: SUPPLY_DESC[trimester],
      category: '출산용품',
      color: '#E91E63',
      bgColor: '#FCE4EC',
    },
  ];
}

const TRIMESTER_BADGE: Record<Trimester, string> = {
  early: '초기 (1~13주)',
  mid: '중기 (14~27주)',
  late: '후기 (28주~)',
};

export default function RecommendationsScreen() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const isPregnant = !!selectedChild?.isPregnant;
  const week = selectedChild?.pregnancyWeeks ?? 0;
  const trimester = getTrimester(week);

  const categories = isPregnant
    ? getPregnancyCategories(trimester)
    : PARENTING_CATEGORIES;

  const introTitle = selectedChild
    ? isPregnant
      ? `${selectedChild.name} 엄마를 위한 맞춤 추천`
      : `${selectedChild.name}을(를) 위한 맞춤 추천`
    : '우리 아이 맞춤 추천';

  const introDesc = isPregnant
    ? `현재 ${week}주차 · ${TRIMESTER_BADGE[trimester]}\n주차에 맞는 임산부 가이드를 확인해보세요`
    : '아이의 기질과 발달 단계에 맞춘\n실천 가능한 추천을 확인해보세요';

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'맞춤 추천'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* 소개 카드 */}
      <View style={styles.introCard}>
        <Image
          source={isPregnant
            ? require('../../assets/preg-mood-good.png')
            : require('../../assets/mascot-happy.png')}
          style={styles.introImage}
          resizeMode="contain"
        />
        <Text style={styles.introTitle}>{introTitle}</Text>
        <Text style={styles.introDesc}>{introDesc}</Text>
      </View>

      {/* 카테고리 카드 */}
      {categories.map((cat) => (
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
    <AdSlot />
    </View>
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

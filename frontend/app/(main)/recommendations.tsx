import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useChildStore } from '../../stores/childStore';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';

interface CategoryItem {
  icon: ReturnType<typeof require>;
  label: string;
  description: string;
  category: string;
  color: string;
  bgColor: string;
}

function getParentingCategories(t: TFunction): CategoryItem[] {
  return [
    {
      icon: require('../../assets/cat-eating.png'),
      label: t('recommendations.category.food.label'),
      description: t('recommendations.category.food.description'),
      category: '음식',
      color: '#FF8C5A',
      bgColor: '#FFF0E6',
    },
    {
      icon: require('../../assets/cat-growth.png'),
      label: t('recommendations.category.lifestyle.label'),
      description: t('recommendations.category.lifestyle.description'),
      category: '생활습관',
      color: '#4ECDC4',
      bgColor: '#E8FAF8',
    },
    {
      icon: require('../../assets/cat-social.png'),
      label: t('recommendations.category.academy.label'),
      description: t('recommendations.category.academy.description'),
      category: '학원',
      color: '#7C83EC',
      bgColor: '#EEEDFC',
    },
    {
      icon: require('../../assets/play-activity.png'),
      label: t('recommendations.category.playLearning.label'),
      description: t('recommendations.category.playLearning.description'),
      category: '놀이학습',
      color: '#FFB344',
      bgColor: '#FFF8E1',
    },
  ];
}

type Trimester = 'early' | 'mid' | 'late';

function getTrimester(week: number): Trimester {
  if (week <= 13) return 'early';
  if (week <= 27) return 'mid';
  return 'late';
}

function getPregnancyCategories(t: TFunction, trimester: Trimester): CategoryItem[] {
  const FOOD_DESC: Record<Trimester, string> = {
    early: t('recommendations.pregnancyCategory.food.early'),
    mid: t('recommendations.pregnancyCategory.food.mid'),
    late: t('recommendations.pregnancyCategory.food.late'),
  };
  const EXERCISE_DESC: Record<Trimester, string> = {
    early: t('recommendations.pregnancyCategory.exercise.early'),
    mid: t('recommendations.pregnancyCategory.exercise.mid'),
    late: t('recommendations.pregnancyCategory.exercise.late'),
  };
  const PRENATAL_DESC: Record<Trimester, string> = {
    early: t('recommendations.pregnancyCategory.prenatal.early'),
    mid: t('recommendations.pregnancyCategory.prenatal.mid'),
    late: t('recommendations.pregnancyCategory.prenatal.late'),
  };
  const SUPPLY_DESC: Record<Trimester, string> = {
    early: t('recommendations.pregnancyCategory.supply.early'),
    mid: t('recommendations.pregnancyCategory.supply.mid'),
    late: t('recommendations.pregnancyCategory.supply.late'),
  };

  return [
    {
      icon: require('../../assets/cat-eating.png'),
      label: t('recommendations.pregnancyCategory.food.label'),
      description: FOOD_DESC[trimester],
      category: '임산부음식',
      color: '#FF8C5A',
      bgColor: '#FFF0E6',
    },
    {
      icon: require('../../assets/preg-foot.png'),
      label: t('recommendations.pregnancyCategory.exercise.label'),
      description: EXERCISE_DESC[trimester],
      category: '임산부운동',
      color: '#4ECDC4',
      bgColor: '#E8FAF8',
    },
    {
      icon: require('../../assets/preg-leaf.png'),
      label: t('recommendations.pregnancyCategory.prenatal.label'),
      description: PRENATAL_DESC[trimester],
      category: '태교',
      color: '#7C83EC',
      bgColor: '#EEEDFC',
    },
    {
      icon: require('../../assets/preg-bag.png'),
      label: t('recommendations.pregnancyCategory.supply.label'),
      description: SUPPLY_DESC[trimester],
      category: '출산용품',
      color: '#E91E63',
      bgColor: '#FCE4EC',
    },
  ];
}

function getTrimesterBadge(t: TFunction): Record<Trimester, string> {
  return {
    early: t('recommendations.trimesterBadge.early'),
    mid: t('recommendations.trimesterBadge.mid'),
    late: t('recommendations.trimesterBadge.late'),
  };
}

export default function RecommendationsScreen() {
  const { t } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const isPregnant = !!selectedChild?.isPregnant;
  const week = selectedChild?.pregnancyWeeks ?? 0;
  const trimester = getTrimester(week);

  const categories = isPregnant
    ? getPregnancyCategories(t, trimester)
    : getParentingCategories(t);

  const trimesterBadge = getTrimesterBadge(t);

  const introTitle = selectedChild
    ? isPregnant
      ? t('recommendations.introTitle.pregnantWithName', { name: selectedChild.name })
      : t('recommendations.introTitle.childWithName', { name: selectedChild.name })
    : t('recommendations.introTitle.default');

  const introDesc = isPregnant
    ? t('recommendations.introDesc.pregnant', { week, badge: trimesterBadge[trimester] })
    : t('recommendations.introDesc.default');

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerWrap}>
        <ScreenHeader title={t('recommendations.headerTitle')} />
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
  headerWrap: {
    marginBottom: SPACING.lg,
  },
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

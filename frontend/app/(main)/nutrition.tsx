import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking, Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import {
  FOOD_RECOMMENDATIONS,
  resolveTemperamentKey,
} from '../../constants/foodRecommendations';
import type {
  FoodRecommendation,
  AvoidFood,
} from '../../constants/foodRecommendations';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                   */
/* ------------------------------------------------------------------ */

type FoodTab = 'good' | 'bad';

const MINT = '#4ECDC4';
const MINT_LIGHT = '#E8FAF8';
const CORAL_RED = '#FF6B6B';
const CORAL_RED_LIGHT = '#FFF0F0';

function getRecommendPercent(index: number): string {
  const values = [95, 92, 90, 88, 85, 83, 80, 78];
  return `${values[index % values.length]}%`;
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export default function NutritionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<FoodTab>('good');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    new Set(),
  );
  const selectedChild = useChildStore((s) => s.selectedChild);

  const temperamentKey = resolveTemperamentKey(
    selectedChild?.innateData?.dominantType ?? '',
  );
  const foods = FOOD_RECOMMENDATIONS[temperamentKey];

  const toggleExpand = useCallback((idx: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const openYoutube = useCallback((query: string) => {
    const url = `https://m.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('열 수 없어요', '유튜브를 열 수 없습니다. 잠시 후 다시 시도해주세요.');
    });
  }, []);

  const childName = selectedChild?.name ?? '';
  const dominantLabel =
    selectedChild?.innateData?.dominantType?.split('(')[0] ?? '';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title={`${childName}${childName.endsWith('를') ? '' : '를'} 위한 식단 가이드`}
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ToggleTabs active={activeTab} onChange={setActiveTab} />

        {activeTab === 'good' ? (
          foods.good.map((food, idx) => (
            <GoodFoodCard
              key={idx}
              food={food}
              index={idx}
              childName={childName}
              dominantLabel={dominantLabel}
              expanded={expandedItems.has(idx)}
              onToggle={toggleExpand}
              onYoutube={openYoutube}
            />
          ))
        ) : (
          foods.bad.map((food, idx) => (
            <BadFoodCard key={idx} food={food} index={idx} />
          ))
        )}

        <MedicalCitation
          note="음식 권장은 일반 영양 정보 기반 참고용이며, 알레르기·질환이 있는 경우 소아과 의사와 상담하세요."
          sources={[
            { label: '식품의약품안전처 식품영양성분 데이터베이스', url: 'https://www.foodsafetykorea.go.kr' },
            { label: '보건복지부 한국인 영양소 섭취기준', url: 'https://www.mohw.go.kr' },
          ]}
        />
      </ScrollView>
      <AdSlot />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle Tabs                                                        */
/* ------------------------------------------------------------------ */

function ToggleTabs({
  active,
  onChange,
}: {
  active: FoodTab;
  onChange: (t: FoodTab) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <TouchableOpacity
        style={[
          styles.toggleBtn,
          active === 'good' && styles.toggleBtnGoodActive,
        ]}
        onPress={() => onChange('good')}
      >
        <Text
          style={[
            styles.toggleText,
            active === 'good' && styles.toggleTextActive,
          ]}
        >
          {'먹으면 좋은 음식'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.toggleBtn,
          active === 'bad' && styles.toggleBtnBadActive,
        ]}
        onPress={() => onChange('bad')}
      >
        <Text
          style={[
            styles.toggleText,
            active === 'bad' && styles.toggleTextActive,
          ]}
        >
          {'피해야 할 음식'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Good Food Card                                                     */
/* ------------------------------------------------------------------ */

function GoodFoodCard({
  food,
  index,
  childName,
  dominantLabel,
  expanded,
  onToggle,
  onYoutube,
}: {
  food: FoodRecommendation;
  index: number;
  childName: string;
  dominantLabel: string;
  expanded: boolean;
  onToggle: (idx: number) => void;
  onYoutube: (query: string) => void;
}) {
  return (
    <View style={[styles.foodCard, { borderLeftColor: MINT }]}>
      {/* Top row */}
      <View style={styles.foodRow}>
        <View style={[styles.foodEmojiWrap, { backgroundColor: MINT_LIGHT }]}>
          <Text style={styles.foodEmoji}>{food.emoji}</Text>
        </View>
        <View style={styles.foodTextWrap}>
          <Text style={styles.foodName}>{food.name}</Text>
        </View>
        <View style={styles.mintBadge}>
          <Text style={styles.mintBadgeText}>
            {'추천도 '}{getRecommendPercent(index)}
          </Text>
        </View>
      </View>

      {/* Reason */}
      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>
          {'추천 이유'}
        </Text>
        <Text style={styles.reasonText}>
          {`${dominantLabel} 기질의 ${childName}에게 - ${food.reason}`}
        </Text>
      </View>

      {/* Caution */}
      {food.caution && (
        <View style={styles.cautionBox}>
          <Text style={styles.cautionLabel}>
            {'주의사항'}
          </Text>
          <Text style={styles.cautionText}>{food.caution}</Text>
        </View>
      )}

      {/* Recipe toggle */}
      <View style={styles.recipeSection}>
        <TouchableOpacity
          style={[styles.recipeToggle, { backgroundColor: MINT_LIGHT }]}
          onPress={() => onToggle(index)}
        >
          <Text style={[styles.recipeToggleText, { color: MINT }]}>
            {expanded
              ? '간단 레시피 접기'
              : '간단 레시피 보기'}
          </Text>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.recipeCard}>
            {food.recipe.map((step, sIdx) => (
              <View key={sIdx} style={styles.recipeStep}>
                <View style={[styles.stepDot, { backgroundColor: MINT }]}>
                  <Text style={styles.stepNumber}>{sIdx + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* YouTube button */}
      <TouchableOpacity
        style={styles.youtubeBtn}
        onPress={() => onYoutube(food.youtubeQuery)}
      >
        <Text style={styles.youtubeBtnText}>
          {'유튜브 검색'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Bad Food Card                                                      */
/* ------------------------------------------------------------------ */

function BadFoodCard({
  food,
  index,
}: {
  food: AvoidFood;
  index: number;
}) {
  return (
    <View
      style={[
        styles.foodCard,
        { backgroundColor: CORAL_RED_LIGHT, borderLeftColor: CORAL_RED },
      ]}
    >
      <View style={styles.foodRow}>
        <View
          style={[styles.foodEmojiWrap, { backgroundColor: '#FFE0E0' }]}
        >
          <Text style={styles.foodEmoji}>{food.emoji}</Text>
        </View>
        <View style={styles.foodTextWrap}>
          <Text style={styles.foodName}>{food.name}</Text>
          <Text style={styles.foodBenefit}>{food.reason}</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F2' },
  scrollView: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl * 3,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: '#FFF8F2',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: COLORS.text, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* Toggle */
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  toggleBtnGoodActive: { backgroundColor: MINT, borderColor: MINT },
  toggleBtnBadActive: { backgroundColor: CORAL_RED, borderColor: CORAL_RED },
  toggleText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  toggleTextActive: { color: '#FFFFFF' },

  /* Food Card */
  foodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: MINT,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  foodEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  foodEmoji: { fontSize: 22 },
  foodTextWrap: { flex: 1, marginRight: SPACING.sm },
  foodName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  foodBenefit: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  mintBadge: {
    backgroundColor: MINT_LIGHT,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  mintBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: MINT,
  },

  /* Reason */
  reasonBox: {
    marginTop: SPACING.sm,
    backgroundColor: '#F0FFFE',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  reasonLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: MINT,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },

  /* Caution */
  cautionBox: {
    marginTop: SPACING.xs,
    backgroundColor: '#FFF8E1',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  cautionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: '#E6A817',
    marginBottom: 2,
  },
  cautionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },

  /* Recipe */
  recipeSection: { marginTop: SPACING.sm },
  recipeToggle: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  recipeToggleText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  recipeCard: {
    marginTop: SPACING.sm,
    backgroundColor: '#F8FFFE',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  recipeStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  stepNumber: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },

  /* YouTube */
  youtubeBtn: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    backgroundColor: '#FF0000',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  youtubeBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

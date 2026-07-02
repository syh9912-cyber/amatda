import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking, Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
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

// 한글 목적격 조사(을/를) — 마지막 글자의 받침 유무로 판정.
function objectParticle(name: string): string {
  if (!name) return '';
  const last = name.charCodeAt(name.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return '를'; // 한글 음절 밖이면 기본 '를'
  return (last - 0xac00) % 28 === 0 ? '를' : '을';
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export default function NutritionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
      Alert.alert(t('nutrition.cannotOpenTitle'), t('nutrition.cannotOpenYoutube'));
    });
  }, [t]);

  const childName = selectedChild?.name ?? '';
  const displayName = childName || t('nutrition.defaultChildName');
  const dominantLabel =
    selectedChild?.innateData?.dominantType?.split('(')[0] ?? '';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title={t('nutrition.title', { name: displayName, particle: objectParticle(displayName) })}
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
          note={t('nutrition.citationNote')}
          sources={[
            { label: t('nutrition.citationSourceFoodSafety'), url: 'https://www.foodsafetykorea.go.kr' },
            { label: t('nutrition.citationSourceMohw'), url: 'https://www.mohw.go.kr' },
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
  onChange: (tab: FoodTab) => void;
}) {
  const { t } = useTranslation();
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
          {t('nutrition.tabGood')}
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
          {t('nutrition.tabBad')}
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
  const { t } = useTranslation();
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
            {t('nutrition.customRecommended')}
          </Text>
        </View>
      </View>

      {/* Reason */}
      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>
          {t('nutrition.reasonLabel')}
        </Text>
        <Text style={styles.reasonText}>
          {t('nutrition.reasonText', { trait: dominantLabel, name: childName, reason: food.reason })}
        </Text>
      </View>

      {/* Caution */}
      {food.caution && (
        <View style={styles.cautionBox}>
          <Text style={styles.cautionLabel}>
            {t('nutrition.cautionLabel')}
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
              ? t('nutrition.recipeCollapse')
              : t('nutrition.recipeExpand')}
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
          {t('nutrition.youtubeSearch')}
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

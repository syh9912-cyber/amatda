import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { foodApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FoodItem {
  name: string;
  benefit: string;
  caution?: string;
  recipe?: string[];
  youtubeQuery?: string;
}

interface FoodGuide {
  id: string;
  suitableType: string;
  foods: FoodItem[];
}

type FoodTab = 'good' | 'bad';

const MINT = '#4ECDC4';
const MINT_LIGHT = '#E8FAF8';
const CORAL_RED = '#FF6B6B';
const CORAL_RED_LIGHT = '#FFF0F0';

/* ------------------------------------------------------------------ */
/*  Emoji helpers                                                      */
/* ------------------------------------------------------------------ */

const GOOD_EMOJIS = ['🥦', '🐟', '🫐', '🥕', '🍎', '🥚', '🥜', '🍠', '🥑', '🍊'];
const BAD_EMOJIS = ['🍬', '🥤', '🍟', '🍕', '🍩', '🍫', '🧁', '🌭', '🍿', '🥫'];

function getEmoji(index: number, tab: FoodTab): string {
  const list = tab === 'good' ? GOOD_EMOJIS : BAD_EMOJIS;
  return list[index % list.length];
}

function getRecommendPercent(index: number): string {
  const values = [95, 90, 88, 85, 82, 80, 78, 75];
  return `${values[index % values.length]}%`;
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export default function NutritionScreen() {
  const router = useRouter();
  const [guides, setGuides] = useState<FoodGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FoodTab>('good');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const selectedChild = useChildStore((s) => s.selectedChild);

  useEffect(() => {
    if (selectedChild) loadGuides();
  }, [selectedChild?.id]);

  const loadGuides = async () => {
    if (!selectedChild) return;
    try {
      const res = await foodApi.list(
        selectedChild.ageInfo.months,
        selectedChild.innateData.dominantType,
      );
      setGuides(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = useCallback((key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const openYoutube = useCallback((query: string) => {
    const url = `https://m.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    Linking.openURL(url);
  }, []);

  /* Split foods into good / bad based on caution field */
  const allFoods: { food: FoodItem; guideId: string; idx: number }[] = [];
  guides.forEach((g) =>
    g.foods.forEach((f, i) => allFoods.push({ food: f, guideId: g.id, idx: i }))
  );
  const goodFoods = allFoods.filter((f) => !f.food.caution);
  const badFoods = allFoods.filter((f) => !!f.food.caution);
  const displayFoods = activeTab === 'good' ? goodFoods : badFoods;

  /* Also use analysisReport goodFoods/badFoods if API returns nothing */
  const report = selectedChild?.analysisReport;
  const reportGoodFoods = report?.goodFoods ?? [];
  const reportBadFoods = report?.badFoods ?? [];

  const childName = selectedChild?.name ?? '';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <Header
        title={`${childName}를 위한 식단 가이드`}
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Toggle Tabs */}
        <ToggleTabs active={activeTab} onChange={setActiveTab} />

        {loading ? (
          <ActivityIndicator
            size="large"
            color={activeTab === 'good' ? MINT : CORAL_RED}
            style={{ marginTop: SPACING.xl * 2 }}
          />
        ) : displayFoods.length > 0 ? (
          displayFoods.map(({ food, guideId, idx }, flatIdx) => {
            const itemKey = `${guideId}-${idx}`;
            return (
              <FoodCard
                key={itemKey}
                food={food}
                tab={activeTab}
                index={flatIdx}
                itemKey={itemKey}
                expanded={expandedItems.has(itemKey)}
                onToggle={toggleExpand}
                onYoutube={openYoutube}
              />
            );
          })
        ) : (
          /* Fallback to analysisReport strings */
          <ReportFoodList
            items={activeTab === 'good' ? reportGoodFoods : reportBadFoods}
            tab={activeTab}
          />
        )}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backArrow}>{'<'}</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.backBtn} />
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
            active === 'good' && styles.toggleTextGoodActive,
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
            active === 'bad' && styles.toggleTextBadActive,
          ]}
        >
          {'피해야 할 음식'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Food Card                                                          */
/* ------------------------------------------------------------------ */

function FoodCard({
  food,
  tab,
  index,
  itemKey,
  expanded,
  onToggle,
  onYoutube,
}: {
  food: FoodItem;
  tab: FoodTab;
  index: number;
  itemKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  onYoutube: (query: string) => void;
}) {
  const isGood = tab === 'good';
  const accentColor = isGood ? MINT : CORAL_RED;
  const bgTint = isGood ? '#FFFFFF' : CORAL_RED_LIGHT;
  const hasRecipe = food.recipe && food.recipe.length > 0;

  return (
    <View style={[styles.foodCard, { backgroundColor: bgTint, borderLeftColor: accentColor }]}>
      <View style={styles.foodRow}>
        {/* Emoji */}
        <View style={[styles.foodEmojiWrap, { backgroundColor: isGood ? MINT_LIGHT : CORAL_RED_LIGHT }]}>
          <Text style={styles.foodEmoji}>{getEmoji(index, tab)}</Text>
        </View>

        {/* Text */}
        <View style={styles.foodTextWrap}>
          <Text style={styles.foodName}>{food.name}</Text>
          <Text style={styles.foodBenefit} numberOfLines={2}>
            {isGood ? food.benefit : (food.caution ?? food.benefit)}
          </Text>
        </View>

        {/* Badge (good only) */}
        {isGood && (
          <View style={styles.mintBadge}>
            <Text style={styles.mintBadgeText}>
              {'추천도 '}{getRecommendPercent(index)}
            </Text>
          </View>
        )}
      </View>

      {/* Recipe expandable */}
      {hasRecipe && (
        <View style={styles.recipeSection}>
          <TouchableOpacity
            style={[styles.recipeToggle, { backgroundColor: isGood ? MINT_LIGHT : CORAL_RED_LIGHT }]}
            onPress={() => onToggle(itemKey)}
          >
            <Text style={[styles.recipeToggleText, { color: accentColor }]}>
              {expanded ? '레시피 접기' : '레시피 보기'}
            </Text>
          </TouchableOpacity>

          {expanded && (
            <View style={styles.recipeCard}>
              {food.recipe!.map((step, sIdx) => (
                <View key={sIdx} style={styles.recipeStep}>
                  <View style={[styles.stepDot, { backgroundColor: accentColor }]}>
                    <Text style={styles.stepNumber}>{sIdx + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* YouTube link */}
      {food.youtubeQuery && (
        <TouchableOpacity
          style={styles.youtubeBtn}
          onPress={() => onYoutube(food.youtubeQuery!)}
        >
          <Text style={styles.youtubeBtnText}>
            {'유튜브에서 보기 ▶️'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Report Food List (fallback when API has no items)                   */
/* ------------------------------------------------------------------ */

function ReportFoodList({
  items,
  tab,
}: {
  items: string[];
  tab: FoodTab;
}) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>
          해당 연령/기질에 맞는 영양 가이드가 아직 준비 중입니다
        </Text>
      </View>
    );
  }

  const isGood = tab === 'good';
  const bgTint = isGood ? '#FFFFFF' : CORAL_RED_LIGHT;
  const accentColor = isGood ? MINT : CORAL_RED;

  return (
    <>
      {items.map((item, i) => (
        <View
          key={i}
          style={[styles.foodCard, { backgroundColor: bgTint, borderLeftColor: accentColor }]}
        >
          <View style={styles.foodRow}>
            <View style={[styles.foodEmojiWrap, { backgroundColor: isGood ? MINT_LIGHT : CORAL_RED_LIGHT }]}>
              <Text style={styles.foodEmoji}>{getEmoji(i, tab)}</Text>
            </View>
            <View style={styles.foodTextWrap}>
              <Text style={styles.foodName}>{item}</Text>
            </View>
            {isGood && (
              <View style={styles.mintBadge}>
                <Text style={styles.mintBadgeText}>
                  {'추천도 '}{getRecommendPercent(i)}
                </Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },
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

  /* Toggle Tabs */
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
  toggleBtnGoodActive: {
    backgroundColor: MINT,
    borderColor: MINT,
  },
  toggleBtnBadActive: {
    backgroundColor: CORAL_RED,
    borderColor: CORAL_RED,
  },
  toggleText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  toggleTextGoodActive: { color: '#FFFFFF' },
  toggleTextBadActive: { color: '#FFFFFF' },

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

  /* Recipe */
  recipeSection: { marginTop: SPACING.sm },
  recipeToggle: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  recipeToggleText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
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

  /* Empty */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
  },
});

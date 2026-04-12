import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { recommendationApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';

/* ------------------------------------------------------------------ */
/*  Category styling                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_STYLE: Record<string, { emoji: string; color: string; bg: string }> = {
  '음식':     { emoji: '🍽', color: '#FF8C5A', bg: '#FFF0E6' },
  '생활습관': { emoji: '🌿', color: '#4ECDC4', bg: '#E8FAF8' },
  '학원':     { emoji: '🏫', color: '#7C83EC', bg: '#EEEDFC' },
  '놀이학습': { emoji: '🎨', color: '#FFB344', bg: '#FFF8E1' },
};

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface RecoItem {
  title: string;
  answer: string;
  reasons: string[];
  actions: string[];
  personalNote: string;
}

/* ------------------------------------------------------------------ */
/*  Screen                                                              */
/* ------------------------------------------------------------------ */

export default function RecommendationListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category: string }>();
  const category = params.category ?? '';
  const selectedChild = useChildStore((s) => s.selectedChild);

  const [items, setItems] = useState<RecoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const catStyle = CATEGORY_STYLE[category] ?? CATEGORY_STYLE['음식'];

  useEffect(() => {
    if (!selectedChild || !category) return;
    fetchList();
  }, [selectedChild?.id, category]);

  const fetchList = async () => {
    if (!selectedChild) return;
    setLoading(true);
    try {
      const months = selectedChild.ageInfo?.months ?? 0;
      const ageGroup = months <= 36 ? 'infant'
        : months <= 83 ? 'toddler'
        : months <= 119 ? 'elementary_low'
        : 'elementary_high';
      const temperament = selectedChild.innateData?.dominantType ?? '안정형';
      const res = await recommendationApi.list(category, ageGroup, temperament);
      const data = res.data?.data as { items?: RecoItem[] } | undefined;
      setItems(data?.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{catStyle.emoji} {category}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={catStyle.color} />
          <Text style={styles.loadingText}>
            {selectedChild?.name ?? '아이'}에 맞는 {category} 추천을 불러오고 있어요...
          </Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>{catStyle.emoji}</Text>
          <Text style={styles.emptyText}>아직 준비 중이에요</Text>
          <Text style={styles.emptySubText}>곧 {category} 추천이 추가됩니다</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {items.map((item, idx) => {
            const isExpanded = expandedIdx === idx;
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.card,
                  { borderLeftColor: catStyle.color },
                  !isExpanded && styles.cardCollapsed,
                ]}
                activeOpacity={0.7}
                onPress={() => setExpandedIdx(isExpanded ? null : idx)}
              >
                {/* Title */}
                <View style={styles.cardHeader}>
                  <View style={[styles.dot, { backgroundColor: catStyle.color }]} />
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={[styles.chevronBadge, { backgroundColor: catStyle.bg }]}>
                    <Text style={[styles.chevronIcon, { color: catStyle.color }]}>
                      {isExpanded ? '\u2303' : '\u2304'}
                    </Text>
                  </View>
                </View>

                {/* Answer (always visible) */}
                <Text style={styles.answer} numberOfLines={isExpanded ? undefined : 2}>
                  {item.answer}
                </Text>

                {/* Tap hint (collapsed only) */}
                {!isExpanded && (
                  <View style={styles.tapHintRow}>
                    <Text style={[styles.tapHintText, { color: catStyle.color }]}>
                      {'자세히 보기'}
                    </Text>
                    <Text style={[styles.tapHintArrow, { color: catStyle.color }]}>{'>'}</Text>
                  </View>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <View style={styles.details}>
                    {/* Reasons */}
                    {item.reasons.length > 0 && (
                      <View style={styles.section}>
                        <Text style={[styles.sectionLabel, { color: catStyle.color }]}>
                          {'💡 알아두세요'}
                        </Text>
                        {item.reasons.map((r, rIdx) => (
                          <View key={rIdx} style={styles.bulletRow}>
                            <View style={[styles.bulletDot, { backgroundColor: catStyle.color }]} />
                            <Text style={styles.bulletText}>{r}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Actions */}
                    {item.actions.length > 0 && (
                      <View style={styles.section}>
                        <Text style={[styles.sectionLabel, { color: catStyle.color }]}>
                          {'📋 실천 방법'}
                        </Text>
                        {item.actions.map((a, aIdx) => (
                          <View key={aIdx} style={styles.stepRow}>
                            <View style={[styles.stepNum, { backgroundColor: catStyle.color }]}>
                              <Text style={styles.stepNumText}>{aIdx + 1}</Text>
                            </View>
                            <Text style={styles.stepText}>{a}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Personal note */}
                    {item.personalNote ? (
                      <View style={[styles.noteBox, { backgroundColor: catStyle.bg }]}>
                        <Text style={[styles.noteLabel, { color: catStyle.color }]}>
                          {'🎯 우리 아이 맞춤 조언'}
                        </Text>
                        <Text style={styles.noteText}>{item.personalNote}</Text>
                      </View>
                    ) : null}

                    {/* Collapse button */}
                    <TouchableOpacity
                      style={[styles.collapseBtn, { borderColor: catStyle.color }]}
                      activeOpacity={0.7}
                      onPress={() => setExpandedIdx(null)}
                    >
                      <Text style={[styles.collapseBtnText, { color: catStyle.color }]}>
                        {'접기 \u2303'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: SPACING.md, paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: COLORS.text, fontWeight: '600' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text,
  },

  loadingWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  loadingText: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary,
    marginTop: SPACING.md, textAlign: 'center',
  },

  emptyWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.lg, color: COLORS.text, fontWeight: '600' },
  emptySubText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: SPACING.lg, marginBottom: SPACING.md,
    borderLeftWidth: 4,
    ...SHADOWS.medium,
  },
  cardCollapsed: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: SPACING.sm },
  cardTitle: {
    flex: 1, fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text,
  },
  chevronBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  chevronIcon: { fontSize: 16, fontWeight: '700' },

  answer: {
    fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 22,
  },

  tapHintRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    marginTop: SPACING.sm, paddingTop: SPACING.sm,
    borderTopWidth: 1, borderTopColor: '#F0EDE8',
  },
  tapHintText: {
    fontSize: FONT_SIZE.xs, fontWeight: '600',
  },
  tapHintArrow: {
    fontSize: FONT_SIZE.xs, fontWeight: '700', marginLeft: 4,
  },

  details: { marginTop: SPACING.md },

  collapseBtn: {
    marginTop: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  collapseBtnText: {
    fontSize: FONT_SIZE.sm, fontWeight: '600',
  },

  section: { marginBottom: SPACING.md },
  sectionLabel: {
    fontSize: FONT_SIZE.sm, fontWeight: '700', marginBottom: SPACING.sm,
  },

  bulletRow: { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },
  bulletDot: {
    width: 6, height: 6, borderRadius: 3, marginTop: 7, marginRight: 8,
  },
  bulletText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },

  stepRow: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  stepNum: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  stepText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },

  noteBox: {
    borderRadius: 12, padding: SPACING.md,
  },
  noteLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', marginBottom: 4 },
  noteText: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
});

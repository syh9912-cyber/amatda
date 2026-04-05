import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { childApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { ELEMENT_BOOST_ACTIVITIES } from '../../constants/elementActivities';

const ELEMENT_COLORS: Record<string, string> = {
  wood: COLORS.wood,
  fire: COLORS.fire,
  earth: COLORS.earth,
  metal: COLORS.metal,
  water: COLORS.water,
};

const ELEMENT_LABELS: Record<string, string> = {
  wood: '탐구',
  fire: '활동',
  earth: '안정',
  metal: '분석',
  water: '감성',
};

interface TraitDetail {
  personality: string[];
  strengths: string[];
  cautions: string[];
  parentingTips: string[];
  learningStyle: string;
  socialStyle: string;
  stressResponse: string;
  bestActivities: string[];
  bestFoods: string[];
}

export default function TraitDetailScreen() {
  const [detail, setDetail] = useState<TraitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedChild = useChildStore((s) => s.selectedChild);

  useEffect(() => {
    if (selectedChild) loadDetail();
  }, [selectedChild?.id]);

  const loadDetail = async () => {
    if (!selectedChild) return;
    try {
      const res = await childApi.get(selectedChild.id);
      const innate = res.data.data.innateData;
      setDetail(innate.detail || null);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '기질 상세', headerShown: true }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const child = selectedChild;
  if (!child) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `${child.name}의 기질 분석`, headerShown: true }} />

      {/* 헤더 */}
      <View style={styles.heroCard}>
        <Text style={styles.heroType}>{child.innateData.dominantType}</Text>
        <Text style={styles.heroLabel}>{child.innateData.label}</Text>
      </View>

      {/* 에너지 분포 */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>에너지 분포</Text>
        {Object.entries(child.innateData.fiveElements).map(([key, val]) => {
          const maxVal = Math.max(
            ...Object.values(child.innateData.fiveElements),
            1,
          );
          return (
            <View key={key} style={styles.chartBarRow}>
              <Text style={styles.chartBarLabel}>
                {ELEMENT_LABELS[key] ?? key}
              </Text>
              <View style={styles.chartBarBg}>
                <View
                  style={[
                    styles.chartBarFill,
                    {
                      width: `${(val / maxVal) * 100}%`,
                      backgroundColor: ELEMENT_COLORS[key] ?? COLORS.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.chartBarVal}>{val}</Text>
            </View>
          );
        })}
      </View>

      {detail ? (
        <>
          <Section title="성격 특성" emoji="🧒" items={detail.personality} />
          <Section title="강점" emoji="💪" items={detail.strengths} />
          <Section title="주의할 점" emoji="⚠️" items={detail.cautions} />
          <Section title="양육 팁" emoji="💡" items={detail.parentingTips} />

          <InfoCard title="학습 스타일" emoji="📖" text={detail.learningStyle} />
          <InfoCard title="사회성" emoji="👫" text={detail.socialStyle} />
          <InfoCard title="스트레스 반응" emoji="😰" text={detail.stressResponse} />

          <TagSection title="추천 활동" emoji="🎯" tags={detail.bestActivities} color={COLORS.primary} />
          <TagSection title="추천 영양" emoji="🥗" tags={detail.bestFoods} color="#38D9A9" />
        </>
      ) : (
        <View style={styles.fallbackCard}>
          <Text style={styles.fallbackTitle}>{child.innateData.dominantType} 기질이란?</Text>
          <Text style={styles.fallbackText}>{child.innateData.label}</Text>
          <Text style={styles.fallbackHint}>
            기질 상세 분석은 앱 업데이트 후 제공됩니다.
          </Text>
        </View>
      )}

      {/* 에너지 보강 활동 */}
      <EnergyBoostSection fiveElements={child.innateData.fiveElements} />
    </ScrollView>
  );
}

function Section({ title, emoji, items }: { title: string; emoji: string; items: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{emoji} {title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoCard({ title, emoji, text }: { title: string; emoji: string; text: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>{emoji} {title}</Text>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function TagSection({ title, emoji, tags, color }: { title: string; emoji: string; tags: string[]; color: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{emoji} {title}</Text>
      <View style={styles.tagRow}>
        {tags.map((tag, i) => (
          <View key={i} style={[styles.tag, { backgroundColor: color + '15', borderColor: color + '30' }]}>
            <Text style={[styles.tagText, { color }]}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function EnergyBoostSection({ fiveElements }: { fiveElements: Record<string, number> }) {
  const sorted = Object.entries(fiveElements).sort((a, b) => a[1] - b[1]);
  const weakest = sorted.slice(0, 2);

  return (
    <View style={styles.boostContainer}>
      <Text style={styles.sectionTitle}>{'⚡'} 에너지 보강 활동</Text>
      <Text style={styles.boostSubtext}>부족한 에너지를 채워주는 활동을 추천해요</Text>
      {weakest.map(([key]) => {
        const boost = ELEMENT_BOOST_ACTIVITIES[key];
        if (!boost) return null;
        const color = ELEMENT_COLORS[key] ?? COLORS.primary;
        return (
          <View key={key} style={styles.boostCard}>
            <View style={[styles.boostBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.boostBadgeText, { color }]}>{boost.label}</Text>
            </View>
            <Text style={styles.boostSubTitle}>추천 활동</Text>
            {boost.activities.map((act, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bullet}>{'•'}</Text>
                <Text style={styles.bulletText}>{act}</Text>
              </View>
            ))}
            <Text style={styles.boostSubTitle}>추천 식품</Text>
            <View style={styles.tagRow}>
              {boost.foods.map((f, i) => (
                <View key={i} style={[styles.tag, { backgroundColor: color + '15', borderColor: color + '30' }]}>
                  <Text style={[styles.tagText, { color }]}>{f}</Text>
                </View>
              ))}
            </View>
            <View style={styles.tipBox}>
              <Text style={styles.tipLabel}>{'💡'} 양육 팁</Text>
              <Text style={styles.tipText}>{boost.tip}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  heroCard: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: RADIUS.lg, padding: SPACING.xl,
    alignItems: 'center', marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.primary + '20',
  },
  heroType: { fontSize: 28, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  heroLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm, textAlign: 'center', lineHeight: 20 },
  section: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: '#F0EDE8',
  },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  bulletRow: { flexDirection: 'row', marginBottom: SPACING.sm, paddingRight: SPACING.md },
  bullet: { color: COLORS.primary, fontSize: 14, marginRight: SPACING.sm, marginTop: 1 },
  bulletText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
  infoCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: '#F0EDE8',
  },
  infoTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  infoText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 22 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tag: { borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderWidth: 1 },
  tagText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  chartCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: '#F0EDE8',
  },
  chartTitle: {
    fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text,
    marginBottom: SPACING.md,
  },
  chartBarRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm,
  },
  chartBarLabel: {
    width: 36, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
  },
  chartBarBg: {
    flex: 1, height: 12, backgroundColor: COLORS.border,
    borderRadius: 6, overflow: 'hidden', marginHorizontal: SPACING.sm,
  },
  chartBarFill: { height: '100%' as unknown as number, borderRadius: 6 },
  chartBarVal: {
    width: 28, fontSize: FONT_SIZE.sm, color: COLORS.text, textAlign: 'right' as const,
    fontWeight: '600',
  },
  fallbackCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl,
    alignItems: 'center', borderWidth: 1, borderColor: '#F0EDE8',
  },
  fallbackTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  fallbackText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  fallbackHint: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: SPACING.md },
  boostContainer: { marginTop: SPACING.lg },
  boostSubtext: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.md, marginTop: -SPACING.sm },
  boostCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: '#F0EDE8',
  },
  boostBadge: { alignSelf: 'flex-start', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, marginBottom: SPACING.md },
  boostBadgeText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  boostSubTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm, marginTop: SPACING.sm },
  tipBox: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md,
  },
  tipLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  tipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
});

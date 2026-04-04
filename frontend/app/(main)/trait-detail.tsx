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
  fallbackCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl,
    alignItems: 'center', borderWidth: 1, borderColor: '#F0EDE8',
  },
  fallbackTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  fallbackText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  fallbackHint: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: SPACING.md },
});

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { siblingApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface CompatResult {
  childA: string;
  childB: string;
  score: number;
  level: string;
  description: string;
  tips: string[];
}

export default function CompatibilityScreen() {
  const [results, setResults] = useState<CompatResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadCompat();
  }, []);

  const loadCompat = async () => {
    try {
      const res = await siblingApi.compatibility();
      setResults(res.data.data.results);
      if (res.data.data.message) setMessage(res.data.data.message);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) =>
    score >= 80 ? COLORS.success : score >= 65 ? COLORS.primary : COLORS.secondary;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '형제자매 궁합', headerShown: true }} />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : message ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{message}</Text>
        </View>
      ) : (
        results.map((r, idx) => (
          <View key={idx} style={styles.card}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{r.childA}</Text>
              <Text style={styles.heart}>💕</Text>
              <Text style={styles.name}>{r.childB}</Text>
            </View>
            <View style={styles.scoreRow}>
              <Text style={[styles.score, { color: scoreColor(r.score) }]}>
                {r.score}점
              </Text>
              <Text style={styles.level}>{r.level}</Text>
            </View>
            <Text style={styles.desc}>{r.description}</Text>
            {r.tips.map((tip, ti) => (
              <View key={ti} style={styles.tipRow}>
                <Text style={styles.bullet}>💡</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.xl, alignItems: 'center',
  },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
  },
  nameRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: SPACING.md, marginBottom: SPACING.md,
  },
  name: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  heart: { fontSize: 20 },
  scoreRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline',
    gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  score: { fontSize: FONT_SIZE.xxl, fontWeight: '700' },
  level: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  desc: {
    fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    textAlign: 'center', marginBottom: SPACING.md,
  },
  tipRow: { flexDirection: 'row', marginBottom: SPACING.xs, gap: SPACING.sm },
  bullet: { fontSize: 14 },
  tipText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
});

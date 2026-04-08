import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { coachingApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { AnalyzerResult } from '../../components/coaching/AnalyzerResult';
import { COACHING_COLORS } from '../../components/coaching/types';

const CRY_TYPES = [
  { id: 'sharp', label: '\uB192\uACE0 \uB0A0\uCE74\uB85C\uC6B4 \uC6B8\uC74C' },
  { id: 'escalating', label: '\uC810\uC810 \uCEE4\uC9C0\uB294 \uBC18\uBCF5 \uC6B8\uC74C' },
  { id: 'whiny', label: '\uCE6D\uC5BC\uAC70\uB9BC/\uB0AE\uC740 \uC6B8\uC74C' },
  { id: 'sudden', label: '\uAC11\uC791\uC2A4\uB7EC\uC6B4 \uBE44\uBA85' },
  { id: 'soothable', label: '\uB2EC\uB798\uBA74 \uADF8\uCE58\uB294 \uC6B8\uC74C' },
  { id: 'unsoothable', label: '\uB2EC\uB798\uB3C4 \uC548 \uADF8\uCE58\uB294 \uC6B8\uC74C' },
] as const;

const DURATIONS = [
  '5\uBD84 \uBBF8\uB9CC',
  '5~15\uBD84',
  '15~30\uBD84',
  '30\uBD84 \uC774\uC0C1',
  '1\uC2DC\uAC04 \uC774\uC0C1',
] as const;

const SYMPTOMS = [
  { id: 'fever', label: '\uC5F4' },
  { id: 'full', label: '\uBC30\uBD80\uB984' },
  { id: 'diaper', label: '\uAE30\uC800\uADC0' },
  { id: 'sleepy', label: '\uC878\uB9BC' },
  { id: 'unusual', label: '\uD3C9\uC18C\uC640 \uB2E4\uB984' },
] as const;

interface AnalysisResult {
  childName?: string;
  type: 'cry' | 'poop';
  analysis: string;
  possibilities: Array<{ label: string; likelihood: string }>;
  recommendations: string[];
  needsDoctor: boolean;
}

export default function CryAnalyzerScreen() {
  const router = useRouter();
  const child = useChildStore((s) => s.selectedChild);
  const [selectedCries, setSelectedCries] = useState<Set<string>>(new Set());
  const [duration, setDuration] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const toggleCry = useCallback((id: string) => {
    setSelectedCries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSymptom = useCallback((id: string) => {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const buildDescription = useCallback((): string => {
    const parts: string[] = [];
    const cryLabels = CRY_TYPES.filter((c) => selectedCries.has(c.id)).map(
      (c) => c.label
    );
    if (cryLabels.length > 0)
      parts.push(`\uC6B8\uC74C \uD2B9\uC131: ${cryLabels.join(', ')}`);
    if (duration) parts.push(`\uC9C0\uC18D\uC2DC\uAC04: ${duration}`);
    const symLabels = SYMPTOMS.filter((s) => selectedSymptoms.has(s.id)).map(
      (s) => s.label
    );
    if (symLabels.length > 0)
      parts.push(`\uB3D9\uBC18\uC99D\uC0C1: ${symLabels.join(', ')}`);
    return parts.join('. ');
  }, [selectedCries, duration, selectedSymptoms]);

  const handleAnalyze = useCallback(async () => {
    if (!child || selectedCries.size === 0) return;
    setLoading(true);
    try {
      const desc = buildDescription();
      const res = await coachingApi.analyzeMedia(child.id, 'cry', desc);
      const data = res.data?.data as AnalysisResult | undefined;
      if (data) setResult(data);
    } catch {
      // backend fallback mock handles errors
    } finally {
      setLoading(false);
    }
  }, [child, selectedCries, buildDescription]);

  const handleReset = useCallback(() => {
    setResult(null);
    setSelectedCries(new Set());
    setDuration(null);
    setSelectedSymptoms(new Set());
  }, []);

  const canSubmit = selectedCries.size > 0 && !loading;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtn}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {'\uC6B8\uC74C\uC18C\uB9AC \uBD84\uC11D\uAE30'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {result ? (
          <AnalyzerResult result={result} onReset={handleReset} />
        ) : (
          <>
            <Text style={styles.sectionLabel}>
              {'\uD83D\uDE2D \uC6B8\uC74C \uD2B9\uC131 (\uBCF5\uC218 \uC120\uD0DD)'}
            </Text>
            <View style={styles.optionGrid}>
              {CRY_TYPES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.optionCard,
                    selectedCries.has(c.id) && styles.optionSelected,
                  ]}
                  onPress={() => toggleCry(c.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedCries.has(c.id) && styles.optionTextSelected,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>
              {'\u23F1\uFE0F \uC9C0\uC18D \uC2DC\uAC04'}
            </Text>
            <View style={styles.pillRow}>
              {DURATIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pill, duration === d && styles.pillSelected]}
                  onPress={() =>
                    setDuration((prev) => (prev === d ? null : d))
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      duration === d && styles.pillTextSelected,
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>
              {'\uD83E\uDE7A \uB3D9\uBC18 \uC99D\uC0C1 (\uBCF5\uC218 \uC120\uD0DD)'}
            </Text>
            <View style={styles.pillRow}>
              {SYMPTOMS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.pill,
                    selectedSymptoms.has(s.id) && styles.pillSelected,
                  ]}
                  onPress={() => toggleSymptom(s.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedSymptoms.has(s.id) && styles.pillTextSelected,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.analyzeBtn, !canSubmit && styles.analyzeBtnOff]}
              onPress={handleAnalyze}
              disabled={!canSubmit}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.analyzeBtnText}>
                  {'AI \uBD84\uC11D\uD558\uAE30'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COACHING_COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: COACHING_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COACHING_COLORS.border,
  },
  backBtn: { fontSize: 22, color: COACHING_COLORS.text },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COACHING_COLORS.text,
  },
  headerSpacer: { width: 22 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COACHING_COLORS.text,
    marginBottom: 12,
    marginTop: 8,
  },
  optionGrid: { gap: 10, marginBottom: 20 },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: { borderColor: COACHING_COLORS.accent, backgroundColor: '#FFF5EC' },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COACHING_COLORS.text,
  },
  optionTextSelected: { color: COACHING_COLORS.accent },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COACHING_COLORS.border,
  },
  pillSelected: {
    backgroundColor: COACHING_COLORS.accent,
    borderColor: COACHING_COLORS.accent,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: COACHING_COLORS.text },
  pillTextSelected: { color: '#FFFFFF' },
  analyzeBtn: {
    backgroundColor: COACHING_COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  analyzeBtnOff: { opacity: 0.5 },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

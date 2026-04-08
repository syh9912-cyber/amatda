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
  { id: 'sharp', label: '높고 날카로운 울음' },
  { id: 'escalating', label: '점점 커지는 반복 울음' },
  { id: 'whiny', label: '칭얼거림/낮은 울음' },
  { id: 'sudden', label: '갑작스러운 비명' },
  { id: 'soothable', label: '달래면 그치는 울음' },
  { id: 'unsoothable', label: '달래도 안 그치는 울음' },
] as const;

const DURATIONS = [
  '5분 미만',
  '5~15분',
  '15~30분',
  '30분 이상',
  '1시간 이상',
] as const;

const SYMPTOMS = [
  { id: 'fever', label: '열' },
  { id: 'full', label: '배부름' },
  { id: 'diaper', label: '기저귀' },
  { id: 'sleepy', label: '졸림' },
  { id: 'unusual', label: '평소와 다름' },
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
      parts.push(`울음 특성: ${cryLabels.join(', ')}`);
    if (duration) parts.push(`지속시간: ${duration}`);
    const symLabels = SYMPTOMS.filter((s) => selectedSymptoms.has(s.id)).map(
      (s) => s.label
    );
    if (symLabels.length > 0)
      parts.push(`동반증상: ${symLabels.join(', ')}`);
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
          <Text style={styles.backBtn}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {'울음소리 분석기'}
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
              {'😭 울음 특성 (복수 선택)'}
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
              {'⏱️ 지속 시간'}
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
              {'🩺 동반 증상 (복수 선택)'}
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
                  {'AI 분석하기'}
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

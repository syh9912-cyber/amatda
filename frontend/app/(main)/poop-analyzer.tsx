import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { coachingApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { AnalyzerResult } from '../../components/coaching/AnalyzerResult';
import { COACHING_COLORS } from '../../components/coaching/types';

const COLORS = [
  { id: 'yellow', label: '\uB178\uB780\uC0C9/\uACA8\uC790\uC0C9', hex: '#DAA520', level: 'normal' },
  { id: 'brown', label: '\uAC08\uC0C9', hex: '#8B4513', level: 'normal' },
  { id: 'green', label: '\uCD08\uB85D\uC0C9', hex: '#2E8B57', level: 'normal' },
  { id: 'darkred', label: '\uAC80\uBD89\uC740\uC0C9', hex: '#8B0000', level: 'warning' },
  { id: 'white', label: '\uD770\uC0C9/\uD68C\uC0C9', hex: '#D3D3D3', level: 'danger' },
  { id: 'black', label: '\uAC80\uC740\uC0C9', hex: '#1A1A1A', level: 'danger' },
] as const;

const CONSISTENCIES = [
  '\uBB3C\uC124\uC0AC',
  '\uBB34\uB978\uBCC0',
  '\uBCF4\uD1B5',
  '\uB531\uB531',
] as const;

interface AnalysisResult {
  childName?: string;
  type: 'cry' | 'poop';
  analysis: string;
  possibilities: Array<{ label: string; likelihood: string }>;
  recommendations: string[];
  needsDoctor: boolean;
}

export default function PoopAnalyzerScreen() {
  const router = useRouter();
  const child = useChildStore((s) => s.selectedChild);
  const [color, setColor] = useState<string | null>(null);
  const [consistency, setConsistency] = useState<string | null>(null);
  const [hasMucus, setHasMucus] = useState(false);
  const [hasBlood, setHasBlood] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const buildDescription = useCallback((): string => {
    const parts: string[] = [];
    const sel = COLORS.find((c) => c.id === color);
    if (sel) parts.push(`\uC0C9\uAE54: ${sel.label}`);
    if (consistency) parts.push(`\uBB3D\uAE30: ${consistency}`);
    if (hasMucus) parts.push('\uC810\uC561 \uC788\uC74C');
    if (hasBlood) parts.push('\uD608\uD754 \uC788\uC74C');
    if (note.trim()) parts.push(`\uCD94\uAC00 \uC124\uBA85: ${note.trim()}`);
    return parts.join(', ');
  }, [color, consistency, hasMucus, hasBlood, note]);

  const handleAnalyze = useCallback(async () => {
    if (!child || !color) return;
    setLoading(true);
    try {
      const desc = buildDescription();
      const res = await coachingApi.analyzeMedia(child.id, 'poop', desc);
      const data = res.data?.data as AnalysisResult | undefined;
      if (data) setResult(data);
    } catch {
      // fallback handled by backend mock
    } finally {
      setLoading(false);
    }
  }, [child, color, buildDescription]);

  const handleReset = useCallback(() => {
    setResult(null);
    setColor(null);
    setConsistency(null);
    setHasMucus(false);
    setHasBlood(false);
    setNote('');
  }, []);

  const canSubmit = !!color && !loading;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtn}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {'\uB300\uBCC0 \uC0C9\uAE54 \uBD84\uC11D\uAE30'}
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
              {'\uD83C\uDFA8 \uC0C9\uAE54 \uC120\uD0DD'}
            </Text>
            <View style={styles.colorGrid}>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.colorItem,
                    color === c.id && styles.colorSelected,
                  ]}
                  onPress={() => setColor(c.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c.hex },
                      c.level === 'danger' && styles.dangerBorder,
                      c.level === 'warning' && styles.warningBorder,
                    ]}
                  />
                  <Text style={styles.colorLabel}>{c.label}</Text>
                  {c.level === 'danger' ? (
                    <Text style={styles.levelBadgeDanger}>
                      {'\uC704\uD5D8'}
                    </Text>
                  ) : c.level === 'warning' ? (
                    <Text style={styles.levelBadgeWarning}>
                      {'\uC8FC\uC758'}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>
              {'\uD83D\uDCA7 \uBB3D\uAE30'}
            </Text>
            <View style={styles.pillRow}>
              {CONSISTENCIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.pill,
                    consistency === c && styles.pillSelected,
                  ]}
                  onPress={() =>
                    setConsistency((prev) => (prev === c ? null : c))
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      consistency === c && styles.pillTextSelected,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>
              {'\uD83D\uDC40 \uCD94\uAC00 \uC99D\uC0C1'}
            </Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[styles.pill, hasMucus && styles.pillSelected]}
                onPress={() => setHasMucus(!hasMucus)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pillText,
                    hasMucus && styles.pillTextSelected,
                  ]}
                >
                  {'\uC810\uC561 \uC788\uC74C'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, hasBlood && styles.pillSelected]}
                onPress={() => setHasBlood(!hasBlood)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pillText,
                    hasBlood && styles.pillTextSelected,
                  ]}
                >
                  {'\uD608\uD754 \uC788\uC74C'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>
              {'\uD83D\uDCDD \uCD94\uAC00 \uC124\uBA85 (\uC120\uD0DD)'}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={'\uC608: \uC5B4\uC81C\uBD80\uD130 \uBCC0\uD654\uAC00 \uC788\uC5C8\uC5B4\uC694...'}
              placeholderTextColor={COACHING_COLORS.textLight}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={300}
            />

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
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  colorItem: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSelected: { borderColor: COACHING_COLORS.accent },
  colorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#E0D5C8',
  },
  dangerBorder: { borderColor: '#FF4444', borderWidth: 3 },
  warningBorder: { borderColor: '#FFA500', borderWidth: 3 },
  colorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COACHING_COLORS.text,
    textAlign: 'center',
  },
  levelBadgeDanger: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D32F2F',
    marginTop: 4,
  },
  levelBadgeWarning: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E67E22',
    marginTop: 4,
  },
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
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: COACHING_COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  analyzeBtn: {
    backgroundColor: COACHING_COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  analyzeBtnOff: { opacity: 0.5 },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

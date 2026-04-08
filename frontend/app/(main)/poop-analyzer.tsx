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
  { id: 'yellow', label: '노란색/겨자색', hex: '#DAA520', level: 'normal' },
  { id: 'brown', label: '갈색', hex: '#8B4513', level: 'normal' },
  { id: 'green', label: '초록색', hex: '#2E8B57', level: 'normal' },
  { id: 'darkred', label: '검붉은색', hex: '#8B0000', level: 'warning' },
  { id: 'white', label: '흰색/회색', hex: '#D3D3D3', level: 'danger' },
  { id: 'black', label: '검은색', hex: '#1A1A1A', level: 'danger' },
] as const;

const CONSISTENCIES = [
  '물설사',
  '무른변',
  '보통',
  '딱딱',
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
    if (sel) parts.push(`색깔: ${sel.label}`);
    if (consistency) parts.push(`묽기: ${consistency}`);
    if (hasMucus) parts.push('점액 있음');
    if (hasBlood) parts.push('혈흔 있음');
    if (note.trim()) parts.push(`추가 설명: ${note.trim()}`);
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
          <Text style={styles.backBtn}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {'대변 색깔 분석기'}
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
              {'🎨 색깔 선택'}
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
                      {'위험'}
                    </Text>
                  ) : c.level === 'warning' ? (
                    <Text style={styles.levelBadgeWarning}>
                      {'주의'}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>
              {'💧 묽기'}
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
              {'👀 추가 증상'}
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
                  {'점액 있음'}
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
                  {'혈흔 있음'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>
              {'📝 추가 설명 (선택)'}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={'예: 어제부터 변화가 있었어요...'}
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

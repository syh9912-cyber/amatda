import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { observationApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface ReportData {
  childName: string;
  innateType: string;
  fiveElements: Record<string, number>;
  observedSummary: string;
  alignment: string;
  insights: string[];
  recommendations: string[];
}

export default function ReportScreen() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedChild = useChildStore((s) => s.selectedChild);

  useEffect(() => {
    if (selectedChild) loadReport();
  }, [selectedChild?.id]);

  const loadReport = async () => {
    if (!selectedChild) return;
    try {
      const res = await observationApi.report(selectedChild.id);
      setReport(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '교차검증 리포트', headerShown: true }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '교차검증 리포트', headerShown: true }} />
        <Text style={styles.emptyText}>리포트를 불러올 수 없습니다</Text>
      </View>
    );
  }

  const alignmentColor =
    report.alignment === '높음' ? COLORS.success : COLORS.secondary;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '교차검증 리포트', headerShown: true }} />

      {/* 헤더 */}
      <View style={styles.headerCard}>
        <Text style={styles.childName}>{report.childName}</Text>
        <Text style={styles.innateType}>기질: {report.innateType}</Text>
        <View style={[styles.alignBadge, { backgroundColor: alignmentColor }]}>
          <Text style={styles.alignText}>일치도 {report.alignment}</Text>
        </View>
      </View>

      {/* 관찰 요약 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>관찰 요약</Text>
        <Text style={styles.sectionBody}>{report.observedSummary}</Text>
      </View>

      {/* 인사이트 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>분석 인사이트</Text>
        {report.insights.map((item, idx) => (
          <View key={idx} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>

      {/* 추천 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>추천 활동</Text>
        {report.recommendations.map((item, idx) => (
          <View key={idx} style={styles.recCard}>
            <Text style={styles.recText}>{item}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 120 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  childName: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  innateType: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  alignBadge: {
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginTop: SPACING.md,
  },
  alignText: { color: '#FFF', fontSize: FONT_SIZE.sm, fontWeight: '600' },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionBody: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  bulletRow: { flexDirection: 'row', marginBottom: SPACING.xs },
  bullet: { color: COLORS.primary, fontSize: FONT_SIZE.md, marginRight: SPACING.sm },
  bulletText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
  recCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  recText: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
});

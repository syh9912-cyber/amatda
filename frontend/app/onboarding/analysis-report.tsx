import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useChildStore, AnalysisReport, ReportReasons } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

/** Maps section keys to reason keys */
const REASON_KEY_MAP: Partial<Record<keyof AnalysisReport, keyof ReportReasons>> = {
  personality: 'personality',
  studyStyle: 'studyStyle',
  bestSubjects: 'bestSubjects',
  futureFields: 'futureFields',
  sportsMatch: 'sportsMatch',
  academyStyle: 'academyStyle',
  goodFoods: 'foods',
};

interface SectionConfig {
  emoji: string;
  title: string;
  key: keyof AnalysisReport;
  type: 'text' | 'list';
}

const SECTIONS: SectionConfig[] = [
  { emoji: '\uD83C\uDFAD', title: '성격 특성', key: 'personality', type: 'list' },
  { emoji: '\uD83D\uDCDA', title: '학습 스타일', key: 'studyStyle', type: 'text' },
  { emoji: '\u2B50', title: '잘하는 분야', key: 'bestSubjects', type: 'list' },
  { emoji: '\uD83D\uDCA1', title: '보완할 분야', key: 'weakAreas', type: 'list' },
  { emoji: '\uD83D\uDE80', title: '미래 진로', key: 'futureFields', type: 'list' },
  { emoji: '\u26BD', title: '잘 맞는 운동', key: 'sportsMatch', type: 'list' },
  { emoji: '\uD83C\uDFEB', title: '학원 스타일', key: 'academyStyle', type: 'text' },
  { emoji: '\uD83C\uDF4E', title: '좋은 음식', key: 'goodFoods', type: 'list' },
  { emoji: '\u26A0\uFE0F', title: '피할 음식', key: 'badFoods', type: 'list' },
  { emoji: '\uD83C\uDFAF', title: '교육 방향', key: 'educationDirection', type: 'text' },
  { emoji: '\uD83C\uDFC6', title: '특출난 재능', key: 'specialTalent', type: 'text' },
  { emoji: '\uD83D\uDC9C', title: '양육 팁', key: 'parentingTip', type: 'text' },
];

export default function AnalysisReportScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const child = children.find((c) => c.id === childId);
  const report = child?.analysisReport;

  if (!child || !report) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: '분석 결과', headerShown: false }} />
        <Text style={styles.emptyText}>분석 결과를 불러올 수 없습니다</Text>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(main)/home')}
        >
          <Text style={styles.homeBtnText}>홈으로 이동</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: '분석 결과', headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>{child.name}의 종합 분석</Text>
        <Text style={styles.headerTitle}>{child.innateData.dominantType}</Text>
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>{report.summary}</Text>
      </View>

      {/* Sections */}
      {SECTIONS.map((section) => {
        const value = report[section.key];
        if (!value) return null;

        const reasonKey = REASON_KEY_MAP[section.key];
        const reason = reasonKey && report.reasons
          ? report.reasons[reasonKey]
          : undefined;

        return (
          <View key={section.key} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>{section.emoji}</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.type === 'list' && Array.isArray(value) ? (
              <View style={styles.listWrap}>
                {(value as string[]).map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionText}>{value as string}</Text>
            )}
            {reason ? (
              <Text style={styles.reasonText}>{reason}</Text>
            ) : null}
          </View>
        );
      })}

      {/* Disclaimer */}
      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerText}>
          이 분석은 아이의 생년월일시 기질 분석과 부모님의 응답을 종합한 결과입니다
        </Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => router.replace('/(main)/home')}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaText}>홈으로 이동</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: 60 },
  emptyContainer: {
    flex: 1, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  homeBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
  },
  homeBtnText: { color: '#FFF', fontWeight: '600', fontSize: FONT_SIZE.md },

  // Header
  header: {
    alignItems: 'center', marginBottom: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl, fontWeight: '700', color: COLORS.primary,
  },

  // Summary
  summaryCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.lg, borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  summaryText: {
    fontSize: FONT_SIZE.md, color: COLORS.text,
    lineHeight: 24, fontWeight: '500',
  },

  // Sections
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING.md, gap: SPACING.sm,
  },
  sectionEmoji: { fontSize: 20 },
  sectionTitle: {
    fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text,
  },
  sectionText: {
    fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    lineHeight: 22,
  },
  listWrap: { gap: SPACING.sm },
  listItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
  },
  bulletDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.primary, marginTop: 7,
  },
  listText: {
    flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    lineHeight: 22,
  },
  reasonText: {
    fontSize: FONT_SIZE.xs, color: COLORS.textLight,
    fontStyle: 'italic', lineHeight: 18,
    marginTop: SPACING.sm, paddingTop: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },

  // Disclaimer
  disclaimerCard: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  disclaimerText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // CTA
  ctaButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  ctaText: {
    color: '#FFFFFF', fontSize: FONT_SIZE.lg, fontWeight: '600',
  },
  bottomSpacer: { height: 40 },
});

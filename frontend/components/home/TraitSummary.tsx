import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Child } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  child: Child;
  compact?: boolean;
}

export function TraitSummary({ child, compact }: Props) {
  const dominantType = child.innateData?.dominantType ?? '';
  const report = child.analysisReport;

  const summaryText = report?.summary ?? child.innateData?.label ?? '';

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <TouchableOpacity
        onPress={() => router.push('/(main)/trait-detail')}
        activeOpacity={0.7}
      >
        <View style={styles.headRow}>
          <Text style={styles.headline}>
            {child.name} · {dominantType} · {child.ageInfo.label}
          </Text>
          <Text style={styles.detailLink}>상세 ›</Text>
        </View>
        <Text style={styles.summaryText} numberOfLines={3}>
          {summaryText}
        </Text>
      </TouchableOpacity>

      {/* Full report link — only in non-compact mode */}
      {!compact && report ? (
        <View style={styles.reportSection}>
          <TouchableOpacity
            style={styles.reportLink}
            onPress={() =>
              router.push({
                pathname: '/onboarding/analysis-report',
                params: { childId: child.id },
              })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.reportLinkText}>상세 분석 보기 ›</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  headRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: SPACING.sm,
  },
  headline: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  detailLink: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  cardCompact: {
    padding: SPACING.sm + 2,
    marginBottom: SPACING.sm,
  },
  summaryText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  // Report section
  reportSection: {
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: SPACING.sm,
  },
  reportLink: {
    alignSelf: 'flex-end',
  },
  reportLinkText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

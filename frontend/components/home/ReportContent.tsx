import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Child } from '../../stores/childStore';
import { FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  child: Child;
}

export function ReportContent({ child }: Props) {
  const report = child.analysisReport;

  if (!report) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>
          \uC544\uC9C1 \uBD84\uC11D \uB9AC\uD3EC\uD2B8\uAC00 \uC5C6\uC5B4\uC694
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(main)/report')}
        >
          <Text style={styles.actionBtnText}>
            \uBD84\uC11D \uC2DC\uC791\uD558\uAE30
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const strengths = report.strengthsDetail
    ? report.strengthsDetail.slice(0, 3)
    : report.personality?.slice(0, 3).map((p) => ({ item: p, reason: '' })) ?? [];

  const weaknesses = report.weaknessesDetail
    ? report.weaknessesDetail.slice(0, 3)
    : report.weakAreas?.slice(0, 3).map((w) => ({ item: w, reason: '' })) ?? [];

  return (
    <View>
      {/* Summary */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>
          {'\uD83D\uDCCA'} \uBD84\uC11D \uC694\uC57D
        </Text>
        <Text style={styles.summaryText} numberOfLines={4}>
          {report.summary}
        </Text>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/onboarding/analysis-report',
              params: { childId: child.id },
            })
          }
        >
          <Text style={styles.moreLink}>
            \uC0C1\uC138 \uBCF4\uAE30 {'\u203A'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Strengths */}
      {strengths.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {'\uD83D\uDCAA'} \uAC15\uC810
          </Text>
          {strengths.map((s, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>{'\u2022'}</Text>
              <Text style={styles.listText}>{s.item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Weaknesses */}
      {weaknesses.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {'\uD83D\uDCA1'} \uBCF4\uC644 \uC601\uC5ED
          </Text>
          {weaknesses.map((w, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>{'\u2022'}</Text>
              <Text style={styles.listText}>{w.item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#1E1E2E',
    marginBottom: SPACING.sm,
  },
  summaryText: {
    fontSize: FONT_SIZE.sm,
    color: '#6B6B80',
    lineHeight: 20,
  },
  moreLink: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: '#4338CA',
    fontWeight: '600',
    textAlign: 'right',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  bullet: {
    fontSize: FONT_SIZE.sm,
    color: '#4338CA',
    lineHeight: 20,
  },
  listText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: '#1E1E2E',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: '#A0A0B0',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  actionBtn: {
    backgroundColor: '#4338CA',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    alignSelf: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});

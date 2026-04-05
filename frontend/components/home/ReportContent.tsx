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
          아직 분석 리포트가 없어요
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(main)/report')}
        >
          <Text style={styles.actionBtnText}>
            분석 시작하기
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
          {'📊'} 분석 요약
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
            상세 보기 {'›'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Strengths */}
      {strengths.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {'💪'} 강점
          </Text>
          {strengths.map((s, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>{'•'}</Text>
              <Text style={styles.listText}>{s.item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Weaknesses */}
      {weaknesses.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {'💡'} 보완 영역
          </Text>
          {weaknesses.map((w, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>{'•'}</Text>
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

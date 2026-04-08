import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface WeeklyReport {
  period: string;
  totalSessions: number;
  report: string;
}

interface Props {
  report: WeeklyReport;
  onDismiss: () => void;
}

export function WeeklyReportCard({ report, onDismiss }: Props) {
  return (
    <LinearGradient
      colors={['#E8F8F0', '#D4F1E4']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <Text style={styles.title}>주간 리포트</Text>
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.7}>
          <Text style={styles.dismiss}>닫기</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.period}>{report.period}</Text>
      <View style={styles.statRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{report.totalSessions}</Text>
          <Text style={styles.statLabel}>상담 횟수</Text>
        </View>
      </View>
      <Text style={styles.reportText}>{report.report}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D6A4F',
  },
  dismiss: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8C7A6B',
  },
  period: {
    fontSize: 12,
    color: '#52796F',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D6A4F',
  },
  statLabel: {
    fontSize: 11,
    color: '#52796F',
    marginTop: 2,
  },
  reportText: {
    fontSize: 14,
    color: '#2D2016',
    lineHeight: 22,
  },
});

import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import type { DailyTrackingData, TrackingRecord } from './types';

interface Props {
  history: TrackingRecord[];
  today: DailyTrackingData;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function arrow(today: number, average: number): string {
  if (average === 0) return '';
  if (today > average * 1.1) return ' ↑';
  if (today < average * 0.9) return ' ↓';
  return '';
}

export function WeeklyAverage({ history, today }: Props) {
  if (history.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.header}>{'📊'} 주간 평균</Text>
        <Text style={styles.empty}>기록 데이터가 아직 없습니다.</Text>
      </View>
    );
  }

  const avgFeeding = avg(history.map((r) => r.feeding.count));
  const avgPoop = avg(history.map((r) => r.diaper.poop));
  const avgSleep = avg(history.map((r) => r.sleep.totalHours));

  return (
    <View style={styles.card}>
      <Text style={styles.header}>{'📊'} 최근 {history.length}일 평균</Text>

      <Row label="수유" avg={avgFeeding} today={today.feedingCount} unit="회" />
      <Row label="대변" avg={avgPoop} today={today.poopCount} unit="회" />
      <Row label="수면" avg={avgSleep} today={today.totalSleepHours} unit="시간" />
    </View>
  );
}

function Row({ label, avg: a, today, unit }: { label: string; avg: number; today: number; unit: string }) {
  const dir = arrow(today, a);
  const color = dir === ' ↑' ? COLORS.error : dir === ' ↓' ? COLORS.primary : COLORS.text;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowAvg}>평균 {a.toFixed(1)}{unit}</Text>
      <Text style={[styles.rowToday, { color }]}>
        오늘 {typeof today === 'number' && today % 1 !== 0 ? today.toFixed(1) : today}{unit}{dir}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#F0EDE8',
  },
  header: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  empty: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  rowLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, width: 40 },
  rowAvg: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  rowToday: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
});

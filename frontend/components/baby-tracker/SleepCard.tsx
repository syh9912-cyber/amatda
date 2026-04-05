import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { CounterRow } from './CounterRow';
import type { DailyTrackingData } from './types';

interface Props {
  data: DailyTrackingData;
  onChange: (updater: (prev: DailyTrackingData) => DailyTrackingData) => void;
}

export function SleepCard({ data, onChange }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.header}>{'😴'} 수면 기록</Text>

      <CounterRow
        label="낮잠 횟수"
        value={data.napCount}
        onIncrement={() => onChange((p) => ({ ...p, napCount: p.napCount + 1 }))}
        onDecrement={() => onChange((p) => ({ ...p, napCount: Math.max(0, p.napCount - 1) }))}
      />
      <CounterRow
        label="총 수면 시간"
        value={data.totalSleepHours}
        step={0.5}
        unit="시간"
        onIncrement={() => onChange((p) => ({ ...p, totalSleepHours: p.totalSleepHours + 0.5 }))}
        onDecrement={() =>
          onChange((p) => ({ ...p, totalSleepHours: Math.max(0, p.totalSleepHours - 0.5) }))
        }
      />
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
});

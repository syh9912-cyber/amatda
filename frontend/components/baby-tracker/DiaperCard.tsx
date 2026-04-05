import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { CounterRow } from './CounterRow';
import type { DailyTrackingData } from './types';

interface Props {
  data: DailyTrackingData;
  onChange: (updater: (prev: DailyTrackingData) => DailyTrackingData) => void;
}

export function DiaperCard({ data, onChange }: Props) {
  const total = data.poopCount + data.peeCount;

  return (
    <View style={styles.card}>
      <Text style={styles.header}>{'💩'} 대변/기저귀</Text>

      <CounterRow
        label="대변 횟수"
        value={data.poopCount}
        onIncrement={() => onChange((p) => ({ ...p, poopCount: p.poopCount + 1 }))}
        onDecrement={() => onChange((p) => ({ ...p, poopCount: Math.max(0, p.poopCount - 1) }))}
      />
      <CounterRow
        label="소변 횟수"
        value={data.peeCount}
        onIncrement={() => onChange((p) => ({ ...p, peeCount: p.peeCount + 1 }))}
        onDecrement={() => onChange((p) => ({ ...p, peeCount: Math.max(0, p.peeCount - 1) }))}
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>기저귀 교체 총 횟수</Text>
        <Text style={styles.totalValue}>{total}회</Text>
      </View>
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '500' },
  totalValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
});

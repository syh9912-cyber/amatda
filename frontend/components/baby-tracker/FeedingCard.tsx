import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { CounterRow } from './CounterRow';
import type { DailyTrackingData, FeedingType } from './types';
import { FEEDING_LABELS } from './types';

interface Props {
  data: DailyTrackingData;
  onChange: (updater: (prev: DailyTrackingData) => DailyTrackingData) => void;
}

const TYPES: FeedingType[] = ['breast', 'formula', 'mixed'];

export function FeedingCard({ data, onChange }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.header}>{'🍼'} 수유 기록</Text>

      <View style={styles.toggleRow}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.toggle, data.feedingType === t && styles.toggleActive]}
            onPress={() => onChange((p) => ({ ...p, feedingType: t }))}
          >
            <Text style={[styles.toggleText, data.feedingType === t && styles.toggleTextActive]}>
              {FEEDING_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <CounterRow
        label="수유 횟수"
        value={data.feedingCount}
        onIncrement={() => onChange((p) => ({ ...p, feedingCount: p.feedingCount + 1 }))}
        onDecrement={() => onChange((p) => ({ ...p, feedingCount: Math.max(0, p.feedingCount - 1) }))}
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
  toggleRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  toggle: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.border,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: '#FFF' },
});

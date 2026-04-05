import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

interface Props {
  label: string;
  value: number;
  step?: number;
  min?: number;
  unit?: string;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function CounterRow({ label, value, step, min = 0, unit, onIncrement, onDecrement }: Props) {
  const displayVal = step && step < 1 ? value.toFixed(1) : String(value);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.btn, value <= min && styles.btnDisabled]}
          onPress={onDecrement}
          disabled={value <= min}
        >
          <Text style={styles.btnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.value}>
          {displayVal}{unit ? ` ${unit}` : ''}
        </Text>
        <TouchableOpacity style={styles.btn} onPress={onIncrement}>
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '500' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  value: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 50,
    textAlign: 'center',
  },
});

import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

const ELEMENT_LABELS: Record<string, string> = {
  wood: '탐구', fire: '활동', earth: '안정', metal: '분석', water: '감성',
};
const ELEMENT_COLORS: Record<string, string> = {
  wood: COLORS.wood, fire: COLORS.fire, earth: COLORS.earth,
  metal: COLORS.metal, water: COLORS.water,
};

interface EnergyChartProps {
  fiveElements: Record<string, number>;
}

export function EnergyChart({ fiveElements }: EnergyChartProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>에너지 분포</Text>
      {Object.entries(fiveElements).map(([key, val]) => (
        <View key={key} style={styles.row}>
          <View style={styles.labelWrap}>
            <View style={[styles.dot, { backgroundColor: ELEMENT_COLORS[key] }]} />
            <Text style={styles.label}>{ELEMENT_LABELS[key]}</Text>
          </View>
          <View style={styles.barBg}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${val}%`,
                  backgroundColor: ELEMENT_COLORS[key],
                },
              ]}
            />
          </View>
          <Text style={styles.val}>{val}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: SPACING.md },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm + 2,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 56,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  barBg: {
    flex: 1,
    height: 14,
    backgroundColor: COLORS.border,
    borderRadius: 7,
    overflow: 'hidden',
    marginHorizontal: SPACING.sm,
  },
  barFill: {
    height: '100%',
    borderRadius: 7,
  },
  val: {
    width: 30,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
  },
});

import { View, Text, StyleSheet } from 'react-native';
import { ELEMENT_DISPLAY_NAMES, TRAIT_COLORS } from './traitConstants';

interface Props {
  fiveElements: Record<string, number>;
}

export function TraitBars({ fiveElements }: Props) {
  const maxVal = Math.max(...Object.values(fiveElements), 1);
  const entries = Object.entries(fiveElements).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>주요 성향</Text>
      {entries.map(([key, val]) => {
        const pct = Math.round((val / maxVal) * 100);
        return (
          <View key={key} style={styles.row}>
            <Text style={styles.label}>
              {ELEMENT_DISPLAY_NAMES[key] ?? key}
            </Text>
            <View style={styles.track}>
              <View
                style={[styles.fill, { width: `${pct}%`, backgroundColor: TRAIT_COLORS.coral }]}
              />
            </View>
            <Text style={styles.pct}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: TRAIT_COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: TRAIT_COLORS.textBrown,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    width: 52,
    fontSize: 13,
    fontWeight: '600',
    color: TRAIT_COLORS.textBrownLight,
  },
  track: {
    flex: 1,
    height: 14,
    backgroundColor: TRAIT_COLORS.barTrack,
    borderRadius: 7,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  fill: {
    height: '100%' as unknown as number,
    borderRadius: 7,
  },
  pct: {
    width: 38,
    fontSize: 13,
    fontWeight: '700',
    color: TRAIT_COLORS.textBrown,
    textAlign: 'right',
  },
});

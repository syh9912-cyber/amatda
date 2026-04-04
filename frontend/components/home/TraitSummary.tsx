import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Child } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  child: Child;
}

const ELEMENT_COLORS: Record<string, string> = {
  wood: COLORS.wood,
  fire: COLORS.fire,
  earth: COLORS.earth,
  metal: COLORS.metal,
  water: COLORS.water,
};

const ELEMENT_LABELS: Record<string, string> = {
  wood: '목',
  fire: '화',
  earth: '토',
  metal: '금',
  water: '수',
};

export function TraitSummary({ child }: Props) {
  const { dominantType, fiveElements } = child.innateData;
  const maxVal = Math.max(...Object.values(fiveElements), 1);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/(main)/trait-detail')}
      activeOpacity={0.7}
    >
      <View style={styles.headRow}>
        <Text style={styles.headline}>
          {child.name} · {dominantType} · {child.ageInfo.label}
        </Text>
        <Text style={styles.detailLink}>상세 ›</Text>
      </View>
      <View style={styles.barsRow}>
        {Object.entries(fiveElements).map(([key, value]) => {
          const ratio = value / maxVal;
          return (
            <View key={key} style={styles.barItem}>
              <Text style={styles.barLabel}>
                {ELEMENT_LABELS[key] ?? key}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round(ratio * 100)}%`,
                      backgroundColor: ELEMENT_COLORS[key] ?? COLORS.primary,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  headRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: SPACING.sm + 2,
  },
  headline: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailLink: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  barsRow: {
    gap: 6,
  },
  barItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    fontWeight: '500',
    width: 16,
    textAlign: 'center',
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
});

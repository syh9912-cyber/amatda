import { View, Text, StyleSheet } from 'react-native';
import { Child } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  child: Child;
}

const AGE_BG: Record<string, string> = {
  infant: COLORS.infant,
  toddler: COLORS.toddler,
  elementary: COLORS.elementary,
};

export function TraitSummary({ child }: Props) {
  const { dominantType, label } = child.innateData;
  const bg = AGE_BG[child.ageInfo.group] ?? COLORS.surface;

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <View style={styles.row}>
        <Text style={styles.name}>{child.name}</Text>
        <Text style={styles.badge}>{child.ageInfo.label}</Text>
      </View>
      <Text style={styles.type}>{dominantType}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  name: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  badge: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  type: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

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

function ElementBar({
  elements,
}: {
  elements: Record<string, number>;
}) {
  const maxVal = Math.max(...Object.values(elements), 1);

  return (
    <View style={barStyles.container}>
      {Object.entries(elements).map(([key, value]) => {
        const ratio = value / maxVal;
        const size = 6 + ratio * 10;
        return (
          <View key={key} style={barStyles.item}>
            <View
              style={[
                barStyles.dot,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: ELEMENT_COLORS[key],
                  opacity: 0.4 + ratio * 0.6,
                },
              ]}
            />
            <Text style={barStyles.label}>
              {ELEMENT_LABELS[key] ?? key}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  item: {
    alignItems: 'center',
    gap: 3,
  },
  dot: {},
  label: {
    fontSize: 9,
    color: COLORS.textLight,
    fontWeight: '500',
  },
});

export function TraitSummary({ child }: Props) {
  const { dominantType, label, fiveElements } = child.innateData;
  const bg = AGE_BG[child.ageInfo.group] ?? COLORS.surface;

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <View style={styles.topRow}>
        <View style={styles.nameCol}>
          <Text style={styles.name}>{child.name}</Text>
          <Text style={styles.labelText}>{label}</Text>
        </View>
        <View style={styles.badgeOuter}>
          <Text style={styles.badgeText}>
            {child.ageInfo.label}
          </Text>
        </View>
      </View>
      <Text style={styles.type}>{dominantType}</Text>
      <ElementBar elements={fiveElements} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  nameCol: {
    flex: 1,
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  labelText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  badgeOuter: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  type: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
});

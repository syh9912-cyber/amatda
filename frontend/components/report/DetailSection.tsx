import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { DetailItem } from '../../stores/childStore';

interface Props {
  emoji: string;
  title: string;
  items: DetailItem[];
  accentColor?: string;
}

export function DetailSection({ emoji, title, items, accentColor }: Props) {
  const dotColor = accentColor ?? COLORS.primary;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.list}>
        {items.map((entry, idx) => (
          <View key={idx} style={styles.itemWrap}>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              <Text style={styles.itemText}>{entry.item}</Text>
            </View>
            <Text style={styles.reasonText}>{entry.reason}</Text>
          </View>
        ))}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  emoji: { fontSize: 20 },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  list: { gap: SPACING.md },
  itemWrap: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  itemText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 22,
  },
  reasonText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginLeft: 14,
  },
});

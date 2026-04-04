import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Child } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  children: Child[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const AGE_EMOJI: Record<string, string> = {
  infant: '👶',
  toddler: '🧒',
  elementary: '📚',
};

export function ChildSelector({ children, selectedId, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {children.map((child) => {
        const active = child.id === selectedId;
        return (
          <TouchableOpacity
            key={child.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(child.id)}
          >
            <Text style={styles.emoji}>
              {AGE_EMOJI[child.ageInfo.group] ?? '👶'}
            </Text>
            <Text style={[styles.name, active && styles.nameActive]}>
              {child.name}
            </Text>
            <Text style={[styles.age, active && styles.ageActive]}>
              {child.ageInfo.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: SPACING.lg },
  content: { gap: SPACING.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  emoji: { fontSize: 16 },
  name: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '500' },
  nameActive: { color: COLORS.primary, fontWeight: '600' },
  age: { fontSize: FONT_SIZE.xs, color: COLORS.textLight },
  ageActive: { color: COLORS.primary },
});

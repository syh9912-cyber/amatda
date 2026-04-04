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

function genderEmoji(gender: 'M' | 'F'): string {
  return gender === 'F' ? '👧' : '👦';
}

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
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>
              {genderEmoji(child.gender)}
            </Text>
            <View style={styles.textCol}>
              <Text style={[styles.name, active && styles.nameActive]}>
                {child.name}
              </Text>
              <Text style={[styles.age, active && styles.ageActive]}>
                {AGE_EMOJI[child.ageInfo.group] ?? '👶'}{' '}
                {child.ageInfo.label}
              </Text>
            </View>
            {active && <View style={styles.indicator} />}
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
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  emoji: { fontSize: 20 },
  textCol: {
    gap: 1,
  },
  name: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  nameActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  age: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
  ageActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: SPACING.md,
    right: SPACING.md,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});

import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { CONCERN_CATEGORIES, COACHING_COLORS } from './types';

interface Props {
  onSelect: (categoryKey: string, label: string) => void;
}

export function CategoryBar({ onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
    >
      {CONCERN_CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.key}
          style={styles.chip}
          onPress={() => onSelect(cat.key, cat.label)}
          activeOpacity={0.7}
        >
          <Text style={styles.chipEmoji}>{cat.emoji}</Text>
          <Text style={styles.chipLabel}>{cat.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    maxHeight: 50,
  },
  row: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COACHING_COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: COACHING_COLORS.border,
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COACHING_COLORS.text,
  },
});

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

const SUGGESTIONS = [
  { label: '배송 문의', emoji: '📦' },
  { label: '구독 관리', emoji: '💳' },
  { label: '기질 상담', emoji: '🧒' },
  { label: '영양 문의', emoji: '🥗' },
];

interface QuickRepliesProps {
  onSelect: (text: string) => void;
}

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.hint}>자주 묻는 질문</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {SUGGESTIONS.map((s) => (
          <TouchableOpacity
            key={s.label}
            style={styles.chip}
            onPress={() => onSelect(s.label)}
          >
            <Text style={styles.chipEmoji}>{s.emoji}</Text>
            <Text style={styles.chipLabel}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
  },
  hint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 6,
  },
  chipEmoji: { fontSize: 14 },
  chipLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
});

import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Child } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

interface Props {
  items: Child[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ChildSelector({ items, selectedId, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {items.map((child) => {
        const active = child.id === selectedId;
        return (
          <TouchableOpacity
            key={child.id}
            style={styles.pill}
            onPress={() => onSelect(child.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.name, active && styles.nameActive]}>
              {child.name}
            </Text>
            {active && <View style={styles.underline} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: SPACING.xs },
  content: { gap: SPACING.lg, paddingHorizontal: 2 },
  pill: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  name: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    fontWeight: '400',
  },
  nameActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  underline: {
    marginTop: 4,
    height: 2,
    width: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 1,
  },
});

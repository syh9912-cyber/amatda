import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

interface SettingsItem {
  emoji: string;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
}

interface SettingsSectionProps {
  items: SettingsItem[];
}

export function SettingsSection({ items }: SettingsSectionProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>설정</Text>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <TouchableOpacity
            key={item.label}
            style={[styles.row, !isLast && styles.rowBorder]}
            onPress={item.onPress}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text
              style={[
                styles.label,
                item.isDestructive && styles.destructive,
              ]}
            >
              {item.label}
            </Text>
            <Text style={styles.chevron}>{'\u203A'}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  emoji: {
    fontSize: 20,
    marginRight: SPACING.md,
    width: 28,
    textAlign: 'center',
  },
  label: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  destructive: {
    color: COLORS.error,
  },
  chevron: {
    fontSize: 22,
    color: COLORS.textLight,
    fontWeight: '300',
  },
});

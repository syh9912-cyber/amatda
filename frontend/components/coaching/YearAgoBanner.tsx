import { View, Text, StyleSheet } from 'react-native';
import { COACHING_COLORS } from './types';

interface Props {
  memory: string;
}

export function YearAgoBanner({ memory }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>1년 전 오늘</Text>
      <Text style={styles.memory}>{memory}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF4EE',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COACHING_COLORS.accent,
    marginBottom: 4,
  },
  memory: {
    fontSize: 14,
    color: COACHING_COLORS.text,
    lineHeight: 22,
  },
});

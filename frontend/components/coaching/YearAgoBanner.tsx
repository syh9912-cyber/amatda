import { Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COACHING_COLORS } from './types';

interface Props {
  memory: string;
}

export function YearAgoBanner({ memory }: Props) {
  return (
    <LinearGradient
      colors={['#FFE8D6', '#FFF0E6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.label}>1년 전 오늘</Text>
      <Text style={styles.memory}>{memory}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COACHING_COLORS.accent,
    marginBottom: 4,
  },
  memory: {
    fontSize: 14,
    color: COACHING_COLORS.text,
    lineHeight: 22,
  },
});

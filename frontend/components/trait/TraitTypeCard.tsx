import { Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TRAIT_COLORS } from './traitConstants';

interface Props {
  name: string;
  dominantType: string;
  label: string;
}

/** "(0~36개월) 탐구형 활동가" → "탐구형 활동가" */
function stripAgePrefix(s: string): string {
  return s.replace(/^\(\d+~?\d*개월\)\s*/, '').replace(/^\(초등\s*\d+~?\d*학년\)\s*/, '');
}

export function TraitTypeCard({ name, dominantType, label }: Props) {
  const cleanLabel = stripAgePrefix(label || '');
  return (
    <LinearGradient
      colors={[TRAIT_COLORS.gradientStart, TRAIT_COLORS.gradientEnd]}
      style={styles.card}
    >
      <Text style={styles.subtitle}>{name}의 기질 유형</Text>
      <Text style={styles.title}>
        {cleanLabel || `${dominantType} 기질`}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: TRAIT_COLORS.textBrownLight,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: TRAIT_COLORS.textBrown,
    textAlign: 'center',
  },
});

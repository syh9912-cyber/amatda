import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TRAIT_COLORS } from './traitConstants';

interface Props {
  name: string;
  dominantType: string;
  label: string;
}

export function TraitTypeCard({ name, dominantType, label }: Props) {
  return (
    <LinearGradient
      colors={[TRAIT_COLORS.gradientStart, TRAIT_COLORS.gradientEnd]}
      style={styles.card}
    >
      <Text style={styles.subtitle}>{name}의 기질 유형</Text>
      <Text style={styles.title}>
        {label || `${dominantType} 기질`}
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

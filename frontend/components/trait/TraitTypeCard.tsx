import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const cleanLabel = stripAgePrefix(label || '');
  return (
    <View style={styles.card}>
      <Text style={styles.subtitle}>{t('components.traitTypeCard.subtitle', { name })}</Text>
      <Text style={styles.title}>
        {cleanLabel || t('components.traitTypeCard.fallback', { dominantType })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: TRAIT_COLORS.gradientStart,
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
    fontSize: 22,
    fontWeight: '600',
    color: TRAIT_COLORS.textBrown,
    textAlign: 'center',
  },
});

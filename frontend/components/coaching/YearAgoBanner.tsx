import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COACHING_COLORS } from './types';

interface Props {
  memory: string;
}

export function YearAgoBanner({ memory }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('components.yearAgoBanner.label')}</Text>
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

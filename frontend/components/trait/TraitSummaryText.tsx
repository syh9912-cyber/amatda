import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TRAIT_COLORS } from './traitConstants';

interface Props {
  name: string;
  summary: string | undefined;
  label: string;
}

export function TraitSummaryText({ name, summary, label }: Props) {
  const { t } = useTranslation();
  // 기존 데이터의 연령대 접두사 제거 (예: "(0~36개월) " → "")
  const cleanSummary = summary?.replace(/^\(\d+~?\d*개월\)\s*/, '')
    ?.replace(/^\(초등\s*\d+~?\d*학년\)\s*/, '') || '';
  const displayText =
    cleanSummary ||
    t('components.traitSummaryText.fallback', { name, label });

  return (
    <View style={styles.card}>
      <Text style={styles.text}>{displayText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: TRAIT_COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  text: {
    fontSize: 15,
    fontWeight: '500',
    color: TRAIT_COLORS.textBrown,
    lineHeight: 24,
  },
});

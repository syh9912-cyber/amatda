import { View, Text, StyleSheet } from 'react-native';
import { TRAIT_COLORS } from './traitConstants';

interface Props {
  name: string;
  summary: string | undefined;
  label: string;
}

export function TraitSummaryText({ name, summary, label }: Props) {
  const displayText =
    summary ||
    `${name}은(는) ${label} 성향을 가지고 있어요.`;

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

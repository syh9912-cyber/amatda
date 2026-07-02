import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface AuthDividerProps {
  label?: string;
}

export function AuthDivider({ label }: AuthDividerProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>{label ?? t('components.authDivider.label')}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8E5E0',
  },
  text: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
  },
});

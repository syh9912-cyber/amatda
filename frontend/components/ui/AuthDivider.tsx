import { View, Text, StyleSheet } from 'react-native';

interface AuthDividerProps {
  label?: string;
}

export function AuthDivider({ label = '또는' }: AuthDividerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>{label}</Text>
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

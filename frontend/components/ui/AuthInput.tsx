import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

interface AuthInputProps extends TextInputProps {
  icon: string;
}

export function AuthInput({ icon, style, ...props }: AuthInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.icon}>{icon}</Text>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={COLORS.textLight}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    height: 56,
  },
  icon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    height: '100%',
    padding: 0,
  },
});

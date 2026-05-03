import { View, TextInput, Image, StyleSheet, TextInputProps, ImageSourcePropType } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

interface AuthInputProps extends TextInputProps {
  icon: ImageSourcePropType;
}

export function AuthInput({ icon, style, ...props }: AuthInputProps) {
  return (
    <View style={styles.wrapper}>
      <Image source={icon} style={styles.icon} resizeMode="contain" />
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
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  icon: {
    width: 18,
    height: 18,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    height: '100%',
    padding: 0,
  },
});

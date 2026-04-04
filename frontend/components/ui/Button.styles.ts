import { StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../constants/theme';
import type { ButtonVariant, ButtonSize } from './Button.types';

export const SIZE_CONFIG: Record<ButtonSize, {
  paddingV: number; paddingH: number; fontSize: number; height: number;
}> = {
  sm: { paddingV: 0, paddingH: SPACING.md, fontSize: FONT_SIZE.sm, height: 36 },
  md: { paddingV: 0, paddingH: SPACING.lg, fontSize: FONT_SIZE.md, height: 48 },
  lg: { paddingV: 0, paddingH: SPACING.xl, fontSize: FONT_SIZE.lg, height: 56 },
};

export const VARIANT_BG: Record<ButtonVariant, string> = {
  primary: COLORS.primary,
  secondary: COLORS.secondary,
  outline: 'transparent',
  ghost: 'transparent',
  social: COLORS.surface,
};

export const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: '#FFFFFF',
  secondary: '#FFFFFF',
  outline: COLORS.primary,
  ghost: COLORS.primary,
  social: COLORS.text,
};

export const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  social: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disabled: { opacity: 0.5 },
  icon: { marginRight: SPACING.sm },
  iconText: { fontSize: 16, fontWeight: FONT_WEIGHT.bold },
  label: { fontWeight: FONT_WEIGHT.semibold },
});

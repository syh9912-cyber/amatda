import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../../constants/theme';

type CardVariant = 'default' | 'gradient' | 'outlined';
type CardPadding = 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  style?: ViewStyle;
}

const PADDING_MAP: Record<CardPadding, number> = {
  sm: SPACING.sm,
  md: SPACING.md,
  lg: SPACING.lg,
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  style,
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        { padding: PADDING_MAP[padding] },
        variant === 'outlined' && styles.outlined,
        variant === 'default' && SHADOWS.soft,
        variant === 'gradient' && styles.gradient,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  outlined: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
  },
  gradient: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.soft,
  },
});

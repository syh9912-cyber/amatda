import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
} from 'react-native';
import { SHADOWS } from '../../constants/theme';
import type { ButtonProps } from './Button.types';
import {
  styles,
  SIZE_CONFIG,
  VARIANT_BG,
  VARIANT_TEXT,
} from './Button.styles';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const sizeConf = SIZE_CONFIG[size];
  const bg = VARIANT_BG[variant];
  const textColor = VARIANT_TEXT[variant];
  const isDisabled = disabled || loading;
  const hasShadow = variant === 'primary' || variant === 'secondary';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          paddingVertical: sizeConf.paddingV,
          paddingHorizontal: sizeConf.paddingH,
        },
        variant === 'outline' && styles.outline,
        variant === 'social' && styles.social,
        hasShadow && SHADOWS.soft,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon && (
            <View style={styles.icon}>
              <Text style={[styles.iconText, { color: textColor }]}>
                {icon}
              </Text>
            </View>
          )}
          <Text
            style={[
              styles.label,
              { fontSize: sizeConf.fontSize, color: textColor },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

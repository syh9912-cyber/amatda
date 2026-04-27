import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
} from 'react-native';
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
  accessibilityLabel,
}: ButtonProps) {
  const sizeConf = SIZE_CONFIG[size];
  const bg = VARIANT_BG[variant];
  const textColor = VARIANT_TEXT[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          height: sizeConf.height,
          paddingHorizontal: sizeConf.paddingH,
        },
        variant === 'outline' && styles.outline,
        variant === 'social' && styles.social,
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

import React from 'react';
import {
  TouchableOpacity,
  Image,
  ImageSourcePropType,
  ImageStyle,
  ViewStyle,
  StyleProp,
} from 'react-native';

interface IconButtonProps {
  source: ImageSourcePropType;
  onPress: () => void;
  accessibilityLabel: string;
  iconStyle?: StyleProp<ImageStyle>;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  activeOpacity?: number;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
}

/**
 * Small icon-only button with built-in a11y defaults:
 * - hitSlop: 8pt on all sides (for < 44pt icons)
 * - accessibilityRole: 'button'
 * - required accessibilityLabel
 */
export function IconButton({
  source,
  onPress,
  accessibilityLabel,
  iconStyle,
  style,
  disabled = false,
  activeOpacity = 0.7,
  resizeMode = 'contain',
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={activeOpacity}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={style}
    >
      <Image source={source} style={iconStyle} resizeMode={resizeMode} />
    </TouchableOpacity>
  );
}

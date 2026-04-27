import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

/**
 * ScreenHeader
 *
 * 앱 전반에서 반복되는 "뒤로가기 + 타이틀 + (옵션) 우측 액션" 헤더.
 * Stack.Screen 네이티브 헤더를 사용하지 않고 커스텀 헤더를 쓰는 화면에서 사용한다.
 *
 * 뒤로가기 동작은 기본적으로 router.back()이지만 onBack 으로 덮어쓸 수 있다.
 */
export interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  /** 기본 백 버튼 문자 ('<'). 디자인 통일을 위해 건드리지 않는 것을 권장. */
  backArrow?: string;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({
  title,
  onBack,
  rightAction,
  backArrow = '<',
  style,
}: ScreenHeaderProps) {
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={[styles.header, style]}>
      <TouchableOpacity
        onPress={handleBack}
        style={styles.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="뒤로"
      >
        <Text style={styles.backArrow}>{backArrow}</Text>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.rightSlot}>{rightAction ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  rightSlot: {
    width: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});

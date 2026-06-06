/**
 * BackButton — 앱 전역 통일 뒤로가기 버튼.
 *
 * 스타일: 원형(연회색 배경) + 쉬브론 ‹ — iOS/최신 앱 톤.
 * 위치/사용: 각 화면 헤더 좌측에 <BackButton /> 한 줄로 배치.
 * 기본 동작: router.back() (스택 없으면 홈으로 fallback).
 */
import { TouchableOpacity, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';

interface Props {
  /** 커스텀 동작 (미지정 시 router.back, 불가하면 홈) */
  onPress?: () => void;
  /** 추가 스타일 (위치 보정 등) */
  style?: ViewStyle;
  /** 쉬브론 색 (어두운 배경 화면에서 흰색 등으로 override) */
  color?: string;
  /** 배경 원 색 (투명 처리 등 override) */
  background?: string;
}

export function BackButton({ onPress, style, color = '#1C1C1E', background = 'transparent' }: Props) {
  const router = useRouter();
  const handlePress = () => {
    if (onPress) { onPress(); return; }
    if (router.canGoBack()) router.back();
    else router.replace('/(main)/home');
  };
  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.btn, { backgroundColor: background }, style]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      activeOpacity={0.7}
    >
      <Text style={[styles.chevron, { color }]}>{'‹'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 32,
    marginTop: -3,
    marginLeft: -1,
  },
});

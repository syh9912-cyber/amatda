/**
 * GuideButton — 화면 헤더 우상단 '?' 버튼. 누르면 해당 화면 가이드를 다시 연다.
 */
import { TouchableOpacity, Text, StyleSheet, type ViewStyle } from 'react-native';

interface Props {
  onPress: () => void;
  style?: ViewStyle;
  color?: string;
}

export function GuideButton({ onPress, style, color = '#F0976C' }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="사용 가이드 보기"
      style={[styles.btn, { borderColor: color }, style]}
    >
      <Text style={[styles.text, { color }]}>?</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  text: { fontSize: 14, fontWeight: '900', marginTop: -1 },
});

import { View, Text, StyleSheet } from 'react-native';

interface Props {
  width?: number;
  height?: number;
}

export function ChildDiaryIllustration({ width = 200, height = 200 }: Props) {
  const s = width / 200;
  return (
    <View style={[styles.wrap, { width, height }]}>
      <Text style={[styles.sparkle, { top: 5 * s, left: 25 * s, fontSize: 14 * s }]}>✨</Text>
      <Text style={[styles.sparkle, { top: 10 * s, right: 20 * s, fontSize: 11 * s }]}>⭐</Text>
      <Text style={[styles.sparkle, { top: 55 * s, right: 10 * s, fontSize: 13 * s }]}>✨</Text>
      {/* 머리카락 */}
      <View style={[styles.hair, { width: 88 * s, height: 46 * s, borderRadius: 44 * s, top: 10 * s, left: 56 * s }]} />
      {/* 얼굴 */}
      <View style={[styles.face, { width: 82 * s, height: 82 * s, borderRadius: 41 * s, top: 22 * s, left: 59 * s }]}>
        <View style={[styles.eye, { top: 30 * s, left: 22 * s, width: 8 * s, height: 10 * s, borderRadius: 5 * s }]} />
        <View style={[styles.eye, { top: 30 * s, right: 22 * s, width: 8 * s, height: 10 * s, borderRadius: 5 * s }]} />
        <View style={[styles.cheek, { top: 40 * s, left: 11 * s, width: 15 * s, height: 10 * s, borderRadius: 7 * s }]} />
        <View style={[styles.cheek, { top: 40 * s, right: 11 * s, width: 15 * s, height: 10 * s, borderRadius: 7 * s }]} />
        <Text style={[styles.mouth, { top: 48 * s, fontSize: 12 * s }]}>◡</Text>
      </View>
      {/* 몸통 */}
      <View style={[styles.body, { width: 72 * s, height: 50 * s, borderRadius: 22 * s, top: 98 * s, left: 64 * s }]} />
      {/* 왼팔 */}
      <View style={[styles.arm, { width: 38 * s, height: 14 * s, borderRadius: 7 * s, top: 118 * s, left: 42 * s, transform: [{ rotate: '-20deg' }] }]} />
      {/* 오른팔 + 연필 */}
      <View style={[styles.arm, { width: 42 * s, height: 14 * s, borderRadius: 7 * s, top: 118 * s, left: 118 * s, transform: [{ rotate: '25deg' }] }]} />
      <Text style={{ position: 'absolute', top: 126 * s, left: 148 * s, fontSize: 22 * s }}>✏️</Text>
      {/* 다이어리 */}
      <View style={[styles.diary, { width: 64 * s, height: 48 * s, borderRadius: 6 * s, top: 142 * s, left: 72 * s }]}>
        <View style={[styles.line, { top: 12 * s, width: 42 * s }]} />
        <View style={[styles.line, { top: 20 * s, width: 36 * s }]} />
        <View style={[styles.line, { top: 28 * s, width: 40 * s }]} />
        <Text style={{ position: 'absolute', top: 2 * s, right: 4 * s, fontSize: 9 * s }}>💜</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' as const },
  sparkle: { position: 'absolute' as const },
  hair: { position: 'absolute' as const, backgroundColor: '#8B6F47' },
  face: { position: 'absolute' as const, backgroundColor: '#FFE0BD' },
  eye: { position: 'absolute' as const, backgroundColor: '#2D2D2D' },
  cheek: { position: 'absolute' as const, backgroundColor: '#FFB4B4', opacity: 0.5 },
  mouth: { position: 'absolute' as const, alignSelf: 'center' as const, color: '#E88B8B' },
  body: { position: 'absolute' as const, backgroundColor: '#B8D4E3' },
  arm: { position: 'absolute' as const, backgroundColor: '#FFE0BD' },
  diary: { position: 'absolute' as const, backgroundColor: '#F5E6D3', borderWidth: 1.5, borderColor: '#D4C4A8' },
  line: { position: 'absolute' as const, height: 1.5, backgroundColor: '#C8B89A', left: 8, borderRadius: 1 },
});

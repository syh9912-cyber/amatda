import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

const BG = '#FDF6F0';
const INDIGO = '#4338CA';
const GRAY = '#9CA3AF';

export default function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const imgOp = useRef(new Animated.Value(0)).current;
  const imgScale = useRef(new Animated.Value(0.7)).current;
  const imgY = useRef(new Animated.Value(40)).current;
  // 글쓰기 모션 — 이미지 전체를 연필 축(우하단) 기준 미세 회전
  const writeRot = useRef(new Animated.Value(0)).current;
  // 반짝이
  const sp1 = useRef(new Animated.Value(0)).current;
  const sp2 = useRef(new Animated.Value(0)).current;
  const sp3 = useRef(new Animated.Value(0)).current;
  // 아맞다
  const titleOp = useRef(new Animated.Value(0)).current;
  const gap1 = useRef(new Animated.Value(0)).current;
  const gap2 = useRef(new Animated.Value(0)).current;
  const subOp1 = useRef(new Animated.Value(0)).current;
  const subOp2 = useRef(new Animated.Value(0)).current;
  const subOp3 = useRef(new Animated.Value(0)).current;
  const subSc1 = useRef(new Animated.Value(0.3)).current;
  const subSc2 = useRef(new Animated.Value(0.3)).current;
  const subSc3 = useRef(new Animated.Value(0.3)).current;
  const lineW = useRef(new Animated.Value(0)).current;
  const engOp = useRef(new Animated.Value(0)).current;
  const coOp = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const e = Easing.out(Easing.cubic);

    // 글쓰기 루프 — 미세하게 기울어졌다 돌아오기 (연필 손목 느낌)
    const writeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(writeRot, { toValue: 1.5, duration: 400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(writeRot, { toValue: -1, duration: 350, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(writeRot, { toValue: 1.2, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(writeRot, { toValue: -0.8, duration: 350, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(writeRot, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    Animated.sequence([
      Animated.delay(400),
      // 1. 캐릭터 등장
      Animated.parallel([
        Animated.timing(imgOp, { toValue: 1, duration: 1200, easing: e, useNativeDriver: true }),
        Animated.timing(imgScale, { toValue: 1, duration: 1400, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
        Animated.timing(imgY, { toValue: 0, duration: 1200, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
      ]),
      // 2. 반짝이
      Animated.stagger(200, [
        Animated.timing(sp1, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(sp2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(sp3, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      // 3. "아맞다"
      Animated.timing(titleOp, { toValue: 1, duration: 800, easing: e, useNativeDriver: true }),
      Animated.delay(500),
      // 4. "이"
      Animated.parallel([
        Animated.timing(gap1, { toValue: 1, duration: 600, easing: e, useNativeDriver: false }),
        Animated.timing(subOp1, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(subSc1, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      // 5. "춤"
      Animated.parallel([
        Animated.timing(gap2, { toValue: 1, duration: 600, easing: e, useNativeDriver: false }),
        Animated.timing(subOp2, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(subSc2, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      // 6. "이어리"
      Animated.parallel([
        Animated.timing(subOp3, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(subSc3, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      Animated.delay(300),
      // 7. 하단
      Animated.timing(lineW, { toValue: 56, duration: 500, easing: e, useNativeDriver: false }),
      Animated.timing(engOp, { toValue: 1, duration: 500, easing: e, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(coOp, { toValue: 1, duration: 400, easing: e, useNativeDriver: true }),
      // 8. 2초 멈춤
      Animated.delay(2000),
      // 9. 페이드아웃
      Animated.timing(fadeOut, { toValue: 0, duration: 500, easing: e, useNativeDriver: true }),
    ]).start(() => {
      writeLoop.stop();
      router.replace(isAuthenticated ? '/(main)/home' as never : '/(auth)/login' as never);
    });

    setTimeout(() => writeLoop.start(), 2000);
  }, []);

  const rotStr = writeRot.interpolate({ inputRange: [-2, 2], outputRange: ['-2deg', '2deg'] });
  const gW1 = gap1.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const gW2 = gap2.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeOut }]}>
        {/* 캐릭터 — 원본 이미지 1개, 중앙 정렬, 글쓰기 모션 */}
        <Animated.View style={[styles.imgWrap, {
          opacity: imgOp,
          transform: [{ translateY: imgY }, { scale: imgScale }, { rotate: rotStr }],
        }]}>
          <Image source={require('../assets/child-diary.png')} style={styles.img} resizeMode="contain" />
        </Animated.View>

        {/* 반짝이 — 이미지 주변에 고정 */}
        <Animated.Text style={[styles.sp, { top: '12%', left: '8%', opacity: sp1 }]}>✨</Animated.Text>
        <Animated.Text style={[styles.sp, { top: '8%', right: '10%', opacity: sp2 }]}>⭐</Animated.Text>
        <Animated.Text style={[styles.sp, { top: '38%', right: '5%', opacity: sp3 }]}>💜</Animated.Text>

        {/* 아이맞춤다이어리 — "맞" 중앙 고정 */}
        <Animated.View style={[styles.nameRow, { opacity: titleOp }]}>
          <View style={styles.nameLeft}>
            <Text style={styles.mainChar}>아</Text>
            <Animated.View style={{ width: gW1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
              <Animated.Text style={[styles.subChar, { opacity: subOp1, transform: [{ scale: subSc1 }] }]}>이</Animated.Text>
            </Animated.View>
          </View>
          <Text style={styles.centerChar}>맞</Text>
          <View style={styles.nameRight}>
            <Animated.View style={{ width: gW2, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
              <Animated.Text style={[styles.subChar, { opacity: subOp2, transform: [{ scale: subSc2 }] }]}>춤</Animated.Text>
            </Animated.View>
            <Text style={styles.mainChar}>다</Text>
            <Animated.View style={{ overflow: 'hidden' }}>
              <Animated.Text style={[styles.subChar, { opacity: subOp3, transform: [{ scale: subSc3 }] }]}>이어리</Animated.Text>
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.line, { width: lineW }]} />
        <Animated.Text style={[styles.eng, { opacity: engOp }]}>Child-Customized Diary</Animated.Text>
        <Animated.View style={[styles.co, { opacity: coOp }]}>
          <Text style={styles.coName}>Bloomin Corp.</Text>
          <Text style={styles.coSub}>Growing with every child</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', width: '100%' },
  imgWrap: { alignItems: 'center', marginBottom: 4 },
  img: { width: 320, height: 320 },
  sp: { position: 'absolute', fontSize: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginTop: 8, marginBottom: 10, width: '100%' },
  nameLeft: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end' },
  nameRight: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-start' },
  mainChar: { fontSize: 32, fontWeight: '800', color: INDIGO },
  centerChar: { fontSize: 36, fontWeight: '800', color: INDIGO, marginHorizontal: 1 },
  subChar: { fontSize: 14, fontWeight: '500', color: GRAY },
  line: { height: 1.5, backgroundColor: '#D4C8BE', marginBottom: 10, borderRadius: 1 },
  eng: { fontSize: 11, color: GRAY, letterSpacing: 1.5 },
  co: { marginTop: 20, alignItems: 'center' },
  coName: { fontSize: 11, color: '#B0A89E', fontWeight: '600', letterSpacing: 1 },
  coSub: { fontSize: 9, color: '#C8C0B8', marginTop: 2, letterSpacing: 0.5 },
});

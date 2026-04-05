import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

const BG = '#FFFFFF';
const INDIGO = '#4338CA';
const GRAY = '#9CA3AF';
const { height: SCREEN_H } = Dimensions.get('window');

export default function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const imgOp = useRef(new Animated.Value(0)).current;
  const imgScale = useRef(new Animated.Value(0.7)).current;
  const imgY = useRef(new Animated.Value(40)).current;
  const writeRot = useRef(new Animated.Value(0)).current;
  const sp1 = useRef(new Animated.Value(0)).current;
  const sp2 = useRef(new Animated.Value(0)).current;
  const sp3 = useRef(new Animated.Value(0)).current;
  // 처음: 아맞다 (붙어서)
  const titleOp = useRef(new Animated.Value(0)).current;
  // 벌어지면서 사이 글자 등장
  const expandW = useRef(new Animated.Value(0)).current; // 아_이 사이
  const expandW2 = useRef(new Animated.Value(0)).current; // 다_이어리
  const subOp1 = useRef(new Animated.Value(0)).current; // 이
  const chumOp = useRef(new Animated.Value(0)).current; // 춤
  const chumSc = useRef(new Animated.Value(0.3)).current;
  const subOp2 = useRef(new Animated.Value(0)).current; // 이어리
  const subSc1 = useRef(new Animated.Value(0.3)).current;
  const subSc2 = useRef(new Animated.Value(0.3)).current;
  const lineW = useRef(new Animated.Value(0)).current;
  const engOp = useRef(new Animated.Value(0)).current;
  const coOp = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const e = Easing.out(Easing.cubic);

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
      // 3. "아맞춤다" 등장 (처음엔 "아맞다"만 보임, 맞춤은 붙어있음)
      Animated.timing(titleOp, { toValue: 1, duration: 800, easing: e, useNativeDriver: true }),
      Animated.delay(500),
      // 4. "이" + "춤" 동시에 등장 (아_이_맞춤_다)
      Animated.parallel([
        Animated.timing(expandW, { toValue: 1, duration: 600, easing: e, useNativeDriver: false }),
        Animated.timing(subOp1, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(subSc1, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
        Animated.timing(chumOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(chumSc, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      // 5. "이어리" 등장
      Animated.parallel([
        Animated.timing(expandW2, { toValue: 1, duration: 600, easing: e, useNativeDriver: false }),
        Animated.timing(subOp2, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(subSc2, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      Animated.delay(300),
      // 6. 구분선 + 영문 + 회사
      Animated.timing(lineW, { toValue: 56, duration: 500, easing: e, useNativeDriver: false }),
      Animated.timing(engOp, { toValue: 1, duration: 500, easing: e, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(coOp, { toValue: 1, duration: 400, easing: e, useNativeDriver: true }),
      // 7. 2초 멈춤
      Animated.delay(2000),
      // 8. 페이드아웃
      Animated.timing(fadeOut, { toValue: 0, duration: 500, easing: e, useNativeDriver: true }),
    ]).start(() => {
      writeLoop.stop();
      router.replace(isAuthenticated ? '/(main)/home' as never : '/(auth)/login' as never);
    });
    setTimeout(() => writeLoop.start(), 2000);
  }, []);

  const rotStr = writeRot.interpolate({ inputRange: [-2, 2], outputRange: ['-2deg', '2deg'] });
  const gapW1 = expandW.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const chumW = expandW.interpolate({ inputRange: [0, 1], outputRange: [0, 16] });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeOut }]}>
        {/* 캐릭터 */}
        <Animated.View style={[styles.imgWrap, {
          opacity: imgOp,
          transform: [{ translateY: imgY }, { scale: imgScale }, { rotate: rotStr }],
        }]}>
          <Image source={require('../assets/child-diary.png')} style={styles.img} resizeMode="contain" />
        </Animated.View>

        {/* 반짝이 */}
        <Animated.Text style={[styles.sp, { top: '12%', left: '8%', opacity: sp1 }]}>✨</Animated.Text>
        <Animated.Text style={[styles.sp, { top: '8%', right: '10%', opacity: sp2 }]}>⭐</Animated.Text>
        <Animated.Text style={[styles.sp, { top: '38%', right: '5%', opacity: sp3 }]}>💜</Animated.Text>

        {/* 아이 맞춤 다이어리 — 한 줄, flexbox row, 중앙 정렬 */}
        {/* "아"크게 + "이"작게 + "맞춤"크게(붙어있음) + "다"크게 + "이어리"작게 */}
        <Animated.View style={[styles.nameRow, { opacity: titleOp }]}>
          <Text style={styles.bigChar}>아</Text>
          <Animated.View style={{ width: gapW1, overflow: 'hidden', alignItems: 'center' }}>
            <Animated.Text style={[styles.smallChar, { opacity: subOp1, transform: [{ scale: subSc1 }] }]}>이</Animated.Text>
          </Animated.View>
          <Text style={styles.bigChar}>맞</Text>
          <Animated.View style={{ width: chumW, overflow: 'hidden' }}>
            <Animated.Text style={[styles.smallCharFixed, { opacity: chumOp, transform: [{ scale: chumSc }] }]}>춤</Animated.Text>
          </Animated.View>
          <Text style={styles.bigChar}>다</Text>
          <Animated.View style={{ overflow: 'hidden' }}>
            <Animated.Text style={[styles.smallChar, { opacity: subOp2, transform: [{ scale: subSc2 }] }]}>이어리</Animated.Text>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.line, { width: lineW }]} />
        <Animated.Text style={[styles.eng, { opacity: engOp }]}>Child-Customized Diary</Animated.Text>
      </Animated.View>

      {/* 회사 정보 — 화면 하단 고정 */}
      <Animated.View style={[styles.co, { opacity: coOp }]}>
        <Text style={styles.coName}>Bloomin Corp.</Text>
        <Text style={styles.coSub}>Growing with every child</Text>
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  bigChar: { fontSize: 34, fontWeight: '800', color: INDIGO },
  smallChar: { fontSize: 15, fontWeight: '500', color: GRAY },
  smallCharFixed: { fontSize: 15, fontWeight: '500', color: GRAY, marginRight: 1 },
  line: { height: 1.5, backgroundColor: '#D4C8BE', marginBottom: 10, borderRadius: 1 },
  eng: { fontSize: 11, color: GRAY, letterSpacing: 1.5 },
  co: { position: 'absolute', bottom: 50, alignItems: 'center' },
  coName: { fontSize: 11, color: '#B0A89E', fontWeight: '600', letterSpacing: 1 },
  coSub: { fontSize: 9, color: '#C8C0B8', marginTop: 2, letterSpacing: 0.5 },
});

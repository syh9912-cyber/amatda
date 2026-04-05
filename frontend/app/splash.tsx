import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

const BG = '#FDF6F0';
const INDIGO = '#4338CA';
const GRAY = '#9CA3AF';

export default function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // 캐릭터
  const illustOp = useRef(new Animated.Value(0)).current;
  const illustScale = useRef(new Animated.Value(0.7)).current;
  const illustY = useRef(new Animated.Value(50)).current;
  // 반짝이
  const sp1 = useRef(new Animated.Value(0)).current;
  const sp2 = useRef(new Animated.Value(0)).current;
  const sp3 = useRef(new Animated.Value(0)).current;
  // 아맞다 (처음에 붙어서 나옴)
  const titleOp = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.9)).current;
  // 글자 벌어지기 (아_맞_다 사이 간격)
  const gap1 = useRef(new Animated.Value(0)).current; // 아 와 맞 사이
  const gap2 = useRef(new Animated.Value(0)).current; // 맞 과 다 사이
  // 사이 글자 (이, 춤, 이어리)
  const subOp1 = useRef(new Animated.Value(0)).current; // 이
  const subOp2 = useRef(new Animated.Value(0)).current; // 춤
  const subOp3 = useRef(new Animated.Value(0)).current; // 이어리
  const subScale1 = useRef(new Animated.Value(0.3)).current;
  const subScale2 = useRef(new Animated.Value(0.3)).current;
  const subScale3 = useRef(new Animated.Value(0.3)).current;
  // 하단
  const lineW = useRef(new Animated.Value(0)).current;
  const engOp = useRef(new Animated.Value(0)).current;
  const coOp = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const e = Easing.out(Easing.cubic);
    Animated.sequence([
      Animated.delay(400),
      // 1. 캐릭터 등장
      Animated.parallel([
        Animated.timing(illustOp, { toValue: 1, duration: 1200, easing: e, useNativeDriver: true }),
        Animated.timing(illustScale, { toValue: 1, duration: 1400, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
        Animated.timing(illustY, { toValue: 0, duration: 1200, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
      ]),
      // 2. 반짝이
      Animated.stagger(200, [
        Animated.timing(sp1, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(sp2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(sp3, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      // 3. "아맞다" 등장 (붙어서)
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 800, easing: e, useNativeDriver: true }),
        Animated.timing(titleScale, { toValue: 1, duration: 800, easing: e, useNativeDriver: true }),
      ]),
      Animated.delay(500),
      // 4. 글자 사이가 벌어지면서 + "이" 등장
      Animated.parallel([
        Animated.timing(gap1, { toValue: 1, duration: 600, easing: e, useNativeDriver: false }),
        Animated.timing(subOp1, { toValue: 1, duration: 500, easing: e, useNativeDriver: true }),
        Animated.timing(subScale1, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      // 5. "춤" 등장
      Animated.parallel([
        Animated.timing(gap2, { toValue: 1, duration: 600, easing: e, useNativeDriver: false }),
        Animated.timing(subOp2, { toValue: 1, duration: 500, easing: e, useNativeDriver: true }),
        Animated.timing(subScale2, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      // 6. "이어리" 등장
      Animated.parallel([
        Animated.timing(subOp3, { toValue: 1, duration: 500, easing: e, useNativeDriver: true }),
        Animated.timing(subScale3, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      Animated.delay(300),
      // 7. 구분선 + 영문 + 회사
      Animated.timing(lineW, { toValue: 56, duration: 500, easing: e, useNativeDriver: false }),
      Animated.timing(engOp, { toValue: 1, duration: 500, easing: e, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(coOp, { toValue: 1, duration: 400, easing: e, useNativeDriver: true }),
      // 8. 2초 멈춤
      Animated.delay(2000),
      // 9. 페이드아웃
      Animated.timing(fadeOut, { toValue: 0, duration: 500, easing: e, useNativeDriver: true }),
    ]).start(() => {
      router.replace(isAuthenticated ? '/(main)/home' as never : '/(auth)/login' as never);
    });
  }, []);

  // gap 보간: 0→1 을 0px→24px로
  const gapWidth1 = gap1.interpolate({ inputRange: [0, 1], outputRange: [0, 24] });
  const gapWidth2 = gap2.interpolate({ inputRange: [0, 1], outputRange: [0, 24] });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeOut }]}>
        {/* 캐릭터 */}
        <View style={styles.illustWrap}>
          <Animated.View style={{
            opacity: illustOp,
            transform: [{ translateY: illustY }, { scale: illustScale }],
          }}>
            <Image source={require('../assets/child-diary.png')} style={styles.image} resizeMode="contain" />
          </Animated.View>
          <Animated.Text style={[styles.sparkle, styles.sp1, { opacity: sp1 }]}>✨</Animated.Text>
          <Animated.Text style={[styles.sparkle, styles.sp2, { opacity: sp2 }]}>⭐</Animated.Text>
          <Animated.Text style={[styles.sparkle, styles.sp3, { opacity: sp3 }]}>💜</Animated.Text>
        </View>

        {/* 아이맞춤다이어리 — 아맞다가 먼저, 사이 글자가 벌어지며 등장 */}
        <Animated.View style={[styles.nameRow, { opacity: titleOp, transform: [{ scale: titleScale }] }]}>
          <Text style={styles.mainChar}>아</Text>
          <Animated.View style={{ width: gapWidth1, overflow: 'hidden', alignItems: 'center' }}>
            <Animated.Text style={[styles.subChar, { opacity: subOp1, transform: [{ scale: subScale1 }] }]}>이</Animated.Text>
          </Animated.View>
          <Text style={styles.mainChar}>맞</Text>
          <Animated.View style={{ width: gapWidth2, overflow: 'hidden', alignItems: 'center' }}>
            <Animated.Text style={[styles.subChar, { opacity: subOp2, transform: [{ scale: subScale2 }] }]}>춤</Animated.Text>
          </Animated.View>
          <Text style={styles.mainChar}>다</Text>
          <Animated.View style={{ overflow: 'hidden' }}>
            <Animated.Text style={[styles.subChar, { opacity: subOp3, transform: [{ scale: subScale3 }] }]}>이어리</Animated.Text>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.line, { width: lineW }]} />
        <Animated.Text style={[styles.eng, { opacity: engOp }]}>Child-Customized Diary</Animated.Text>

        <Animated.View style={[styles.coWrap, { opacity: coOp }]}>
          <Text style={styles.coName}>Bloomin Corp.</Text>
          <Text style={styles.coInfo}>Growing with every child</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center' },
  illustWrap: { position: 'relative', width: 360, height: 360, alignItems: 'center', justifyContent: 'center' },
  image: { width: 340, height: 340 },
  sparkle: { position: 'absolute', fontSize: 22 },
  sp1: { top: 15, right: 20 },
  sp2: { top: 50, left: 15 },
  sp3: { bottom: 80, right: 10 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 20,
    marginBottom: 18,
  },
  mainChar: {
    fontSize: 44,
    fontWeight: '800',
    color: INDIGO,
    letterSpacing: -0.5,
  },
  subChar: {
    fontSize: 18,
    fontWeight: '500',
    color: GRAY,
  },
  line: { height: 2, backgroundColor: '#D4C8BE', marginBottom: 16, borderRadius: 1 },
  eng: { fontSize: 14, color: GRAY, letterSpacing: 1.5, fontWeight: '400' },
  coWrap: { marginTop: 44, alignItems: 'center' },
  coName: { fontSize: 13, color: '#B0A89E', fontWeight: '600', letterSpacing: 1.2 },
  coInfo: { fontSize: 10, color: '#C8C0B8', marginTop: 3, letterSpacing: 0.5 },
});

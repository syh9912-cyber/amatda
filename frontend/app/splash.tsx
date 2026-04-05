import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { AppNameDisplay } from '../components/ui/AppNameDisplay';

const BG = '#FDF6F0';

export default function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const illustOpacity = useRef(new Animated.Value(0)).current;
  const illustScale = useRef(new Animated.Value(0.7)).current;
  const illustY = useRef(new Animated.Value(50)).current;

  // 연필만 움직이는 애니메이션
  const penRotate = useRef(new Animated.Value(0)).current;
  const penX = useRef(new Animated.Value(0)).current;

  // 글씨 흔적 (점이 하나씩 나타남)
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  // 반짝이
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const sparkle3 = useRef(new Animated.Value(0)).current;

  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameY = useRef(new Animated.Value(20)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const engOpacity = useRef(new Animated.Value(0)).current;
  const companyOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    // 연필 글쓰기 모션 (손목만 움직이는 느낌)
    const penWriteAnim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(penRotate, { toValue: 8, duration: 300, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
          Animated.timing(penX, { toValue: 4, duration: 300, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(penRotate, { toValue: -5, duration: 350, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
          Animated.timing(penX, { toValue: -3, duration: 350, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(penRotate, { toValue: 6, duration: 280, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
          Animated.timing(penX, { toValue: 5, duration: 280, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(penRotate, { toValue: -3, duration: 320, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
          Animated.timing(penX, { toValue: -2, duration: 320, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(penRotate, { toValue: 0, duration: 200, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
          Animated.timing(penX, { toValue: 0, duration: 200, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        ]),
      ])
    );

    Animated.sequence([
      Animated.delay(400),
      // 1. 캐릭터 등장
      Animated.parallel([
        Animated.timing(illustOpacity, { toValue: 1, duration: 1200, easing: ease, useNativeDriver: true }),
        Animated.timing(illustScale, { toValue: 1, duration: 1400, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
        Animated.timing(illustY, { toValue: 0, duration: 1200, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
      ]),
      // 2. 글 쓰는 점 하나씩
      Animated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
      // 3. 반짝이 등장
      Animated.stagger(250, [
        Animated.timing(sparkle1, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(sparkle2, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(sparkle3, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      // 4. 앱 이름
      Animated.parallel([
        Animated.timing(nameOpacity, { toValue: 1, duration: 1000, easing: ease, useNativeDriver: true }),
        Animated.timing(nameY, { toValue: 0, duration: 1000, easing: ease, useNativeDriver: true }),
      ]),
      Animated.timing(lineWidth, { toValue: 56, duration: 500, easing: ease, useNativeDriver: false }),
      Animated.timing(engOpacity, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(companyOpacity, { toValue: 1, duration: 400, easing: ease, useNativeDriver: true }),
      // 5. 2초 멈춤
      Animated.delay(2000),
      // 6. 페이드아웃
      Animated.timing(fadeOut, { toValue: 0, duration: 500, easing: ease, useNativeDriver: true }),
    ]).start(() => {
      penWriteAnim.stop();
      router.replace(isAuthenticated ? '/(main)/home' as never : '/(auth)/login' as never);
    });

    // 캐릭터 등장 후 연필 움직임 시작
    setTimeout(() => penWriteAnim.start(), 1600);
  }, []);

  const penRotateStr = penRotate.interpolate({ inputRange: [-8, 8], outputRange: ['-12deg', '12deg'] });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeOut }]}>
        <View style={styles.illustWrap}>
          {/* 캐릭터 (고정) */}
          <Animated.View style={{
            opacity: illustOpacity,
            transform: [{ translateY: illustY }, { scale: illustScale }],
          }}>
            <Image source={require('../assets/child-diary.png')} style={styles.image} resizeMode="contain" />
          </Animated.View>

          {/* 연필 (손만 움직임) */}
          <Animated.Text style={[styles.pen, {
            opacity: illustOpacity,
            transform: [{ rotate: penRotateStr }, { translateX: penX }],
          }]}>
            ✏️
          </Animated.Text>

          {/* 글씨 흔적 (다이어리 위 점) */}
          <Animated.Text style={[styles.writeDot, styles.wd1, { opacity: dot1 }]}>.</Animated.Text>
          <Animated.Text style={[styles.writeDot, styles.wd2, { opacity: dot2 }]}>..</Animated.Text>
          <Animated.Text style={[styles.writeDot, styles.wd3, { opacity: dot3 }]}>...</Animated.Text>

          {/* 반짝이 */}
          <Animated.Text style={[styles.sparkle, styles.sp1, { opacity: sparkle1 }]}>✨</Animated.Text>
          <Animated.Text style={[styles.sparkle, styles.sp2, { opacity: sparkle2 }]}>⭐</Animated.Text>
          <Animated.Text style={[styles.sparkle, styles.sp3, { opacity: sparkle3 }]}>💜</Animated.Text>
        </View>

        <Animated.View style={[styles.nameWrap, { opacity: nameOpacity, transform: [{ translateY: nameY }] }]}>
          <AppNameDisplay size="large" />
        </Animated.View>

        <Animated.View style={[styles.line, { width: lineWidth }]} />
        <Animated.Text style={[styles.eng, { opacity: engOpacity }]}>Child-Customized Diary</Animated.Text>

        <Animated.View style={[styles.companyWrap, { opacity: companyOpacity }]}>
          <Text style={styles.companyName}>Bloomin Corp.</Text>
          <Text style={styles.companyInfo}>Growing with every child</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center' },
  illustWrap: { position: 'relative', width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  image: { width: 260, height: 260 },
  pen: { position: 'absolute', fontSize: 28, bottom: 55, right: 45 },
  writeDot: { position: 'absolute', fontSize: 18, color: '#7B68EE', fontWeight: '700' },
  wd1: { bottom: 65, right: 90 },
  wd2: { bottom: 72, right: 80 },
  wd3: { bottom: 58, right: 70 },
  sparkle: { position: 'absolute', fontSize: 22 },
  sp1: { top: 15, right: 20 },
  sp2: { top: 45, left: 15 },
  sp3: { bottom: 80, right: 10 },
  nameWrap: { marginTop: 20, marginBottom: 18 },
  line: { height: 2, backgroundColor: '#D4C8BE', marginBottom: 16, borderRadius: 1 },
  eng: { fontSize: 14, color: '#9CA3AF', letterSpacing: 1.5, fontWeight: '400' },
  companyWrap: { marginTop: 44, alignItems: 'center' },
  companyName: { fontSize: 13, color: '#B0A89E', fontWeight: '600', letterSpacing: 1.2 },
  companyInfo: { fontSize: 10, color: '#C8C0B8', marginTop: 3, letterSpacing: 0.5 },
});

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
  // 글 쓰는 동작 — 좌우 흔들림
  const writeSwing = useRef(new Animated.Value(0)).current;
  // 반짝이 이모지
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const sparkle3 = useRef(new Animated.Value(0)).current;
  const sparkle1Y = useRef(new Animated.Value(10)).current;
  const sparkle2Y = useRef(new Animated.Value(10)).current;
  const sparkle3Y = useRef(new Animated.Value(10)).current;

  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameY = useRef(new Animated.Value(20)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const engOpacity = useRef(new Animated.Value(0)).current;
  const companyOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    // 글 쓰는 흔들림 (연속 반복)
    const swingAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(writeSwing, { toValue: 3, duration: 400, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        Animated.timing(writeSwing, { toValue: -2, duration: 350, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        Animated.timing(writeSwing, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        Animated.timing(writeSwing, { toValue: -3, duration: 400, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
        Animated.timing(writeSwing, { toValue: 0, duration: 250, easing: Easing.inOut(Easing.sine), useNativeDriver: true }),
      ])
    );

    Animated.sequence([
      Animated.delay(400),
      // 1. 캐릭터 등장 (1.2초)
      Animated.parallel([
        Animated.timing(illustOpacity, { toValue: 1, duration: 1200, easing: ease, useNativeDriver: true }),
        Animated.timing(illustScale, { toValue: 1, duration: 1400, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
        Animated.timing(illustY, { toValue: 0, duration: 1200, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
      ]),
      // 2. 반짝이 하나씩 등장
      Animated.parallel([
        Animated.timing(sparkle1, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(sparkle1Y, { toValue: 0, duration: 400, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(sparkle2, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(sparkle2Y, { toValue: 0, duration: 350, easing: ease, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(sparkle3, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(sparkle3Y, { toValue: 0, duration: 300, easing: ease, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      // 3. 앱 이름 (1초)
      Animated.parallel([
        Animated.timing(nameOpacity, { toValue: 1, duration: 1000, easing: ease, useNativeDriver: true }),
        Animated.timing(nameY, { toValue: 0, duration: 1000, easing: ease, useNativeDriver: true }),
      ]),
      // 4. 구분선 (0.5초)
      Animated.timing(lineWidth, { toValue: 56, duration: 500, easing: ease, useNativeDriver: false }),
      // 5. 영문 (0.5초)
      Animated.timing(engOpacity, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
      Animated.delay(200),
      // 6. 회사명 (0.4초)
      Animated.timing(companyOpacity, { toValue: 1, duration: 400, easing: ease, useNativeDriver: true }),
      // 7. 2초 멈춤
      Animated.delay(2000),
      // 8. 페이드아웃 (0.5초)
      Animated.timing(fadeOut, { toValue: 0, duration: 500, easing: ease, useNativeDriver: true }),
    ]).start(() => {
      swingAnim.stop();
      router.replace(isAuthenticated ? '/(main)/home' as never : '/(auth)/login' as never);
    });

    // 캐릭터가 나타난 후 흔들림 시작
    setTimeout(() => swingAnim.start(), 1800);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeOut }]}>
        {/* 캐릭터 + 반짝이 */}
        <View style={styles.illustWrap}>
          <Animated.View style={{
            opacity: illustOpacity,
            transform: [{ translateY: illustY }, { scale: illustScale }, { rotate: writeSwing.interpolate({ inputRange: [-3, 3], outputRange: ['-2deg', '2deg'] }) }],
          }}>
            <Image source={require('../assets/child-diary.png')} style={styles.image} resizeMode="contain" />
          </Animated.View>

          {/* 반짝이 이모지 */}
          <Animated.Text style={[styles.sparkle, styles.sp1, { opacity: sparkle1, transform: [{ translateY: sparkle1Y }] }]}>
            ✨
          </Animated.Text>
          <Animated.Text style={[styles.sparkle, styles.sp2, { opacity: sparkle2, transform: [{ translateY: sparkle2Y }] }]}>
            ⭐
          </Animated.Text>
          <Animated.Text style={[styles.sparkle, styles.sp3, { opacity: sparkle3, transform: [{ translateY: sparkle3Y }] }]}>
            💜
          </Animated.Text>
        </View>

        <Animated.View style={[styles.nameWrap, { opacity: nameOpacity, transform: [{ translateY: nameY }] }]}>
          <AppNameDisplay size="large" />
        </Animated.View>

        <Animated.View style={[styles.line, { width: lineWidth }]} />

        <Animated.Text style={[styles.eng, { opacity: engOpacity }]}>
          Child-Customized Diary
        </Animated.Text>

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
  illustWrap: { position: 'relative', width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
  image: { width: 260, height: 260 },
  sparkle: { position: 'absolute', fontSize: 24 },
  sp1: { top: 10, right: 15 },
  sp2: { top: 40, left: 10 },
  sp3: { bottom: 50, right: 5 },
  nameWrap: { marginTop: 24, marginBottom: 18 },
  line: { height: 2, backgroundColor: '#D4C8BE', marginBottom: 16, borderRadius: 1 },
  eng: { fontSize: 14, color: '#9CA3AF', letterSpacing: 1.5, fontWeight: '400' },
  companyWrap: { marginTop: 48, alignItems: 'center' },
  companyName: { fontSize: 13, color: '#B0A89E', fontWeight: '600', letterSpacing: 1.2 },
  companyInfo: { fontSize: 10, color: '#C8C0B8', marginTop: 3, letterSpacing: 0.5 },
});

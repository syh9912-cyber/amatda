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
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameY = useRef(new Animated.Value(20)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const engOpacity = useRef(new Animated.Value(0)).current;
  const companyOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    Animated.sequence([
      Animated.delay(600),
      // 1. 이미지 천천히 등장 (1.2초)
      Animated.parallel([
        Animated.timing(illustOpacity, { toValue: 1, duration: 1200, easing: ease, useNativeDriver: true }),
        Animated.timing(illustScale, { toValue: 1, duration: 1400, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
        Animated.timing(illustY, { toValue: 0, duration: 1200, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
      ]),
      Animated.delay(400),
      // 2. 앱 이름 (1초)
      Animated.parallel([
        Animated.timing(nameOpacity, { toValue: 1, duration: 1000, easing: ease, useNativeDriver: true }),
        Animated.timing(nameY, { toValue: 0, duration: 1000, easing: ease, useNativeDriver: true }),
      ]),
      // 3. 구분선 (0.6초)
      Animated.timing(lineWidth, { toValue: 56, duration: 600, easing: ease, useNativeDriver: false }),
      // 4. 영문 (0.6초)
      Animated.timing(engOpacity, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
      Animated.delay(300),
      // 5. 회사명 (0.5초)
      Animated.timing(companyOpacity, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
      // 6. 2초 멈춤
      Animated.delay(2000),
      // 7. 페이드아웃 (0.5초)
      Animated.timing(fadeOut, { toValue: 0, duration: 500, easing: ease, useNativeDriver: true }),
    ]).start(() => {
      router.replace(isAuthenticated ? '/(main)/home' as never : '/(auth)/login' as never);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeOut }]}>
        <Animated.View style={{
          opacity: illustOpacity,
          transform: [{ translateY: illustY }, { scale: illustScale }],
        }}>
          <Image source={require('../assets/child-diary.png')} style={styles.image} resizeMode="contain" />
        </Animated.View>

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
  image: { width: 260, height: 260 },
  nameWrap: { marginTop: 28, marginBottom: 18 },
  line: { height: 2, backgroundColor: '#D4C8BE', marginBottom: 16, borderRadius: 1 },
  eng: { fontSize: 14, color: '#9CA3AF', letterSpacing: 1.5, fontWeight: '400' },
  companyWrap: { marginTop: 48, alignItems: 'center' },
  companyName: { fontSize: 13, color: '#B0A89E', fontWeight: '600', letterSpacing: 1.2 },
  companyInfo: { fontSize: 10, color: '#C8C0B8', marginTop: 3, letterSpacing: 0.5 },
});

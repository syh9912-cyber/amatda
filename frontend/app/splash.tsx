import { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { AppNameDisplay } from '../components/ui/AppNameDisplay';

const BG = '#FFFFFF';
const GRAY_LIGHT = '#B0B4C8';
const GRAY = '#9CA3AF';

export default function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const illustOpacity = useRef(new Animated.Value(0)).current;
  const illustScale = useRef(new Animated.Value(0.8)).current;
  const illustY = useRef(new Animated.Value(40)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameY = useRef(new Animated.Value(15)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const engOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    Animated.sequence([
      // 0.5초 대기
      Animated.delay(500),
      // 1. 이미지 천천히 등장 (1초)
      Animated.parallel([
        Animated.timing(illustOpacity, {
          toValue: 1, duration: 1000, easing: ease, useNativeDriver: true,
        }),
        Animated.timing(illustScale, {
          toValue: 1, duration: 1200, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true,
        }),
        Animated.timing(illustY, {
          toValue: 0, duration: 1000, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true,
        }),
      ]),
      // 0.3초 대기
      Animated.delay(300),
      // 2. 앱 이름 등장 (0.8초)
      Animated.parallel([
        Animated.timing(nameOpacity, {
          toValue: 1, duration: 800, easing: ease, useNativeDriver: true,
        }),
        Animated.timing(nameY, {
          toValue: 0, duration: 800, easing: ease, useNativeDriver: true,
        }),
      ]),
      // 3. 구분선 (0.5초)
      Animated.timing(lineWidth, {
        toValue: 48, duration: 500, easing: ease, useNativeDriver: false,
      }),
      // 4. 영문 (0.5초)
      Animated.timing(engOpacity, {
        toValue: 1, duration: 500, easing: ease, useNativeDriver: true,
      }),
      // 5. 완성 상태에서 2초 멈춤
      Animated.delay(2000),
      // 6. 페이드아웃 (0.4초)
      Animated.timing(fadeOut, {
        toValue: 0, duration: 400, easing: ease, useNativeDriver: true,
      }),
    ]).start(() => {
      router.replace(isAuthenticated ? '/(main)/home' as never : '/(auth)/login' as never);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeOut }]}>
        <Animated.View
          style={{
            opacity: illustOpacity,
            transform: [{ translateY: illustY }, { scale: illustScale }],
          }}
        >
          <Image
            source={require('../assets/child-diary.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={[styles.nameWrap, {
            opacity: nameOpacity,
            transform: [{ translateY: nameY }],
          }]}
        >
          <AppNameDisplay size="large" />
        </Animated.View>

        <Animated.View style={[styles.line, { width: lineWidth }]} />

        <Animated.Text style={[styles.eng, { opacity: engOpacity }]}>
          Child-Customized Diary
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { alignItems: 'center' },
  image: { width: 240, height: 240 },
  nameWrap: { marginTop: 24, marginBottom: 16 },
  line: {
    height: 1.5, backgroundColor: GRAY_LIGHT,
    marginBottom: 14, borderRadius: 1,
  },
  eng: {
    fontSize: 12, color: GRAY,
    letterSpacing: 1.2, fontWeight: '400',
  },
});

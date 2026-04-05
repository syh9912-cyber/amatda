import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

const BG = '#F0EDF6';
const INDIGO = '#4338CA';
const GRAY = '#8B8FA3';
const GRAY_LIGHT = '#B0B4C8';

export default function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.3)).current;
  const iconY = useRef(new Animated.Value(20)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.9)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const engOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    Animated.sequence([
      Animated.delay(300),
      // 아이 일러스트 등장 (위로 올라오면서 페이드인)
      Animated.parallel([
        Animated.timing(iconOpacity, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(iconY, { toValue: 0, duration: 600, easing: ease, useNativeDriver: true }),
      ]),
      // 앱 이름
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 450, easing: ease, useNativeDriver: true }),
        Animated.timing(titleScale, { toValue: 1, duration: 450, easing: ease, useNativeDriver: true }),
      ]),
      // 구분선
      Animated.timing(lineWidth, { toValue: 48, duration: 300, easing: ease, useNativeDriver: false }),
      // 한글 서브타이틀
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 350, easing: ease, useNativeDriver: true }),
      // 영문
      Animated.timing(engOpacity, { toValue: 1, duration: 350, easing: ease, useNativeDriver: true }),
      Animated.delay(500),
      // 페이드아웃
      Animated.timing(fadeOut, { toValue: 0, duration: 250, easing: ease, useNativeDriver: true }),
    ]).start(() => {
      router.replace(isAuthenticated ? '/(main)/home' as never : '/(auth)/login' as never);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeOut }]}>
        {/* 귀여운 아이 + 다이어리 일러스트 */}
        <Animated.View style={[styles.iconWrap, {
          opacity: iconOpacity,
          transform: [{ scale: iconScale }, { translateY: iconY }],
        }]}>
          <Text style={styles.childEmoji}>👧</Text>
          <Text style={styles.diaryEmoji}>📔</Text>
          <Text style={styles.penEmoji}>✏️</Text>
        </Animated.View>

        <Animated.Text style={[styles.title, {
          opacity: titleOpacity,
          transform: [{ scale: titleScale }],
        }]}>
          아맞다
        </Animated.Text>

        <Animated.View style={[styles.line, { width: lineWidth }]} />

        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          아이맞춤다이어리
        </Animated.Text>

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
  iconWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
    gap: 2,
  },
  childEmoji: { fontSize: 52 },
  diaryEmoji: { fontSize: 36, marginBottom: 4 },
  penEmoji: { fontSize: 20, marginBottom: 12, marginLeft: -8 },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: INDIGO,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  line: {
    height: 2,
    backgroundColor: GRAY_LIGHT,
    marginBottom: 14,
    borderRadius: 1,
  },
  subtitle: {
    fontSize: 15,
    color: GRAY,
    letterSpacing: 3,
    marginBottom: 8,
    fontWeight: '500',
  },
  eng: {
    fontSize: 11,
    color: GRAY_LIGHT,
    letterSpacing: 1.5,
    fontWeight: '400',
  },
});

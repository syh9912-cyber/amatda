import { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { ChildDiaryIllustration } from '../components/ui/ChildDiaryIllustration';
import { AppNameDisplay } from '../components/ui/AppNameDisplay';

const BG = '#FFF8F0';
const GRAY_LIGHT = '#B0B4C8';
const GRAY = '#9CA3AF';

export default function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const illustOpacity = useRef(new Animated.Value(0)).current;
  const illustY = useRef(new Animated.Value(30)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const engOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(illustOpacity, {
          toValue: 1,
          duration: 600,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(illustY, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(nameOpacity, {
        toValue: 1,
        duration: 450,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.timing(lineWidth, {
        toValue: 48,
        duration: 300,
        easing: ease,
        useNativeDriver: false,
      }),
      Animated.timing(engOpacity, {
        toValue: 1,
        duration: 350,
        easing: ease,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 250,
        easing: ease,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const dest = isAuthenticated
        ? '/(main)/home'
        : '/(auth)/login';
      router.replace(dest as never);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeOut }]}>
        <Animated.View
          style={{
            opacity: illustOpacity,
            transform: [{ translateY: illustY }],
          }}
        >
          <ChildDiaryIllustration width={200} height={200} />
        </Animated.View>

        <Animated.View
          style={[styles.nameWrap, { opacity: nameOpacity }]}
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
  content: {
    alignItems: 'center',
  },
  nameWrap: {
    marginTop: 20,
    marginBottom: 14,
  },
  line: {
    height: 1.5,
    backgroundColor: GRAY_LIGHT,
    marginBottom: 12,
    borderRadius: 1,
  },
  eng: {
    fontSize: 12,
    color: GRAY,
    letterSpacing: 1.2,
    fontWeight: '400',
  },
});

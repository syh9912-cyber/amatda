import { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Animated, Easing, StyleSheet, Dimensions, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

const { width: SW, height: SH } = Dimensions.get('window');

/* ── Colors — 브랜드 통일 ── */
const C = {
  accent: '#FF8C5A',
  white: '#1A1A1A',
  shadow: 'rgba(0,0,0,0.05)',
  gray: '#999999',
  lightGray: '#B0B0B0',
};

/* ================================================================== */
/*  Splash Screen                                                      */
/*  Phase 1: Full-screen anime video                                   */
/*  Phase 2: "아맞다" → "아이맞춤다이어리" text overlay animation       */
/*  Phase 3: 1s hold → navigate                                        */
/* ================================================================== */

export default function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const animStarted = useRef(false);

  /* ── Animated values ── */
  // Video overlay
  const overlayOp = useRef(new Animated.Value(0)).current;
  // Big title: 아 맞 다  (always visible once shown)
  const titleOp = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.5)).current;
  // Sub chars expanding
  const gap1W = useRef(new Animated.Value(0)).current;   // "이" between 아-맞
  const sub1Op = useRef(new Animated.Value(0)).current;
  const sub1Sc = useRef(new Animated.Value(0.2)).current;
  const gap2W = useRef(new Animated.Value(0)).current;   // "춤" between 맞-다
  const sub2Op = useRef(new Animated.Value(0)).current;
  const sub2Sc = useRef(new Animated.Value(0.2)).current;
  const gap3W = useRef(new Animated.Value(0)).current;   // "이어리" after 다
  const sub3Op = useRef(new Animated.Value(0)).current;
  const sub3Sc = useRef(new Animated.Value(0.2)).current;
  // Subtitle
  const engOp = useRef(new Animated.Value(0)).current;
  // Footer
  const footOp = useRef(new Animated.Value(0)).current;
  const footY = useRef(new Animated.Value(20)).current;
  // Whole screen fade out
  const fadeOut = useRef(new Animated.Value(1)).current;

  /* ── Navigate ── */
  const navigate = useCallback(() => {
    try {
      const target = isAuthenticated ? '/(main)/home' : '/(auth)/login';
      router.replace(target as never);
    } catch {
      router.replace('/(auth)/login' as never);
    }
  }, [isAuthenticated]);

  /* ── Text animation sequence ── */
  const startTextAnim = useCallback(() => {
    const ease = Easing.out(Easing.cubic);
    const spring = Easing.out(Easing.back(1.6));

    Animated.sequence([
      Animated.timing(overlayOp, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 200, easing: ease, useNativeDriver: true }),
        Animated.timing(titleScale, { toValue: 1, duration: 280, easing: spring, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(gap1W, { toValue: 1, duration: 180, easing: ease, useNativeDriver: false }),
        Animated.timing(sub1Op, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(sub1Sc, { toValue: 1, duration: 150, easing: spring, useNativeDriver: true }),
        Animated.timing(gap2W, { toValue: 1, duration: 180, easing: ease, useNativeDriver: false }),
        Animated.timing(sub2Op, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(sub2Sc, { toValue: 1, duration: 150, easing: spring, useNativeDriver: true }),
        Animated.timing(gap3W, { toValue: 1, duration: 220, easing: ease, useNativeDriver: false }),
        Animated.timing(sub3Op, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(sub3Sc, { toValue: 1, duration: 180, easing: spring, useNativeDriver: true }),
        Animated.timing(engOp, { toValue: 1, duration: 180, easing: ease, useNativeDriver: true }),
        Animated.timing(footOp, { toValue: 1, duration: 180, easing: ease, useNativeDriver: true }),
        Animated.timing(footY, { toValue: 0, duration: 180, easing: ease, useNativeDriver: true }),
      ]),
      Animated.delay(3000),
      Animated.timing(fadeOut, { toValue: 0, duration: 200, easing: ease, useNativeDriver: true }),
    ]).start(() => navigate());
  }, [overlayOp, titleOp, titleScale, gap1W, sub1Op, sub1Sc, gap2W, sub2Op, sub2Sc, gap3W, sub3Op, sub3Sc, engOp, footOp, footY, fadeOut, navigate]);

  useEffect(() => {
    if (!animStarted.current) {
      animStarted.current = true;
      startTextAnim();
    }
  }, [startTextAnim]);

  /* ── Interpolations ── */
  const gapW1 = gap1W.interpolate({ inputRange: [0, 1], outputRange: [0, 22] });
  const gapW2 = gap2W.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const gapW3 = gap3W.interpolate({ inputRange: [0, 1], outputRange: [0, 56] });

  return (
    <Animated.View style={[s.root, { opacity: fadeOut }]}>
      <StatusBar hidden />

      {/* ═══ Dark overlay for text readability ═══ */}
      <Animated.View style={[s.overlay, { opacity: overlayOp }]} />

      {/* ═══ Text animation ═══ */}
      <View style={s.textCenter}>
        <Animated.View
          style={[
            s.nameRow,
            { opacity: titleOp, transform: [{ scale: titleScale }] },
          ]}
        >
          {/* 아 */}
          <Text style={s.bigChar}>{'아'}</Text>

          {/* (이) */}
          <Animated.View style={{ width: gapW1, overflow: 'hidden', alignItems: 'center' }}>
            <Animated.Text
              style={[s.subChar, { opacity: sub1Op, transform: [{ scale: sub1Sc }] }]}
            >
              {'이'}
            </Animated.Text>
          </Animated.View>

          {/* 맞 */}
          <Text style={s.bigChar}>{'맞'}</Text>

          {/* (춤) */}
          <Animated.View style={{ width: gapW2, overflow: 'hidden', alignItems: 'center' }}>
            <Animated.Text
              style={[s.subChar, { opacity: sub2Op, transform: [{ scale: sub2Sc }] }]}
            >
              {'춤'}
            </Animated.Text>
          </Animated.View>

          {/* 다 */}
          <Text style={s.bigChar}>{'다'}</Text>

          {/* (이어리) */}
          <Animated.View style={{ width: gapW3, overflow: 'hidden' }}>
            <Animated.Text
              style={[s.subChar, { opacity: sub3Op, transform: [{ scale: sub3Sc }] }]}
            >
              {'이어리'}
            </Animated.Text>
          </Animated.View>
        </Animated.View>

        {/* English subtitle */}
        <Animated.Text style={[s.eng, { opacity: engOp }]}>
          {'Child-Customized Diary'}
        </Animated.Text>
      </View>

      {/* ═══ Footer ═══ */}
      <Animated.View
        style={[s.footer, { opacity: footOp, transform: [{ translateY: footY }] }]}
      >
        <Text style={s.footerName}>{'SY Labs'}</Text>
        <Text style={s.footerSub}>{'Growing with every child'}</Text>
      </Animated.View>
    </Animated.View>
  );
}

/* ── Styles ── */
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  /* Full-screen video (same bg color = seamless) */
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SW,
    height: SH,
  },

  /* Semi-transparent overlay for text contrast */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FAFAFA',
  },

  /* Text center */
  textCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 16,
  },

  bigChar: {
    fontSize: 44,
    fontWeight: '900',
    color: C.white,
    textShadowColor: C.shadow,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },

  subChar: {
    fontSize: 18,
    fontWeight: '700',
    color: C.accent,
    textShadowColor: 'rgba(255,140,90,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  eng: {
    fontSize: 13,
    color: C.gray,
    letterSpacing: 3,
    fontWeight: '600',
    textShadowColor: C.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  footer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    alignItems: 'center',
  },
  footerName: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  footerSub: {
    fontSize: 9,
    color: 'rgba(0,0,0,0.4)',
    marginTop: 3,
    letterSpacing: 0.8,
  },
});

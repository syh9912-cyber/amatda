import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Animated, Easing, StyleSheet, Dimensions, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

const { width: SW, height: SH } = Dimensions.get('window');

/* eslint-disable @typescript-eslint/no-require-imports */
const SPLASH_VIDEO = require('../assets/splash-video.mp4') as number;
/* eslint-enable @typescript-eslint/no-require-imports */

/* ── Colors ── */
const C = {
  accent: '#FF8C5A',
  white: '#2D2016',
  shadow: 'rgba(0,0,0,0.08)',
  gray: '#8C7A6B',
  lightGray: '#B5A99A',
};

/* ================================================================== */
/*  Splash Screen                                                      */
/*  Phase 1: Full-screen anime video                                   */
/*  Phase 2: "아맞다" → "아이맞춤다이어리" text overlay animation       */
/*  Phase 3: 1s hold → navigate                                        */
/* ================================================================== */

export default function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  /* ── Video module (dynamic import per CLAUDE.md rule 6) ── */
  const [VideoComp, setVideoComp] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const videoLoaded = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('expo-av');
        if (mounted) { setVideoComp(() => mod.Video); videoLoaded.current = true; }
      } catch {
        // fallback: skip video
        if (mounted) startTextAnim();
      }
    })();
    return () => { mounted = false; };
  }, []);

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
      setTimeout(() => router.replace(target as never), 100);
    } catch {
      setTimeout(() => router.replace('/(auth)/login' as never), 500);
    }
  }, [isAuthenticated]);

  /* ── Text animation sequence ── */
  const startTextAnim = useCallback(() => {
    const ease = Easing.out(Easing.cubic);
    const spring = Easing.out(Easing.back(1.6));

    Animated.sequence([
      // 0. Show dark overlay behind text
      Animated.timing(overlayOp, { toValue: 1, duration: 400, useNativeDriver: true }),

      // 1. "아맞다" appear big + scale bounce
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
        Animated.timing(titleScale, { toValue: 1, duration: 700, easing: spring, useNativeDriver: true }),
      ]),

      Animated.delay(600),

      // 2. "이" expands between 아-맞
      Animated.parallel([
        Animated.timing(gap1W, { toValue: 1, duration: 500, easing: ease, useNativeDriver: false }),
        Animated.timing(sub1Op, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(sub1Sc, { toValue: 1, duration: 400, easing: spring, useNativeDriver: true }),
      ]),

      Animated.delay(200),

      // 3. "춤" expands between 맞-다
      Animated.parallel([
        Animated.timing(gap2W, { toValue: 1, duration: 500, easing: ease, useNativeDriver: false }),
        Animated.timing(sub2Op, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(sub2Sc, { toValue: 1, duration: 400, easing: spring, useNativeDriver: true }),
      ]),

      Animated.delay(200),

      // 4. "이어리" expands after 다
      Animated.parallel([
        Animated.timing(gap3W, { toValue: 1, duration: 600, easing: ease, useNativeDriver: false }),
        Animated.timing(sub3Op, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(sub3Sc, { toValue: 1, duration: 500, easing: spring, useNativeDriver: true }),
      ]),

      Animated.delay(300),

      // 5. English subtitle
      Animated.timing(engOp, { toValue: 1, duration: 400, easing: ease, useNativeDriver: true }),

      // 6. Footer
      Animated.parallel([
        Animated.timing(footOp, { toValue: 1, duration: 400, easing: ease, useNativeDriver: true }),
        Animated.timing(footY, { toValue: 0, duration: 400, easing: ease, useNativeDriver: true }),
      ]),

      // 7. Hold 1 second
      Animated.delay(1000),

      // 8. Fade out everything
      Animated.timing(fadeOut, { toValue: 0, duration: 500, easing: ease, useNativeDriver: true }),
    ]).start(() => navigate());
  }, [overlayOp, titleOp, titleScale, gap1W, sub1Op, sub1Sc, gap2W, sub2Op, sub2Sc, gap3W, sub3Op, sub3Sc, engOp, footOp, footY, fadeOut, navigate]);

  /* ── Video end handler ── */
  const onVideoEnd = useCallback(() => {
    startTextAnim();
  }, [startTextAnim]);

  /* ── Fallback timeout (if video fails to trigger end) ── */
  useEffect(() => {
    const fallback = setTimeout(() => {
      if ((titleOp as unknown as { _value: number })._value === 0) startTextAnim();
    }, 8000);
    return () => clearTimeout(fallback);
  }, [startTextAnim, titleOp]);

  /* ── Interpolations ── */
  const gapW1 = gap1W.interpolate({ inputRange: [0, 1], outputRange: [0, 22] });
  const gapW2 = gap2W.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const gapW3 = gap3W.interpolate({ inputRange: [0, 1], outputRange: [0, 56] });

  return (
    <Animated.View style={[s.root, { opacity: fadeOut }]}>
      <StatusBar hidden />

      {/* ═══ Full-screen video background ═══ */}
      {VideoComp && (
        <VideoComp
          source={SPLASH_VIDEO}
          style={s.video}
          resizeMode="cover"
          shouldPlay
          isLooping={false}
          isMuted
          onPlaybackStatusUpdate={(status: Record<string, unknown>) => {
            if (status.didJustFinish) onVideoEnd();
          }}
        />
      )}

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
    backgroundColor: '#F5E3C3',
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
    backgroundColor: '#FFF5EC',
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

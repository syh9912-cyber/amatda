import { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Animated, Easing, StyleSheet, Dimensions, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';

// 비한국어 브랜드 워드마크 — 한국어 글자 애니메이션 대신 단일 표기 (앱 표시이름과 동일)
const SPLASH_BRAND: Record<string, string> = { ja: 'なるほど育児', 'zh-Hant': '育兒答' };

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
  const { i18n } = useTranslation();
  const splashBrand = SPLASH_BRAND[i18n.language];

  const animStarted = useRef(false);
  const hasNavigated = useRef(false);

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

  /* ── Navigate ──
     성공했을 때만 hasNavigated=true. 라우터가 아직 준비 안 됐으면(예: OTA reload
     직후 navigation tree 미마운트) router.replace 가 throw → false 유지 →
     fail-safe 인터벌이 준비될 때까지 재시도. (이전 버그: 시도 전에 true 로 박아
     실패 시 영구 정지) */
  const navigate = useCallback(() => {
    if (hasNavigated.current) return;
    try {
      const target = isAuthenticated ? '/(main)/home' : '/(auth)/login';
      router.replace(target as never);
      hasNavigated.current = true;
    } catch {
      // 라우터 미준비 — 재시도 인터벌이 다시 시도 (hasNavigated 유지)
    }
  }, [isAuthenticated]);

  /* ── Text animation sequence ── */
  const startTextAnim = useCallback(() => {
    const ease = Easing.out(Easing.cubic);
    const spring = Easing.out(Easing.back(1.6));

    // 시작 체감속도 개선(2026-07-23): 브랜드 애니는 유지하되 각 구간을 타이트하게 →
    // 총 ~2050ms → ~1150ms. (단어 조립 효과 이→춤→이어리 순차는 유지)
    Animated.sequence([
      Animated.timing(overlayOp, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 260, easing: ease, useNativeDriver: true }),
        Animated.timing(titleScale, { toValue: 1, duration: 300, easing: spring, useNativeDriver: true }),
      ]),
      // 서브 글자들을 순차적으로 늘어나게 (2(이) → 맞춤(춤) → 다이어리(이어리))
      Animated.sequence([
        Animated.parallel([
          Animated.timing(gap1W, { toValue: 1, duration: 160, easing: ease, useNativeDriver: false }),
          Animated.timing(sub1Op, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(sub1Sc, { toValue: 1, duration: 160, easing: spring, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(gap2W, { toValue: 1, duration: 160, easing: ease, useNativeDriver: false }),
          Animated.timing(sub2Op, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(sub2Sc, { toValue: 1, duration: 160, easing: spring, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(gap3W, { toValue: 1, duration: 180, easing: ease, useNativeDriver: false }),
          Animated.timing(sub3Op, { toValue: 1, duration: 170, useNativeDriver: true }),
          Animated.timing(sub3Sc, { toValue: 1, duration: 180, easing: spring, useNativeDriver: true }),
          Animated.timing(engOp, { toValue: 1, duration: 180, easing: ease, useNativeDriver: true }),
          Animated.timing(footOp, { toValue: 1, duration: 180, easing: ease, useNativeDriver: true }),
          Animated.timing(footY, { toValue: 0, duration: 180, easing: ease, useNativeDriver: true }),
        ]),
      ]),
      Animated.delay(80),
      Animated.timing(fadeOut, { toValue: 0, duration: 150, easing: ease, useNativeDriver: true }),
    ]).start(() => navigate());
  }, [overlayOp, titleOp, titleScale, gap1W, sub1Op, sub1Sc, gap2W, sub2Op, sub2Sc, gap3W, sub3Op, sub3Sc, engOp, footOp, footY, fadeOut, navigate]);

  useEffect(() => {
    if (!animStarted.current) {
      animStarted.current = true;
      startTextAnim();
    }
    // fail-safe: 애니메이션 완료 콜백에 의존하지 않고 타이머로 직접 이동 구동.
    // OTA reload 직후 애니메이션 콜백이 유실되거나 라우터 마운트가 지연돼도,
    // 1.5s 부터 0.4s 간격으로 이동을 재시도 → 라우터 준비되는 즉시 성공하고 멈춤.
    // navigate 는 성공 시에만 hasNavigated=true → 성공할 때까지 계속 재시도.
    // 최대 30초 상한(무한 방지). 정상 부팅 땐 애니메이션이 ~1.15s 에 이동 → 인터벌 no-op.
    let retry: ReturnType<typeof setInterval> | undefined;
    const startFailSafe = setTimeout(() => {
      navigate(); // 즉시 1회 시도
      if (!hasNavigated.current) {
        retry = setInterval(() => {
          if (hasNavigated.current) { if (retry) clearInterval(retry); return; }
          navigate();
        }, 400);
      }
    }, 1500);
    const stop = setTimeout(() => { if (retry) clearInterval(retry); }, 30000);
    return () => {
      clearTimeout(startFailSafe);
      clearTimeout(stop);
      if (retry) clearInterval(retry);
    };
  }, [startTextAnim, navigate]);

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
          {splashBrand ? (
            /* 비한국어: 브랜드명 단일 표기(Amatda / アマッタ) */
            <Text style={s.bigChar}>{splashBrand}</Text>
          ) : (
            <>
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
            </>
          )}
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
    backgroundColor: '#F2F2F7',
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
    backgroundColor: '#F2F2F7',
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

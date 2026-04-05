import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

const BG = '#FDF6F0';
const INDIGO = '#4338CA';
const GRAY = '#9CA3AF';
const { width: SCREEN_W } = Dimensions.get('window');

export default function SplashScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // 캐릭터 본체
  const bodyOp = useRef(new Animated.Value(0)).current;
  const bodyScale = useRef(new Animated.Value(0.7)).current;
  const bodyY = useRef(new Animated.Value(50)).current;
  // 손+연필 (별도 레이어)
  const handOp = useRef(new Animated.Value(0)).current;
  const handRotate = useRef(new Animated.Value(0)).current;
  const handX = useRef(new Animated.Value(0)).current;
  // 반짝이
  const sp1 = useRef(new Animated.Value(0)).current;
  const sp2 = useRef(new Animated.Value(0)).current;
  const sp3 = useRef(new Animated.Value(0)).current;
  // 아맞다
  const titleOp = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.9)).current;
  // 글자 벌어지기
  const gap1 = useRef(new Animated.Value(0)).current;
  const gap2 = useRef(new Animated.Value(0)).current;
  // 사이 글자
  const subOp1 = useRef(new Animated.Value(0)).current;
  const subOp2 = useRef(new Animated.Value(0)).current;
  const subOp3 = useRef(new Animated.Value(0)).current;
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

    // 연필 글쓰기 루프 (손만 움직임)
    const penLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(handRotate, { toValue: 6, duration: 350, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(handX, { toValue: 3, duration: 350, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(handRotate, { toValue: -4, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(handX, { toValue: -2, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(handRotate, { toValue: 5, duration: 280, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(handX, { toValue: 4, duration: 280, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(handRotate, { toValue: -3, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(handX, { toValue: -1, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(handRotate, { toValue: 0, duration: 250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(handX, { toValue: 0, duration: 250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    );

    Animated.sequence([
      Animated.delay(400),
      // 1. 캐릭터 본체 등장
      Animated.parallel([
        Animated.timing(bodyOp, { toValue: 1, duration: 1200, easing: e, useNativeDriver: true }),
        Animated.timing(bodyScale, { toValue: 1, duration: 1400, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
        Animated.timing(bodyY, { toValue: 0, duration: 1200, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
      ]),
      // 2. 손+연필 등장
      Animated.timing(handOp, { toValue: 1, duration: 400, easing: e, useNativeDriver: true }),
      // 3. 반짝이
      Animated.stagger(200, [
        Animated.timing(sp1, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(sp2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(sp3, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      // 4. "아맞다"
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 800, easing: e, useNativeDriver: true }),
        Animated.timing(titleScale, { toValue: 1, duration: 800, easing: e, useNativeDriver: true }),
      ]),
      Animated.delay(500),
      // 5. "이" 끼어듦
      Animated.parallel([
        Animated.timing(gap1, { toValue: 1, duration: 600, easing: e, useNativeDriver: false }),
        Animated.timing(subOp1, { toValue: 1, duration: 500, easing: e, useNativeDriver: true }),
        Animated.timing(subScale1, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      // 6. "춤" 끼어듦
      Animated.parallel([
        Animated.timing(gap2, { toValue: 1, duration: 600, easing: e, useNativeDriver: false }),
        Animated.timing(subOp2, { toValue: 1, duration: 500, easing: e, useNativeDriver: true }),
        Animated.timing(subScale2, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      // 7. "이어리" 등장
      Animated.parallel([
        Animated.timing(subOp3, { toValue: 1, duration: 500, easing: e, useNativeDriver: true }),
        Animated.timing(subScale3, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      Animated.delay(300),
      // 8. 구분선 + 영문 + 회사
      Animated.timing(lineW, { toValue: 56, duration: 500, easing: e, useNativeDriver: false }),
      Animated.timing(engOp, { toValue: 1, duration: 500, easing: e, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(coOp, { toValue: 1, duration: 400, easing: e, useNativeDriver: true }),
      // 9. 2초 멈춤
      Animated.delay(2000),
      // 10. 페이드아웃
      Animated.timing(fadeOut, { toValue: 0, duration: 500, easing: e, useNativeDriver: true }),
    ]).start(() => {
      penLoop.stop();
      router.replace(isAuthenticated ? '/(main)/home' as never : '/(auth)/login' as never);
    });

    // 손 등장 후 글쓰기 모션 시작
    setTimeout(() => penLoop.start(), 2200);
  }, []);

  const gapW1 = gap1.interpolate({ inputRange: [0, 1], outputRange: [0, 22] });
  const gapW2 = gap2.interpolate({ inputRange: [0, 1], outputRange: [0, 22] });
  const handRot = handRotate.interpolate({ inputRange: [-6, 6], outputRange: ['-10deg', '10deg'] });

  // 이미지 크기 1.3배 = 442px, 연필 중심 정렬
  const IMG_SIZE = 442;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeOut }]}>
        {/* 캐릭터 영역 — 연필이 좌우 중심 */}
        <View style={[styles.illustWrap, { width: IMG_SIZE, height: IMG_SIZE * 0.6 }]}>
          {/* 본체 (고정) */}
          <Animated.View style={[styles.bodyLayer, {
            opacity: bodyOp,
            transform: [{ translateY: bodyY }, { scale: bodyScale }],
          }]}>
            <Image source={require('../assets/child-diary.png')} style={{ width: IMG_SIZE, height: IMG_SIZE * 0.55 }} resizeMode="contain" />
          </Animated.View>

          {/* 손+연필 (움직임) */}
          <Animated.View style={[styles.handLayer, {
            opacity: handOp,
            transform: [{ rotate: handRot }, { translateX: handX }],
          }]}>
            <Image source={require('../assets/hand-pen.png')} style={styles.handImage} resizeMode="contain" />
          </Animated.View>

          {/* 반짝이 */}
          <Animated.Text style={[styles.sparkle, { top: 0, right: 30, opacity: sp1 }]}>✨</Animated.Text>
          <Animated.Text style={[styles.sparkle, { top: 30, left: 20, opacity: sp2 }]}>⭐</Animated.Text>
          <Animated.Text style={[styles.sparkle, { bottom: 40, right: 15, opacity: sp3 }]}>💜</Animated.Text>
        </View>

        {/* 아이맞춤다이어리 — "맞"이 화면 중앙에 고정 */}
        <Animated.View style={[styles.nameRow, { opacity: titleOp, transform: [{ scale: titleScale }] }]}>
          {/* 왼쪽: 아(이) — 오른쪽으로 밀려남 */}
          <View style={styles.nameLeft}>
            <Text style={styles.mainChar}>아</Text>
            <Animated.View style={{ width: gapW1, overflow: 'hidden', alignItems: 'center' }}>
              <Animated.Text style={[styles.subChar, { opacity: subOp1, transform: [{ scale: subScale1 }] }]}>이</Animated.Text>
            </Animated.View>
          </View>

          {/* 중앙: 맞 (고정) */}
          <Text style={styles.mainCharCenter}>맞</Text>

          {/* 오른쪽: (춤)다이어리 — 왼쪽으로 밀려남 */}
          <View style={styles.nameRight}>
            <Animated.View style={{ width: gapW2, overflow: 'hidden', alignItems: 'center' }}>
              <Animated.Text style={[styles.subChar, { opacity: subOp2, transform: [{ scale: subScale2 }] }]}>춤</Animated.Text>
            </Animated.View>
            <Text style={styles.mainChar}>다</Text>
            <Animated.View style={{ overflow: 'hidden' }}>
              <Animated.Text style={[styles.subChar, { opacity: subOp3, transform: [{ scale: subScale3 }] }]}>이어리</Animated.Text>
            </Animated.View>
          </View>
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
  content: { alignItems: 'center', width: '100%' },
  illustWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  bodyLayer: { position: 'absolute' },
  handLayer: { position: 'absolute', bottom: 10, right: 40 },
  handImage: { width: 120, height: 80 },
  sparkle: { position: 'absolute', fontSize: 22 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 16,
    width: '100%',
  },
  nameLeft: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end' },
  nameRight: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-start' },
  mainChar: {
    fontSize: 38,
    fontWeight: '800',
    color: INDIGO,
  },
  mainCharCenter: {
    fontSize: 42,
    fontWeight: '800',
    color: INDIGO,
  },
  subChar: {
    fontSize: 16,
    fontWeight: '500',
    color: GRAY,
  },
  line: { height: 2, backgroundColor: '#D4C8BE', marginBottom: 14, borderRadius: 1 },
  eng: { fontSize: 13, color: GRAY, letterSpacing: 1.5, fontWeight: '400' },
  coWrap: { marginTop: 36, alignItems: 'center' },
  coName: { fontSize: 13, color: '#B0A89E', fontWeight: '600', letterSpacing: 1.2 },
  coInfo: { fontSize: 10, color: '#C8C0B8', marginTop: 3, letterSpacing: 0.5 },
});

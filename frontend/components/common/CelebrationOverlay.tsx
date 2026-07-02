/**
 * 축하 인터랙션 — 폭죽(Confetti) + 응원 메시지
 *
 * - 외부 라이브러리 X (순수 RN Animated, OTA 안전)
 * - VIP 사용자에게는 더 많은 파티클 + 골드 컬러
 *
 * 사용:
 *   <CelebrationOverlay
 *     visible={done}
 *     message="우리 엄마, 오늘도 정말 고생 많았어요!"
 *     vip={false}
 *     onClose={() => setDone(false)}
 *   />
 */

import { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const COLORS_BASIC = ['#FF8C5A', '#7C5CFF', '#4DD0E1', '#FFD54F', '#F06292'];
const COLORS_VIP = ['#FFD700', '#FF6F00', '#FF3D00', '#7C5CFF', '#E91E63', '#00E5FF'];

interface Props {
  visible: boolean;
  message: string;
  vip?: boolean;
  onClose: () => void;
}

interface ConfettiParticle {
  startX: number;
  endX: number;
  endY: number;
  rotateEnd: string;
  size: number;
  color: string;
  delay: number;
  duration: number;
  shape: 'rect' | 'circle';
}

export function CelebrationOverlay({ visible, message, vip = false, onClose }: Props) {
  const particles: ConfettiParticle[] = useMemo(() => {
    const count = vip ? 40 : 25;
    const palette = vip ? COLORS_VIP : COLORS_BASIC;
    return Array.from({ length: count }).map(() => ({
      startX: Math.random() * SCREEN_WIDTH,
      endX: Math.random() * SCREEN_WIDTH,
      endY: SCREEN_HEIGHT * (0.6 + Math.random() * 0.5),
      rotateEnd: `${Math.floor(Math.random() * 720) - 360}deg`,
      size: 8 + Math.random() * 10,
      color: palette[Math.floor(Math.random() * palette.length)],
      delay: Math.random() * 400,
      duration: 1800 + Math.random() * 1400,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));
  }, [vip, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Confetti 파티클 */}
        {particles.map((p, i) => (
          <Particle key={`p-${i}-${visible ? '1' : '0'}`} p={p} active={visible} />
        ))}

        {/* 가운데 메시지 카드 */}
        <View style={styles.cardWrap}>
          <MessageCard vip={vip} message={message} active={visible} onClose={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function Particle({ p, active }: { p: ConfettiParticle; active: boolean }) {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(p.startX)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    translateY.setValue(-50);
    translateX.setValue(p.startX);
    rotate.setValue(0);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: p.endY,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: p.endX,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 100,
          delay: p.delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 600,
          delay: p.duration - 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [active, p, translateY, translateX, rotate, opacity]);

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', p.rotateEnd],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: p.size,
        height: p.size,
        backgroundColor: p.color,
        borderRadius: p.shape === 'circle' ? p.size / 2 : 2,
        transform: [{ translateX }, { translateY }, { rotate: rotation }],
        opacity,
      }}
    />
  );
}

function MessageCard({
  vip,
  message,
  active,
  onClose,
}: {
  vip: boolean;
  message: string;
  active: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    scale.setValue(0);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [active, scale, opacity]);

  return (
    <Animated.View style={[styles.card, vip && styles.cardVip, { opacity, transform: [{ scale }] }]}>
      <Text style={styles.celebrateEmoji}>{vip ? '🎉✨🎊' : '🎉'}</Text>
      <Text style={[styles.message, vip && styles.messageVip]}>{message}</Text>
      <TouchableOpacity style={[styles.btn, vip && styles.btnVip]} onPress={onClose} activeOpacity={0.85}>
        <Text style={styles.btnText}>{t('components.celebrationOverlay.thanks')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 12,
  },
  cardVip: {
    backgroundColor: '#FFFDF6',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  celebrateEmoji: { fontSize: 56, marginBottom: 14 },
  message: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 22,
  },
  messageVip: {
    color: '#3C3450',
  },
  btn: {
    backgroundColor: '#FF8C5A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  btnVip: {
    backgroundColor: '#FFD700',
  },
  btnText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
});

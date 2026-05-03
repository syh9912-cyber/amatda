/**
 * 가벼운 토스트 — 데일리 미션 등 사소한 기록 완료에 사용.
 *
 * - 화면 상단(safe area 아래)에 잠깐 떴다 사라짐
 * - 큰 모달/폭죽이 아니라 사용자 흐름 방해 X
 * - 사용 흐름:
 *     const [toast, setToast] = useState<string | null>(null);
 *     // 표시: setToast('물 한 잔 추가했어요 💧');
 *     <MissionToast message={toast} onDismiss={() => setToast(null)} />
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  message: string | null;
  durationMs?: number;
  onDismiss: () => void;
}

export function MissionToast({ message, durationMs = 1800, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    translateY.setValue(-20);
    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
      Animated.delay(durationMs),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 220, useNativeDriver: true }),
      ]),
    ]);
    sequence.start(({ finished }) => {
      if (finished) onDismiss();
    });
    return () => sequence.stop();
  }, [message, durationMs, onDismiss, opacity, translateY]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { top: insets.top + 12, opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(28,28,30,0.92)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

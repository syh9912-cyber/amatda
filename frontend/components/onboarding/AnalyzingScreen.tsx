import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { FONT_SIZE, SPACING } from '../../constants/theme';

const MESSAGES = [
  '',
  '유아기질분석 AI가 정밀 분석을 시작합니다...',
  '생년월일시 기반 고유 에너지를 분석하고 있습니다...',
  '20개 응답 패턴을 교차 검증하고 있습니다...',
  '성격·학습·사회성 프로파일을 생성하고 있습니다...',
  '최적의 교육 방향을 도출하고 있습니다...',
  '맞춤형 양육 가이드를 완성하고 있습니다...',
  '분석이 완료되었습니다! ✨',
];

const STEP_DURATION = 2000;

interface Props {
  childName: string;
}

export function AnalyzingScreen({ childName }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const msgFade = useRef(new Animated.Value(0)).current;
  const imgFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(imgFade, {
      toValue: 1, duration: 800, useNativeDriver: true,
    }).start();

    Animated.timing(progressAnim, {
      toValue: 1, duration: STEP_DURATION * MESSAGES.length, useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setStepIdx((prev) => {
        if (prev < MESSAGES.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, STEP_DURATION);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    msgFade.setValue(0);
    Animated.timing(msgFade, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();
  }, [stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '분석 중', headerShown: false }} />

      <Animated.View style={{ opacity: imgFade }}>
        <Image
          source={require('../../assets/analyzing.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </Animated.View>

      <Text style={styles.title}>{childName}의 성향을 분석하고 있어요</Text>

      <Animated.Text style={[styles.message, { opacity: msgFade }]}>
        {MESSAGES[stepIdx]}
      </Animated.Text>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  image: { width: 180, height: 180, marginBottom: SPACING.lg },
  title: {
    fontSize: FONT_SIZE.xl, fontWeight: '700',
    color: '#333', textAlign: 'center', marginBottom: SPACING.md,
  },
  message: {
    fontSize: FONT_SIZE.md, color: '#888',
    textAlign: 'center', minHeight: 44, lineHeight: 22,
  },
  progressTrack: {
    width: '80%', height: 6, borderRadius: 3,
    backgroundColor: '#EDE4DB', marginTop: SPACING.xl, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 3,
    backgroundColor: '#6366F1',
  },
});

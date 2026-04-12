import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { FONT_SIZE, SPACING } from '../../constants/theme';

const MESSAGES = [
  '',
  'AI 기질 분석 엔진을 시작합니다...',
  '생년월일시 기반 고유 에너지를 분석하고 있어요...',
  '20개 응답 패턴을 수집하고 있어요...',
  '응답 데이터를 교차 검증하고 있어요...',
  '기질 유형을 분류하고 있어요...',
  '성격 특성 프로파일을 생성하고 있어요...',
  '학습 스타일을 분석하고 있어요...',
  '잘하는 분야를 탐색하고 있어요...',
  '보완할 점을 파악하고 있어요...',
  '미래 진로 적성을 예측하고 있어요...',
  '잘 맞는 운동을 찾고 있어요...',
  '학원 스타일을 매칭하고 있어요...',
  '영양 및 식습관을 분석하고 있어요...',
  '교육 방향을 설계하고 있어요...',
  '특출난 재능을 발견하고 있어요...',
  '양육 팁을 작성하고 있어요...',
  '사회성 프로파일을 완성하고 있어요...',
  '맞춤형 육아 가이드를 최종 정리하고 있어요...',
  '분석이 완료되었습니다!',
];

const STEP_DURATION = 1000;

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

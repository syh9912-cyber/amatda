import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { childApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface FallbackQuestion {
  id: string;
  text: string;
  options: string[];
}

const FALLBACK_QUESTIONS: FallbackQuestion[] = [
  { id: 'q1', text: '새로운 장소에 가면?', options: ['바로 탐험한다', '부모 옆에 있는다', '관찰 후 합류한다', '불안해한다'] },
  { id: 'q2', text: '친구와 놀 때?', options: ['리더 역할을 한다', '양보하는 편이다', '혼자 놀기를 좋아한다', '관찰하는 편이다'] },
  { id: 'q3', text: '실패했을 때 반응은?', options: ['바로 다시 시도한다', '속상해한다', '쉽게 포기한다', '도움을 요청한다'] },
  { id: 'q4', text: '좋아하는 놀이는?', options: ['활동적인 놀이', '그림/만들기', '퍼즐/게임', '역할놀이'] },
  { id: 'q5', text: '새로운 것을 배울 때?', options: ['직접 해본다', '설명을 듣는다', '영상/책으로 본다', '친구와 함께 한다'] },
  { id: 'q6', text: '감정 표현 방식은?', options: ['크게 표현한다', '조용히 표현한다', '말로 설명한다', '몸으로 표현한다'] },
  { id: 'q7', text: '집중하는 시간은?', options: ['매우 길게', '보통 수준', '짧은 편', '관심 있는 것만 길게'] },
  { id: 'q8', text: '규칙에 대한 태도는?', options: ['잘 따르는 편', '바꾸려고 한다', '따르기 어려워한다', '왜 그런지 물어본다'] },
  { id: 'q9', text: '스트레스를 받으면?', options: ['혼자 있고 싶어한다', '운동/활동을 한다', '부모에게 말한다', '다른 활동으로 전환'] },
  { id: 'q10', text: '가장 소중하게 여기는 것은?', options: ['가족', '친구', '자기만의 공간', '반려동물/인형'] },
  { id: 'q11', text: '아침에 일어나는 모습은?', options: ['스스로 잘 일어난다', '깨워야 일어난다', '기분에 따라 다르다', '일찍 일어나는 편'] },
  { id: 'q12', text: '싫은 일을 해야 할 때?', options: ['빨리 끝낸다', '미루는 편이다', '불평을 한다', '보상이 있으면 한다'] },
];

export default function QuestionsScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const updateChild = useChildStore((s) => s.updateChild);
  const child = children.find((c) => c.id === childId);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [fadeAnim] = useState(() => new Animated.Value(1));

  const questions = FALLBACK_QUESTIONS;
  const total = questions.length;
  const current = questions[currentIdx];
  const progress = (currentIdx + 1) / total;

  const animateTransition = useCallback((cb: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setTimeout(cb, 150);
  }, [fadeAnim]);

  const handleSelect = async (optionIdx: number) => {
    const newAnswers = { ...answers, [current.id]: optionIdx };
    setAnswers(newAnswers);

    if (currentIdx < total - 1) {
      animateTransition(() => setCurrentIdx((prev) => prev + 1));
    } else {
      // All answered — submit
      setAnalyzing(true);
      try {
        const answerList = questions.map((q) => ({
          questionId: q.id,
          answer: newAnswers[q.id] ?? 0,
        }));
        const res = await childApi.analyze(childId!, answerList);
        const updatedChild = res.data.data;
        if (updatedChild) {
          updateChild(updatedChild);
        }
        // Wait 2 seconds for animation effect
        await new Promise((r) => setTimeout(r, 2000));
        router.replace({
          pathname: '/onboarding/analysis-report',
          params: { childId },
        });
      } catch {
        // If API fails, still navigate with local data
        await new Promise((r) => setTimeout(r, 1500));
        router.replace({
          pathname: '/onboarding/analysis-report',
          params: { childId },
        });
      }
    }
  };

  if (analyzing) {
    return (
      <View style={styles.analyzingContainer}>
        <Stack.Screen options={{ title: '분석 중', headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.analyzingTitle}>
          {child?.name}의 성향을 분석하고 있어요
        </Text>
        <Text style={styles.analyzingDesc}>잠시만 기다려주세요...</Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, i === 1 && styles.dotActive]} />
          ))}
        </View>
      </View>
    );
  }

  if (!current) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '성향 질문', headerShown: false }} />

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{currentIdx + 1} / {total}</Text>
      </View>

      {/* Question */}
      <Animated.View style={[styles.questionArea, { opacity: fadeAnim }]}>
        <Text style={styles.qNumber}>Q{currentIdx + 1}</Text>
        <Text style={styles.qText}>{current.text}</Text>

        <View style={styles.optionsWrap}>
          {current.options.map((opt, idx) => {
            const selected = answers[current.id] === idx;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.optionBtn, selected && styles.optionSelected]}
                onPress={() => handleSelect(idx)}
                activeOpacity={0.7}
              >
                <View style={[styles.optionCircle, selected && styles.circleSelected]}>
                  <Text style={[styles.optionCircleText, selected && styles.circleTextSelected]}>
                    {String.fromCharCode(65 + idx)}
                  </Text>
                </View>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {/* Skip */}
      <TouchableOpacity
        style={styles.skipLink}
        onPress={() => router.replace('/(main)/home')}
      >
        <Text style={styles.skipText}>건너뛰고 홈으로</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
    paddingTop: 60,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  questionArea: { flex: 1 },
  qNumber: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  qText: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xl,
    lineHeight: 38,
  },
  optionsWrap: { gap: SPACING.md },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    gap: SPACING.md,
  },
  optionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  optionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleSelected: {
    backgroundColor: COLORS.primary,
  },
  optionCircleText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  circleTextSelected: {
    color: '#FFFFFF',
  },
  optionText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  skipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
  // Analyzing state
  analyzingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  analyzingTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.xl,
    textAlign: 'center',
  },
  analyzingDesc: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
  },
});

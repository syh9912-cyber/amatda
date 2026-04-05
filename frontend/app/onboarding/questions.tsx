import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, Animated,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { childApi, questionApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS } from '../../constants/theme';
import { styles } from './questions.styles';
import {
  FALLBACK_QUESTIONS,
  getAgeGroup,
  type OnboardingQuestion,
} from './questions.helpers';

export default function QuestionsScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const updateChild = useChildStore((s) => s.updateChild);
  const child = children.find((c) => c.id === childId);

  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [fadeAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    loadQuestions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadQuestions = async () => {
    try {
      const ageGroup = child ? getAgeGroup(child.ageInfo.months) : 'kinder';
      const res = await questionApi.onboarding(ageGroup);
      const backendQs = res.data?.data as OnboardingQuestion[] | undefined;
      if (backendQs && backendQs.length > 0) {
        setQuestions(backendQs);
      } else {
        setQuestions(FALLBACK_QUESTIONS);
      }
    } catch {
      setQuestions(FALLBACK_QUESTIONS);
    } finally {
      setLoading(false);
    }
  };

  const total = questions.length;
  const current = questions[currentIdx];
  const progress = total > 0 ? (currentIdx + 1) / total : 0;

  const animateTransition = useCallback((cb: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setTimeout(cb, 150);
  }, [fadeAnim]);

  const handleBack = () => {
    if (currentIdx > 0) {
      animateTransition(() => setCurrentIdx((prev) => prev - 1));
    }
  };

  const handleSelect = async (optionIdx: number) => {
    const newAnswers = { ...answers, [current.id]: optionIdx };
    setAnswers(newAnswers);

    if (currentIdx < total - 1) {
      animateTransition(() => setCurrentIdx((prev) => prev + 1));
    } else {
      await submitAnswers(newAnswers);
    }
  };

  const submitAnswers = async (finalAnswers: Record<string, number>) => {
    setAnalyzing(true);
    try {
      const answerList = questions.map((q) => ({
        questionId: q.id,
        answer: finalAnswers[q.id] ?? 0,
      }));
      const res = await childApi.analyze(childId!, answerList);
      const updatedChild = res.data.data;
      if (updatedChild) {
        updateChild(updatedChild);
      }
      await new Promise((r) => setTimeout(r, 2000));
      router.replace({
        pathname: '/onboarding/analysis-report',
        params: { childId },
      });
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
      router.replace({
        pathname: '/onboarding/analysis-report',
        params: { childId },
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: '질문 준비', headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>질문을 준비하고 있어요...</Text>
      </View>
    );
  }

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
        {current.category ? (
          <Text style={styles.categoryLabel}>{current.category}</Text>
        ) : null}
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

      {/* Bottom row: back + skip */}
      <View style={styles.bottomRow}>
        <TouchableOpacity
          style={[styles.backBtn, currentIdx === 0 && styles.backBtnHidden]}
          onPress={handleBack}
          disabled={currentIdx === 0}
        >
          <Text style={styles.backBtnText}>이전</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipLink}
          onPress={() => router.replace('/(main)/home')}
        >
          <Text style={styles.skipText}>건너뛰고 홈으로</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

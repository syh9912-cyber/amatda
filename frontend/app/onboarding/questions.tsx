import { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, Animated, ScrollView,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { childApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS } from '../../constants/theme';
import { styles } from '../../constants/onboardingStyles';
import {
  type SurveyQuestion,
  getAgeGroup,
  getSurveyQuestions,
  LIKERT_OPTIONS,
} from '../../constants/onboardingHelpers';
import { calculateTemperament } from '../../constants/onboardingQuestions';
import { AnalyzingScreen } from '../../components/onboarding/AnalyzingScreen';

export default function QuestionsScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const updateChild = useChildStore((s) => s.updateChild);
  const child = children.find((c) => c.id === childId);

  const ageGroup = child ? getAgeGroup(child.ageInfo.months) : 'toddler';
  const questions: SurveyQuestion[] = getSurveyQuestions(ageGroup);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [fadeAnim] = useState(() => new Animated.Value(1));

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

  const handleSelect = async (likertValue: number) => {
    const newAnswers = { ...answers, [current.id]: likertValue };
    setAnswers(newAnswers);

    if (currentIdx < total - 1) {
      animateTransition(() => setCurrentIdx((prev) => prev + 1));
    } else {
      await submitAnswers(newAnswers);
    }
  };

  const apiDoneRef = useRef(false);

  const submitAnswers = async (finalAnswers: Record<string, number>) => {
    setAnalyzing(true);
    apiDoneRef.current = false;

    // Calculate temperament locally for UI display
    calculateTemperament(finalAnswers);

    // Fire API call immediately (runs during loading animation)
    const apiCall = (async () => {
      try {
        const answerList = questions.map((q) => ({
          questionId: q.id,
          answer: finalAnswers[q.id] ?? 0,
        }));
        const res = await childApi.analyze(childId!, answerList);
        const updatedChild = res.data?.data;
        if (updatedChild) {
          updateChild(updatedChild);
          // 스토어 전파 보장
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch {
        // navigate anyway after timer
      } finally {
        apiDoneRef.current = true;
      }
    })();

    // Wait minimum 15 seconds for premium feel, then navigate
    const timer = new Promise((r) => setTimeout(r, 15000));
    await Promise.all([apiCall, timer]);

    router.replace({
      pathname: '/onboarding/analysis-report',
      params: { childId },
    });
  };

  if (questions.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: '질문 준비', headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>질문을 준비하고 있어요...</Text>
      </View>
    );
  }

  if (analyzing) {
    return <AnalyzingScreen childName={child?.name ?? ''} />;
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.questionScroll}
        >
          {current.category ? (
            <Text style={styles.categoryLabel}>{current.category}</Text>
          ) : null}
          <Text style={styles.qNumber}>Q{currentIdx + 1}</Text>
          <Text style={styles.qText}>{current.question}</Text>

          <View style={styles.optionsWrap}>
            {LIKERT_OPTIONS.map((opt) => {
              const selected = answers[current.id] === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionBtn, selected && styles.optionSelected]}
                  onPress={() => handleSelect(opt.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionCircle, selected && styles.circleSelected]}>
                    <Text style={[styles.optionCircleText, selected && styles.circleTextSelected]}>
                      {opt.value}
                    </Text>
                  </View>
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
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

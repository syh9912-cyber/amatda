import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { questionApi, childApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { captureError } from '../../services/sentry';

interface Question {
  id: string;
  questionText: string;
  options: string[];
}

export default function IntakeFormScreen() {
  const { t } = useTranslation();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const children = useChildStore((s) => s.children);
  const child = children.find((c) => c.id === childId);

  useEffect(() => {
    if (child) loadQuestions();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.id]);

  const loadQuestions = async () => {
    if (!child) { setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    try {
      const res = await questionApi.list(
        child.ageInfo.months,
        child.innateData?.dominantType ?? ''
      );
      setQuestions(res.data.data);
    } catch (e) {
      // 로드 실패를 '질문 없음'으로 위장하지 않고 명시적으로 구분 + 재시도 제공
      captureError(e, { ctx: 'intake-form/loadQuestions', childId });
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (questionId: string, optionIdx: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleSubmit = async () => {
    if (!childId) return;
    if (Object.keys(answers).length < questions.length) {
      Alert.alert(t('common.notice'), t('onboardingIntakeForm.answerAllRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const answerList = questions.map((q) => ({
        questionId: q.id,
        selectedOption: answers[q.id],
      }));
      await childApi.saveBaseline(childId, answerList);
      Alert.alert(t('common.complete'), t('onboardingIntakeForm.saveSuccess'));
      router.replace('/(main)/home');
    } catch {
      Alert.alert(t('common.error'), t('onboardingIntakeForm.saveFail'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: t('onboardingIntakeForm.pageTitle') }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('onboardingIntakeForm.pageTitle') }} />

      <Text style={styles.heading}>
        {t('onboardingIntakeForm.heading', { name: child?.name })}
      </Text>
      <Text style={styles.desc}>
        {t('onboardingIntakeForm.desc', { count: questions.length })}
      </Text>

      {questions.map((q, qIdx) => (
        <View key={q.id} style={styles.questionCard}>
          <Text style={styles.qNumber}>Q{qIdx + 1}</Text>
          <Text style={styles.qText}>{q.questionText}</Text>
          <View style={styles.optionsCol}>
            {q.options.map((opt, oIdx) => {
              const selected = answers[q.id] === oIdx;
              return (
                <TouchableOpacity
                  key={oIdx}
                  style={[styles.optionBtn, selected && styles.optionSelected]}
                  onPress={() => handleSelect(q.id, oIdx)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {questions.length > 0 && (
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? t('onboardingIntakeForm.saving') : t('common.complete')}
          </Text>
        </TouchableOpacity>
      )}

      {questions.length === 0 && loadError && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('onboardingIntakeForm.loadFailText')}</Text>
          <TouchableOpacity style={styles.skipBtn} onPress={loadQuestions}>
            <Text style={styles.skipText}>{t('common.retry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipLink}
            onPress={() => router.replace('/(main)/home')}
          >
            <Text style={styles.skipLinkText}>{t('onboardingIntakeForm.skip')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {questions.length === 0 && !loadError && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('onboardingIntakeForm.noQuestions')}</Text>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => router.replace('/(main)/home')}
          >
            <Text style={styles.skipText}>{t('onboardingIntakeForm.skip')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  heading: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  desc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, marginBottom: SPACING.lg },
  questionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  qNumber: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600', marginBottom: SPACING.xs },
  qText: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text, marginBottom: SPACING.md, lineHeight: 22 },
  optionsCol: { gap: SPACING.sm },
  optionBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.surface,
  },
  optionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  optionText: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  optionTextSelected: { color: COLORS.primary, fontWeight: '600' },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center', marginTop: SPACING.md,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: '#FFF', fontSize: FONT_SIZE.lg, fontWeight: '600' },
  emptyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.xl, alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, marginBottom: SPACING.md },
  skipBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
  skipText: { color: '#FFF', fontWeight: '600' },
  skipLink: { marginTop: SPACING.md, paddingVertical: SPACING.xs },
  skipLinkText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
});

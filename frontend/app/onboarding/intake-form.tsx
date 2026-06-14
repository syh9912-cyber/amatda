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
      Alert.alert('알림', '모든 질문에 답해주세요');
      return;
    }
    setSubmitting(true);
    try {
      const answerList = questions.map((q) => ({
        questionId: q.id,
        selectedOption: answers[q.id],
      }));
      await childApi.saveBaseline(childId, answerList);
      Alert.alert('완료', '기초 성향 설정이 완료되었습니다');
      router.replace('/(main)/home');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '성향 질문' }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '성향 질문' }} />

      <Text style={styles.heading}>
        {child?.name}에게 맞는 질문이에요
      </Text>
      <Text style={styles.desc}>
        아이의 평소 모습을 떠올리며 답해주세요 ({questions.length}문항)
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
            {submitting ? '저장 중...' : '완료'}
          </Text>
        </TouchableOpacity>
      )}

      {questions.length === 0 && loadError && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>질문을 불러오지 못했어요.{'\n'}네트워크 확인 후 다시 시도해주세요.</Text>
          <TouchableOpacity style={styles.skipBtn} onPress={loadQuestions}>
            <Text style={styles.skipText}>다시 시도</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipLink}
            onPress={() => router.replace('/(main)/home')}
          >
            <Text style={styles.skipLinkText}>건너뛰기</Text>
          </TouchableOpacity>
        </View>
      )}

      {questions.length === 0 && !loadError && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>해당 연령/기질의 질문이 아직 없습니다</Text>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => router.replace('/(main)/home')}
          >
            <Text style={styles.skipText}>건너뛰기</Text>
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

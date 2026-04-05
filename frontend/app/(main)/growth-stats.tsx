import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { childApi } from '../../services/api';
import { getTodayQuestion } from '../../constants/dailyQuestions';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type TabKey = 'physical' | 'trait' | 'learning';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'physical', label: '키/몸무게' },
  { key: 'trait', label: '기질 변화' },
  { key: 'learning', label: '학습 활동' },
];

export default function GrowthStatsScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('physical');
  const selectedChild = useChildStore((s) => s.selectedChild);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ headerShown: false }} />

        <GrowthHeader />
        <FilterTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'physical' && (
          <PhysicalTab childName={selectedChild?.name ?? '아이'} />
        )}
        {activeTab === 'trait' && <TraitTab />}
        {activeTab === 'learning' && <LearningTab />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GrowthHeader() {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backArrow}>{'<'}</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>성장 기록 & 변화</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function FilterTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}) {
  return (
    <View style={styles.tabsRow}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.key)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PhysicalTab({ childName }: { childName: string }) {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const handleSave = () => {
    if (!height && !weight) {
      Alert.alert('알림', '키 또는 몸무게를 입력해주세요');
      return;
    }
    Alert.alert('저장 완료', `${childName}의 성장 기록이 저장되었습니다`);
    setHeight('');
    setWeight('');
  };

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>키 & 몸무게 변화</Text>
        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartIcon}>{'📈'}</Text>
          <Text style={styles.chartPlaceholderText}>
            데이터가 쌓이면 성장 차트가 표시됩니다
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>이번 달 기록</Text>
        <View style={styles.statsRow}>
          <StatBox label="키" value="-- cm" color={COLORS.secondary} />
          <StatBox label="몸무게" value="-- kg" color={COLORS.primary} />
          <StatBox label="성장 점수" value="--" color={COLORS.info} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>기록 입력</Text>
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>키 (cm)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>몸무게 (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
            />
          </View>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>기록 저장</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.statBox, { borderTopColor: color }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

interface TraitInsight {
  weekLabel: string;
  insight: string;
  reason: string;
  createdAt: string;
}

function TraitTab() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const dominantType = selectedChild?.innateData.dominantType ?? '--';
  const [insights, setInsights] = useState<TraitInsight[]>([]);
  const [loadingTraits, setLoadingTraits] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  const [traitAnswer, setTraitAnswer] = useState('');
  const [savingTrait, setSavingTrait] = useState(false);

  const dailyQuestion = useMemo(() => {
    if (!selectedChild) return null;
    return getTodayQuestion(selectedChild.ageInfo.group);
  }, [selectedChild?.ageInfo.group]);

  useEffect(() => {
    if (!selectedChild) return;
    setLoadingTraits(true);
    childApi
      .getDailyTraits(selectedChild.id)
      .then((res) => {
        const data = res.data.data;
        setInsights(data.insights ?? []);
        setResponseCount(data.responses?.length ?? 0);
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => setLoadingTraits(false));
  }, [selectedChild?.id]);

  const handleSaveTrait = async () => {
    if (!traitAnswer.trim() || !selectedChild || !dailyQuestion) return;
    setSavingTrait(true);
    try {
      await childApi.saveDailyTrait(selectedChild.id, {
        question: dailyQuestion.question,
        answer: traitAnswer.trim(),
        date: new Date().toISOString().split('T')[0],
      });
      setResponseCount((c) => c + 1);
      setTraitAnswer('');
      Alert.alert('저장 완료', '오늘의 기질 관찰이 기록되었습니다');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSavingTrait(false);
    }
  };

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>기질 변화 기록</Text>
        <View style={styles.traitInfo}>
          <Text style={styles.traitIcon}>{'🧠'}</Text>
          <Text style={styles.traitCurrentLabel}>현재 기질 유형</Text>
          <Text style={styles.traitCurrentValue}>{dominantType}</Text>
        </View>
        <View style={styles.traitNotice}>
          <Text style={styles.traitNoticeText}>
            매일 질문에 답하면 기질 변화를 추적할 수 있어요 ({responseCount}개 응답 누적)
          </Text>
        </View>
      </View>

      {/* Daily question input */}
      {dailyQuestion && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>오늘의 질문</Text>
          <View style={styles.traitNotice}>
            <Text style={styles.traitNoticeText}>{dailyQuestion.question}</Text>
          </View>
          <Text style={styles.traitHintText}>{dailyQuestion.hint}</Text>
          <TextInput
            style={styles.traitInput}
            placeholder="관찰 내용을 입력하세요..."
            placeholderTextColor={COLORS.textLight}
            value={traitAnswer}
            onChangeText={setTraitAnswer}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.saveBtn, (!traitAnswer.trim() || savingTrait) && styles.saveBtnDisabled]}
            onPress={handleSaveTrait}
            disabled={!traitAnswer.trim() || savingTrait}
          >
            <Text style={styles.saveBtnText}>
              {savingTrait ? '저장 중...' : '기질 관찰 저장'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>기질 변화 타임라인</Text>
        {loadingTraits ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : insights.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'📋'}</Text>
            <Text style={styles.emptyText}>
              7개 응답이 쌓이면 첫 기질 변화 인사이트가 생성됩니다
            </Text>
          </View>
        ) : (
          <View>
            {insights.map((item, idx) => (
              <View key={idx} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                {idx < insights.length - 1 && <View style={styles.timelineLine} />}
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineWeek}>{item.weekLabel}</Text>
                  <Text style={styles.timelineInsight}>{item.insight}</Text>
                  <Text style={styles.timelineReason}>{item.reason}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const SUBJECTS = ['국어', '수학', '영어', '과학', '사회', '미술', '음악', '체육'] as const;

function LearningTab() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [selectedSubject, setSelectedSubject] = useState<string>(SUBJECTS[0]);
  const [score, setScore] = useState('');
  const [memo, setMemo] = useState('');
  const [savingLearning, setSavingLearning] = useState(false);

  const handleSaveLearning = async () => {
    if (!score.trim() || !selectedChild) {
      Alert.alert('알림', '점수를 입력해주세요');
      return;
    }
    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 100) {
      Alert.alert('알림', '0~100 사이의 점수를 입력해주세요');
      return;
    }
    setSavingLearning(true);
    try {
      await childApi.saveDailyTracking(selectedChild.id, {
        type: 'learning',
        subject: selectedSubject,
        score: numScore,
        memo: memo.trim(),
        date: new Date().toISOString().split('T')[0],
      });
      Alert.alert('저장 완료', `${selectedSubject} 학습 기록이 저장되었습니다`);
      setScore('');
      setMemo('');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSavingLearning(false);
    }
  };

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>학습 활동 기록</Text>

        {/* Subject selector */}
        <Text style={styles.inputLabel}>과목 선택</Text>
        <View style={styles.subjectRow}>
          {SUBJECTS.map((subj) => {
            const isActive = selectedSubject === subj;
            return (
              <TouchableOpacity
                key={subj}
                style={[styles.subjectPill, isActive && styles.subjectPillActive]}
                onPress={() => setSelectedSubject(subj)}
              >
                <Text style={[styles.subjectPillText, isActive && styles.subjectPillTextActive]}>
                  {subj}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Score input */}
        <Text style={styles.inputLabel}>점수 (0~100)</Text>
        <TextInput
          style={styles.input}
          placeholder="점수 입력"
          placeholderTextColor={COLORS.textLight}
          keyboardType="number-pad"
          value={score}
          onChangeText={setScore}
          maxLength={3}
        />

        {/* Memo input */}
        <Text style={styles.inputLabel}>메모 (선택)</Text>
        <TextInput
          style={[styles.input, styles.memoInput]}
          placeholder="학습 활동에 대한 메모..."
          placeholderTextColor={COLORS.textLight}
          value={memo}
          onChangeText={setMemo}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.saveBtn, (!score.trim() || savingLearning) && styles.saveBtnDisabled]}
          onPress={handleSaveLearning}
          disabled={!score.trim() || savingLearning}
        >
          <Text style={styles.saveBtnText}>
            {savingLearning ? '저장 중...' : '학습 기록 저장'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>최근 학습 기록</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'📚'}</Text>
          <Text style={styles.emptyText}>
            학습 활동 데이터가 쌓이면 여기에 표시됩니다
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5EC',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
    paddingRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 24,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  cardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  chartPlaceholder: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
  },
  chartIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  chartPlaceholderText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  traitInfo: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  traitIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  traitCurrentLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  traitCurrentValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  traitNotice: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  traitNoticeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  traitHintText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  traitInput: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
    marginBottom: SPACING.md,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  subjectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  subjectPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subjectPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  subjectPillText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  subjectPillTextActive: {
    color: '#FFFFFF',
  },
  memoInput: {
    minHeight: 60,
    marginBottom: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginTop: 4,
    marginRight: SPACING.md,
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: -SPACING.md,
    width: 2,
    backgroundColor: COLORS.primaryLight,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  timelineWeek: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  timelineInsight: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  timelineReason: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
});

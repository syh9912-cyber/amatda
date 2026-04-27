import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useChildStore, AnalysisReport, ReportReasons } from '../../stores/childStore';
import { childApi, coachingApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { DetailSection } from '../../components/report/DetailSection';
import { TextTipSection } from '../../components/report/TextTipSection';
import { SimpleListSection } from '../../components/report/SimpleListSection';
import { LinearGradient } from 'expo-linear-gradient';

 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const reportHeaderImg = require('../../assets/report-header.png');
 
const IC_SEND = require('../../assets/icon-send.png') as number;

/**
 * Safely converts any value to a displayable string.
 * Prevents "Objects are not valid as a React child" errors.
 */
function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    // Handle common object shapes like { label, daysUntil }
    const obj = value as Record<string, unknown>;
    if ('label' in obj && typeof obj.label === 'string') return obj.label;
    if ('text' in obj && typeof obj.text === 'string') return obj.text;
    if ('item' in obj && typeof obj.item === 'string') return obj.item;
    try { return JSON.stringify(value); } catch { return '[object]'; }
  }
  return String(value);
}

/**
 * Safely converts an array value to string[].
 * Each element is run through safeString.
 */
function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeString(item));
}

interface FirstTalkData {
  intro: string;
  traitSummary: string;
  suggestedQuestion: string;
  quickOptions: string[];
}

/** Maps section keys to reason keys */
const REASON_KEY_MAP: Partial<Record<keyof AnalysisReport, keyof ReportReasons>> = {
  personality: 'personality',
  studyStyle: 'studyStyle',
  bestSubjects: 'bestSubjects',
  futureFields: 'futureFields',
  sportsMatch: 'sportsMatch',
  academyStyle: 'academyStyle',
  goodFoods: 'foods',
};

interface SectionConfig {
  emoji: string;
  title: string;
  key: keyof AnalysisReport;
  type: 'text' | 'list';
}

const SECTIONS: SectionConfig[] = [
  { emoji: '🎭', title: '성격 특성', key: 'personality', type: 'list' },
  { emoji: '📚', title: '학습 스타일', key: 'studyStyle', type: 'text' },
  { emoji: '⭐', title: '잘하는 분야', key: 'bestSubjects', type: 'list' },
  { emoji: '💡', title: '보완할 분야', key: 'weakAreas', type: 'list' },
  { emoji: '🚀', title: '미래 진로', key: 'futureFields', type: 'list' },
  { emoji: '⚽', title: '잘 맞는 운동', key: 'sportsMatch', type: 'list' },
  { emoji: '🏫', title: '학원 스타일', key: 'academyStyle', type: 'text' },
  { emoji: '🍎', title: '좋은 음식', key: 'goodFoods', type: 'list' },
  { emoji: '⚠️', title: '피할 음식', key: 'badFoods', type: 'list' },
  { emoji: '🎯', title: '교육 방향', key: 'educationDirection', type: 'text' },
  { emoji: '🏆', title: '특출난 재능', key: 'specialTalent', type: 'text' },
  { emoji: '💜', title: '양육 팁', key: 'parentingTip', type: 'text' },
];

export default function AnalysisReportScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const selectChild = useChildStore((s) => s.selectChild);
  const updateChild = useChildStore((s) => s.updateChild);
  const child = children.find((c) => c.id === childId);
  const storeReport = child?.analysisReport;

  const [localReport, setLocalReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [firstTalk, setFirstTalk] = useState<FirstTalkData | null>(null);
  const [firstTalkLoading, setFirstTalkLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const report = storeReport ?? localReport;

  // 스토어에 리포트 없으면 API에서 재조회
  useEffect(() => {
    if (childId && !storeReport && !localReport && !loading) {
      setLoading(true);
      childApi.list()
        .then((res) => {
          const list = res.data?.data as Record<string, unknown>[] | undefined;
          const found = list?.find((c) => (c.id as string) === childId);
          if (found) {
            const parsed = found.analysisReport as AnalysisReport | null;
            if (parsed) {
              setLocalReport(parsed);
              updateChild(found as unknown as ReturnType<typeof useChildStore.getState>['children'][0]);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [childId, storeReport, localReport, loading, updateChild]);

  // 리포트가 로드되면 AI 첫 대화 가져오기
  useEffect(() => {
    if (!childId || !report || firstTalk || firstTalkLoading) return;
    setFirstTalkLoading(true);
    coachingApi
      .firstTalk(childId)
      .then((res) => {
        const raw = res.data?.data;
        if (raw && typeof raw === 'object') {
          const rawObj = raw as Record<string, unknown>;
          setFirstTalk({
            intro: typeof rawObj.intro === 'string' ? rawObj.intro : '',
            traitSummary: typeof rawObj.traitSummary === 'string' ? rawObj.traitSummary : '',
            suggestedQuestion: typeof rawObj.suggestedQuestion === 'string' ? rawObj.suggestedQuestion : '',
            quickOptions: Array.isArray(rawObj.quickOptions)
              ? (rawObj.quickOptions as unknown[]).map((o) => safeString(o))
              : [],
          });
        }
      })
      .catch(() => {
        // fallback: show default question
        setFirstTalk({
          intro: '상담이모가 준비되었어요!',
          traitSummary: '',
          suggestedQuestion: '아이에 대해 궁금한 점을 물어보세요',
          quickOptions: [],
        });
      })
      .finally(() => setFirstTalkLoading(false));
  }, [childId, report, firstTalk, firstTalkLoading]);

  const handleFirstTalkOption = (option: string) => {
    if (!childId) return;
    if (child) selectChild(child.id);
    router.push({
      pathname: '/(main)/chatbot',
      params: { firstMessage: option },
    });
  };

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: '분석 결과', headerShown: false }} />
        <ActivityIndicator size="large" color="#FF8C5A" />
        <Text style={[styles.emptyText, { marginTop: 16 }]}>분석 결과를 불러오는 중...</Text>
      </View>
    );
  }

  if (!child || !report) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: '분석 결과', headerShown: false }} />
        <Text style={styles.emptyText}>분석 결과를 불러올 수 없습니다</Text>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(main)/home')}
        >
          <Text style={styles.homeBtnText}>홈으로 이동</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: '분석 결과', headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>{safeString(child.name)}의 종합 분석</Text>
        <Text style={styles.headerTitle}>{safeString(child.innateData?.dominantType ?? '')}</Text>
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>{safeString(report.summary)}</Text>
      </View>

      {/* Sections */}
      {SECTIONS.map((section) => {
        const rawValue = report[section.key];
        if (!rawValue) return null;

        const reasonKey = REASON_KEY_MAP[section.key];
        const rawReason = reasonKey && report.reasons
          ? report.reasons[reasonKey]
          : undefined;
        const reason = rawReason ? safeString(rawReason) : undefined;

        return (
          <View key={section.key} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>{section.emoji}</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.type === 'list' && Array.isArray(rawValue) ? (
              <View style={styles.listWrap}>
                {safeStringArray(rawValue).map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.sectionText}>{safeString(rawValue)}</Text>
            )}
            {reason ? (
              <Text style={styles.reasonText}>{reason}</Text>
            ) : null}
          </View>
        );
      })}

      {/* Strengths Detail */}
      {report.strengthsDetail && report.strengthsDetail.length > 0 && (
        <DetailSection
          emoji="✨"
          title="이런 점이 뛰어나요"
          items={report.strengthsDetail.map((d) => ({
            item: safeString(d.item),
            reason: safeString(d.reason),
          }))}
          accentColor={COLORS.primary}
        />
      )}

      {/* Weaknesses Detail */}
      {report.weaknessesDetail && report.weaknessesDetail.length > 0 && (
        <DetailSection
          emoji="⚠️"
          title="이런 점은 주의하세요"
          items={report.weaknessesDetail.map((d) => ({
            item: safeString(d.item),
            reason: safeString(d.reason),
          }))}
          accentColor="#F5A623"
        />
      )}

      {/* Do List */}
      {report.doList && report.doList.length > 0 && (
        <SimpleListSection
          emoji="✅"
          title="이렇게 해주세요"
          items={safeStringArray(report.doList)}
          bulletColor="#4CAF50"
        />
      )}

      {/* Don't List */}
      {report.dontList && report.dontList.length > 0 && (
        <SimpleListSection
          emoji="❌"
          title="이건 피해주세요"
          items={safeStringArray(report.dontList)}
          bulletColor="#F44336"
        />
      )}

      {/* Daily Routine Tip */}
      {report.dailyRoutineTip ? (
        <TextTipSection
          emoji="🕐"
          title="하루 루틴 제안"
          text={safeString(report.dailyRoutineTip)}
        />
      ) : null}

      {/* Social Tip */}
      {report.socialTip ? (
        <TextTipSection
          emoji="👫"
          title="친구 관계 팁"
          text={safeString(report.socialTip)}
        />
      ) : null}

      {/* Emotional Tip */}
      {report.emotionalTip ? (
        <TextTipSection
          emoji="💕"
          title="감정 관리 팁"
          text={safeString(report.emotionalTip)}
        />
      ) : null}

      {/* Disclaimer */}
      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerText}>
          이 분석은 아이의 생년월일시 기질 분석과 부모님의 응답을 종합한 결과입니다
        </Text>
      </View>

      {/* AI First Talk Inline */}
      {firstTalkLoading ? (
        <LinearGradient
          colors={['#FFB088', '#FF8C5A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.firstTalkCard}
        >
          <View style={styles.ftLoadingWrap}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.ftLoadingText}>상담이모가 준비 중이에요...</Text>
          </View>
        </LinearGradient>
      ) : firstTalk ? (
        <LinearGradient
          colors={['#FFB088', '#FF8C5A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.firstTalkCard}
        >
          <View style={styles.ftAvatarRow}>
            <View style={styles.ftAvatar}>
              <Text style={styles.ftAvatarEmoji}>{'🤖'}</Text>
            </View>
            <Text style={styles.ftCoachLabel}>상담이모</Text>
          </View>
          {firstTalk.intro ? (
            <Text style={styles.ftIntro}>{firstTalk.intro}</Text>
          ) : null}
          {firstTalk.traitSummary ? (
            <View style={styles.ftTraitBox}>
              <Text style={styles.ftTraitText}>{firstTalk.traitSummary}</Text>
            </View>
          ) : null}
          {firstTalk.suggestedQuestion ? (
            <Text style={styles.ftQuestion}>{firstTalk.suggestedQuestion}</Text>
          ) : null}
          <View style={styles.ftInputRow}>
            <TextInput
              style={styles.ftTextInput}
              placeholder="고민이나 궁금한 점을 적어주세요..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={answer}
              onChangeText={setAnswer}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.ftSendBtn, !answer.trim() && styles.ftSendBtnDisabled]}
              onPress={() => {
                const trimmed = answer.trim();
                if (!trimmed || submitting) return;
                setSubmitting(true);
                handleFirstTalkOption(trimmed);
              }}
              disabled={!answer.trim() || submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FF8C5A" />
              ) : (
                <Image source={IC_SEND} style={styles.ftSendIcon} resizeMode="contain" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.ftHint}>
            첫 질문에 답변하시면 맞춤 코칭이 시작됩니다
          </Text>
        </LinearGradient>
      ) : null}

      <View style={styles.bottomSpacer} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: 60 },
  emptyContainer: {
    flex: 1, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  homeBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
  },
  homeBtnText: { color: '#FFF', fontWeight: '600', fontSize: FONT_SIZE.md },

  // Header
  header: {
    alignItems: 'center', marginBottom: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl, fontWeight: '700', color: COLORS.primary,
  },

  // Summary
  summaryCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.lg, borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  summaryText: {
    fontSize: FONT_SIZE.md, color: COLORS.text,
    lineHeight: 24, fontWeight: '500',
  },

  // Sections
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING.md, gap: SPACING.sm,
  },
  sectionEmoji: { fontSize: 20 },
  sectionTitle: {
    fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text,
  },
  sectionText: {
    fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    lineHeight: 22,
  },
  listWrap: { gap: SPACING.sm },
  listItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
  },
  bulletDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.primary, marginTop: 7,
  },
  listText: {
    flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    lineHeight: 22,
  },
  reasonText: {
    fontSize: FONT_SIZE.xs, color: COLORS.textLight,
    fontStyle: 'italic', lineHeight: 18,
    marginTop: SPACING.sm, paddingTop: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },

  // Disclaimer
  disclaimerCard: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  disclaimerText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // CTA
  ctaButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  ctaText: {
    color: '#FFFFFF', fontSize: FONT_SIZE.lg, fontWeight: '600',
  },
  bottomSpacer: { height: 40 },

  // First Talk Card (inline AI question)
  firstTalkCard: {
    borderRadius: 20,
    padding: 20,
    marginTop: SPACING.lg,
  },
  ftLoadingWrap: {
    alignItems: 'center' as const,
    paddingVertical: 20,
    gap: 10,
  },
  ftLoadingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
  },
  ftAvatarRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  ftAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ftAvatarEmoji: { fontSize: 16 },
  ftCoachLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
  },
  ftIntro: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    lineHeight: 24,
    marginBottom: 10,
  },
  ftTraitBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  ftTraitText: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  ftQuestion: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    lineHeight: 26,
    marginBottom: 16,
  },
  ftInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 4,
  },
  ftTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500' as const,
    minHeight: 40,
    maxHeight: 100,
    paddingVertical: 8,
  },
  ftSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 2,
  },
  ftSendBtnDisabled: {
    opacity: 0.4,
  },
  ftSendIcon: {
    width: 18,
    height: 18,
    tintColor: '#FF8C5A',
  },
  ftHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
    marginTop: 10,
    fontWeight: '500' as const,
  },
});

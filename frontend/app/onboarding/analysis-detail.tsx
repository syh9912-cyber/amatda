import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { buildFullReportHtml } from '../../utils/traitReportHtml';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useChildStore, AnalysisReport, ReportReasons } from '../../stores/childStore';
import { childApi, coachingApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { DetailSection } from '../../components/report/DetailSection';
import { TextTipSection } from '../../components/report/TextTipSection';
import { SimpleListSection } from '../../components/report/SimpleListSection';
import { EditorialCover } from '../../components/report/EditorialCover';

const IC_SEND = require('../../assets/icon-send.png') as number;

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('label' in obj && typeof obj.label === 'string') return obj.label;
    if ('text' in obj && typeof obj.text === 'string') return obj.text;
    if ('item' in obj && typeof obj.item === 'string') return obj.item;
    try { return JSON.stringify(value); } catch { return '[object]'; }
  }
  return String(value);
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeString(item));
}

/** "(0~36개월) 탐구형 활동가" → "탐구형 활동가" */
function stripAgePrefix(s: string): string {
  return s.replace(/^\(\d+~?\d*개월\)\s*/, '').replace(/^\(초등\s*\d+~?\d*학년\)\s*/, '');
}

/** dominantType → 표지/상세 공통 아키타입 라벨 (짧고 알아보기 쉬움) */
function getTypeArchetype(t: TFunction): Record<string, string> {
  return {
    탐구형: t('onboardingAnalysisDetail.archetypeExplorer'),
    활동형: t('onboardingAnalysisDetail.archetypeActive'),
    조화형: t('onboardingAnalysisDetail.archetypeHarmony'),
    분석형: t('onboardingAnalysisDetail.archetypeAnalytic'),
    감성형: t('onboardingAnalysisDetail.archetypeEmotional'),
  };
}

interface FirstTalkData {
  intro: string;
  traitSummary: string;
  suggestedQuestion: string;
  quickOptions: string[];
}

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
  icon: ReturnType<typeof require>;
  title: string;
  key: keyof AnalysisReport;
  type: 'text' | 'list';
}

function getSections(t: TFunction): SectionConfig[] {
  return [
    { icon: require('../../assets/cat-behavior.png'),    title: t('onboardingAnalysisDetail.sectionPersonality'), key: 'personality', type: 'list' },
    { icon: require('../../assets/quick-learning.png'),  title: t('onboardingAnalysisDetail.sectionStudyStyle'), key: 'studyStyle', type: 'text' },
    { icon: require('../../assets/mascot-happy.png'),    title: t('onboardingAnalysisDetail.sectionBestSubjects'), key: 'bestSubjects', type: 'list' },
    { icon: require('../../assets/quick-report.png'),    title: t('onboardingAnalysisDetail.sectionWeakAreas'), key: 'weakAreas', type: 'list' },
    { icon: require('../../assets/quick-baby.png'),      title: t('onboardingAnalysisDetail.sectionFutureFields'), key: 'futureFields', type: 'list' },
    { icon: require('../../assets/academy-sports.png'),  title: t('onboardingAnalysisDetail.sectionSportsMatch'), key: 'sportsMatch', type: 'list' },
    { icon: require('../../assets/cat-social.png'),      title: t('onboardingAnalysisDetail.sectionAcademyStyle'), key: 'academyStyle', type: 'text' },
    { icon: require('../../assets/cat-eating.png'),      title: t('onboardingAnalysisDetail.sectionGoodFoods'), key: 'goodFoods', type: 'list' },
    { icon: require('../../assets/mascot-worried.png'),  title: t('onboardingAnalysisDetail.sectionBadFoods'), key: 'badFoods', type: 'list' },
    { icon: require('../../assets/academy-math.png'),    title: t('onboardingAnalysisDetail.sectionEducationDirection'), key: 'educationDirection', type: 'text' },
    { icon: require('../../assets/mascot-happy.png'),    title: t('onboardingAnalysisDetail.sectionSpecialTalent'), key: 'specialTalent', type: 'text' },
    { icon: require('../../assets/mascot-thinking.png'), title: t('onboardingAnalysisDetail.sectionParentingTip'), key: 'parentingTip', type: 'text' },
  ];
}

export default function AnalysisDetailScreen() {
  const { t } = useTranslation();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const selectChild = useChildStore((s) => s.selectChild);
  const updateChild = useChildStore((s) => s.updateChild);
  const child = children.find((c) => c.id === childId);
  const storeReport = child?.analysisReport;

  const [localReport, setLocalReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  // 리포트 fetch를 자녀당 1회만 — 리포트가 없을 때 무한 재요청(로딩 먹통) 방지
  const fetchedForRef = useRef<string | null>(null);
  const [firstTalk, setFirstTalk] = useState<FirstTalkData | null>(null);
  const [firstTalkLoading, setFirstTalkLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sharing, setSharing] = useState(false);

  // 풀 리포트 PDF 생성 → 공유.
  // 이전 view-shot snapshotContentContainer 방식은 KeyboardAvoidingView+ScrollView 조합에서
  // 콘텐츠 일부만 캡쳐되고 나머지가 검은 빈 공간으로 출력되는 RN 버그가 있어 PDF 로 전환.
  // 카톡 PDF 첨부도 정상 미리보기되며, 풀 리포트는 다 페이지에 안전하게 분할됨.
  const handleShareFull = async () => {
    if (sharing) return;
    if (!child || !report) return;
    setSharing(true);
    try {
      const analysisDate = child.birthDate ? child.birthDate.replace(/-/g, '.') : '';
      const html = buildFullReportHtml({
        childName: safeString(child.name),
        ageMonths: child.ageInfo?.months ?? 0,
        analysisDate,
        dominantType: safeString(child.innateData?.dominantType),
        label: safeString(child.innateData?.label),
        fiveElements: child.innateData?.fiveElements ?? null,
        report,
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('onboardingAnalysisDetail.shareDialogTitle', { name: safeString(child.name) }),
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(t('onboardingAnalysisDetail.saveCompleteTitle'), t('onboardingAnalysisDetail.savedPdfMessage', { uri }));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('onboardingAnalysisDetail.reportGenerationFailed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSharing(false);
    }
  };

  const report = storeReport ?? localReport;

  useEffect(() => {
    if (childId && !storeReport && !localReport && !loading && fetchedForRef.current !== childId) {
      fetchedForRef.current = childId;
      setLoading(true);
      (async () => {
        try {
          const listRes = await childApi.list();
          const list = listRes.data?.data as Record<string, unknown>[] | undefined;
          const found = list?.find((c) => (c.id as string) === childId);
          let parsed = (found?.analysisReport ?? null) as AnalysisReport | null;
          if (!parsed) {
            // 설문을 안 한 자녀: 생년월일 기반으로 기질 리포트 즉시 생성 (빈 답변 analyze)
            const aRes = await childApi.analyze(childId, []);
            const data = aRes.data?.data as
              | (Record<string, unknown> & { analysisReport?: AnalysisReport })
              | undefined;
            parsed = (data?.analysisReport ?? null) as AnalysisReport | null;
            if (data) updateChild(data as unknown as ReturnType<typeof useChildStore.getState>['children'][0]);
          } else if (found) {
            updateChild(found as unknown as ReturnType<typeof useChildStore.getState>['children'][0]);
          }
          if (parsed) setLocalReport(parsed);
        } catch {
          /* ignore — report 없으면 빈 상태 표시 */
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [childId, storeReport, localReport, loading, updateChild]);

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
        setFirstTalk({
          intro: t('onboardingAnalysisDetail.coachReadyFallback'),
          traitSummary: '',
          suggestedQuestion: t('onboardingAnalysisDetail.suggestedQuestionFallback'),
          quickOptions: [],
        });
      })
      .finally(() => setFirstTalkLoading(false));
  }, [childId, report, firstTalk, firstTalkLoading, t]);

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
        <Stack.Screen options={{ title: t('onboardingAnalysisDetail.screenTitle'), headerShown: false }} />
        <ActivityIndicator size="large" color="#FF8C5A" />
        <Text style={[styles.emptyText, { marginTop: 16 }]}>{t('onboardingAnalysisDetail.loadingReport')}</Text>
      </View>
    );
  }

  if (!child || !report) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: t('onboardingAnalysisDetail.screenTitle'), headerShown: false }} />
        <Text style={styles.emptyText}>{t('onboardingAnalysisDetail.loadFailed')}</Text>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(main)/home')}
        >
          <Text style={styles.homeBtnText}>{t('onboardingAnalysisDetail.goHome')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dominantType = safeString(child.innateData?.dominantType ?? '');
  // 표지와 통일된 아키타입 라벨 ("탐구형 활동가" 등). 백엔드 라벨이 길면 그것도 fallback으로 사용.
  const typeArchetype = getTypeArchetype(t);
  const headerTitle =
    typeArchetype[dominantType] ||
    stripAgePrefix(safeString(child.innateData?.label ?? '')) ||
    dominantType;
  const sections = getSections(t);

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
      <Stack.Screen options={{ title: t('onboardingAnalysisDetail.screenTitle'), headerShown: false }} />

      {/* 상단 네비 바 (뒤로 + 타이틀 + 공유) */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
        >
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{headerTitle}</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleShareFull}
          disabled={sharing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#FF8C5A" />
          ) : (
            <Text style={styles.shareTopBtn}>{t('onboardingAnalysisDetail.share')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Editorial 표지 — 풀 리포트 위에 배치. 공유 시 ScrollView 전체 캡쳐로 표지+본문 함께 포함. */}
      <View style={styles.coverWrap}>
        <EditorialCover
          childName={safeString(child.name)}
          ageMonths={child.ageInfo?.months ?? 0}
          dominantType={safeString(child.innateData?.dominantType)}
          label={safeString(child.innateData?.label)}
          fiveElements={child.innateData?.fiveElements ?? null}
          description={safeString(report.summary)}
          fullScreen={false}
          // CTA 숨김 — 이미 풀 리포트 화면이라 "READ THE FULL REPORT" 버튼 불필요
        />
      </View>

      {/* Sections */}
      {sections.map((section) => {
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
              <Image source={section.icon} style={styles.sectionIcon} resizeMode="contain" />
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

      {report.strengthsDetail && report.strengthsDetail.length > 0 && (
        <DetailSection
          emoji="✨"
          title={t('onboardingAnalysisDetail.strengthsTitle')}
          items={report.strengthsDetail.map((d) => ({
            item: safeString(d.item),
            reason: safeString(d.reason),
          }))}
          accentColor={COLORS.primary}
        />
      )}

      {report.weaknessesDetail && report.weaknessesDetail.length > 0 && (
        <DetailSection
          emoji="⚠️"
          title={t('onboardingAnalysisDetail.weaknessesTitle')}
          items={report.weaknessesDetail.map((d) => ({
            item: safeString(d.item),
            reason: safeString(d.reason),
          }))}
          accentColor="#F5A623"
        />
      )}

      {report.doList && report.doList.length > 0 && (
        <SimpleListSection
          emoji="✅"
          title={t('onboardingAnalysisDetail.doListTitle')}
          items={safeStringArray(report.doList)}
          bulletColor="#4CAF50"
        />
      )}

      {report.dontList && report.dontList.length > 0 && (
        <SimpleListSection
          emoji="❌"
          title={t('onboardingAnalysisDetail.dontListTitle')}
          items={safeStringArray(report.dontList)}
          bulletColor="#F44336"
        />
      )}

      {report.dailyRoutineTip ? (
        <TextTipSection emoji="🕐" title={t('onboardingAnalysisDetail.dailyRoutineTipTitle')} text={safeString(report.dailyRoutineTip)} />
      ) : null}

      {report.socialTip ? (
        <TextTipSection emoji="👫" title={t('onboardingAnalysisDetail.socialTipTitle')} text={safeString(report.socialTip)} />
      ) : null}

      {report.emotionalTip ? (
        <TextTipSection emoji="💕" title={t('onboardingAnalysisDetail.emotionalTipTitle')} text={safeString(report.emotionalTip)} />
      ) : null}

      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerText}>
          {t('onboardingAnalysisDetail.disclaimer')}
        </Text>
      </View>

      {firstTalkLoading ? (
        <View style={[styles.firstTalkCard, { backgroundColor: '#F4A98C' }]}>
          <View style={styles.ftLoadingWrap}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.ftLoadingText}>{t('onboardingAnalysisDetail.coachPreparing')}</Text>
          </View>
        </View>
      ) : firstTalk ? (
        <View style={[styles.firstTalkCard, { backgroundColor: '#F4A98C' }]}>
          <View style={styles.ftAvatarRow}>
            <View style={styles.ftAvatar}>
              <Text style={styles.ftAvatarEmoji}>{'🤖'}</Text>
            </View>
            <Text style={styles.ftCoachLabel}>{t('onboardingAnalysisDetail.coachLabel')}</Text>
          </View>
          {firstTalk.intro ? <Text style={styles.ftIntro}>{firstTalk.intro}</Text> : null}
          {firstTalk.traitSummary ? (
            <View style={styles.ftTraitBox}>
              <Text style={styles.ftTraitText}>{stripAgePrefix(firstTalk.traitSummary)}</Text>
            </View>
          ) : null}
          {firstTalk.suggestedQuestion ? (
            <Text style={styles.ftQuestion}>{firstTalk.suggestedQuestion}</Text>
          ) : null}
          <View style={styles.ftInputRow}>
            <TextInput
              style={styles.ftTextInput}
              placeholder={t('onboardingAnalysisDetail.answerPlaceholder')}
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
          <Text style={styles.ftHint}>{t('onboardingAnalysisDetail.ftHint')}</Text>
        </View>
      ) : null}

      <View style={styles.bottomSpacer} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: 56 },
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

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  backArrow: { fontSize: 20, color: COLORS.text, fontWeight: '700' },
  shareTopBtn: { fontSize: 12, color: '#FF8C5A', fontWeight: '700' },
  coverWrap: {
    marginHorizontal: -SPACING.md,
    marginBottom: SPACING.lg,
    borderRadius: 0,
    overflow: 'hidden',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
    color: COLORS.text,
  },

  header: {
    alignItems: 'center', marginBottom: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.primary,
    textAlign: 'center',
  },

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
  sectionIcon: { width: 28, height: 28 },
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
  bottomSpacer: { height: 40 },

  firstTalkCard: { borderRadius: 20, padding: 20, marginTop: SPACING.lg },
  ftLoadingWrap: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  ftLoadingText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  ftAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  ftAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  ftAvatarEmoji: { fontSize: 16 },
  ftCoachLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  ftIntro: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', lineHeight: 24, marginBottom: 10 },
  ftTraitBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  ftTraitText: { fontSize: 13, color: '#FFFFFF', lineHeight: 20 },
  ftQuestion: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', lineHeight: 26, marginBottom: 16 },
  ftInputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    paddingLeft: 14, paddingRight: 6, paddingVertical: 4,
  },
  ftTextInput: {
    flex: 1, fontSize: 14, color: '#FFFFFF',
    fontWeight: '500', minHeight: 40, maxHeight: 100, paddingVertical: 8,
  },
  ftSendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  ftSendBtnDisabled: { opacity: 0.4 },
  ftSendIcon: { width: 18, height: 18, tintColor: '#FF8C5A' },
  ftHint: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 10, fontWeight: '500' },
});

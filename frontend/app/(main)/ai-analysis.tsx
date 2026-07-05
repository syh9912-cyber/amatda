import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Image,
  Alert,
} from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  loadAnalysisHistory,
  saveAnalysisHistory,
  deleteAnalysisHistoryItem,
  AnalysisType,
  AnalysisHistoryItem,
} from '../../utils/analysisHistory';
import { useChildStore } from '../../stores/childStore';
import { growthApi } from '../../services/api';
import { createGrowthAnalysisTranslator } from '../../utils/growthAnalysisI18n';
import type { ImageSourcePropType } from 'react-native';
// 로컬 AsyncStorage 헬퍼 — baby-tracker가 자체 저장한 일일 기록을 같은 형식으로
// 읽어 AI 분석 페이로드에 포함. 서버 통신이 아닌 디바이스-로컬 데이터이므로
// CLAUDE.md "UI→Repository 직접 호출 금지" 규칙은 Service-tier 헬퍼로 간주해 적용.
import { loadRecords } from '../../features/baby-tracker/storage';
import { formatDate } from '../../features/baby-tracker/utils/time';
import type { TrackerAnalysisResult } from '../../features/baby-tracker/types';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';
import { GuideButton } from '../../components/common/GuideButton';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { getAiAnalysisGuide } from '../../features/guide/aiAnalysisGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';

const IC_REPORT = require('../../assets/quick-report.png') as ImageSourcePropType;
const IC_POOP = require('../../assets/cat-poop.png') as ImageSourcePropType;
const IC_LULLABY = require('../../assets/quick-lullaby.png') as ImageSourcePropType;

type TabKey = AnalysisType;

interface TabConfig {
  key: TabKey;
  labelKey: string;
  icon: ImageSourcePropType;
  accent: string;
  bg: string;
  descriptionKey: string;
  ctaKey: string;
  // 인라인 실행(pattern)인지, 외부 화면으로 이동(poop/cry)인지
  inline: boolean;
  route?: string;
}

const TABS: TabConfig[] = [
  {
    key: 'pattern',
    labelKey: 'aiAnalysis.tabs.pattern.label',
    icon: IC_REPORT,
    accent: '#7C83EC',
    bg: '#EEEDFC',
    descriptionKey: 'aiAnalysis.tabs.pattern.description',
    ctaKey: 'aiAnalysis.tabs.pattern.cta',
    inline: true,
  },
  {
    key: 'poop',
    labelKey: 'aiAnalysis.tabs.poop.label',
    icon: IC_POOP,
    accent: '#D4A373',
    bg: '#FBF3E6',
    descriptionKey: 'aiAnalysis.tabs.poop.description',
    ctaKey: 'aiAnalysis.tabs.poop.cta',
    inline: false,
    route: '/(main)/poop-analyzer',
  },
  {
    key: 'cry',
    labelKey: 'aiAnalysis.tabs.cry.label',
    icon: IC_LULLABY,
    accent: '#D88FB8',
    bg: '#FCEAF3',
    descriptionKey: 'aiAnalysis.tabs.cry.description',
    ctaKey: 'aiAnalysis.tabs.cry.cta',
    inline: false,
    route: '/(main)/cry-analyzer',
  },
];

function formatShortDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AIAnalysisScreen() {
  const { t, i18n } = useTranslation();
  // 패턴 분석 결과(백엔드 한국어 고정 문자열)를 표시 시점에 번역
  const gaT = useMemo(() => createGrowthAnalysisTranslator(t, i18n), [t, i18n]);
  const [activeTab, setActiveTab] = useState<TabKey>('pattern');
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<AnalysisHistoryItem | null>(null);

  // 가이드 (첫 진입 1회 자동 + 헤더 '?' 재열람)
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => { shouldAutoShowGuide('ai-analysis').then((sh) => { if (sh) setGuideVisible(true); }); }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('ai-analysis'); };

  // 패턴 분석 상태
  const [patternLoading, setPatternLoading] = useState(false);
  const [patternError, setPatternError] = useState('');

  const selectedChild = useChildStore((s) => s.selectedChild);

  const reload = useCallback(async (type: TabKey) => {
    const items = await loadAnalysisHistory(type);
    setHistory(items);
  }, []);

  const handleDeleteItem = useCallback(
    (item: AnalysisHistoryItem) => {
      Alert.alert(
        t('aiAnalysis.alert.deleteTitle'),
        t('aiAnalysis.alert.deleteMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              await deleteAnalysisHistoryItem(item.type, item.id);
              setSelectedItem((prev) => (prev?.id === item.id ? null : prev));
              reload(activeTab);
            },
          },
        ],
      );
    },
    [activeTab, reload, t],
  );

  useEffect(() => {
    reload(activeTab);
    setSelectedItem(null);
  }, [activeTab, reload]);

  useFocusEffect(
    useCallback(() => {
      reload(activeTab);
    }, [activeTab, reload]),
  );

  const current = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];

  async function runPatternAnalysis() {
    if (patternLoading) return;
    const childId = selectedChild?.id;
    if (!childId) {
      setPatternError(t('aiAnalysis.error.selectChildFirst'));
      return;
    }
    setPatternLoading(true);
    setPatternError('');

    try {
      const today = formatDate(new Date());
      const records = await loadRecords(childId, today);
      const diaperCount = records.filter((r) => r.type === 'diaper').length;
      const feedingCount = records.filter((r) => r.type === 'feeding').length;
      const sleepMinutes = records
        .filter((r) => r.type === 'sleep' && r.duration != null)
        .reduce((sum, r) => sum + (r.duration ?? 0), 0);
      const sleepHours = Math.round((sleepMinutes / 60) * 10) / 10;

      // 강제 2초 가짜 지연 제거(rule #4) — 실제 분석 완료 시점에 결과 표시
      const res = await growthApi.analysis(childId, {
        diaper: diaperCount,
        feeding: feedingCount,
        sleep: sleepHours,
      });
      const data = res.data?.data as TrackerAnalysisResult | undefined;
      if (data?.trackerMetrics) {
        // 해결책(advice) 우선, 없으면 comment fallback
        const recs = data.trackerMetrics
          .map((m) => {
            const advice = (m.advice ?? '').trim();
            if (advice) return `${m.title}: ${advice}`;
            const comment = (m.comment ?? '').trim();
            return comment ? `${m.title}: ${comment}` : '';
          })
          .filter((c) => c !== '');

        // 전체 분석 본문: 종합 + 각 항목의 현황/해결책을 모두 포함
        const fullTextParts: string[] = [];
        if (data.overallSummary) fullTextParts.push(data.overallSummary);
        data.trackerMetrics.forEach((m) => {
          const chunk: string[] = [];
          chunk.push(`${m.emoji ?? ''} ${m.title} (${m.value})`);
          if (m.standardRange) chunk.push(t('aiAnalysis.fullText.standardRange', { range: m.standardRange }));
          if (m.comment) chunk.push(t('aiAnalysis.fullText.currentStatus', { comment: m.comment }));
          if (m.advice) chunk.push(t('aiAnalysis.fullText.advice', { advice: m.advice }));
          fullTextParts.push(chunk.join('\n'));
        });
        const fullText = fullTextParts.join('\n\n');

        await saveAnalysisHistory({
          type: 'pattern',
          summary: data.overallSummary?.slice(0, 120) ?? t('aiAnalysis.patternAnalysisComplete'),
          details: data.trackerMetrics
            .slice(0, 5)
            .map((m) => `${m.title}: ${m.value}`)
            .join(' · '),
          childId,
          childName: selectedChild?.name,
          fullText,
          metrics: data.trackerMetrics.map((m) => ({
            title: m.title,
            value: String(m.value),
            comment: m.comment,
            advice: m.advice,
            emoji: m.emoji,
            level: m.level,
            standardRange: m.standardRange,
          })),
          recommendations: recs,
        });
        reload('pattern');
        // 분석 직후 결과를 큰 팝업으로 보여주기 위해 latest 항목을 expandedItem에 설정
        const latest = await loadAnalysisHistory('pattern');
        if (latest[0]) setSelectedItem(latest[0]);
      } else {
        setPatternError(t('aiAnalysis.error.loadResultFailed'));
      }
    } catch {
      setPatternError(t('aiAnalysis.error.analysisFailed'));
    } finally {
      setPatternLoading(false);
    }
  }

  function handleStartPress() {
    if (current.inline) {
      runPatternAnalysis();
    } else if (current.route) {
      router.push(current.route as never);
    }
  }

  // 패턴 분석 종합 본문은 저장 시점 언어로 조합돼 있으므로,
  // 저장된 구조화 데이터(metrics/summary)로 현재 언어에 맞게 다시 조합한다.
  // (한국어 표시 결과는 기존 저장 본문과 동일. metrics가 없는 항목은 원문 유지)
  function buildPatternFullText(item: AnalysisHistoryItem): string {
    if (item.type !== 'pattern' || !item.metrics || item.metrics.length === 0) {
      return item.fullText ?? '';
    }
    const parts: string[] = [];
    if (item.summary) parts.push(gaT.overallSummary(item.summary));
    item.metrics.forEach((m) => {
      const chunk: string[] = [];
      chunk.push(`${m.emoji ?? ''} ${gaT.text(m.title)} (${m.value})`);
      if (m.standardRange) chunk.push(t('aiAnalysis.fullText.standardRange', { range: gaT.standardRange(m.standardRange) }));
      if (m.comment) chunk.push(t('aiAnalysis.fullText.currentStatus', { comment: gaT.text(m.comment) }));
      if (m.advice) chunk.push(t('aiAnalysis.fullText.advice', { advice: gaT.text(m.advice) }));
      parts.push(chunk.join('\n'));
    });
    return parts.join('\n\n');
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: t('aiAnalysis.screenTitle'), headerShown: true, headerLeft: () => <BackButton />, headerRight: () => <View style={{ marginRight: 14 }}><GuideButton onPress={() => setGuideVisible(true)} color="#9D8CC6" /></View> }} />

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && { backgroundColor: tab.bg }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Image source={tab.icon} style={styles.tabIconImg} resizeMode="contain" />
              <Text
                style={[
                  styles.tabLabel,
                  active && { color: tab.accent, fontWeight: '600' },
                ]}
              >
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Start Card */}
        <View style={[styles.startCard, { backgroundColor: current.bg }]}>
          <Image source={current.icon} style={styles.startIconImg} resizeMode="contain" />
          <Text style={styles.startTitle}>{t('aiAnalysis.startTitle', { label: t(current.labelKey) })}</Text>
          <Text style={styles.startDesc}>{t(current.descriptionKey)}</Text>
          <TouchableOpacity
            style={[
              styles.startBtn,
              { backgroundColor: current.accent },
              patternLoading && { opacity: 0.6 },
            ]}
            onPress={handleStartPress}
            disabled={patternLoading && current.inline}
            activeOpacity={0.85}
          >
            {patternLoading && current.inline ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.startBtnText}>{t('aiAnalysis.analyzing')}</Text>
              </View>
            ) : (
              <Text style={styles.startBtnText}>{t(current.ctaKey)}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Pattern inline error (결과는 모달로 표시됨) */}
        {current.inline && patternError !== '' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{patternError}</Text>
          </View>
        )}

        {/* AdSlot (분석 섹션 직후) */}
        <View style={styles.adWrap}>
          <AdSlot />
        </View>

        {/* History Section */}
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>{t('aiAnalysis.recentHistory')}</Text>
          <Text style={styles.historyCount}>{history.length}/10</Text>
        </View>

        {history.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('aiAnalysis.empty.title')}</Text>
            <Text style={styles.emptySubText}>
              {t('aiAnalysis.empty.subtitle')}
            </Text>
          </View>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <TouchableOpacity
                style={styles.historyHead}
                onPress={() => setSelectedItem(item)}
                activeOpacity={0.7}
              >
                {item.thumbnailUri ? (
                  <Image
                    source={{ uri: item.thumbnailUri }}
                    style={styles.historyThumb}
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>{formatShortDate(item.createdAt)}</Text>
                  <Text style={styles.historyName} numberOfLines={1}>
                    {item.childName ?? '-'}
                  </Text>
                  <Text style={styles.historySummaryShort} numberOfLines={2}>
                    {item.type === 'pattern' ? gaT.overallSummary(item.summary) : item.summary}
                  </Text>
                </View>
                <Text style={styles.historyChevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteItem(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={selectedItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedItem
                  ? t('aiAnalysis.detailTitle', {
                      label: t(
                        TABS.find((tab) => tab.key === selectedItem.type)?.labelKey ??
                          TABS[0].labelKey,
                      ),
                    })
                  : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedItem(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedItem ? (
                <>
                  <Text style={styles.modalDate}>
                    {formatShortDate(selectedItem.createdAt)}
                    {selectedItem.childName ? ` · ${selectedItem.childName}` : ''}
                  </Text>
                  {selectedItem.thumbnailUri ? (
                    <Image
                      source={{ uri: selectedItem.thumbnailUri }}
                      style={styles.modalThumb}
                      resizeMode="cover"
                    />
                  ) : null}
                  <Text style={styles.modalSectionTitle}>{t('aiAnalysis.section.summary')}</Text>
                  <Text style={styles.modalSummary}>
                    {selectedItem.type === 'pattern'
                      ? gaT.overallSummary(selectedItem.summary)
                      : selectedItem.summary}
                  </Text>

                  {selectedItem.fullText ? (
                    <>
                      <Text style={styles.modalSectionTitle}>{t('aiAnalysis.section.fullAnalysis')}</Text>
                      <Text style={styles.modalBody}>
                        {selectedItem.type === 'pattern'
                          ? buildPatternFullText(selectedItem)
                          : selectedItem.fullText}
                      </Text>
                    </>
                  ) : null}

                  {selectedItem.metrics && selectedItem.metrics.length > 0 ? (
                    <>
                      <Text style={styles.modalSectionTitle}>{t('aiAnalysis.section.metrics')}</Text>
                      {selectedItem.metrics.map((m, idx) => (
                        <View key={`${m.title}_${idx}`} style={styles.metricRow}>
                          <Text style={styles.metricTitle}>
                            {m.emoji ? `${m.emoji} ` : ''}
                            {gaT.text(m.title)}
                          </Text>
                          <Text style={styles.metricValue}>
                            {m.value}
                            {m.standardRange ? t('aiAnalysis.metric.standardRangeSuffix', { range: gaT.standardRange(m.standardRange) }) : ''}
                          </Text>
                          {m.comment ? (
                            <Text style={styles.metricComment}>
                              📝 {gaT.text(m.comment)}
                            </Text>
                          ) : null}
                          {m.advice ? (
                            <View style={styles.adviceBox}>
                              <Text style={styles.adviceLabel}>{t('aiAnalysis.metric.tryThis')}</Text>
                              <Text style={styles.adviceText}>{gaT.text(m.advice)}</Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </>
                  ) : null}

                  {selectedItem.recommendations &&
                  selectedItem.recommendations.length > 0 ? (
                    <>
                      <Text style={styles.modalSectionTitle}>{t('aiAnalysis.section.recommendations')}</Text>
                      {selectedItem.recommendations.map((r, idx) => (
                        <View key={idx} style={styles.recRow}>
                          <Text style={styles.recBullet}>✓</Text>
                          <Text style={styles.recText}>{gaT.recommendation(r)}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}

                  <View style={styles.historyAdWrap}>
                    <AdSlot />
                  </View>
                </>
              ) : null}
            </ScrollView>
            <View style={{ flexDirection: 'row' }}>
              {selectedItem ? (
                <TouchableOpacity
                  style={styles.modalDeleteBtn}
                  onPress={() => handleDeleteItem(selectedItem)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalDeleteBtnText}>{t('common.delete')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedItem(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCloseBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <GuideCarousel visible={guideVisible} pages={getAiAnalysisGuide(t)} onClose={closeGuide} onComplete={closeGuide} accent="#9D8CC6" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7FA' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F4F4F7',
  },
  tabEmoji: { fontSize: 18, marginBottom: 2 },
  tabIconImg: { width: 22, height: 22, marginBottom: 2 },
  tabLabel: { fontSize: 13, color: '#636366', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  startCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  startEmoji: { fontSize: 40, marginBottom: 8 },
  startIconImg: { width: 48, height: 48, marginBottom: 8 },
  startTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  startDesc: { fontSize: 13, color: '#636366', marginBottom: 16, textAlign: 'center' },
  startBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  startBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  errorBox: {
    backgroundColor: '#FFECEC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: '#C0392B', fontSize: 13, fontWeight: '600' },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  resultSummary: {
    fontSize: 13,
    color: '#3A3A3C',
    lineHeight: 19,
    marginBottom: 10,
  },
  metricRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ECECEE',
    paddingVertical: 8,
  },
  metricTitle: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  metricValue: { fontSize: 13, color: '#7C83EC', fontWeight: '600', marginTop: 2 },
  metricComment: { fontSize: 12, color: '#636366', marginTop: 2, lineHeight: 17 },
  adWrap: {
    marginBottom: 16,
    alignItems: 'center',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  historyTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  historyCount: { fontSize: 12, color: '#8E8E93' },
  empty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#636366', fontWeight: '600' },
  emptySubText: { fontSize: 12, color: '#ABABAB', marginTop: 4 },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  historyThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0F0F3',
  },
  historyDate: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  historyName: { fontSize: 13, color: '#1C1C1E', fontWeight: '700', marginTop: 2 },
  historySummaryShort: {
    fontSize: 12,
    color: '#636366',
    marginTop: 4,
    lineHeight: 16,
  },
  historyChevron: { fontSize: 22, color: '#C7C7CC', fontWeight: '300' },
  historyAdWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECEE',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', flex: 1 },
  modalClose: { fontSize: 18, color: '#8E8E93', paddingHorizontal: 6 },
  modalScroll: { maxHeight: 520 },
  modalScrollContent: { padding: 18 },
  modalDate: { fontSize: 12, color: '#8E8E93', marginBottom: 10 },
  modalThumb: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: '#F0F0F3',
    marginBottom: 14,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 12,
    marginBottom: 6,
  },
  modalSummary: {
    fontSize: 13,
    color: '#1C1C1E',
    lineHeight: 20,
  },
  modalBody: {
    fontSize: 13,
    color: '#3A3A3C',
    lineHeight: 20,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    gap: 6,
  },
  recBullet: { fontSize: 13, color: '#7C83EC', fontWeight: '600' },
  recText: { flex: 1, fontSize: 13, color: '#3A3A3C', lineHeight: 19 },
  adviceBox: {
    marginTop: 8,
    backgroundColor: '#F0F7F4',
    borderLeftWidth: 3,
    borderLeftColor: '#2BA89E',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  adviceLabel: {
    fontSize: 11,
    color: '#2BA89E',
    fontWeight: '600',
    marginBottom: 3,
  },
  adviceText: {
    fontSize: 12,
    color: '#1C1C1E',
    lineHeight: 18,
  },
  modalCloseBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F4F4F7',
  },
  modalCloseBtnText: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  deleteBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F3',
  },
  deleteBtnText: {
    fontSize: 12,
    color: '#C0392B',
    fontWeight: '600',
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFECEC',
  },
  modalDeleteBtnText: { fontSize: 14, fontWeight: '700', color: '#C0392B' },
});

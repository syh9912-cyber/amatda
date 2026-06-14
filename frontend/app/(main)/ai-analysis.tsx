import { useCallback, useEffect, useState } from 'react';
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
import {
  loadAnalysisHistory,
  saveAnalysisHistory,
  deleteAnalysisHistoryItem,
  AnalysisType,
  AnalysisHistoryItem,
} from '../../utils/analysisHistory';
import { useChildStore } from '../../stores/childStore';
import { growthApi } from '../../services/api';
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
import { AIANALYSIS_GUIDE } from '../../features/guide/aiAnalysisGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';

const IC_REPORT = require('../../assets/quick-report.png') as ImageSourcePropType;
const IC_POOP = require('../../assets/cat-poop.png') as ImageSourcePropType;
const IC_LULLABY = require('../../assets/quick-lullaby.png') as ImageSourcePropType;

type TabKey = AnalysisType;

interface TabConfig {
  key: TabKey;
  label: string;
  icon: ImageSourcePropType;
  accent: string;
  bg: string;
  description: string;
  cta: string;
  // 인라인 실행(pattern)인지, 외부 화면으로 이동(poop/cry)인지
  inline: boolean;
  route?: string;
}

const TABS: TabConfig[] = [
  {
    key: 'pattern',
    label: '육아패턴',
    icon: IC_REPORT,
    accent: '#7C83EC',
    bg: '#EEEDFC',
    description: '오늘 기록된 배변·수유·수면을 종합 분석합니다',
    cta: '육아패턴 분석 시작',
    inline: true,
  },
  {
    key: 'poop',
    label: '대변',
    icon: IC_POOP,
    accent: '#D4A373',
    bg: '#FBF3E6',
    description: '사진으로 건강 상태를 확인합니다',
    cta: '대변 분석 시작',
    inline: false,
    route: '/(main)/poop-analyzer',
  },
  {
    key: 'cry',
    label: '울음',
    icon: IC_LULLABY,
    accent: '#D88FB8',
    bg: '#FCEAF3',
    description: '울음 소리로 원인을 추정합니다',
    cta: '울음 분석 시작',
    inline: false,
    route: '/(main)/cry-analyzer',
  },
];

function formatShortDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AIAnalysisScreen() {
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
        '분석 기록 삭제',
        '이 분석 기록을 삭제할까요? 삭제 후에는 복구할 수 없어요.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
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
    [activeTab, reload],
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

  const current = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  async function runPatternAnalysis() {
    if (patternLoading) return;
    const childId = selectedChild?.id;
    if (!childId) {
      setPatternError('아이를 먼저 선택해주세요.');
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
          if (m.standardRange) chunk.push(`표준 범위: ${m.standardRange}`);
          if (m.comment) chunk.push(`현재 상태: ${m.comment}`);
          if (m.advice) chunk.push(`✅ 해결책: ${m.advice}`);
          fullTextParts.push(chunk.join('\n'));
        });
        const fullText = fullTextParts.join('\n\n');

        await saveAnalysisHistory({
          type: 'pattern',
          summary: data.overallSummary?.slice(0, 120) ?? '육아패턴 분석 완료',
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
        setPatternError('분석 결과를 불러올 수 없습니다.');
      }
    } catch {
      setPatternError('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
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

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'AI 분석', headerShown: true, headerLeft: () => <BackButton />, headerRight: () => <View style={{ marginRight: 14 }}><GuideButton onPress={() => setGuideVisible(true)} color="#9D8CC6" /></View> }} />

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = t.key === activeTab;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && { backgroundColor: t.bg }]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.8}
            >
              <Image source={t.icon} style={styles.tabIconImg} resizeMode="contain" />
              <Text
                style={[
                  styles.tabLabel,
                  active && { color: t.accent, fontWeight: '600' },
                ]}
              >
                {t.label}
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
          <Text style={styles.startTitle}>{current.label} 분석</Text>
          <Text style={styles.startDesc}>{current.description}</Text>
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
                <Text style={styles.startBtnText}>분석 중...</Text>
              </View>
            ) : (
              <Text style={styles.startBtnText}>{current.cta}</Text>
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
          <Text style={styles.historyTitle}>최근 분석 기록</Text>
          <Text style={styles.historyCount}>{history.length}/10</Text>
        </View>

        {history.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>아직 분석 기록이 없어요</Text>
            <Text style={styles.emptySubText}>
              위 버튼으로 첫 분석을 시작해보세요
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
                    {item.summary}
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
                <Text style={styles.deleteBtnText}>삭제</Text>
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
                  ? `${TABS.find((t) => t.key === selectedItem.type)?.label ?? ''} 분석 상세`
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
                  <Text style={styles.modalSectionTitle}>요약</Text>
                  <Text style={styles.modalSummary}>{selectedItem.summary}</Text>

                  {selectedItem.fullText ? (
                    <>
                      <Text style={styles.modalSectionTitle}>종합 분석</Text>
                      <Text style={styles.modalBody}>{selectedItem.fullText}</Text>
                    </>
                  ) : null}

                  {selectedItem.metrics && selectedItem.metrics.length > 0 ? (
                    <>
                      <Text style={styles.modalSectionTitle}>세부 지표</Text>
                      {selectedItem.metrics.map((m, idx) => (
                        <View key={`${m.title}_${idx}`} style={styles.metricRow}>
                          <Text style={styles.metricTitle}>
                            {m.emoji ? `${m.emoji} ` : ''}
                            {m.title}
                          </Text>
                          <Text style={styles.metricValue}>
                            {m.value}
                            {m.standardRange ? `  (표준: ${m.standardRange})` : ''}
                          </Text>
                          {m.comment ? (
                            <Text style={styles.metricComment}>
                              📝 {m.comment}
                            </Text>
                          ) : null}
                          {m.advice ? (
                            <View style={styles.adviceBox}>
                              <Text style={styles.adviceLabel}>이렇게 해보세요</Text>
                              <Text style={styles.adviceText}>{m.advice}</Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </>
                  ) : null}

                  {selectedItem.recommendations &&
                  selectedItem.recommendations.length > 0 ? (
                    <>
                      <Text style={styles.modalSectionTitle}>해결책 · 추천 가이드</Text>
                      {selectedItem.recommendations.map((r, idx) => (
                        <View key={idx} style={styles.recRow}>
                          <Text style={styles.recBullet}>✓</Text>
                          <Text style={styles.recText}>{r}</Text>
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
                  <Text style={styles.modalDeleteBtnText}>삭제</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedItem(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCloseBtnText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <GuideCarousel visible={guideVisible} pages={AIANALYSIS_GUIDE} onClose={closeGuide} onComplete={closeGuide} accent="#9D8CC6" />
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

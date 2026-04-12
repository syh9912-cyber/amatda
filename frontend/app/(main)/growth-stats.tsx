import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Animated } from 'react-native';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Stack, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useChildStore } from '../../stores/childStore';
import { childApi, coachingApi, growthApi } from '../../services/api';
import { getTodayQuestion } from '../../constants/dailyQuestions';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type TabKey = 'physical' | 'trait';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'physical', label: '키/몸무게' },
  { key: 'trait', label: '기질 변화' },
];

/* ---- Milestone Types ---- */

interface MilestoneItem {
  id: string;
  label: string;
  domain: string;
  description: string;
  completed: boolean;
}

interface MilestoneData {
  ageLabel: string;
  items: MilestoneItem[];
  nextMilestone: string;
  daysUntilNext: number;
}

/* ---- Growth Analysis Types ---- */

interface GrowthMetricItem {
  metric: string;
  value: number;
  level: string;
  title: string;
  emoji: string;
  comment: string;
  advice: string;
  percentileLabel?: string;
}

interface GrowthAnalysisResult {
  ageLabel: string;
  overallSummary: string;
  growthMetrics: GrowthMetricItem[];
  trackerMetrics: GrowthMetricItem[];
}

function isGrowthMetricItem(item: unknown): item is GrowthMetricItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.metric === 'string' &&
    typeof obj.value === 'number' &&
    typeof obj.level === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.emoji === 'string' &&
    typeof obj.comment === 'string' &&
    typeof obj.advice === 'string'
  );
}

function parseGrowthAnalysis(raw: unknown): GrowthAnalysisResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.overallSummary !== 'string') return null;

  const growthMetrics = Array.isArray(obj.growthMetrics)
    ? (obj.growthMetrics as unknown[]).filter(isGrowthMetricItem)
    : [];
  const trackerMetrics = Array.isArray(obj.trackerMetrics)
    ? (obj.trackerMetrics as unknown[]).filter(isGrowthMetricItem)
    : [];

  return {
    ageLabel: typeof obj.ageLabel === 'string' ? obj.ageLabel : '',
    overallSummary: obj.overallSummary,
    growthMetrics,
    trackerMetrics,
  };
}

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  very_low: { bg: '#FFF0F0', text: '#D32F2F' },
  very_high: { bg: '#FFF0F0', text: '#D32F2F' },
  low: { bg: '#FFF8E1', text: '#F57C00' },
  high: { bg: '#FFF8E1', text: '#F57C00' },
  normal: { bg: '#E8FAF8', text: '#2BA89E' },
};

function getLevelColor(level: string): { bg: string; text: string } {
  return LEVEL_COLORS[level] ?? { bg: '#F5F5F5', text: '#888888' };
}

function getLevelLabel(level: string): string {
  switch (level) {
    case 'very_low': return '매우 낮음';
    case 'low': return '낮음';
    case 'normal': return '정상';
    case 'high': return '높음';
    case 'very_high': return '매우 높음';
    default: return level;
  }
}

/* ---- Growth Percentile Standards (WHO approximate data) ---- */

interface PercentileData {
  p3: number;
  p50: number;
  p97: number;
}

interface GrowthStandard {
  height: PercentileData;
  weight: PercentileData;
}

const GROWTH_STANDARDS_BOYS: Record<number, GrowthStandard> = {
  0: { height: { p3: 46.3, p50: 49.9, p97: 53.4 }, weight: { p3: 2.5, p50: 3.3, p97: 4.3 } },
  3: { height: { p3: 57.6, p50: 61.4, p97: 65.3 }, weight: { p3: 5.1, p50: 6.4, p97: 8.0 } },
  6: { height: { p3: 63.6, p50: 67.6, p97: 71.6 }, weight: { p3: 6.4, p50: 7.9, p97: 9.8 } },
  9: { height: { p3: 67.7, p50: 72.0, p97: 76.2 }, weight: { p3: 7.2, p50: 8.9, p97: 11.0 } },
  12: { height: { p3: 71.0, p50: 75.7, p97: 80.5 }, weight: { p3: 8.1, p50: 9.6, p97: 11.8 } },
  18: { height: { p3: 76.0, p50: 81.7, p97: 87.5 }, weight: { p3: 9.2, p50: 10.9, p97: 13.2 } },
  24: { height: { p3: 80.5, p50: 87.1, p97: 93.8 }, weight: { p3: 10.0, p50: 12.2, p97: 14.7 } },
  30: { height: { p3: 84.0, p50: 91.1, p97: 98.2 }, weight: { p3: 10.8, p50: 13.3, p97: 16.0 } },
  36: { height: { p3: 87.5, p50: 95.1, p97: 102.8 }, weight: { p3: 11.3, p50: 14.0, p97: 17.0 } },
  48: { height: { p3: 93.4, p50: 102.0, p97: 110.5 }, weight: { p3: 12.7, p50: 16.3, p97: 20.5 } },
  60: { height: { p3: 99.0, p50: 108.0, p97: 117.0 }, weight: { p3: 14.1, p50: 18.3, p97: 23.5 } },
  72: { height: { p3: 104.0, p50: 113.8, p97: 123.5 }, weight: { p3: 15.9, p50: 20.5, p97: 26.8 } },
  84: { height: { p3: 109.0, p50: 119.2, p97: 129.4 }, weight: { p3: 17.4, p50: 22.9, p97: 30.5 } },
  96: { height: { p3: 113.5, p50: 124.5, p97: 135.5 }, weight: { p3: 19.2, p50: 25.6, p97: 34.8 } },
  108: { height: { p3: 118.0, p50: 129.5, p97: 141.0 }, weight: { p3: 21.3, p50: 28.8, p97: 39.8 } },
  120: { height: { p3: 122.5, p50: 134.5, p97: 146.5 }, weight: { p3: 23.6, p50: 32.4, p97: 45.6 } },
  132: { height: { p3: 127.5, p50: 140.0, p97: 152.5 }, weight: { p3: 26.4, p50: 36.5, p97: 51.5 } },
  144: { height: { p3: 133.0, p50: 146.0, p97: 159.0 }, weight: { p3: 29.8, p50: 41.2, p97: 58.0 } },
};

const GROWTH_STANDARDS_GIRLS: Record<number, GrowthStandard> = {
  0: { height: { p3: 45.6, p50: 49.1, p97: 52.7 }, weight: { p3: 2.4, p50: 3.2, p97: 4.2 } },
  3: { height: { p3: 56.2, p50: 59.8, p97: 63.5 }, weight: { p3: 4.6, p50: 5.8, p97: 7.4 } },
  6: { height: { p3: 61.8, p50: 65.7, p97: 69.8 }, weight: { p3: 5.8, p50: 7.3, p97: 9.2 } },
  9: { height: { p3: 65.6, p50: 70.1, p97: 74.5 }, weight: { p3: 6.6, p50: 8.2, p97: 10.4 } },
  12: { height: { p3: 68.9, p50: 74.0, p97: 79.2 }, weight: { p3: 7.0, p50: 8.9, p97: 11.5 } },
  18: { height: { p3: 74.0, p50: 80.0, p97: 86.1 }, weight: { p3: 8.2, p50: 10.2, p97: 12.8 } },
  24: { height: { p3: 79.3, p50: 85.7, p97: 92.2 }, weight: { p3: 9.2, p50: 11.5, p97: 14.5 } },
  30: { height: { p3: 83.0, p50: 89.8, p97: 96.6 }, weight: { p3: 10.0, p50: 12.7, p97: 16.0 } },
  36: { height: { p3: 86.5, p50: 93.9, p97: 101.4 }, weight: { p3: 10.8, p50: 13.9, p97: 17.5 } },
  48: { height: { p3: 92.5, p50: 100.8, p97: 109.2 }, weight: { p3: 12.3, p50: 16.1, p97: 20.8 } },
  60: { height: { p3: 98.0, p50: 107.2, p97: 116.4 }, weight: { p3: 13.7, p50: 18.2, p97: 24.1 } },
  72: { height: { p3: 103.5, p50: 113.0, p97: 122.5 }, weight: { p3: 15.3, p50: 20.2, p97: 27.5 } },
  84: { height: { p3: 108.5, p50: 118.5, p97: 128.5 }, weight: { p3: 17.0, p50: 22.4, p97: 31.2 } },
  96: { height: { p3: 113.5, p50: 124.0, p97: 134.5 }, weight: { p3: 18.8, p50: 25.0, p97: 35.5 } },
  108: { height: { p3: 118.5, p50: 130.0, p97: 141.5 }, weight: { p3: 21.0, p50: 28.2, p97: 40.5 } },
  120: { height: { p3: 124.0, p50: 136.5, p97: 149.0 }, weight: { p3: 23.5, p50: 32.0, p97: 46.0 } },
  132: { height: { p3: 130.0, p50: 143.0, p97: 156.0 }, weight: { p3: 26.5, p50: 36.5, p97: 52.0 } },
  144: { height: { p3: 135.5, p50: 149.0, p97: 162.5 }, weight: { p3: 30.0, p50: 41.5, p97: 58.5 } },
};

function getClosestStandard(months: number, gender: 'M' | 'F'): GrowthStandard | null {
  const table = gender === 'M' ? GROWTH_STANDARDS_BOYS : GROWTH_STANDARDS_GIRLS;
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) return null;

  let closest = keys[0];
  let minDiff = Math.abs(months - closest);
  for (const k of keys) {
    const diff = Math.abs(months - k);
    if (diff < minDiff) {
      minDiff = diff;
      closest = k;
    }
  }
  return table[closest] ?? null;
}

function calculatePercentile(value: number, std: PercentileData): number {
  if (value <= std.p3) return 97;
  if (value >= std.p97) return 3;

  if (value <= std.p50) {
    const ratio = (value - std.p3) / (std.p50 - std.p3);
    return Math.round(97 - ratio * 47);
  }
  const ratio = (value - std.p50) / (std.p97 - std.p50);
  return Math.round(50 - ratio * 47);
}

function getPercentileLabel(percentile: number): string {
  if (percentile <= 10) return `상위 ${percentile}%`;
  if (percentile <= 25) return `상위 ${percentile}%`;
  if (percentile <= 50) return `상위 ${percentile}%`;
  return `상위 ${percentile}%`;
}

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

/* ---- Growth Analysis Section ---- */

function GrowthAnalysisSection({ childId }: { childId: string }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<GrowthAnalysisResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const startLoadingAnimation = useCallback(() => {
    setProgress(0);
    progressAnim.setValue(0);

    // Spin animation loop
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    spin.start();

    // Progress bar animation: 0 -> 0.85 over 3 seconds (simulated feel)
    Animated.timing(progressAnim, {
      toValue: 0.85,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(interval);
          return 85;
        }
        return prev + Math.random() * 8 + 2;
      });
    }, 300);

    return () => {
      spin.stop();
      clearInterval(interval);
    };
  }, [spinAnim, progressAnim]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setShowModal(true);

    const cleanup = startLoadingAnimation();

    try {
      const res = await growthApi.analysis(childId);
      const raw: unknown = res.data?.data;
      const parsed = parseGrowthAnalysis(raw);

      if (!parsed) {
        setError('분석 결과를 처리할 수 없습니다.');
        return;
      }

      // Complete the progress bar
      setProgress(100);
      progressAnim.setValue(1);
      setResult(parsed);
    } catch {
      setError('성장 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      cleanup();
      setLoading(false);
    }
  };

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const allMetrics = [
    ...(result?.growthMetrics ?? []),
    ...(result?.trackerMetrics ?? []),
  ];

  return (
    <>
      {/* Analysis Button */}
      <TouchableOpacity
        style={gaStyles.analyzeBtn}
        onPress={handleAnalyze}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#4ECDC4', '#2BA89E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={gaStyles.analyzeBtnGradient}
        >
          <Image source={require('../../assets/quick-report.png')} style={gaStyles.analyzeBtnImg} resizeMode="contain" />
          <Text style={gaStyles.analyzeBtnText}>성장 분석하기</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Analysis Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (!loading) setShowModal(false);
        }}
      >
        <View style={gaStyles.modalContainer}>
          {/* Header */}
          <View style={gaStyles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                if (!loading) setShowModal(false);
              }}
              disabled={loading}
            >
              <Text style={[gaStyles.modalClose, loading && { opacity: 0.3 }]}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={gaStyles.modalTitle}>성장 분석</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={gaStyles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Loading State */}
            {loading && (
              <View style={gaStyles.loadingWrap}>
                <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
                  <Text style={gaStyles.loadingSpinner}>{'🔍'}</Text>
                </Animated.View>
                <Text style={gaStyles.loadingTitle}>
                  아이의 성장 데이터를 분석하고 있어요...
                </Text>
                <Text style={gaStyles.loadingSubtitle}>
                  AI가 성장 패턴을 꼼꼼히 살펴보고 있어요
                </Text>
                {/* Progress Bar */}
                <View style={gaStyles.progressBarBg}>
                  <Animated.View
                    style={[gaStyles.progressBarFill, { width: progressWidth as Animated.AnimatedInterpolation<string> }]}
                  />
                </View>
                <Text style={gaStyles.progressText}>
                  {Math.min(Math.round(progress), 100)}%
                </Text>
              </View>
            )}

            {/* Error State */}
            {!loading && error && (
              <View style={gaStyles.errorWrap}>
                <Text style={gaStyles.errorIcon}>{'⚠️'}</Text>
                <Text style={gaStyles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={gaStyles.retryBtn}
                  onPress={handleAnalyze}
                >
                  <Text style={gaStyles.retryBtnText}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Result State */}
            {!loading && !error && result && (
              <View>
                {/* Overall Summary */}
                <LinearGradient
                  colors={['#FF8C5A', '#FFB88C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={gaStyles.summaryCard}
                >
                  {result.ageLabel ? (
                    <Text style={gaStyles.summaryAge}>{result.ageLabel}</Text>
                  ) : null}
                  <Text style={gaStyles.summaryTitle}>종합 분석</Text>
                  <Text style={gaStyles.summaryText}>{result.overallSummary}</Text>
                </LinearGradient>

                {/* Metrics */}
                {allMetrics.length > 0 && (
                  <View>
                    <Text style={gaStyles.sectionTitle}>상세 항목</Text>
                    {allMetrics.map((item, idx) => {
                      const levelColor = getLevelColor(item.level);
                      return (
                        <View key={`${item.metric}-${idx}`} style={gaStyles.metricCard}>
                          {/* Metric Header */}
                          <View style={gaStyles.metricHeader}>
                            <Text style={gaStyles.metricEmoji}>{item.emoji}</Text>
                            <View style={gaStyles.metricTitleWrap}>
                              <Text style={gaStyles.metricTitle}>{item.title}</Text>
                              {item.percentileLabel ? (
                                <Text style={gaStyles.metricPercentile}>
                                  {item.percentileLabel}
                                </Text>
                              ) : null}
                            </View>
                            <View style={[gaStyles.levelBadge, { backgroundColor: levelColor.bg }]}>
                              <Text style={[gaStyles.levelBadgeText, { color: levelColor.text }]}>
                                {getLevelLabel(item.level)}
                              </Text>
                            </View>
                          </View>
                          {/* Comment */}
                          <Text style={gaStyles.metricComment}>{item.comment}</Text>
                          {/* Advice */}
                          <View style={gaStyles.adviceBox}>
                            <Text style={gaStyles.adviceIcon}>{'💡'}</Text>
                            <Text style={gaStyles.adviceText}>{item.advice}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const gaStyles = StyleSheet.create({
  analyzeBtn: {
    marginBottom: SPACING.md,
  },
  analyzeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    gap: SPACING.sm,
  },
  analyzeBtnIcon: {
    fontSize: 20,
  },
  analyzeBtnImg: {
    width: 22,
    height: 22,
  },
  analyzeBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    ...SHADOWS.soft,
  },
  modalClose: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
    paddingRight: SPACING.sm,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  /* Loading */
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  loadingSpinner: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  loadingTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  loadingSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  progressBarBg: {
    width: '80%',
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  /* Error */
  errorWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  /* Summary */
  summaryCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  summaryAge: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
  },
  summaryText: {
    fontSize: FONT_SIZE.sm,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  /* Section */
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  /* Metric Card */
  metricCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  metricEmoji: {
    fontSize: 28,
    marginRight: SPACING.sm,
  },
  metricTitleWrap: {
    flex: 1,
  },
  metricTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  metricPercentile: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  levelBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  metricComment: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  adviceBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  adviceIcon: {
    fontSize: 16,
  },
  adviceText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

function PhysicalTab({ childName }: { childName: string }) {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [recordDate, setRecordDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<{ date: string; height?: number; weight?: number }[]>([]);

  const initialHeight = selectedChild?.height ?? null;
  const initialWeight = selectedChild?.weight ?? null;
  const ageMonths = selectedChild?.ageInfo.months ?? 0;
  const gender = selectedChild?.gender ?? 'M';
  const ageLabel = selectedChild?.ageInfo.label ?? '';

  // 로컬 기록 로드
  useEffect(() => {
    if (!selectedChild) return;
    const loadRecords = async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const key = `growth_records_${selectedChild.id}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) setRecords(JSON.parse(stored) as typeof records);
      } catch { /* ignore */ }
    };
    loadRecords();
  }, [selectedChild?.id]);

  const standard = useMemo(
    () => getClosestStandard(ageMonths, gender),
    [ageMonths, gender],
  );

  const heightPercentile = useMemo(() => {
    if (!initialHeight || !standard) return null;
    return calculatePercentile(initialHeight, standard.height);
  }, [initialHeight, standard]);

  const weightPercentile = useMemo(() => {
    if (!initialWeight || !standard) return null;
    return calculatePercentile(initialWeight, standard.weight);
  }, [initialWeight, standard]);

  const genderLabel = gender === 'M' ? '남아' : '여아';

  const handleSave = async () => {
    if (!height && !weight) {
      Alert.alert('알림', '키 또는 몸무게를 입력해주세요');
      return;
    }
    if (!selectedChild) return;
    setSaving(true);
    try {
      const newRecord = {
        date: recordDate,
        height: height ? parseFloat(height) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
      };
      const updated = [...records.filter((r) => r.date !== recordDate), newRecord].sort(
        (a, b) => a.date.localeCompare(b.date),
      );
      setRecords(updated);
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(`growth_records_${selectedChild.id}`, JSON.stringify(updated));
      Alert.alert('저장 완료', `${recordDate} 성장 기록이 저장되었습니다`);
      setHeight('');
      setWeight('');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      {/* Initial record from onboarding */}
      {(initialHeight || initialWeight) ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>첫 기록 ({ageLabel})</Text>
          <View style={styles.statsRow}>
            <StatBox
              label="키"
              value={initialHeight ? `${initialHeight}cm` : '-- cm'}
              color={COLORS.secondary}
            />
            <StatBox
              label="몸무게"
              value={initialWeight ? `${initialWeight}kg` : '-- kg'}
              color={COLORS.primary}
            />
          </View>

          {/* Percentile display */}
          {(heightPercentile !== null || weightPercentile !== null) ? (
            <View style={pStyles.percentileWrap}>
              <Text style={pStyles.percentileHeader}>
                동 개월 {genderLabel} 대비
              </Text>
              {heightPercentile !== null && initialHeight ? (
                <View style={pStyles.percentileRow}>
                  <Text style={pStyles.percentileLabel}>키</Text>
                  <View style={pStyles.barBg}>
                    <View
                      style={[
                        pStyles.barFill,
                        { width: `${Math.max(5, 100 - heightPercentile)}%` },
                      ]}
                    />
                  </View>
                  <Text style={pStyles.percentileValue}>
                    {getPercentileLabel(heightPercentile)}
                  </Text>
                </View>
              ) : null}
              {weightPercentile !== null && initialWeight ? (
                <View style={pStyles.percentileRow}>
                  <Text style={pStyles.percentileLabel}>몸무게</Text>
                  <View style={pStyles.barBg}>
                    <View
                      style={[
                        pStyles.barFill,
                        { width: `${Math.max(5, 100 - weightPercentile)}%`, backgroundColor: COLORS.primary },
                      ]}
                    />
                  </View>
                  <Text style={pStyles.percentileValue}>
                    {getPercentileLabel(weightPercentile)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Growth Analysis Button */}
      {selectedChild ? (
        <GrowthAnalysisSection childId={selectedChild.id} />
      ) : null}

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
          <StatBox
            label="키"
            value={initialHeight ? `${initialHeight}cm` : '-- cm'}
            color={COLORS.secondary}
          />
          <StatBox
            label="몸무게"
            value={initialWeight ? `${initialWeight}kg` : '-- kg'}
            color={COLORS.primary}
          />
          <StatBox label="성장 점수" value="--" color={COLORS.info} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>기록 입력</Text>
        {/* 날짜 입력 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>측정 날짜</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textLight}
            value={recordDate}
            onChangeText={setRecordDate}
            maxLength={10}
          />
        </View>
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
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '기록 저장'}</Text>
        </TouchableOpacity>
      </View>

      {/* 기록 히스토리 */}
      {records.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>성장 기록 내역</Text>
          {records.slice().reverse().map((rec) => (
            <View key={rec.date} style={styles.recordRow}>
              <Text style={styles.recordDate}>{rec.date}</Text>
              <Text style={styles.recordValue}>
                {rec.height ? `${rec.height}cm` : '--'} / {rec.weight ? `${rec.weight}kg` : '--'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const pStyles = StyleSheet.create({
  percentileWrap: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  percentileHeader: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  percentileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  percentileLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    width: 44,
  },
  barBg: {
    flex: 1,
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: 10,
    backgroundColor: COLORS.secondary,
    borderRadius: 5,
  },
  percentileValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.primary,
    width: 72,
    textAlign: 'right',
  },
});

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
          <Image source={require('../../assets/trait-analyst-small.png')} style={styles.traitIconImg} resizeMode="contain" />
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
              <View key={idx} style={traitInsightStyles.row}>
                <View style={traitInsightStyles.dot} />
                {idx < insights.length - 1 && <View style={traitInsightStyles.line} />}
                <View style={traitInsightStyles.content}>
                  <Text style={traitInsightStyles.week}>{item.weekLabel}</Text>
                  <Text style={traitInsightStyles.insight}>{item.insight}</Text>
                  <Text style={traitInsightStyles.reason}>{item.reason}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Milestone Defaults                                                  */
/* ------------------------------------------------------------------ */

function getAgeLabel(months: number): string {
  if (months <= 6) return '0~6개월';
  if (months <= 12) return '7~12개월';
  if (months <= 18) return '13~18개월';
  if (months <= 24) return '19~24개월';
  if (months <= 36) return '25~36개월';
  if (months <= 48) return '3~4세';
  if (months <= 60) return '4~5세';
  if (months <= 72) return '5~6세';
  if (months <= 96) return '초등 저학년';
  return '초등 고학년';
}

function getDefaultMilestones(months: number): MilestoneItem[] {
  const m = (id: string, label: string, domain: string, description: string): MilestoneItem =>
    ({ id, label, domain, description, completed: false });

  if (months <= 6) return [
    m('d0-1', '목을 가눌 수 있어요', '대근육', '엎드린 자세에서 머리를 들고 유지할 수 있는지 확인해보세요'),
    m('d0-2', '뒤집기를 해요', '대근육', '등에서 배로 또는 배에서 등으로 뒤집는 동작을 해요'),
    m('d0-3', '물건을 손으로 잡아요', '소근육', '장난감이나 손가락을 움켜쥘 수 있어요'),
    m('d0-4', '옹알이를 해요', '언어', '"아~", "우~" 같은 모음 소리를 내요'),
    m('d0-5', '소리 나는 쪽을 바라봐요', '인지', '소리가 나면 고개를 돌려 찾아봐요'),
    m('d0-6', '눈을 맞추고 미소 지어요', '사회성', '얼굴을 보고 사회적 미소를 보여요'),
    m('d0-7', '손을 입으로 가져가요', '소근육', '자신의 손을 탐색하며 입에 넣어요'),
    m('d0-8', '익숙한 사람을 알아봐요', '사회성', '엄마 아빠를 보면 반가워해요'),
    m('d0-9', '딸랑이를 흔들어요', '소근육', '손에 쥔 물건을 흔드는 동작을 해요'),
    m('d0-10', '배밀이를 시도해요', '대근육', '엎드린 자세에서 팔다리를 움직여 이동하려 해요'),
  ];
  if (months <= 12) return [
    m('d1-1', '혼자 앉을 수 있어요', '대근육', '도움 없이 앉은 자세를 유지해요'),
    m('d1-2', '기어다녀요', '대근육', '네발로 기어서 이동할 수 있어요'),
    m('d1-3', '잡고 서기를 해요', '대근육', '가구를 잡고 일어설 수 있어요'),
    m('d1-4', '집게 손가락으로 잡아요', '소근육', '엄지와 검지로 작은 물건을 집어요'),
    m('d1-5', '"맘마", "다다" 말해요', '언어', '의미 있는 첫 단어를 말하기 시작해요'),
    m('d1-6', '까꿍 놀이를 이해해요', '인지', '숨었다 나타나면 웃으며 반응해요'),
    m('d1-7', '낯가림을 해요', '사회성', '낯선 사람을 보면 불안해하거나 울어요'),
    m('d1-8', '"안돼"를 이해해요', '언어', '"안돼"라고 하면 동작을 멈추거나 반응해요'),
    m('d1-9', '컵으로 마실 수 있어요', '자조', '도움을 받아 컵으로 물을 마셔요'),
    m('d1-10', '손가락으로 가리켜요', '인지', '원하는 것을 손가락으로 가리켜 표현해요'),
  ];
  if (months <= 18) return [
    m('d2-1', '혼자 걸어요', '대근육', '도움 없이 여러 걸음을 걸을 수 있어요'),
    m('d2-2', '블록 2~3개를 쌓아요', '소근육', '작은 블록을 위로 쌓을 수 있어요'),
    m('d2-3', '숟가락을 사용해요', '자조', '숟가락으로 음식을 떠서 입에 넣으려 시도해요'),
    m('d2-4', '단어를 3개 이상 말해요', '언어', '"엄마", "아빠", "맘마" 등 의미 있는 단어를 사용해요'),
    m('d2-5', '간단한 지시를 따라요', '인지', '"공 가져와", "여기 앉아" 등을 이해하고 따라요'),
    m('d2-6', '모방 놀이를 해요', '사회성', '전화 받는 흉내, 청소하는 흉내를 내요'),
    m('d2-7', '계단을 기어 올라가요', '대근육', '네발로 기어서 계단을 올라갈 수 있어요'),
    m('d2-8', '끼적이기를 해요', '소근육', '크레용이나 연필로 종이에 자유롭게 그어요'),
    m('d2-9', '신발을 벗으려 시도해요', '자조', '신발이나 양말을 벗으려는 시도를 해요'),
    m('d2-10', '거울 속 자기를 알아봐요', '인지', '거울을 보고 자기 모습을 인식해요'),
  ];
  if (months <= 24) return [
    m('d3-1', '뛰기를 시작해요', '대근육', '두 발로 뛰거나 빠르게 걸어요'),
    m('d3-2', '공을 발로 차요', '대근육', '서 있는 자세에서 공을 발로 찰 수 있어요'),
    m('d3-3', '두 단어를 조합해요', '언어', '"엄마 줘", "물 줘" 같은 두 단어 문장을 만들어요'),
    m('d3-4', '뚜껑을 열고 닫아요', '소근육', '병뚜껑이나 상자 뚜껑을 돌려 열어요'),
    m('d3-5', '색깔 1~2개를 구분해요', '인지', '"빨간색 줘"라고 하면 맞는 색을 고를 수 있어요'),
    m('d3-6', '또래에 관심을 보여요', '사회성', '다른 아이를 관찰하거나 옆에서 놀아요'),
    m('d3-7', '세로선을 따라 그어요', '소근육', '위에서 아래로 선을 그을 수 있어요'),
    m('d3-8', '혼자 손을 씻으려 해요', '자조', '수도꼭지를 틀고 손을 비비는 시도를 해요'),
    m('d3-9', '자기 이름에 반응해요', '언어', '이름을 부르면 "네" 하고 반응해요'),
    m('d3-10', '감정 표현이 다양해요', '정서', '기쁨, 슬픔, 화남 등을 표정과 몸짓으로 표현해요'),
  ];
  if (months <= 36) return [
    m('d4-1', '한 발로 잠깐 서요', '대근육', '한 발로 1~2초 균형을 잡을 수 있어요'),
    m('d4-2', '세발자전거를 타요', '대근육', '페달을 밟아 세발자전거를 움직일 수 있어요'),
    m('d4-3', '가위질을 시도해요', '소근육', '안전 가위로 종이를 자르려 시도해요'),
    m('d4-4', '원을 그릴 수 있어요', '소근육', '동그라미 모양을 그릴 수 있어요'),
    m('d4-5', '3~4단어 문장을 말해요', '언어', '"나 과자 먹고 싶어"처럼 긴 문장을 사용해요'),
    m('d4-6', '1~5까지 세어요', '인지', '물건을 하나씩 가리키며 숫자를 세요'),
    m('d4-7', '차례를 지킬 수 있어요', '사회성', '놀이에서 순서를 기다릴 수 있어요'),
    m('d4-8', '혼자 옷을 입으려 해요', '자조', '간단한 옷을 혼자 입거나 벗으려 시도해요'),
    m('d4-9', '친구 이름을 기억해요', '사회성', '함께 노는 친구의 이름을 말할 수 있어요'),
    m('d4-10', '왜? 질문을 자주 해요', '인지', '"왜?" "뭐야?"라는 질문을 반복해요'),
  ];
  if (months <= 48) return [
    m('d5-1', '한 발로 뛸 수 있어요', '대근육', '한 발로 여러 번 점프할 수 있어요'),
    m('d5-2', '공을 던지고 받아요', '대근육', '두 손으로 공을 받을 수 있어요'),
    m('d5-3', '사각형을 그려요', '소근육', '네모 모양을 그릴 수 있어요'),
    m('d5-4', '단추를 끼울 수 있어요', '자조', '큰 단추를 스스로 끼울 수 있어요'),
    m('d5-5', '이야기를 만들어요', '언어', '간단한 이야기를 순서대로 말할 수 있어요'),
    m('d5-6', '기본 도형을 구분해요', '인지', '동그라미, 세모, 네모를 구분해요'),
    m('d5-7', '규칙 있는 놀이를 해요', '사회성', '숨바꼭질, 보드게임 등 규칙을 따라요'),
    m('d5-8', '혼자 화장실을 가요', '자조', '도움 없이 화장실을 사용할 수 있어요'),
    m('d5-9', '과거 경험을 이야기해요', '인지', '"어제 공원 갔었어"처럼 과거를 말해요'),
    m('d5-10', '친구와 협력 놀이를 해요', '사회성', '역할을 나눠서 함께 놀 수 있어요'),
  ];
  if (months <= 72) return [
    m('d6-1', '줄넘기를 할 수 있어요', '대근육', '줄넘기를 연속으로 여러 번 넘을 수 있어요'),
    m('d6-2', '자기 이름을 ��요', '소근육', '한글로 자기 이름을 쓸 수 있어요'),
    m('d6-3', '긴 문장으로 설명해요', '언어', '경험이나 느낌을 여러 문장으로 설명해요'),
    m('d6-4', '10까지 세고 더해요', '인지', '간단한 덧셈과 뺄셈을 할 수 있어요'),
    m('d6-5', '친구와 갈등을 해결해요', '사회성', '말로 문제를 해결하려 시도해요'),
    m('d6-6', '자기감정을 말로 표현해요', '정서', '"화가 나", "슬퍼"라고 말할 수 있어요'),
    m('d6-7', '가위로 모양을 오려요', '소근육', '선을 따라 정확하게 오릴 수 있어요'),
    m('d6-8', '혼자 세수하고 양치해요', '자조', '아침저녁 위생 습관을 스스로 해요'),
    m('d6-9', '시계 개념을 이해해요', '인지', '"3시", "점심시간" 같은 시간 개념을 알아요'),
    m('d6-10', '상대 감정을 이해해요', '정서', '친구가 울면 위로하려는 행동을 해요'),
  ];
  // 초등 이상
  return [
    m('d7-1', '복잡한 운동을 해요', '대근육', '수영, 자전거, 구기 운동 등을 할 수 있어요'),
    m('d7-2', '글씨를 정교하게 써요', '소근육', '알아보기 쉽게 또박또박 글을 써요'),
    m('d7-3', '독서를 즐겨요', '언어', '혼자서 책을 읽고 내용을 이해해요'),
    m('d7-4', '문제 해결 능력이 있어요', '인지', '스스로 방법을 찾아 문제를 해결해요'),
    m('d7-5', '또래 관계를 잘 맺어요', '사회성', '친구를 사귀고 우정을 유지해요'),
    m('d7-6', '감정 조절을 해요', '정서', '화가 나도 참고 적절히 표현해요'),
    m('d7-7', '일기나 편지를 써요', '언어', '자기 생각을 글로 표현할 수 있어요'),
    m('d7-8', '스스로 준비물을 챙겨요', '자조', '학교 가방을 스스로 정리해요'),
    m('d7-9', '시간 관리를 시도해요', '인지', '숙제 시간, 놀이 시간을 스스로 계획해요'),
    m('d7-10', '단체 활동에 참여해요', '사회성', '학교 활동이나 동아리에 적극 참여해요'),
  ];
}

/* ------------------------------------------------------------------ */
/* Milestones Tab                                                      */
/* ------------------------------------------------------------------ */

function MilestonesTab() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [loading, setLoading] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneData | null>(null);
  const [error, setError] = useState(false);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    setToggled({});

    const months = selectedChild.ageInfo?.months ?? 0;

    coachingApi
      .milestones(selectedChild.id)
      .then((res) => {
        const raw = res.data?.data;
        if (!raw || typeof raw !== 'object') return;
        const rawObj = raw as Record<string, unknown>;
        const items = Array.isArray(rawObj.items)
          ? (rawObj.items as MilestoneItem[])
          : [];
        const parsed: MilestoneData = {
          ageLabel: typeof rawObj.ageLabel === 'string' ? rawObj.ageLabel : '',
          items: items.length > 0 ? items : getDefaultMilestones(months),
          nextMilestone: typeof rawObj.nextMilestone === 'string' ? rawObj.nextMilestone : '',
          daysUntilNext: typeof rawObj.daysUntilNext === 'number' ? rawObj.daysUntilNext : 0,
        };
        if (!parsed.ageLabel) parsed.ageLabel = getAgeLabel(months);
        setMilestones(parsed);
        const initial: Record<string, boolean> = {};
        parsed.items.forEach((item) => { initial[item.id] = item.completed; });
        setToggled(initial);
      })
      .catch(() => {
        // API 실패 시 기본 체크리스트 표시
        const fallback = getDefaultMilestones(months);
        setMilestones({
          ageLabel: getAgeLabel(months),
          items: fallback,
          nextMilestone: '',
          daysUntilNext: 0,
        });
        const initial: Record<string, boolean> = {};
        fallback.forEach((item) => { initial[item.id] = false; });
        setToggled(initial);
        setError(false);
      })
      .finally(() => setLoading(false));
  }, [selectedChild?.id]);

  // 토글 후 1초 뒤 자동 저장 (디바운스)
  const saveToServer = useCallback((checks: Record<string, boolean>) => {
    if (!selectedChild) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      coachingApi.saveMilestoneChecks(selectedChild.id, checks).catch(() => {});
    }, 1000);
  }, [selectedChild]);

  const handleToggle = (id: string) => {
    setToggled((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveToServer(next);
      return next;
    });
  };

  if (loading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !milestones) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'📋'}</Text>
          <Text style={styles.emptyText}>
            발달 체크리스트를 불러올 수 없습니다
          </Text>
        </View>
      </View>
    );
  }

  const items = milestones.items ?? [];
  const completedCount = items.filter((item) => toggled[item.id]).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  // 서버에서 domain이 내려오므로 직접 매핑
  const DOMAIN_STYLE: Record<string, { emoji: string; color: string }> = {
    '대근육': { emoji: '🏃', color: '#FF8C5A' },
    '소근육': { emoji: '✋', color: '#E91E63' },
    '언어': { emoji: '💬', color: '#4285F4' },
    '인지': { emoji: '🧠', color: '#9B59B6' },
    '사회성': { emoji: '🤝', color: '#2BA89E' },
    '정서': { emoji: '💛', color: '#F5A623' },
    '자조': { emoji: '🧹', color: '#78909C' },
  };

  function getDomainTag(item: MilestoneItem) {
    const style = DOMAIN_STYLE[item.domain];
    if (style) return { ...style, label: item.domain };
    return { emoji: '📋', label: item.domain || '발달', color: '#8C7A6B' };
  }

  // 발달 진행 요약 통계
  const domainCounts: Record<string, { total: number; done: number }> = {};
  items.forEach((item) => {
    const tag = getDomainTag(item);
    if (!domainCounts[tag.label]) domainCounts[tag.label] = { total: 0, done: 0 };
    domainCounts[tag.label].total += 1;
    if (toggled[item.id]) domainCounts[tag.label].done += 1;
  });

  const domainSummary = Object.entries(domainCounts).map(([label, counts]) => ({
    label,
    ...counts,
    emoji: DOMAIN_STYLE[label]?.emoji ?? '📋',
    color: DOMAIN_STYLE[label]?.color ?? '#8C7A6B',
  }));

  return (
    <View>
      {/* Current Milestone Card */}
      <LinearGradient
        colors={['#FF8C5A', '#FFB88C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={msStyles.gradientCard}
      >
        <Text style={msStyles.gradientTitle}>
          {milestones.ageLabel} 발달 체크
        </Text>
        <View style={msStyles.progressRow}>
          <View style={msStyles.progressBarBg}>
            <View
              style={[msStyles.progressBarFill, { width: `${progress * 100}%` }]}
            />
          </View>
          <Text style={msStyles.progressText}>
            {completedCount}/{totalCount}
          </Text>
        </View>
        <Text style={msStyles.progressHint}>
          {progress >= 1
            ? '모든 발달 항목을 달성했어요!'
            : progress >= 0.7
            ? '순조롭게 발달하고 있어요!'
            : '천천히 아이 속도에 맞춰주세요'}
        </Text>
      </LinearGradient>

      {/* 영역별 발달 현황 */}
      {domainSummary.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>영역별 발달 현황</Text>
          <View style={msStyles.domainGrid}>
            {domainSummary.map((d) => {
              const domainProgress = d.total > 0 ? d.done / d.total : 0;
              return (
                <View key={d.label} style={msStyles.domainItem}>
                  <Text style={msStyles.domainEmoji}>{d.emoji}</Text>
                  <Text style={msStyles.domainLabel}>{d.label}</Text>
                  <View style={msStyles.domainBarBg}>
                    <View
                      style={[
                        msStyles.domainBarFill,
                        { width: `${domainProgress * 100}%`, backgroundColor: d.color },
                      ]}
                    />
                  </View>
                  <Text style={[msStyles.domainCount, { color: d.color }]}>
                    {d.done}/{d.total}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Checklist */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>발달 체크리스트</Text>
        <Text style={msStyles.checkHint}>항목을 눌러 체크하고, 다시 눌러 확인 방법을 보세요</Text>
        {items.map((item) => {
          const tag = getDomainTag(item);
          const done = toggled[item.id] ?? false;
          const isExpanded = expandedId === item.id;
          return (
            <View key={item.id}>
              <TouchableOpacity
                style={msStyles.checkRow}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                activeOpacity={0.7}
              >
                <TouchableOpacity onPress={() => handleToggle(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={msStyles.checkIcon}>
                    {done ? '✅' : '⬜'}
                  </Text>
                </TouchableOpacity>
                <View style={msStyles.checkContent}>
                  <Text
                    style={[
                      msStyles.checkLabel,
                      done && msStyles.checkLabelDone,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <View style={[msStyles.domainBadge, { backgroundColor: tag.color + '18' }]}>
                    <Text style={[msStyles.domainBadgeText, { color: tag.color }]}>
                      {tag.emoji} {tag.label}
                    </Text>
                  </View>
                </View>
                <Text style={msStyles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {isExpanded && (
                <View style={msStyles.descBox}>
                  <Text style={msStyles.descIcon}>{'💡'}</Text>
                  <Text style={msStyles.descText}>{item.description}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* 발달 팁 카드 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{'💡 발달 촉진 팁'}</Text>
        <View style={msStyles.tipCard}>
          <Text style={msStyles.tipTitle}>{'이 시기에 중요한 것'}</Text>
          <Text style={msStyles.tipBody}>
            {progress < 0.5
              ? '아직 달성하지 못한 항목이 있어도 걱정하지 마세요. 아이마다 발달 속도가 달라요. 충분한 놀이와 상호작용이 가장 좋은 자극이에요.'
              : '많은 항목을 달성했네요! 이 시기에는 다양한 경험을 제공해주는 것이 중요해요. 새로운 장난감, 바깥 활동, 또래 놀이를 시도해보세요.'}
          </Text>
        </View>
        <View style={msStyles.tipCard}>
          <Text style={msStyles.tipTitle}>{'부모가 도와줄 수 있는 것'}</Text>
          <Text style={msStyles.tipBody}>
            {completedCount < totalCount
              ? '미달성 항목은 아이와 함께 놀이하면서 자연스럽게 연습해보세요. 강요하지 않고, 아이가 흥미를 보일 때 격려해주는 것이 효과적이에요.'
              : '모든 항목을 달성했다면 다음 단계의 발달을 준비해보세요. 조금 더 도전적인 활동으로 자연스럽게 이어가면 좋아요.'}
          </Text>
        </View>
      </View>

      {/* Next Milestone */}
      <LinearGradient
        colors={['#7DD3B8', '#A8E6CF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={msStyles.nextCard}
      >
        <Text style={msStyles.nextLabel}>다음 목표</Text>
        <Text style={msStyles.nextTitle}>{milestones.nextMilestone}</Text>
        <View style={msStyles.ddayBadge}>
          <Text style={msStyles.ddayText}>
            D-{milestones.daysUntilNext}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const msStyles = StyleSheet.create({
  gradientCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  gradientTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressHint: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: SPACING.xs,
    fontWeight: '500',
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  domainItem: {
    width: '47%' as unknown as number,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    alignItems: 'center',
  },
  domainEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  domainLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  domainBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#EEE',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  domainBarFill: {
    height: 6,
    borderRadius: 3,
  },
  domainCount: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  checkHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  checkIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  checkContent: {
    flex: 1,
  },
  checkLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    flex: 1,
    lineHeight: 22,
  },
  checkLabelDone: {
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  domainBadge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  domainBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  expandArrow: {
    fontSize: 10,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  descBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8F0',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginLeft: 36,
    gap: 8,
  },
  descIcon: {
    fontSize: 16,
  },
  descText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  tipCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  tipTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  tipBody: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  nextCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  nextLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  nextTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  ddayBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  ddayText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

const traitInsightStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginTop: 4,
    marginRight: SPACING.md,
    zIndex: 1,
  },
  line: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: -SPACING.md,
    width: 2,
    backgroundColor: COLORS.primaryLight,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  week: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  insight: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  reason: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
});

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
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  recordDate: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  recordValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  traitInfo: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  traitIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  traitIconImg: {
    width: 44,
    height: 44,
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
});

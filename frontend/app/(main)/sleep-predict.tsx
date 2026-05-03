import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useChildStore } from '../../stores/childStore';
import { sleepApi } from '../../services/api';
import { AdSlot } from '../../components/ads/AdSlot';
import type { ImageSourcePropType } from 'react-native';

const IC_SLEEP = require('../../assets/quick-sleep.png') as ImageSourcePropType;
const IC_REPORT = require('../../assets/quick-report.png') as ImageSourcePropType;
const IC_DIARY = require('../../assets/child-diary.png') as ImageSourcePropType;
const IC_NIGHT = require('../../assets/weather-night.png') as ImageSourcePropType;
const IC_REDFLAG = require('../../assets/icon-redflag.png') as ImageSourcePropType;
const IC_CLOCK = require('../../assets/contraction-clock.png') as ImageSourcePropType;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface SleepWindow {
  label: string;
  time: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

interface SleepPrediction {
  nextNap: SleepWindow | null;
  bedtime: SleepWindow | null;
  tips: string[];
  avgSleepHours: string;
  sleepPattern?: {
    ageLabel: string;
    totalSleep: string;
    nightSleep: string;
    napCount: string;
    napDuration: string;
    wakeWindow: string;
    commonIssues: string[];
  };
}

interface PredictResponse {
  insufficient: boolean;
  message?: string;
  prediction?: SleepPrediction;
  recommendation?: Record<string, unknown>;
  dataCount: number;
  requiredCount?: number;
  source?: 'db' | 'cache' | 'ai';
}

interface HistoryItem {
  id: string;
  prediction: SleepPrediction;
  createdAt: string;
  trackingData?: { avgSleepHours?: number; avgBedtime?: string; dataCount: number };
}

const COLOR = {
  bg: '#0D1B3E',
  card: '#162044',
  cardLight: '#1E2D5A',
  accent: '#7B9EFF',
  accentSoft: '#4A6BBF',
  text: '#FFFFFF',
  textSub: '#8B9CC7',
  gold: '#FFD76E',
  green: '#6DD5A0',
  orange: '#FFB06B',
  red: '#FF6B6B',
  warn: '#FF9F43',
};

const CONFIDENCE_COLOR = { high: COLOR.green, medium: COLOR.gold, low: COLOR.orange };
const CONFIDENCE_LABEL = { high: '높음', medium: '보통', low: '낮음' };

const SOURCE_LABEL = { db: 'DB 기반', cache: '캐시', ai: 'AI 분석' };

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function SleepPredictScreen() {
  const insets = useSafeAreaInsets();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchPrediction = useCallback(async () => {
    if (!selectedChild) return;
    setLoading(true);
    try {
      const res = await sleepApi.predict(selectedChild.id);
      const data = res.data?.data as PredictResponse;
      setResult(data);
    } catch {
      setResult({
        insufficient: true,
        message: '수면 예측을 불러오는 중 오류가 발생했어요. 다시 시도해주세요.',
        dataCount: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedChild]);

  const fetchHistory = useCallback(async () => {
    if (!selectedChild) return;
    try {
      const res = await sleepApi.history(selectedChild.id);
      const data = res.data?.data as { history: HistoryItem[] };
      setHistory(data?.history ?? []);
    } catch { /* ignore */ }
  }, [selectedChild]);

  useEffect(() => {
    fetchPrediction();
    fetchHistory();
  }, [fetchPrediction, fetchHistory]);

  const renderWindow = (w: SleepWindow) => {
    const confColor = CONFIDENCE_COLOR[w.confidence];
    return (
      <View style={styles.windowCard} key={w.label}>
        <View style={styles.windowHeader}>
          <Text style={styles.windowLabel}>{w.label}</Text>
          <View style={[styles.confBadge, { backgroundColor: confColor + '30' }]}>
            <View style={[styles.confDot, { backgroundColor: confColor }]} />
            <Text style={[styles.confText, { color: confColor }]}>
              정확도 {CONFIDENCE_LABEL[w.confidence]}
            </Text>
          </View>
        </View>
        <Text style={styles.windowTime}>{w.time}</Text>
        <Text style={styles.windowReason}>{w.reason}</Text>
      </View>
    );
  };

  const pred = result?.prediction;
  const rec = result?.recommendation as Record<string, unknown> | undefined;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Image source={IC_SLEEP} style={styles.titleIconImg} resizeMode="contain" />
              <Text style={styles.title}>{' AI 수면 예측'}</Text>
            </View>
            <Text style={styles.subtitle}>
              {selectedChild?.name ?? '아이'}의 수면 패턴을 분석합니다
            </Text>
          </View>
          {result?.source && (
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceText}>{SOURCE_LABEL[result.source] ?? ''}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLOR.accent} />
            <Text style={styles.loadingText}>수면 패턴 분석 중...</Text>
          </View>
        ) : result?.insufficient ? (
          /* 데이터 부족 화면 */
          <View style={styles.insufficientWrap}>
            <Image
              source={require('../../assets/weather-night.png')}
              style={styles.insufficientImage}
              resizeMode="contain"
            />
            <Text style={styles.insufficientTitle}>
              데이터가 부족해요
            </Text>
            <Text style={styles.insufficientMsg}>{result.message}</Text>

            {result.requiredCount && (
              <View style={styles.progressBox}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, {
                    width: `${Math.min((result.dataCount / result.requiredCount) * 100, 100)}%`,
                  }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {result.dataCount}/{result.requiredCount}일 기록 완료
                </Text>
              </View>
            )}

            {/* DB 기반 기본 권장 정보 표시 */}
            {rec && (
              <View style={styles.recCard}>
                <Text style={styles.recTitle}>
                  {`${rec.ageLabel as string} 수면 가이드`}
                </Text>
                <View style={styles.recRow}>
                  <Text style={styles.recLabel}>총 수면</Text>
                  <Text style={styles.recValue}>{rec.totalSleep as string}</Text>
                </View>
                <View style={styles.recRow}>
                  <Text style={styles.recLabel}>야간 수면</Text>
                  <Text style={styles.recValue}>{rec.nightSleep as string}</Text>
                </View>
                <View style={styles.recRow}>
                  <Text style={styles.recLabel}>낮잠</Text>
                  <Text style={styles.recValue}>{rec.napCount as string}</Text>
                </View>
                <View style={styles.recRow}>
                  <Text style={styles.recLabel}>권장 취침</Text>
                  <Text style={styles.recValue}>{rec.bedtime as string}</Text>
                </View>

                {(rec.tips as string[])?.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Text style={styles.tipNum}>{i + 1}</Text>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}

                {(rec.commonIssues as string[])?.length > 0 && (
                  <>
                    <Text style={styles.issueTitle}>흔한 수면 문제</Text>
                    {(rec.commonIssues as string[]).map((issue, i) => (
                      <Text key={i} style={styles.issueText}>{'•'} {issue}</Text>
                    ))}
                  </>
                )}
              </View>
            )}
          </View>
        ) : pred ? (
          <>
            {/* 데이터 수 표시 */}
            {result.message && (
              <View style={styles.dataNotice}>
                <Text style={styles.dataNoticeText}>{result.message}</Text>
              </View>
            )}

            {/* 요약 카드 */}
            <LinearGradient colors={['#2A3F7A', '#1E2D5A']} style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Image source={IC_SLEEP} style={styles.summaryIconImg} resizeMode="contain" />
                  <Text style={styles.summaryLabel}>평균 수면</Text>
                  <Text style={styles.summaryValue}>{pred.avgSleepHours}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Image source={IC_REPORT} style={styles.summaryIconImg} resizeMode="contain" />
                  <Text style={styles.summaryLabel}>낮잠</Text>
                  <Text style={styles.summaryValue}>{pred.sleepPattern?.napCount ?? '-'}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Image source={IC_CLOCK} style={styles.summaryIconImg} resizeMode="contain" />
                  <Text style={styles.summaryLabel}>깨어있기</Text>
                  <Text style={styles.summaryValue}>{pred.sleepPattern?.wakeWindow ?? '-'}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* 예측 카드들 */}
            {pred.nextNap && renderWindow(pred.nextNap)}
            {pred.bedtime && renderWindow(pred.bedtime)}

            {/* 수면 팁 */}
            <View style={styles.tipsCard}>
              <View style={styles.tipsTitleRow}>
                <Image source={IC_NIGHT} style={styles.tipsTitleIconImg} resizeMode="contain" />
                <Text style={styles.tipsTitle}>{' 수면 팁'}</Text>
              </View>
              {pred.tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Text style={styles.tipNum}>{i + 1}</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>

            {/* 흔한 수면 문제 */}
            {pred.sleepPattern?.commonIssues && pred.sleepPattern.commonIssues.length > 0 && (
              <View style={styles.tipsCard}>
                <View style={styles.tipsTitleRow}>
                  <Image source={IC_REDFLAG} style={styles.tipsTitleIconImg} resizeMode="contain" />
                  <Text style={styles.tipsTitle}>{' 이 시기 흔한 수면 문제'}</Text>
                </View>
                {pred.sleepPattern.commonIssues.map((issue, i) => (
                  <Text key={i} style={styles.issueText}>{'•'} {issue}</Text>
                ))}
              </View>
            )}

            {/* 새로고침 */}
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchPrediction}>
              <Text style={styles.refreshText}>{'다시 분석하기'}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {/* 이전 기록 */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <TouchableOpacity
              style={styles.historyHeader}
              onPress={() => setShowHistory(!showHistory)}
            >
              <View style={styles.historyTitleRow}>
                <Image source={IC_DIARY} style={styles.historyTitleIconImg} resizeMode="contain" />
                <Text style={styles.historyTitle}>{` 이전 예측 기록 (${history.length})`}</Text>
              </View>
              <Text style={styles.historyToggle}>{showHistory ? '접기' : '펼치기'}</Text>
            </TouchableOpacity>

            {showHistory && history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <Text style={styles.historyDate}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ko-KR') : ''}
                </Text>
                <Text style={styles.historyInfo}>
                  평균 수면: {item.prediction?.avgSleepHours ?? '-'}
                  {item.trackingData?.dataCount ? ` | ${item.trackingData.dataCount}일 데이터` : ''}
                </Text>
                {item.prediction?.bedtime && (
                  <Text style={styles.historyInfo}>
                    취침: {item.prediction.bedtime.time}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: insets.bottom + 30 }} />
      </ScrollView>
      <AdSlot />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: COLOR.text },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleIconImg: { width: 30, height: 30 },
  subtitle: { fontSize: 14, color: COLOR.textSub, marginTop: 4 },
  sourceBadge: {
    backgroundColor: COLOR.accent + '25', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  sourceText: { fontSize: 11, fontWeight: '600', color: COLOR.accent },

  loadingWrap: { alignItems: 'center', paddingTop: 80 },
  loadingText: { fontSize: 14, color: COLOR.textSub, marginTop: 12 },

  /* Insufficient data */
  insufficientWrap: { alignItems: 'center', paddingTop: 20 },
  insufficientImage: { width: 140, height: 140, marginBottom: 16, opacity: 0.8 },
  insufficientTitle: { fontSize: 20, fontWeight: '800', color: COLOR.gold, marginBottom: 8 },
  insufficientMsg: { fontSize: 14, color: COLOR.textSub, textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
  progressBox: { width: '100%', marginTop: 16, marginBottom: 20 },
  progressBarBg: { height: 8, borderRadius: 4, backgroundColor: COLOR.cardLight },
  progressBarFill: { height: 8, borderRadius: 4, backgroundColor: COLOR.accent },
  progressLabel: { fontSize: 12, color: COLOR.textSub, textAlign: 'center', marginTop: 6 },

  /* Recommendation card */
  recCard: {
    width: '100%', backgroundColor: COLOR.card, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: COLOR.cardLight, marginBottom: 16,
  },
  recTitle: { fontSize: 16, fontWeight: '700', color: COLOR.text, marginBottom: 14 },
  recRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLOR.cardLight,
  },
  recLabel: { fontSize: 13, color: COLOR.textSub },
  recValue: { fontSize: 13, fontWeight: '700', color: COLOR.text },

  /* Data notice */
  dataNotice: {
    backgroundColor: COLOR.accent + '15', borderRadius: 12, padding: 12, marginBottom: 16,
  },
  dataNoticeText: { fontSize: 13, color: COLOR.accent, textAlign: 'center' },

  /* Summary */
  summaryCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.15)' },
  summaryIcon: { fontSize: 24 },
  summaryIconImg: { width: 28, height: 28 },
  summaryLabel: { fontSize: 11, color: COLOR.textSub, marginTop: 4 },
  summaryValue: { fontSize: 14, fontWeight: '800', color: COLOR.text, marginTop: 2 },

  /* Window Cards */
  windowCard: {
    backgroundColor: COLOR.card, borderRadius: 16, padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: COLOR.cardLight,
  },
  windowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  windowLabel: { fontSize: 14, fontWeight: '700', color: COLOR.textSub },
  confBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  confDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  confText: { fontSize: 11, fontWeight: '600' },
  windowTime: { fontSize: 28, fontWeight: '800', color: COLOR.text, marginBottom: 6 },
  windowReason: { fontSize: 13, color: COLOR.textSub, lineHeight: 18 },

  /* Tips */
  tipsCard: { backgroundColor: COLOR.card, borderRadius: 16, padding: 20, marginBottom: 16 },
  tipsTitle: { fontSize: 16, fontWeight: '700', color: COLOR.text, marginBottom: 14 },
  tipsTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  tipsTitleIconImg: { width: 18, height: 18 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  tipNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLOR.accent + '30', color: COLOR.accent,
    textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '700', marginRight: 10,
    overflow: 'hidden',
  },
  tipText: { flex: 1, fontSize: 13, color: COLOR.textSub, lineHeight: 19 },
  issueTitle: { fontSize: 14, fontWeight: '700', color: COLOR.warn, marginTop: 14, marginBottom: 8 },
  issueText: { fontSize: 13, color: COLOR.textSub, lineHeight: 20, marginLeft: 4 },

  /* Refresh */
  refreshBtn: {
    alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    backgroundColor: COLOR.cardLight, marginBottom: 20,
  },
  refreshText: { fontSize: 14, fontWeight: '600', color: COLOR.accent },

  /* History */
  historySection: { marginBottom: 20 },
  historyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12,
  },
  historyTitle: { fontSize: 15, fontWeight: '700', color: COLOR.text },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center' },
  historyTitleIconImg: { width: 18, height: 18 },
  historyToggle: { fontSize: 13, color: COLOR.accent },
  historyCard: {
    backgroundColor: COLOR.card, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: COLOR.cardLight,
  },
  historyDate: { fontSize: 12, fontWeight: '700', color: COLOR.gold, marginBottom: 4 },
  historyInfo: { fontSize: 12, color: COLOR.textSub, lineHeight: 18 },
});

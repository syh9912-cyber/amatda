import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';
import { pregnancyApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';

type Tab = 'kick' | 'contraction';

function getCurrentWeek(dueDate?: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate).getTime();
  if (isNaN(due)) return 0;
  const lmp = due - 280 * 24 * 60 * 60 * 1000;
  const diff = Date.now() - lmp;
  return Math.max(0, Math.min(42, Math.floor(diff / (7 * 24 * 60 * 60 * 1000))));
}

export default function LaborMonitorScreen() {
  const insets = useSafeAreaInsets();
  const { selectedChild } = useChildStore();
  const childId = selectedChild?.id ?? '';
  const currentWeek = getCurrentWeek(selectedChild?.dueDate);

  const params = useLocalSearchParams<{ tab?: string }>();
  const tab: Tab = params.tab === 'contraction' ? 'contraction' : 'kick';
  const headerTitle = tab === 'contraction' ? '진통 체크' : '태동 체크';

  // 태동
  const [kickCount, setKickCount] = useState(0);
  const [kickElapsed, setKickElapsed] = useState(0);
  const [kickRunning, setKickRunning] = useState(false);
  const kickStartRef = useRef<number | null>(null);
  const kickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [kickSaving, setKickSaving] = useState(false);

  // 진통
  const [contractions, setContractions] = useState<{ start: number; end: number | null }[]>([]);
  const [currentContraction, setCurrentContraction] = useState<number | null>(null);
  const [contractionTick, setContractionTick] = useState(0);

  useEffect(() => {
    if (kickRunning) {
      kickTimerRef.current = setInterval(() => {
        if (kickStartRef.current) {
          setKickElapsed(Math.floor((Date.now() - kickStartRef.current) / 1000));
        }
      }, 1000);
    }
    return () => {
      if (kickTimerRef.current) clearInterval(kickTimerRef.current);
    };
  }, [kickRunning]);

  useEffect(() => {
    if (currentContraction === null) return;
    const id = setInterval(() => setContractionTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [currentContraction]);

  const handleKickStart = () => {
    setKickCount(0);
    setKickElapsed(0);
    kickStartRef.current = Date.now();
    setKickRunning(true);
  };

  const handleKickTap = () => {
    if (!kickRunning) handleKickStart();
    setKickCount((c) => c + 1);
  };

  const handleKickStop = async () => {
    setKickRunning(false);
    if (kickTimerRef.current) clearInterval(kickTimerRef.current);
    if (kickCount === 0 || kickElapsed < 10) {
      Alert.alert('기록 없음', '측정 시간이 너무 짧거나 태동이 기록되지 않았어요.');
      return;
    }
    setKickSaving(true);
    try {
      const res = await pregnancyApi.saveKickSession({
        childId, count: kickCount, durationSec: kickElapsed, week: currentWeek,
      });
      const d = res.data.data as { perHour: number; status: string; message: string };
      Alert.alert(
        `태동 ${kickCount}회 기록 완료`,
        `${Math.round(kickElapsed / 60)}분간 측정 (시간당 약 ${d.perHour}회)\n\n${d.message}`,
      );
      setKickCount(0);
      setKickElapsed(0);
    } catch {
      Alert.alert('오류', '태동 기록 저장에 실패했습니다');
    }
    setKickSaving(false);
  };

  const handleContractionToggle = () => {
    if (currentContraction === null) {
      setCurrentContraction(Date.now());
      setContractionTick(0);
    } else {
      setContractions((prev) => [...prev, { start: currentContraction, end: Date.now() }]);
      setCurrentContraction(null);
      setContractionTick(0);
    }
  };

  const handleContractionReset = () => {
    setContractions([]);
    setCurrentContraction(null);
    setContractionTick(0);
  };

  if (!selectedChild?.isPregnant) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>{'< 뒤로'}</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyText}>임신 중인 아이를 선택해주세요</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>{'< 뒤로'}</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {tab === 'kick' ? (
          <>
            <Text style={styles.hint}>
              태동이 느껴질 때마다 아래 버튼을 탭하세요{'\n'}보통 1시간에 10회 이상이면 건강한 신호예요
            </Text>

            <TouchableOpacity style={styles.bigBtn} onPress={handleKickTap} activeOpacity={0.8}>
              <Text style={styles.bigCount}>{kickCount}</Text>
              <Text style={styles.bigLabel}>회</Text>
            </TouchableOpacity>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>경과</Text>
                <Text style={styles.statValue}>{Math.floor(kickElapsed / 60)}분 {kickElapsed % 60}초</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>시간당</Text>
                <Text style={styles.statValue}>
                  {kickElapsed > 0 ? Math.round((kickCount / kickElapsed) * 3600) : 0}회
                </Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => { setKickCount(0); setKickElapsed(0); kickStartRef.current = Date.now(); }}
              >
                <Text style={styles.secondaryBtnText}>초기화</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, kickSaving && { opacity: 0.5 }]}
                onPress={handleKickStop}
                disabled={kickSaving}
              >
                {kickSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>측정 종료 · 저장</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {currentWeek < 36 && (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  ℹ️ 진통 간격 기록은 보통 36주 이후 필요해요 (현재 {currentWeek}주차)
                </Text>
              </View>
            )}
            <Text style={styles.hint}>
              진통 시작 시 버튼 탭 → 끝날 때 다시 탭{'\n'}5분 간격이 1시간 이상 지속되면 병원에 연락하세요
            </Text>

            <TouchableOpacity
              style={[styles.bigBtn, currentContraction !== null && { backgroundColor: '#E91E63' }]}
              onPress={handleContractionToggle}
              activeOpacity={0.8}
            >
              <Text style={[styles.bigCount, currentContraction !== null && { color: '#fff' }]}>
                {currentContraction !== null ? contractionTick : contractions.length}
              </Text>
              <Text style={[styles.bigLabel, currentContraction !== null && { color: '#fff' }]}>
                {currentContraction !== null ? '초 진행 중' : '회'}
              </Text>
            </TouchableOpacity>

            {contractions.length > 0 && (
              <View style={styles.historyCard}>
                <Text style={styles.historyTitle}>측정 기록</Text>
                {contractions.slice().reverse().map((c, i) => {
                  const duration = Math.round((c.end! - c.start) / 1000);
                  const prev = contractions[contractions.length - 2 - i];
                  const interval = prev ? Math.round((c.start - prev.start) / 1000) : null;
                  return (
                    <View key={c.start} style={styles.historyRow}>
                      <Text style={styles.historyText}>
                        {contractions.length - i}회차 · 지속 {duration}초
                        {interval !== null ? ` · 간격 ${Math.floor(interval / 60)}분 ${interval % 60}초` : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleContractionReset}>
              <Text style={styles.secondaryBtnText}>전체 초기화</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      <AdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabBtnActive: {
    backgroundColor: '#E91E63',
    borderColor: '#E91E63',
  },
  tabText: { fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xl * 2 },

  hint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
    marginTop: SPACING.sm,
  },

  noticeBox: {
    backgroundColor: '#FFF8E1',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  noticeText: { fontSize: FONT_SIZE.sm, color: '#F57C00', lineHeight: 20 },

  bigBtn: {
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: '#FCE4EC',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: SPACING.lg,
    ...SHADOWS.soft,
  },
  bigCount: { fontSize: 72, fontWeight: '800', color: '#C2185B' },
  bigLabel: { fontSize: FONT_SIZE.md, color: '#AD1457', fontWeight: '600' },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: 4 },
  statValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.md,
  },
  secondaryBtnText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: '#E91E63',
    marginTop: SPACING.md,
  },
  primaryBtnText: { fontSize: FONT_SIZE.md, color: '#fff', fontWeight: '700' },

  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  historyRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  historyText: { fontSize: FONT_SIZE.sm, color: COLORS.text },
});

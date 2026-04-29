import { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
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
  const [kickGuideOpen, setKickGuideOpen] = useState(false);

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

  /* ── 진통 가이드 분석 (가진통 / 진진통 추정) ──
   * 의료 진단 아님 — 정보 제공 목적. 면책 고지 화면에 항상 노출.
   *
   * 입력: 최근 5회 측정의 시작 시각 + 지속 시간
   * 판정 기준 (산부인과 일반 가이드 기반):
   *   - 간격이 점점 짧아지고 5분 ± 1분 이내로 일정 → 진진통 의심
   *   - 간격이 불규칙하거나 10분 이상 → 가진통 가능성
   *   - 데이터 부족(< 3회) → 판단 불가
   */
  const contractionGuide = useMemo(() => {
    if (contractions.length < 3) {
      return {
        label: '데이터 수집 중',
        message: '진통 3회 이상 기록되면 패턴 분석을 시작합니다.',
        tone: 'info' as const,
      };
    }
    const last5 = contractions.slice(-5);
    const intervals: number[] = [];
    for (let i = 1; i < last5.length; i++) {
      intervals.push((last5[i].start - last5[i - 1].start) / 1000); // 초
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const max = Math.max(...intervals);
    const min = Math.min(...intervals);
    const variance = max - min;
    const avgMin = avg / 60;

    // 일정한 간격(분산 < 90초) + 5분 이내 → 진진통 의심
    if (variance < 90 && avgMin <= 6 && avgMin >= 3) {
      return {
        label: '병원 방문 권장 수치',
        message:
          `현재 기록된 간격은 평균 ${avgMin.toFixed(1)}분으로 병원 방문 권장 수치에 해당합니다. ` +
          '담당 의사나 분만실에 문의하여 정확한 진단을 받으시길 권장합니다.',
        tone: 'danger' as const,
      };
    }
    // 점점 짧아지는 추세 — 마지막 간격이 평균의 70% 이하
    if (intervals[intervals.length - 1] < avg * 0.7 && avgMin < 10) {
      return {
        label: '간격이 짧아지고 있어요',
        message:
          `평균 ${avgMin.toFixed(1)}분에서 마지막 ${(intervals[intervals.length - 1] / 60).toFixed(1)}분으로 짧아지는 추세입니다. ` +
          '점점 가까워지고 있을 가능성이 있으니 다음 몇 회 더 지켜봐 주세요.',
        tone: 'watch' as const,
      };
    }
    // 그 외 — 불규칙하거나 10분 이상
    return {
      label: '가진통일 가능성이 높습니다',
      message:
        `간격이 ${Math.round(min / 60)}~${Math.round(max / 60)}분으로 불규칙합니다. ` +
        '현재 패턴은 가진통일 가능성이 높습니다. 편안한 자세로 휴식을 취하며 경과를 조금 더 지켜보세요.',
      tone: 'info' as const,
    };
  }, [contractions]);

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
            <View style={styles.hintBox}>
              <Text style={styles.hintBoxText}>
                태동이 느껴질 때마다 <Text style={styles.hintBoxStrong}>아래 버튼을 탭</Text>하세요{'\n'}
                <Text style={styles.hintBoxStrong}>30분에 3~5회 이상</Text>이면 건강한 신호예요
              </Text>
            </View>

            <TouchableOpacity
              style={styles.guideLinkLarge}
              onPress={() => setKickGuideOpen(true)}
              activeOpacity={0.85}
              hitSlop={20}
            >
              <Text style={styles.guideLinkLargeIcon}>❓</Text>
              <Text style={styles.guideLinkLargeText}>
                태동이 평소보다{'\n'}안 느껴지나요?
              </Text>
            </TouchableOpacity>

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
            <View style={styles.hintBox}>
              <Text style={styles.hintBoxText}>
                <Text style={styles.hintBoxStrong}>진통 시작</Text> 시{' '}
                <Text style={styles.hintBoxAccent}>버튼 탭</Text>{' '}
                <Text style={styles.hintBoxArrow}>➔</Text>{' '}
                <Text style={styles.hintBoxStrong}>진통 종료</Text> 시{' '}
                <Text style={styles.hintBoxAccent}>다시 탭</Text>
              </Text>
              <Text style={styles.hintBoxAlert}>
                🚨 5분 간격이 1시간 이상 지속되면 병원에 연락하세요
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.bigBtn, currentContraction !== null && { backgroundColor: '#E91E63' }]}
              onPress={handleContractionToggle}
              activeOpacity={0.8}
            >
              {currentContraction !== null ? (
                <>
                  <Text style={[styles.bigLabel, { color: '#fff', marginBottom: 4 }]}>참는 중...</Text>
                  <Text style={[styles.bigCount, { color: '#fff' }]}>{contractionTick}</Text>
                  <Text style={[styles.bigLabel, { color: '#fff' }]}>초 진행 중</Text>
                </>
              ) : (
                <>
                  <Text style={styles.bigCount}>{contractions.length}</Text>
                  <Text style={styles.bigLabel}>
                    {contractions.length === 0 ? '진통 시작' : '회'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* 분석 가이드 카드 (3회 이상 기록되면 활성화) */}
            <View
              style={[
                styles.guideCard,
                contractionGuide.tone === 'danger' && styles.guideCardDanger,
                contractionGuide.tone === 'watch' && styles.guideCardWatch,
              ]}
            >
              <Text
                style={[
                  styles.guideCardLabel,
                  contractionGuide.tone === 'danger' && { color: '#C62828' },
                  contractionGuide.tone === 'watch' && { color: '#E65100' },
                ]}
              >
                {contractionGuide.tone === 'danger' ? '🚨 ' : contractionGuide.tone === 'watch' ? '⏱️ ' : 'ℹ️ '}
                {contractionGuide.label}
              </Text>
              <Text style={styles.guideCardText}>{contractionGuide.message}</Text>
            </View>

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

        {/* 의료 면책 고지 — 모든 측정 화면 하단에 항상 노출 */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerStrong}>⚕️ 의료 면책 고지</Text>
          <Text style={styles.disclaimer}>
            본 안내는 입력된 데이터를 바탕으로 한 일반 정보이며 의료적 진단을 대신할 수 없습니다.
            위급 상황 시에는 반드시 의료기관의 도움을 받으세요.
          </Text>
        </View>
      </ScrollView>

      {/* 태동 안심 가이드 모달 */}
      <Modal
        visible={kickGuideOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setKickGuideOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>태동이 평소보다 안 느껴지나요?</Text>
              <Text style={styles.modalSub}>아래 방법을 시도해 보세요 👇</Text>

              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>🧃</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>당분 섭취</Text>
                  <Text style={styles.tipText}>초코우유나 주스를 마시고 아기를 깨워 보세요.</Text>
                </View>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>🛌</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>왼쪽으로 눕기</Text>
                  <Text style={styles.tipText}>왼쪽으로 누우면 아기에게 혈액 공급이 더 잘 돼요.</Text>
                </View>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>🧘</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>집중 태동</Text>
                  <Text style={styles.tipText}>조용한 곳에서 배에 손을 얹고 30분만 지켜보세요.</Text>
                </View>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>💤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>잠자는 중일 수 있음</Text>
                  <Text style={styles.tipText}>아기는 20~40분 단위로 자고 일어날 수 있어요.</Text>
                </View>
              </View>

              {/* 위험 박스 */}
              <View style={styles.dangerBox}>
                <Text style={styles.dangerTitle}>🚨 이럴 땐 병원에 문의하세요!</Text>
                <Text style={styles.dangerItem}>• 1시간 동안 태동이 3회 미만일 때</Text>
                <Text style={styles.dangerItem}>• 평소보다 횟수가 절반 이하로 줄었을 때</Text>
                <Text style={styles.dangerItem}>• 반나절(12시간) 동안 태동이 10번 미만일 때</Text>
              </View>

              <Text style={styles.disclaimerSm}>
                본 안내는 일반 정보이며 의료적 진단을 대신할 수 없습니다.
              </Text>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setKickGuideOpen(false)}
              >
                <Text style={styles.modalCloseBtnText}>닫기</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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

  /* 상단 안내 박스 (태동/진통 공통) */
  hintBox: {
    backgroundColor: '#F5F2FF',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E1D9FA',
  },
  hintBoxText: {
    fontSize: 17,
    color: '#3C3450',
    textAlign: 'center',
    lineHeight: 28,
  },
  hintBoxStrong: { fontWeight: '800', color: '#1A1A1A' },
  hintBoxAccent: { fontWeight: '800', color: '#7C5CFF' },
  hintBoxArrow: { fontSize: 18, color: '#7C5CFF' },
  hintBoxAlert: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C62828',
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },

  /* 태동 안심 가이드 — 거대 버튼 (당황한 산모를 위한 시인성) */
  guideLinkLarge: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 22,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: '#FF8C2A',
    marginBottom: SPACING.lg,
    marginHorizontal: 0,
    borderWidth: 2,
    borderColor: '#E26A00',
    ...SHADOWS.soft,
  },
  guideLinkLargeIcon: {
    fontSize: 36,
    color: '#FFFFFF',
  },
  guideLinkLargeText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 26,
  },

  /* 진통 분석 가이드 카드 — 폰트/패딩 1.4배 강화 */
  guideCard: {
    backgroundColor: '#F0F4F8',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
    borderLeftWidth: 6,
    borderLeftColor: '#90A4AE',
  },
  guideCardWatch: {
    backgroundColor: '#FFF3E0',
    borderLeftColor: '#E65100',
  },
  guideCardDanger: {
    backgroundColor: '#FFEBEE',
    borderLeftColor: '#C62828',
  },
  guideCardLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#37474F',
    marginBottom: 8,
    lineHeight: 30,
  },
  guideCardText: {
    fontSize: 16,
    color: '#37474F',
    lineHeight: 26,
    fontWeight: '500',
  },

  /* 의료 면책 고지 박스 (분석 박스 바로 아래) */
  disclaimerBox: {
    backgroundColor: '#FAFAFA',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  disclaimerStrong: {
    fontSize: 12,
    fontWeight: '800',
    color: '#616161',
    marginBottom: 4,
  },
  disclaimer: {
    fontSize: 12,
    color: '#757575',
    lineHeight: 18,
  },
  disclaimerSm: {
    fontSize: 11,
    color: '#9E9E9E',
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },

  /* 안심 가이드 모달 */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  tipEmoji: { fontSize: 28 },
  tipTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  tipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  dangerBox: {
    backgroundColor: '#FFEBEE',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  dangerTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
    color: '#C62828',
    marginBottom: SPACING.sm,
  },
  dangerItem: {
    fontSize: FONT_SIZE.sm,
    color: '#B71C1C',
    lineHeight: 22,
  },
  modalCloseBtn: {
    backgroundColor: '#FF8C5A',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  modalCloseBtnText: { fontSize: FONT_SIZE.md, color: '#fff', fontWeight: '700' },
});

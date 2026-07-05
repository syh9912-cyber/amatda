import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useChildStore } from '../../stores/childStore';
import { pregnancyApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { pickAllPhones, type PickedPhone } from '../../services/deliveryHospital';
import { MissionToast } from '../../components/common/MissionToast';
import { HospitalRegisterModal } from '../../components/pregnancy/HospitalRegisterModal';
import { captureError } from '../../services/sentry';
import { BackButton } from '../../components/common/BackButton';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideButton } from '../../components/common/GuideButton';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import { getLaborMonitorGuide } from '../../features/guide/laborMonitorGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';

type Tab = 'kick' | 'contraction';

// createdAt이 ISO 문자열/숫자/Firestore Timestamp({_seconds}|{seconds}) 어느 형태든
// 밀리초로 정규화 — 문자열이 아니면 NaN으로 '오늘 0회' 표시되던 문제 방지.
function toMillis(v: unknown): number {
  if (typeof v === 'string') return new Date(v).getTime();
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') {
    const o = v as { _seconds?: number; seconds?: number };
    const s = o._seconds ?? o.seconds;
    if (typeof s === 'number') return s * 1000;
  }
  return NaN;
}

function getCurrentWeek(dueDate?: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate).getTime();
  if (isNaN(due)) return 0;
  const lmp = due - 280 * 24 * 60 * 60 * 1000;
  const diff = Date.now() - lmp;
  return Math.max(0, Math.min(42, Math.floor(diff / (7 * 24 * 60 * 60 * 1000))));
}

export default function LaborMonitorScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { selectedChild } = useChildStore();
  const childId = selectedChild?.id ?? '';
  const currentWeek = getCurrentWeek(selectedChild?.dueDate);

  const laborMonitorGuide = useMemo(() => getLaborMonitorGuide(t), [t]);
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => { shouldAutoShowGuide('labor-monitor').then((sh) => { if (sh) setGuideVisible(true); }); }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('labor-monitor'); };

  const params = useLocalSearchParams<{ tab?: string }>();
  // 진통 체크는 한국어 버전 전용 (응급번호·병원 연락 안내가 국가별로 달라 해외 미지원 — SOS 와 동일 정책).
  // 비한국어에서 딥링크/푸시로 진입해도 태동 탭으로 폴백.
  const tab: Tab = params.tab === 'contraction' && i18n.language === 'ko' ? 'contraction' : 'kick';
  const headerTitle = tab === 'contraction' ? t('laborMonitor.headerTitleContraction') : t('laborMonitor.headerTitleKick');

  // 태동
  const [kickCount, setKickCount] = useState(0);
  const [kickElapsed, setKickElapsed] = useState(0);
  const [kickRunning, setKickRunning] = useState(false);
  const kickStartRef = useRef<number | null>(null);
  const kickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [kickSaving, setKickSaving] = useState(false);
  const [kickGuideOpen, setKickGuideOpen] = useState(false);

  // 태동 누적 기록 — 사용자 피드백(2026-05-08): "그동안 몇 번 눌렀는지 기록이 안 보임"
  type KickHistoryItem = {
    id: string;
    count: number;
    durationSec: number;
    week?: number;
    createdAt?: string;
  };
  const [kickHistory, setKickHistory] = useState<KickHistoryItem[]>([]);

  // 누적 통계 계산
  const kickStats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yestStart = new Date(todayStart);
    yestStart.setDate(yestStart.getDate() - 1);
    const week7Start = new Date(todayStart);
    week7Start.setDate(week7Start.getDate() - 6);

    let todayCount = 0;
    let yestCount = 0;
    let week7Count = 0;
    for (const r of kickHistory) {
      if (!r.createdAt) continue;
      const ms = toMillis(r.createdAt);
      if (isNaN(ms)) continue;
      if (ms >= todayStart.getTime()) {
        todayCount += r.count;
      } else if (ms >= yestStart.getTime()) {
        yestCount += r.count;
      }
      if (ms >= week7Start.getTime()) {
        week7Count += r.count;
      }
    }
    return { todayCount, yestCount, week7Count, totalSessions: kickHistory.length };
  }, [kickHistory]);

  const reloadKickHistory = useCallback(async () => {
    if (!childId) return;
    try {
      const res = await pregnancyApi.getKickSessions(childId);
      const data = (res.data?.data ?? res.data) as KickHistoryItem[] | { sessions?: KickHistoryItem[] };
      const list = Array.isArray(data) ? data : (data.sessions ?? []);
      setKickHistory(list);
    } catch {
      // 조회 실패는 silent — 화면 자체는 작동 유지
    }
  }, [childId]);

  useEffect(() => {
    reloadKickHistory();
  }, [reloadKickHistory]);

  // 작은 토스트 (기록 완료 알림 — 큰 Alert 대신)
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 진통
  const [contractions, setContractions] = useState<{ start: number; end: number | null }[]>([]);
  const [currentContraction, setCurrentContraction] = useState<number | null>(null);
  const [contractionTick, setContractionTick] = useState(0);

  // 인터랙티브 진단 (조산사 말풍선 형태로 한 번에 하나씩)
  // 단계: posture(자세변화) → painSite(통증부위) → ruptured(양수파수)
  type DiagStep = 'posture' | 'painSite' | 'ruptured' | 'done';
  const [diagStep, setDiagStep] = useState<DiagStep>('posture');
  const [diagAnswers, setDiagAnswers] = useState<{
    postureFails?: boolean;       // true=자세 바꿔도 아픔(진진통 가능성)
    painCentral?: boolean;         // true=허리+배 전체(진진통 가능성), false=하복부(가진통 가능성)
    ruptured?: boolean;            // true=이슬/양수 파수
  }>({});

  // 호흡법 가이드 — 측정 중 회전 노출 (5~7초마다)
  const BREATHING_TIPS = [
    t('laborMonitor.breathingTips.0'),
    t('laborMonitor.breathingTips.1'),
    t('laborMonitor.breathingTips.2'),
    t('laborMonitor.breathingTips.3'),
    t('laborMonitor.breathingTips.4'),
    t('laborMonitor.breathingTips.5'),
  ];
  const [breathingIdx, setBreathingIdx] = useState(0);
  useEffect(() => {
    if (currentContraction === null) return;
    const id = setInterval(() => {
      setBreathingIdx((i) => (i + 1) % BREATHING_TIPS.length);
    }, 6000);
    return () => clearInterval(id);
  }, [currentContraction, BREATHING_TIPS.length]);

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
    const id = setInterval(() => setContractionTick((v) => v + 1), 1000);
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
      Alert.alert(t('laborMonitor.noRecordTitle'), t('laborMonitor.noRecordDesc'));
      return;
    }
    setKickSaving(true);
    try {
      await pregnancyApi.saveKickSession({
        childId, count: kickCount, durationSec: kickElapsed, week: currentWeek,
      });
      // 작은 토스트만 — 큰 Alert 제거 (반복 기록 시 피로도 ↓)
      setToastMsg(t('laborMonitor.kickSavedToast', { count: kickCount }));
      setKickCount(0);
      setKickElapsed(0);
      // 누적 기록 갱신 (fire-and-forget)
      reloadKickHistory();
    } catch (e) {
      captureError(e, { ctx: 'labor-monitor/saveKickSession', childId, count: kickCount });
      Alert.alert(t('common.error'), t('laborMonitor.kickSaveFailed'));
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
      // 작은 토스트 — 진통 1회 기록 완료
      setToastMsg(t('laborMonitor.contractionSavedToast'));
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
   * 입력: 최근 5회 측정의 시작 시각 + 지속 시간 + 인터랙티브 답변
   * 가중치 (단순 if-else로 빠르게):
   *   - 간격 패턴: 일정+5분이내 +3 / 점점 짧아짐 +2 / 불규칙 0
   *   - postureFails(자세 바꿔도 아픔): +2
   *   - painCentral(허리+배 전체): +2 / 하복부 위주: -1
   *   - ruptured(양수): 즉시 EMERGENCY
   * 합계 ≥ 4 → 병원 권장, ≥ 2 → 지켜보기, 그 외 → 가진통 가능성
   */
  const contractionGuide = useMemo(() => {
    // 양수 파수는 즉시 EMERGENCY
    if (diagAnswers.ruptured) {
      return {
        label: t('laborMonitor.guide.emergency.label'),
        message: t('laborMonitor.guide.emergency.message'),
        tone: 'emergency' as const,
        score: 99,
      };
    }
    if (contractions.length < 3) {
      return {
        label: t('laborMonitor.guide.collecting.label'),
        message: t('laborMonitor.guide.collecting.message'),
        tone: 'info' as const,
        score: 0,
      };
    }
    // 진행 중인 진통의 시작 시각도 포함해 최신 간격을 반영
    // (완료된 진통만 보면 임계 판정이 항상 한 박자 늦음)
    const starts = contractions.map((c) => c.start);
    if (currentContraction !== null) starts.push(currentContraction);
    const recentStarts = starts.slice(-6);
    const intervals: number[] = [];
    for (let i = 1; i < recentStarts.length; i++) {
      intervals.push((recentStarts[i] - recentStarts[i - 1]) / 1000);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const max = Math.max(...intervals);
    const min = Math.min(...intervals);
    const variance = max - min;
    const avgMin = avg / 60;

    // 가중치 계산 (간단한 if-else, 빠른 응답)
    let score = 0;
    let pattern: 'regular' | 'shortening' | 'irregular';
    if (variance < 90 && avgMin <= 6 && avgMin >= 3) {
      score += 3;
      pattern = 'regular';
    } else if (intervals[intervals.length - 1] < avg * 0.7 && avgMin < 10) {
      score += 2;
      pattern = 'shortening';
    } else {
      pattern = 'irregular';
    }
    if (diagAnswers.postureFails === true) score += 2;
    if (diagAnswers.postureFails === false) score -= 1;
    if (diagAnswers.painCentral === true) score += 2;
    if (diagAnswers.painCentral === false) score -= 1;

    // 결론 분기
    if (score >= 4) {
      return {
        label: t('laborMonitor.guide.hospitalRecommended.label'),
        message: t('laborMonitor.guide.hospitalRecommended.message', { avgMin: avgMin.toFixed(1) }),
        tone: 'danger' as const,
        score,
      };
    }
    if (score >= 2 || pattern === 'shortening') {
      return {
        label: t('laborMonitor.guide.shortening.label'),
        message: t('laborMonitor.guide.shortening.message', {
          avgMin: avgMin.toFixed(1),
          lastMin: (intervals[intervals.length - 1] / 60).toFixed(1),
        }),
        tone: 'watch' as const,
        score,
      };
    }
    return {
      label: t('laborMonitor.guide.falseLabor.label'),
      message: t('laborMonitor.guide.falseLabor.message', {
        minMin: Math.round(min / 60),
        maxMin: Math.round(max / 60),
      }),
      tone: 'info' as const,
      score,
    };
  }, [contractions, currentContraction, diagAnswers, t]);

  /** 진진통 판정 (배경 빨강 + 분만실 전화 노출) */
  const isLaborImminent = contractionGuide.tone === 'danger' || contractionGuide.tone === 'emergency';

  /** 어디로 전화할지 선택 모달 — 번호 여러 개 등록 시 사용 */
  const [phoneChoiceOpen, setPhoneChoiceOpen] = useState(false);
  const [phoneChoices, setPhoneChoices] = useState<PickedPhone[]>([]);

  /** 분만 병원 등록 여부 (등록 안 됐으면 진통 화면에 [등록하기] 강제 노출) */
  const [hasRegisteredHospital, setHasRegisteredHospital] = useState<boolean | null>(null);
  const [hospitalRegisterOpen, setHospitalRegisterOpen] = useState(false);

  /** 고위험 임신 — 위급 강조 톤 분기 */
  const isHighRiskPregnancy = selectedChild?.isHighRiskPregnancy === true;

  const refreshHospitalRegistered = useCallback(async () => {
    if (!childId) return;
    const all = await pickAllPhones(t, childId);
    setHasRegisteredHospital(all.length > 0);
  }, [childId, t]);

  useEffect(() => {
    refreshHospitalRegistered();
  }, [refreshHospitalRegistered]);

  const dialPhone = useCallback((phone: string) => {
    // #25: 국제번호 +82 보존 — `+` 도 허용하여 +82-10-... 같은 형식 깨지지 않게
    const cleaned = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch((e) => {
      captureError(e, { ctx: 'labor-monitor/dialPhone', phoneLast4: phone.slice(-4) });
      Alert.alert(t('laborMonitor.callFailedTitle'), t('laborMonitor.callFailedDescDirect', { phone }));
    });
  }, [t]);

  /** 분만실 전화하기 — 번호 1개면 바로 전화, 여러 개면 선택 모달, 미등록이면 등록 모달.
   *  양수파수/출혈 등 위급 증상 시(isEmergency) 외래 후보 자동 제외 → MFICU/분만실/119 만 노출. */
  const callDeliveryWard = useCallback(async () => {
    if (!childId) return;
    // 양수 파수 = 즉시 emergency. (현 contractionGuide.tone === 'emergency' 와 동일 조건)
    const isEmergency = diagAnswers.ruptured === true;
    const all = await pickAllPhones(t, childId, { isEmergency });
    if (all.length === 0) {
      // 미등록 — 진통 위급 상황에서 119로 안내 + 즉시 등록 가능한 모달
      Alert.alert(
        t('laborMonitor.hospitalRegisterRequiredTitle'),
        t('laborMonitor.hospitalRegisterRequiredDesc'),
        [
          {
            text: t('laborMonitor.call119'),
            onPress: () => {
              Linking.openURL('tel:119').catch((e) => {
                captureError(e, { ctx: 'labor-monitor/119-fallback' });
                Alert.alert(t('laborMonitor.callFailedTitle'), t('laborMonitor.callFailedDesc119'));
              });
            },
          },
          {
            text: t('laborMonitor.registerHospital'),
            style: 'default',
            onPress: () => setHospitalRegisterOpen(true),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ],
      );
      return;
    }
    if (all.length === 1) {
      dialPhone(all[0].phone);
      return;
    }
    // 여러 개 등록 — 시간대 우선순위에 맞는 첫 번호가 위에 표시되는 선택 모달
    setPhoneChoices(all);
    setPhoneChoiceOpen(true);
  }, [childId, dialPhone, diagAnswers.ruptured, t]);

  if (!selectedChild?.isPregnant) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title={headerTitle} />
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyText}>{t('laborMonitor.selectPregnantChild')}</Text>
        </View>
      </View>
    );
  }

  // 진진통 판정 시 화면 배경색 빨강 톤 (탭이 contraction일 때만 적용)
  const screenBg = tab === 'contraction' && isLaborImminent ? '#FFEAEA' : COLORS.background;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: screenBg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader title={headerTitle} right={<GuideButton onPress={() => setGuideVisible(true)} color="#DB6A5F" />} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {tab === 'kick' ? (
          <>
            <View style={styles.hintBox}>
              <Text style={styles.hintBoxText}>
                {t('laborMonitor.kickHintPrefix')} <Text style={styles.hintBoxStrong}>{t('laborMonitor.kickHintTapButton')}</Text>{t('laborMonitor.kickHintSuffix')}{'\n'}
                <Text style={styles.hintBoxStrong}>{t('laborMonitor.kickHintThreshold')}</Text>{t('laborMonitor.kickHintHealthySignal')}
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
                {t('laborMonitor.kickLessThanUsualQuestion')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.bigBtn} onPress={handleKickTap} activeOpacity={0.8}>
              <Text style={styles.bigCount}>{kickCount}</Text>
              <Text style={styles.bigLabel}>{t('laborMonitor.countUnit')}</Text>
            </TouchableOpacity>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('laborMonitor.elapsed')}</Text>
                <Text style={styles.statValue}>{t('laborMonitor.minSec', { min: Math.floor(kickElapsed / 60), sec: kickElapsed % 60 })}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('laborMonitor.perHour')}</Text>
                <Text style={styles.statValue}>
                  {t('laborMonitor.countValue', { count: kickElapsed > 0 ? Math.round((kickCount / kickElapsed) * 3600) : 0 })}
                </Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => { setKickCount(0); setKickElapsed(0); kickStartRef.current = Date.now(); }}
              >
                <Text style={styles.secondaryBtnText}>{t('laborMonitor.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, kickSaving && { opacity: 0.5 }]}
                onPress={handleKickStop}
                disabled={kickSaving}
              >
                {kickSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('laborMonitor.stopAndSave')}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 누적 태동 기록 */}
            <View style={kickStyles.historyCard}>
              <Text style={kickStyles.historyTitle}>{t('laborMonitor.kickHistoryTitle')}</Text>
              <View style={kickStyles.historyRow}>
                <View style={kickStyles.historyItem}>
                  <Text style={kickStyles.historyLabel}>{t('laborMonitor.today')}</Text>
                  <Text style={kickStyles.historyValue}>{t('laborMonitor.countValue', { count: kickStats.todayCount })}</Text>
                </View>
                <View style={kickStyles.historyDivider} />
                <View style={kickStyles.historyItem}>
                  <Text style={kickStyles.historyLabel}>{t('laborMonitor.yesterday')}</Text>
                  <Text style={kickStyles.historyValue}>{t('laborMonitor.countValue', { count: kickStats.yestCount })}</Text>
                </View>
                <View style={kickStyles.historyDivider} />
                <View style={kickStyles.historyItem}>
                  <Text style={kickStyles.historyLabel}>{t('laborMonitor.last7Days')}</Text>
                  <Text style={kickStyles.historyValue}>{t('laborMonitor.countValue', { count: kickStats.week7Count })}</Text>
                </View>
              </View>
              <Text style={kickStyles.historyFoot}>
                {t('laborMonitor.kickHistoryFoot', { count: kickStats.totalSessions })}
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* === 위급 증상 119 즉시 안내 — 진통 화면 진입 시 항상 노출 ===
                양수 파수 / 다량 출혈 / 태동 감소·안느껴짐 / 극심한 복통 → 진통 수치 무관
                고위험 임신: 짙은 빨강 + "고위험 — 즉시 119" 톤
                양수파수 확인(diagAnswers.ruptured): 골든타임 모드 — 외래 후보 제거 + 버튼 대형화 */}
            <View style={[
              styles.emergencyBanner,
              isHighRiskPregnancy && styles.emergencyBannerHighRisk,
              diagAnswers.ruptured && styles.emergencyBannerUrgent,
            ]}>
              <Text style={[styles.emergencyBannerTitle, isHighRiskPregnancy && styles.emergencyBannerTitleHighRisk]}>
                {diagAnswers.ruptured
                  ? t('laborMonitor.emergencyBanner.titleRuptured')
                  : isHighRiskPregnancy
                  ? t('laborMonitor.emergencyBanner.titleHighRisk')
                  : t('laborMonitor.emergencyBanner.titleDefault')}
              </Text>
              <Text style={styles.emergencyBannerText}>
                {t('laborMonitor.emergencyBanner.symptoms')}
              </Text>
              <Text style={styles.emergencyBannerSub}>
                {diagAnswers.ruptured
                  ? t('laborMonitor.emergencyBanner.subRuptured')
                  : isHighRiskPregnancy
                  ? t('laborMonitor.emergencyBanner.subHighRisk')
                  : t('laborMonitor.emergencyBanner.subDefault')}
              </Text>
              <View style={styles.emergencyBtnRow}>
                <TouchableOpacity
                  style={[styles.emergency119Btn, diagAnswers.ruptured && styles.emergency119BtnUrgent]}
                  onPress={() => {
                    Linking.openURL('tel:119').catch((e) => {
                      captureError(e, { ctx: 'labor-monitor/119-banner', urgent: diagAnswers.ruptured });
                      Alert.alert(t('laborMonitor.callFailedTitle'), t('laborMonitor.callFailedDesc119'));
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.emergency119Text, diagAnswers.ruptured && styles.emergency119TextUrgent]}>📞 119</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.emergencyHospitalBtn, diagAnswers.ruptured && styles.emergencyHospitalBtnUrgent]}
                  onPress={callDeliveryWard}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.emergencyHospitalText, diagAnswers.ruptured && styles.emergencyHospitalTextUrgent]}>
                    {diagAnswers.ruptured ? t('laborMonitor.deliveryWardDirect') : t('laborMonitor.hospital')}
                  </Text>
                </TouchableOpacity>
              </View>
              {/* 미등록 시 [지금 등록하기] 강제 노출 — 응급 상황 전 사전 등록 유도 */}
              {hasRegisteredHospital === false && (
                <TouchableOpacity
                  style={styles.emergencyRegisterBtn}
                  onPress={() => setHospitalRegisterOpen(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emergencyRegisterText}>
                    {t('laborMonitor.emergencyRegisterHospital')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {currentWeek < 36 && (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  {t('laborMonitor.weekNotice', { week: currentWeek })}
                </Text>
              </View>
            )}
            <View style={styles.hintBox}>
              <Text style={styles.hintBoxText}>
                <Text style={styles.hintBoxStrong}>{t('laborMonitor.contractionStart')}</Text> {t('laborMonitor.when')}{' '}
                <Text style={styles.hintBoxAccent}>{t('laborMonitor.tapButton')}</Text>{' '}
                <Text style={styles.hintBoxArrow}>➔</Text>{' '}
                <Text style={styles.hintBoxStrong}>{t('laborMonitor.contractionEnd')}</Text> {t('laborMonitor.when')}{' '}
                <Text style={styles.hintBoxAccent}>{t('laborMonitor.tapAgain')}</Text>
              </Text>
              <Text style={styles.hintBoxAlert}>
                {t('laborMonitor.fiveMinuteAlert')}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.bigBtn, currentContraction !== null && { backgroundColor: '#E91E63' }]}
              onPress={handleContractionToggle}
              activeOpacity={0.8}
            >
              {currentContraction !== null ? (
                <>
                  <Text style={[styles.bigLabel, { color: '#fff', marginBottom: 4 }]}>{t('laborMonitor.enduring')}</Text>
                  <Text style={[styles.bigCount, { color: '#fff' }]}>{contractionTick}</Text>
                  <Text style={[styles.bigLabel, { color: '#fff' }]}>{t('laborMonitor.secondsInProgress')}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.bigCount}>{contractions.length}</Text>
                  <Text style={styles.bigLabel}>
                    {contractions.length === 0 ? t('laborMonitor.contractionStart') : t('laborMonitor.countUnit')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* 호흡법 가이드 — 측정 중에만 노출 */}
            {currentContraction !== null && (
              <View style={styles.breathingBox}>
                <Text style={styles.breathingText}>{BREATHING_TIPS[breathingIdx]}</Text>
              </View>
            )}

            {/* 분석 가이드 카드 — 진진통 시 강조 (큰 결론) */}
            <View
              style={[
                styles.guideCard,
                contractionGuide.tone === 'danger' && styles.guideCardDanger,
                contractionGuide.tone === 'watch' && styles.guideCardWatch,
                contractionGuide.tone === 'emergency' && styles.guideCardEmergency,
                isLaborImminent && styles.guideCardImminent,
              ]}
            >
              <Text
                style={[
                  styles.guideCardLabel,
                  isLaborImminent && styles.guideCardLabelImminent,
                  contractionGuide.tone === 'danger' && { color: '#C62828' },
                  contractionGuide.tone === 'watch' && { color: '#E65100' },
                  contractionGuide.tone === 'emergency' && { color: '#B71C1C' },
                ]}
              >
                {contractionGuide.tone === 'emergency'
                  ? ''
                  : contractionGuide.tone === 'danger' ? '🚨 '
                  : contractionGuide.tone === 'watch' ? '⏱️ '
                  : 'ℹ️ '}
                {contractionGuide.label}
              </Text>
              <Text style={[styles.guideCardText, isLaborImminent && styles.guideCardTextImminent]}>
                {contractionGuide.message}
              </Text>

              {/* 다이렉트 액션 — 진진통 판정 시 큰 분만실 전화 버튼 */}
              {isLaborImminent && (
                <TouchableOpacity
                  style={styles.directCallBtn}
                  onPress={callDeliveryWard}
                  activeOpacity={0.85}
                  hitSlop={8}
                >
                  <Text style={styles.directCallIcon}>📞</Text>
                  <Text style={styles.directCallText}>{t('laborMonitor.directCallDeliveryWard')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 의료 면책 고지 — 분석 박스 바로 아래 */}
            {contractions.length >= 3 && (
              <View style={styles.disclaimerBoxInline}>
                <Text style={styles.disclaimer}>
                  {t('laborMonitor.medicalDisclaimer')}
                </Text>
              </View>
            )}

            {/* 인터랙티브 진단 — 조산사 말풍선 (3회 이상 기록 시 시작) */}
            {contractions.length >= 3 && diagStep !== 'done' && !diagAnswers.ruptured && (
              <View style={styles.midwifeBubble}>
                <Text style={styles.midwifeAvatar}>👩‍⚕️</Text>
                <View style={styles.midwifeContent}>
                  <Text style={styles.midwifeName}>{t('laborMonitor.midwifeName')}</Text>

                  {diagStep === 'posture' && (
                    <>
                      <Text style={styles.midwifeQuestion}>
                        {t('laborMonitor.diag.postureQuestion')}
                      </Text>
                      <View style={styles.midwifeChoices}>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceSoft]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, postureFails: false }));
                            setDiagStep('painSite');
                          }}
                        >
                          <Text style={styles.midwifeChoiceText}>{t('laborMonitor.diag.postureImproved')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceFirm]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, postureFails: true }));
                            setDiagStep('painSite');
                          }}
                        >
                          <Text style={[styles.midwifeChoiceText, styles.midwifeChoiceTextFirm]}>
                            {t('laborMonitor.diag.postureStillHurts')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {diagStep === 'painSite' && (
                    <>
                      <Text style={styles.midwifeQuestion}>
                        {t('laborMonitor.diag.painSiteQuestion')}
                      </Text>
                      <View style={styles.midwifeChoices}>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceSoft]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, painCentral: false }));
                            setDiagStep('ruptured');
                          }}
                        >
                          <Text style={styles.midwifeChoiceText}>{t('laborMonitor.diag.painLowerAbdomen')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceFirm]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, painCentral: true }));
                            setDiagStep('ruptured');
                          }}
                        >
                          <Text style={[styles.midwifeChoiceText, styles.midwifeChoiceTextFirm]}>
                            {t('laborMonitor.diag.painWholeBackAbdomen')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {diagStep === 'ruptured' && (
                    <>
                      <Text style={styles.midwifeQuestion}>
                        {t('laborMonitor.diag.rupturedQuestion')}
                      </Text>
                      <View style={styles.midwifeChoices}>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceSoft]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, ruptured: false }));
                            setDiagStep('done');
                          }}
                        >
                          <Text style={styles.midwifeChoiceText}>{t('laborMonitor.diag.no')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceEmergency]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, ruptured: true }));
                            setDiagStep('done');
                          }}
                        >
                          <Text style={[styles.midwifeChoiceText, styles.midwifeChoiceTextFirm]}>
                            {t('laborMonitor.diag.yesRuptured')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </View>
            )}

            {contractions.length > 0 && (
              <View style={styles.historyCard}>
                <Text style={styles.historyTitle}>{t('laborMonitor.measurementRecord')}</Text>
                {contractions.slice().reverse().map((c, i) => {
                  const duration = Math.round((c.end! - c.start) / 1000);
                  const prev = contractions[contractions.length - 2 - i];
                  const interval = prev ? Math.round((c.start - prev.start) / 1000) : null;
                  return (
                    <View key={c.start} style={styles.historyRow}>
                      <Text style={styles.historyText}>
                        {interval !== null
                          ? t('laborMonitor.historyRowWithInterval', {
                              seq: contractions.length - i,
                              duration,
                              min: Math.floor(interval / 60),
                              sec: interval % 60,
                            })
                          : t('laborMonitor.historyRow', {
                              seq: contractions.length - i,
                              duration,
                            })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleContractionReset}>
              <Text style={styles.secondaryBtnText}>{t('laborMonitor.resetAll')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* 의료 면책 고지 — 모든 측정 화면 하단에 항상 노출 */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerStrong}>{t('laborMonitor.medicalDisclaimerTitle')}</Text>
          <Text style={styles.disclaimer}>
            {t('laborMonitor.medicalDisclaimerFooter')}
          </Text>
        </View>

        <MedicalCitation
          sources={[
            { label: t('laborMonitor.citationKsog'), url: 'https://www.ksog.org' },
            { label: t('laborMonitor.citationChildcare'), url: 'https://www.childcare.go.kr' },
          ]}
        />
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
              <Text style={styles.modalTitle}>{t('laborMonitor.kickGuideModal.title')}</Text>
              <Text style={styles.modalSub}>{t('laborMonitor.kickGuideModal.subtitle')}</Text>

              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>🧃</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>{t('laborMonitor.kickGuideModal.sugarTitle')}</Text>
                  <Text style={styles.tipText}>{t('laborMonitor.kickGuideModal.sugarText')}</Text>
                </View>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>🛌</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>{t('laborMonitor.kickGuideModal.leftSideTitle')}</Text>
                  <Text style={styles.tipText}>{t('laborMonitor.kickGuideModal.leftSideText')}</Text>
                </View>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>🧘</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>{t('laborMonitor.kickGuideModal.focusTitle')}</Text>
                  <Text style={styles.tipText}>{t('laborMonitor.kickGuideModal.focusText')}</Text>
                </View>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>💤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>{t('laborMonitor.kickGuideModal.sleepingTitle')}</Text>
                  <Text style={styles.tipText}>{t('laborMonitor.kickGuideModal.sleepingText')}</Text>
                </View>
              </View>

              {/* 위험 박스 */}
              <View style={styles.dangerBox}>
                <Text style={styles.dangerTitle}>{t('laborMonitor.kickGuideModal.dangerTitle')}</Text>
                <Text style={styles.dangerItem}>{t('laborMonitor.kickGuideModal.dangerItem1')}</Text>
                <Text style={styles.dangerItem}>{t('laborMonitor.kickGuideModal.dangerItem2')}</Text>
                <Text style={styles.dangerItem}>{t('laborMonitor.kickGuideModal.dangerItem3')}</Text>
              </View>

              <Text style={styles.disclaimerSm}>
                {t('laborMonitor.kickGuideModal.disclaimer')}
              </Text>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setKickGuideOpen(false)}
              >
                <Text style={styles.modalCloseBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* === 어디로 전화할까요? — 번호 여러 개 등록 시 선택 모달 (사용자 의도)
          시간대 우선순위에 따라 위쪽이 추천 번호 (낮: 외래, 밤/주말: 분만실) */}
      <Modal
        visible={phoneChoiceOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhoneChoiceOpen(false)}
      >
        <TouchableOpacity
          style={styles.phoneChoiceBackdrop}
          activeOpacity={1}
          onPress={() => setPhoneChoiceOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.phoneChoiceSheet}>
            <Text style={styles.phoneChoiceTitle}>{t('laborMonitor.phoneChoice.title')}</Text>
            <Text style={styles.phoneChoiceSub}>
              {t('laborMonitor.phoneChoice.subtitle')}
            </Text>
            {phoneChoices.map((c, i) => (
              <TouchableOpacity
                key={c.source}
                style={[
                  styles.phoneChoiceItem,
                  i === 0 && styles.phoneChoiceItemPrimary,
                ]}
                onPress={() => {
                  setPhoneChoiceOpen(false);
                  dialPhone(c.phone);
                }}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.phoneChoiceLabel,
                      i === 0 && styles.phoneChoiceLabelPrimary,
                    ]}
                  >
                    {i === 0 ? '⭐ ' : ''}{c.label}
                  </Text>
                  {c.hospitalName && (
                    <Text style={styles.phoneChoiceHospitalName}>{c.hospitalName}</Text>
                  )}
                  {c.subLabel && (
                    <Text style={styles.phoneChoiceSubLabel}>{c.subLabel}</Text>
                  )}
                  <Text style={styles.phoneChoicePhone}>{c.phone}</Text>
                </View>
                <Text style={styles.phoneChoiceCallIcon}>📞</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.phoneChoiceCancel}
              onPress={() => setPhoneChoiceOpen(false)}
            >
              <Text style={styles.phoneChoiceCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <AdSlot />

      {/* 작은 토스트 — 태동/진통 기록 완료 시 (사용 흐름 방해 X) */}
      <MissionToast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      {/* 분만 병원 등록 모달 — 미등록 시 [등록하기] / Alert 에서 호출 */}
      <HospitalRegisterModal
        visible={hospitalRegisterOpen}
        childId={childId}
        initialKind="delivery"
        onClose={() => setHospitalRegisterOpen(false)}
        onSaved={() => {
          setHospitalRegisterOpen(false);
          refreshHospitalRegistered();
        }}
      />

      <GuideCarousel visible={guideVisible} pages={laborMonitorGuide} onClose={closeGuide} onComplete={closeGuide} accent="#DB6A5F" />
    </View>
  );
}

const kickStyles = StyleSheet.create({
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
    ...SHADOWS.soft,
  },
  historyTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  historyItem: { alignItems: 'center', flex: 1 },
  historyDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  historyLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
    fontWeight: '500',
  },
  historyValue: {
    fontSize: 20,
    color: '#FF8C5A',
    fontWeight: '600',
  },
  historyFoot: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
  },
});

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
  bigCount: { fontSize: 72, fontWeight: '600', color: '#C2185B' },
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
  hintBoxStrong: { fontWeight: '600', color: '#1A1A1A' },
  hintBoxAccent: { fontWeight: '600', color: '#7C5CFF' },
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
    fontWeight: '600',
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
    fontWeight: '600',
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

  /* 호흡법 가이드 박스 — 측정 중 회전 메시지 */
  breathingBox: {
    backgroundColor: '#E8F5E9',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginVertical: SPACING.md,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    alignItems: 'center',
  },
  breathingText: {
    fontSize: 17,
    color: '#2E7D32',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
  },

  /* 진진통 판정 시 결론 강조 (배경 빨강 톤일 때 결론 박스 강조) */
  guideCardEmergency: {
    backgroundColor: '#FFCDD2',
    borderLeftColor: '#B71C1C',
    borderLeftWidth: 8,
  },
  guideCardImminent: {
    paddingVertical: SPACING.lg + 4,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.lg,
  },
  guideCardLabelImminent: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  guideCardTextImminent: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
  },

  /* 다이렉트 분만실 전화 버튼 (진진통 시 결론 박스 안) */
  directCallBtn: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    backgroundColor: '#D32F2F',
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: '#B71C1C',
    ...SHADOWS.soft,
  },
  directCallIcon: { fontSize: 30, color: '#FFFFFF' },
  directCallText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },

  /* 인라인 면책 고지 (분석 박스 바로 아래) */
  disclaimerBoxInline: {
    backgroundColor: '#FAFAFA',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
  },

  /* 조산사 말풍선 — 인터랙티브 진단 */
  midwifeBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...SHADOWS.soft,
  },
  midwifeAvatar: { fontSize: 36 },
  midwifeContent: { flex: 1 },
  midwifeName: { fontSize: 13, fontWeight: '700', color: '#7C5CFF', marginBottom: 6 },
  midwifeQuestion: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  midwifeChoices: { gap: 8 },
  midwifeChoice: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  midwifeChoiceSoft: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  midwifeChoiceFirm: { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' },
  midwifeChoiceEmergency: { backgroundColor: '#FFCDD2', borderColor: '#C62828' },
  midwifeChoiceText: { fontSize: 15, fontWeight: '600', color: '#333' },
  midwifeChoiceTextFirm: { color: '#C62828', fontWeight: '700' },

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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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

  // === 위급 증상 119 배너 (진통 화면 상단 항상 노출) ===
  emergencyBanner: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1.5,
    borderColor: '#E53935',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  // 고위험 임신 — 더 짙은 빨강 + 두꺼운 보더
  emergencyBannerHighRisk: {
    backgroundColor: '#FFD8D8',
    borderWidth: 2.5,
    borderColor: '#B71C1C',
  },
  emergencyBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B71C1C',
    marginBottom: 6,
  },
  emergencyBannerTitleHighRisk: {
    fontSize: 17,
    color: '#7A0000',
  },
  emergencyRegisterBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FF8C5A',
    alignItems: 'center',
  },
  emergencyRegisterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D9534F',
    textAlign: 'center',
  },
  emergencyBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C62828',
    lineHeight: 18,
  },
  emergencyBannerSub: {
    fontSize: 12,
    color: '#7A1F1F',
    marginTop: 6,
    lineHeight: 17,
  },
  emergencyBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  emergency119Btn: {
    flex: 1,
    backgroundColor: '#E53935',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  emergency119Text: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emergencyHospitalBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E53935',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  emergencyHospitalText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C62828',
  },
  // === 양수파수 확인 — 골든타임 모드 (대문짝 버튼) ===
  emergencyBannerUrgent: {
    backgroundColor: '#FFCDD2',
    borderColor: '#B71C1C',
    borderWidth: 3,
  },
  emergency119BtnUrgent: {
    paddingVertical: 22,
    backgroundColor: '#B71C1C',
  },
  emergency119TextUrgent: {
    fontSize: 22,
  },
  emergencyHospitalBtnUrgent: {
    paddingVertical: 22,
    borderColor: '#B71C1C',
    borderWidth: 2.5,
  },
  emergencyHospitalTextUrgent: {
    fontSize: 18,
    color: '#7A0000',
  },

  // === 번호 선택 모달 ===
  phoneChoiceBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  phoneChoiceSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  phoneChoiceTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    textAlign: 'center',
  },
  phoneChoiceSub: {
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
    textAlign: 'center',
  },
  phoneChoiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  phoneChoiceItemPrimary: {
    backgroundColor: '#FFF5EC',
    borderColor: '#FF8C5A',
    borderWidth: 1.5,
  },
  phoneChoiceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  phoneChoiceLabelPrimary: {
    color: '#C2410C',
  },
  phoneChoiceSubLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  phoneChoiceHospitalName: {
    fontSize: 12,
    color: '#444',
    marginTop: 2,
    fontWeight: '600',
  },
  phoneChoicePhone: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
    fontWeight: '600',
  },
  phoneChoiceCallIcon: {
    fontSize: 22,
    marginLeft: 12,
  },
  phoneChoiceCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  phoneChoiceCancelText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '700',
  },
});

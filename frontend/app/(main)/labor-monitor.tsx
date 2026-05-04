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
import { useChildStore } from '../../stores/childStore';
import { pregnancyApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { pickAllPhones, type PickedPhone } from '../../services/deliveryHospital';
import { MissionToast } from '../../components/common/MissionToast';
import { HospitalRegisterModal } from '../../components/pregnancy/HospitalRegisterModal';

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
    '🌬 깊게 숨을 들이마시고, 천천히 내뱉으세요',
    '💆‍♀️ 어깨 힘을 빼고 편안한 자세를 유지하세요',
    '👐 남편이 허리를 지그시 눌러주면 도움이 돼요',
    '😌 통증 사이에는 편하게 쉬어 두세요',
    '💧 물을 한 모금씩 천천히 마셔도 좋아요',
    '🌬 코로 들이쉬고 입으로 후~ 길게 내쉬세요',
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
      await pregnancyApi.saveKickSession({
        childId, count: kickCount, durationSec: kickElapsed, week: currentWeek,
      });
      // 작은 토스트만 — 큰 Alert 제거 (반복 기록 시 피로도 ↓)
      setToastMsg(`태동 ${kickCount}회 기록 완료했어요 👣`);
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
      // 작은 토스트 — 진통 1회 기록 완료
      setToastMsg('진통 간격 기록했어요 ⏱️');
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
        label: '🚨 즉시 분만실 연락',
        message:
          '양수가 터졌거나 이슬이 비치면 즉시 분만실에 전화하시고 병원으로 이동하세요. 출산이 가까울 수 있습니다.',
        tone: 'emergency' as const,
        score: 99,
      };
    }
    if (contractions.length < 3) {
      return {
        label: '데이터 수집 중',
        message: '진통 3회 이상 기록되면 패턴 분석을 시작합니다. 측정 중에는 깊은 호흡으로 편하게 쉬세요.',
        tone: 'info' as const,
        score: 0,
      };
    }
    const last5 = contractions.slice(-5);
    const intervals: number[] = [];
    for (let i = 1; i < last5.length; i++) {
      intervals.push((last5[i].start - last5[i - 1].start) / 1000);
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
        label: '병원 방문 권장 수치',
        message:
          `현재 기록된 간격은 평균 ${avgMin.toFixed(1)}분이며, 종합 분석상 진진통일 가능성이 높습니다. ` +
          '담당 의사나 분만실에 문의하여 정확한 진단을 받으시길 권장합니다.',
        tone: 'danger' as const,
        score,
      };
    }
    if (score >= 2 || pattern === 'shortening') {
      return {
        label: '간격이 짧아지고 있어요',
        message:
          `평균 ${avgMin.toFixed(1)}분에서 마지막 ${(intervals[intervals.length - 1] / 60).toFixed(1)}분으로 변화가 보여요. ` +
          '점점 가까워지고 있을 가능성이 있으니 다음 몇 회 더 지켜봐 주세요.',
        tone: 'watch' as const,
        score,
      };
    }
    return {
      label: '가진통일 가능성이 높습니다',
      message:
        `간격이 ${Math.round(min / 60)}~${Math.round(max / 60)}분으로 불규칙합니다. ` +
        '현재 패턴은 가진통일 가능성이 높습니다. 편안한 자세로 휴식을 취하며 경과를 조금 더 지켜보세요.',
      tone: 'info' as const,
      score,
    };
  }, [contractions, diagAnswers]);

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
    const all = await pickAllPhones(childId);
    setHasRegisteredHospital(all.length > 0);
  }, [childId]);

  useEffect(() => {
    refreshHospitalRegistered();
  }, [refreshHospitalRegistered]);

  const dialPhone = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone.replace(/[^0-9]/g, '')}`).catch(() => {
      Alert.alert('전화 연결 실패', `직접 전화해 주세요: ${phone}`);
    });
  }, []);

  /** 분만실 전화하기 — 번호 1개면 바로 전화, 여러 개면 선택 모달, 미등록이면 등록 모달 */
  const callDeliveryWard = useCallback(async () => {
    if (!childId) return;
    const all = await pickAllPhones(childId);
    if (all.length === 0) {
      // 미등록 — 진통 위급 상황에서 119로 안내 + 즉시 등록 가능한 모달
      Alert.alert(
        '병원 번호 등록 필요',
        '분만 예정 병원이 등록되어 있지 않아요.\n지금 등록하시겠어요?\n\n급한 상황이면 먼저 119에 전화하세요.',
        [
          {
            text: '119 전화',
            onPress: () => {
              Linking.openURL('tel:119').catch(() => {
                Alert.alert('전화 연결 실패', '직접 119에 전화해 주세요.');
              });
            },
          },
          {
            text: '병원 등록',
            style: 'default',
            onPress: () => setHospitalRegisterOpen(true),
          },
          { text: '취소', style: 'cancel' },
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
  }, [childId, dialPhone]);

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

  // 진진통 판정 시 화면 배경색 빨강 톤 (탭이 contraction일 때만 적용)
  const screenBg = tab === 'contraction' && isLaborImminent ? '#FFEAEA' : COLORS.background;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: screenBg }]}>
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
            {/* === 위급 증상 119 즉시 안내 — 진통 화면 진입 시 항상 노출 ===
                양수 파수 / 다량 출혈 / 태동 12h+ 멈춤 / 극심한 복통 → 진통 수치 무관
                고위험 임신: 더 짙은 빨강 + "고위험 — 즉시 119" 톤 */}
            <View style={[styles.emergencyBanner, isHighRiskPregnancy && styles.emergencyBannerHighRisk]}>
              <Text style={[styles.emergencyBannerTitle, isHighRiskPregnancy && styles.emergencyBannerTitleHighRisk]}>
                {isHighRiskPregnancy
                  ? '🚨 고위험 임신 — 위험 신호 시 즉시 119'
                  : '🚨 이런 증상은 119 먼저!'}
              </Text>
              <Text style={styles.emergencyBannerText}>
                양수 파수 · 다량 출혈 · 태동 12시간 이상 멈춤 · 극심한 복통
              </Text>
              <Text style={styles.emergencyBannerSub}>
                {isHighRiskPregnancy
                  ? '고위험 임신은 합병증 위험이 더 큽니다. 애매해도 망설이지 말고 119를 먼저 부르세요.'
                  : '앱 확인보다 119가 먼저입니다. 애매하거나 불안하면 지금 바로 병원에 전화하세요.'}
              </Text>
              <View style={styles.emergencyBtnRow}>
                <TouchableOpacity
                  style={styles.emergency119Btn}
                  onPress={() => {
                    Linking.openURL('tel:119').catch(() => {
                      Alert.alert('전화 연결 실패', '직접 119에 전화해 주세요.');
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emergency119Text}>📞 119</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emergencyHospitalBtn}
                  onPress={callDeliveryWard}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emergencyHospitalText}>🏥 병원</Text>
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
                    🏥 분만 병원이 아직 등록되지 않았어요 — 지금 등록하기 ›
                  </Text>
                </TouchableOpacity>
              )}
            </View>

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
                  <Text style={styles.directCallText}>분만실 바로 전화하기</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 의료 면책 고지 — 분석 박스 바로 아래 */}
            {contractions.length >= 3 && (
              <View style={styles.disclaimerBoxInline}>
                <Text style={styles.disclaimer}>
                  본 안내는 입력된 데이터를 바탕으로 한 일반 정보이며 의료적 진단을 대신할 수 없습니다.
                  위급 상황 시 반드시 의료기관의 도움을 받으세요.
                </Text>
              </View>
            )}

            {/* 인터랙티브 진단 — 조산사 말풍선 (3회 이상 기록 시 시작) */}
            {contractions.length >= 3 && diagStep !== 'done' && !diagAnswers.ruptured && (
              <View style={styles.midwifeBubble}>
                <Text style={styles.midwifeAvatar}>👩‍⚕️</Text>
                <View style={styles.midwifeContent}>
                  <Text style={styles.midwifeName}>조산사 선생님</Text>

                  {diagStep === 'posture' && (
                    <>
                      <Text style={styles.midwifeQuestion}>
                        잠시 일어나 걷거나 자세를 바꿔보세요.{'\n'}
                        그래도 계속 아픈가요?
                      </Text>
                      <View style={styles.midwifeChoices}>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceSoft]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, postureFails: false }));
                            setDiagStep('painSite');
                          }}
                        >
                          <Text style={styles.midwifeChoiceText}>통증이 줄거나 사라졌어요</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceFirm]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, postureFails: true }));
                            setDiagStep('painSite');
                          }}
                        >
                          <Text style={[styles.midwifeChoiceText, styles.midwifeChoiceTextFirm]}>
                            자세 바꿔도 똑같이 아파요
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {diagStep === 'painSite' && (
                    <>
                      <Text style={styles.midwifeQuestion}>
                        지금 통증은 어디가 가장 심하세요?
                      </Text>
                      <View style={styles.midwifeChoices}>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceSoft]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, painCentral: false }));
                            setDiagStep('ruptured');
                          }}
                        >
                          <Text style={styles.midwifeChoiceText}>아랫배 위주로 아파요</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceFirm]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, painCentral: true }));
                            setDiagStep('ruptured');
                          }}
                        >
                          <Text style={[styles.midwifeChoiceText, styles.midwifeChoiceTextFirm]}>
                            허리·배 전체가 쥐어짜요
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {diagStep === 'ruptured' && (
                    <>
                      <Text style={styles.midwifeQuestion}>
                        혹시 이슬이 비쳤거나{'\n'}양수가 터졌나요?
                      </Text>
                      <View style={styles.midwifeChoices}>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceSoft]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, ruptured: false }));
                            setDiagStep('done');
                          }}
                        >
                          <Text style={styles.midwifeChoiceText}>아니요</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.midwifeChoice, styles.midwifeChoiceEmergency]}
                          onPress={() => {
                            setDiagAnswers((p) => ({ ...p, ruptured: true }));
                            setDiagStep('done');
                          }}
                        >
                          <Text style={[styles.midwifeChoiceText, styles.midwifeChoiceTextFirm]}>
                            네, 보였어요/터졌어요
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
            <Text style={styles.phoneChoiceTitle}>어디로 전화할까요?</Text>
            <Text style={styles.phoneChoiceSub}>
              지금 시간대에 권장되는 번호가 위에 있어요
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
              <Text style={styles.phoneChoiceCancelText}>취소</Text>
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
    fontWeight: '900',
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
  directCallText: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },

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
    fontWeight: '900',
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
    fontWeight: '800',
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
    fontWeight: '900',
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
    fontWeight: '900',
    color: '#C62828',
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
    fontWeight: '900',
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
    fontWeight: '800',
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

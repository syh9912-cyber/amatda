import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { pickImageFromLibrary } from '../../utils/imagePicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { childApi, coachingApi, retentionApi, premiumApi, uploadApi } from '../../services/api';
import { useChildStore, Child } from '../../stores/childStore';
import { ChildSelector } from '../../components/home/ChildSelector';
// AI Insights UI 제거됨 (WeeklyReportCard, DailyDiaryCard 미사용)
import {
  ProactivePopup,
  PopupReason,
} from '../../components/coaching/ProactivePopup';
import { getCharacteristicForChild } from '../../constants/monthlyCharacteristics';
import { OnboardingGuide } from '../../components/common/OnboardingGuide';
import { AgeGroupKey } from '../../constants/ageGroups';

/* ------------------------------------------------------------------ */
/* Pregnancy week-appropriate questions                                */
/* ------------------------------------------------------------------ */

function getWeeklyQuestion(name: string, week: number): { emoji: string; text: string; desc: string } {
  if (week <= 6) return { emoji: '🌱', text: `${name}의 첫 초음파, 확인하셨나요?`, desc: '탭하면 출산 등록으로 전환돼요' };
  if (week <= 10) return { emoji: '💓', text: `${name} 심장소리는 들으셨나요?`, desc: '출산하셨다면 탭해주세요' };
  if (week <= 13) return { emoji: '🔬', text: `${name} 목투명대 검사는 받으셨나요?`, desc: '출산하셨다면 탭해주세요' };
  if (week <= 16) return { emoji: '🌿', text: `안정기에요! ${name}가 잘 크고 있나요?`, desc: '출산하셨다면 탭해주세요' };
  if (week <= 20) return { emoji: '🎀', text: `${name}가 왕자인가요 공주인가요?`, desc: '출산하셨다면 탭해주세요' };
  if (week <= 24) return { emoji: '🦶', text: `${name} 태동을 자주 느끼시나요?`, desc: '출산하셨다면 탭해주세요' };
  if (week <= 28) return { emoji: '📋', text: `${name} 키는 많이 컸나요? 잘 크고 있나요?`, desc: '출산하셨다면 탭해주세요' };
  if (week <= 32) return { emoji: '📚', text: `출산 준비는 시작하셨나요?`, desc: '출산하셨다면 탭해주세요' };
  if (week <= 36) return { emoji: '🧳', text: `${name} 출산가방은 준비되었나요?`, desc: '출산하셨다면 탭해주세요' };
  if (week <= 39) return { emoji: '🤰', text: `${name} 만날 준비 되셨나요?`, desc: '출산하셨다면 탭해주세요' };
  return { emoji: '👶', text: `${name} 만나셨나요?`, desc: '탭하면 육아 모드로 전환됩니다' };
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const COLOR = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  accent: '#FF8C5A',
  accentLight: '#FFF0E6',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#ABABAB',
  mint: '#5CBFAB',
  mintBg: '#F0FAF7',
  yellow: '#FFD76E',
  yellowBg: '#FFFCF0',
  coralBg: '#FFF8F3',
  shadow: '#000',
};

interface QuickAction {
  icon: ReturnType<typeof require>;
  label: string;
  route: string;
  bg: string;
  ages: AgeGroupKey[]; // 표시할 연령 그룹
}

const ALL_ACTIONS: QuickAction[] = [
  // 임산부 전용
  { icon: require('../../assets/quick-learning.png'), label: '임신 기록', route: '/(main)/pregnancy', bg: '#FCE4EC', ages: ['pregnant'] },
  { icon: require('../../assets/quick-report.png'), label: '주수별 발달', route: '/(main)/growth-stats', bg: '#F3E5F5', ages: ['pregnant'] },
  { icon: require('../../assets/quick-report.png'), label: '임당 관리', route: '/(main)/gdm', bg: '#FCE4EC', ages: ['pregnant'] },
  { icon: require('../../assets/quick-sleep.png'), label: '태동 체크', route: '/(main)/labor-monitor?tab=kick', bg: '#FCE4EC', ages: ['pregnant'] },
  { icon: require('../../assets/quick-parent-level.png'), label: '맘 체크인', route: '/(main)/mom-wellness', bg: '#F8BBD0', ages: ['pregnant'] },
  { icon: require('../../assets/icon-heart.png'), label: '맘스톡', route: '/(main)/mom-group', bg: '#FCE4EC', ages: ['pregnant', 'infant', 'toddler', 'elementary'] },
  { icon: require('../../assets/quick-timeline.png'), label: '성장앨범', route: '/(main)/album', bg: '#E0F2F1', ages: ['infant', 'toddler', 'elementary'] },
  // 공통
  { icon: require('../../assets/quick-learning.png'), label: '아기시간', route: '/(main)/baby-tracker', bg: COLOR.mintBg, ages: ['infant', 'toddler'] },
  { icon: require('../../assets/quick-report.png'), label: '열나', route: '/(main)/fever', bg: '#FFF0F0', ages: ['infant', 'toddler'] },
  { icon: require('../../assets/quick-learning.png'), label: '생활 기록', route: '/(main)/baby-tracker', bg: COLOR.mintBg, ages: ['elementary'] },
  { icon: require('../../assets/quick-report.png'), label: '접종달력', route: '/(main)/vaccination', bg: '#E3F2FD', ages: ['infant', 'toddler'] },
  { icon: require('../../assets/quick-report.png'), label: '성장 통계', route: '/(main)/growth-stats', bg: COLOR.mintBg, ages: ['infant', 'toddler', 'elementary'] },
  // 영유아
  { icon: require('../../assets/quick-lullaby.png'), label: '태교음악', route: '/(main)/lullaby', bg: '#EDE7F6', ages: ['pregnant'] },
  { icon: require('../../assets/quick-lullaby.png'), label: '자장가', route: '/(main)/lullaby', bg: '#EDE7F6', ages: ['infant', 'toddler'] },
  // 유아 + 초등
  { icon: require('../../assets/play-activity.png'), label: '놀이 학습', route: '/(main)/play-learning', bg: COLOR.yellowBg, ages: ['toddler', 'elementary'] },
  // 공통
  { icon: require('../../assets/quick-coparenting.png'), label: '가족육아', route: '/(main)/coparenting', bg: '#FFF3E0', ages: ['pregnant', 'infant', 'toddler', 'elementary'] },
  { icon: require('../../assets/quick-parent-level.png'), label: '새싹부모', route: '/(main)/parent-level', bg: '#E8F5E9', ages: ['infant', 'toddler', 'elementary'] },
];

const VACCINE_ACTION: QuickAction = {
  icon: require('../../assets/quick-report.png'), label: '접종달력', route: '/(main)/vaccination', bg: '#E3F2FD', ages: ['pregnant'],
};

function getActionsForAge(ageGroup: AgeGroupKey, child?: Child | null): QuickAction[] {
  const filtered = ALL_ACTIONS.filter((a) => a.ages.includes(ageGroup));

  // 임산부: 출산 1달전부터 접종달력 표시
  if (ageGroup === 'pregnant' && child?.dueDate) {
    const daysUntilDue = Math.ceil((new Date(child.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= 30) {
      filtered.push(VACCINE_ACTION);
    }
  }

  // 새싹부모는 임신부 제외하고 반드시 포함
  if (ageGroup !== 'pregnant') {
    const hasSprout = filtered.some((a) => a.route === '/(main)/parent-level');
    const sprout = ALL_ACTIONS.find((a) => a.route === '/(main)/parent-level');
    if (!hasSprout && sprout) filtered.push(sprout);
  }
  return filtered.slice(0, 8);
}

/* ------------------------------------------------------------------ */
/* Retention Types                                                     */
/* ------------------------------------------------------------------ */

interface CountdownData {
  daysSinceBirth: number;
  childName: string;
  displayText: string;
  nextMilestone: { label: string; daysUntil: number; monthsUntil?: number } | null;
  isPregnant?: boolean;
  daysUntilDue?: number;
  pregnancyWeeks?: number;
}

interface DailyCardData {
  emoji: string;
  tip: string;
  category: string;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  level: number;
  levelName: string;
  nextLevelDays: number;
  totalSessions: number;
}

function getAgeText(months: number): string {
  if (months < 12) return `${months}개월`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (remaining === 0) return `${years}세`;
  return `${years}세 ${remaining}개월`;
}

/* ── 맞춤 추천 카테고리 (홈 + 마이페이지 동일) ── */

const RECO_CATEGORIES = [
  { icon: require('../../assets/cat-eating.png'), label: '음식 추천', category: '음식', desc: '기질에 맞는 영양 식단과 레시피', color: '#FF8C5A', bg: '#FFF0E6' },
  { icon: require('../../assets/cat-growth.png'), label: '생활습관', category: '생활습관', desc: '수면, 위생, 루틴 등 생활 가이드', color: '#4ECDC4', bg: '#E8FAF8' },
  { icon: require('../../assets/cat-social.png'), label: '학원 추천', category: '학원', desc: '기질과 발달에 맞는 교육 활동', color: '#7C83EC', bg: '#EEEDFC' },
  { icon: require('../../assets/play-activity.png'), label: '놀이학습', category: '놀이학습', desc: '집에서 할 수 있는 놀이와 활동', color: '#FFB344', bg: '#FFF8E1' },
] as const;

/* ------------------------------------------------------------------ */
/* Main Screen                                                         */
/* ------------------------------------------------------------------ */

const LAST_OPEN_KEY = 'amatda_last_open_ts';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const TRIAL_AUTO_KEY = 'amatda_trial_auto_started';
const TRIAL_POPUP_KEY = 'amatda_trial_popup_dismissed';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupReason, setPopupReason] = useState<PopupReason>('inactive');
  const [popupFollowupText, setPopupFollowupText] = useState<
    string | undefined
  >(undefined);

  const [countdown, setCountdown] = useState<CountdownData | null>(null);
  const [, setDailyCard] = useState<DailyCardData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);

  const [proactiveInsights, setProactiveInsights] = useState<{
    type: string; title: string; message: string; actionLabel?: string; actionRoute?: string;
  }[]>([]);

  const { children, selectedChild, setChildren, selectChild } =
    useChildStore();
  const { updateChild } = useChildStore();
  const [trialPopupVisible, setTrialPopupVisible] = useState(false);

  // ── 출산 전환 모달 상태 ──
  const [birthModalVisible, setBirthModalVisible] = useState(false);
  const [birthName, setBirthName] = useState('');
  const [birthGender, setBirthGender] = useState<'M' | 'F' | null>(null);
  const [birthDateVal, setBirthDateVal] = useState('');
  const [birthTimeVal, setBirthTimeVal] = useState('');
  const [birthLoading, setBirthLoading] = useState(false);

  const loadRetentionData = useCallback(async (childId: string) => {
    const results = await Promise.allSettled([
      retentionApi.countdown(childId),
      retentionApi.dailyCard(childId),
      retentionApi.streak(childId),
    ]);
    if (results[0].status === 'fulfilled') {
      setCountdown(results[0].value.data?.data ?? null);
    }
    if (results[1].status === 'fulfilled') {
      setDailyCard(results[1].value.data?.data ?? null);
    }
    if (results[2].status === 'fulfilled') {
      setStreak(results[2].value.data?.data ?? null);
    }
  }, []);

  const checkTrialStatus = useCallback(async () => {
    try {
      const res = await premiumApi.status();
      const status = res.data?.data as {
        tier: string;
        trialDaysLeft?: number;
      } | undefined;
      if (!status) return;

      if (status.tier === 'FREE') {
        const alreadyStarted = await AsyncStorage.getItem(TRIAL_AUTO_KEY);
        if (!alreadyStarted && (status.trialDaysLeft === undefined || status.trialDaysLeft === null)) {
          await premiumApi.startTrial();
          await AsyncStorage.setItem(TRIAL_AUTO_KEY, '1');
          Alert.alert('7일 무료 체험 시작!', '프리미엄 기능을 무료로 이용해보세요.');
          return;
        }
        if (alreadyStarted && status.trialDaysLeft !== undefined && status.trialDaysLeft <= 0) {
          const dismissed = await AsyncStorage.getItem(TRIAL_POPUP_KEY);
          if (!dismissed) {
            setTrialPopupVisible(true);
          }
        }
      }
    } catch {
      // ignore trial check errors
    }
  }, []);

  useEffect(() => {
    loadChildren();
    checkProactivePopup();
    checkTrialStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProactiveInsights = useCallback(async (childId: string) => {
    try {
      const res = await coachingApi.dailyInsight(childId);
      const data = res.data?.data as { insights?: { type: string; title: string; message: string; actionLabel?: string; actionRoute?: string }[] } | undefined;
      if (data?.insights && data.insights.length > 0) {
        setProactiveInsights(data.insights);
      }
    } catch {
      // 인사이트 로딩 실패해도 앱은 정상
    }
  }, []);

  useEffect(() => {
    // selectedChild 변경 시 이전 아이의 countdown 즉시 초기화 (D-day 오표시 방지)
    setCountdown(null);
    setStreak(null);
    setProactiveInsights([]);
    if (selectedChild) {
      loadRetentionData(selectedChild.id);
      loadProactiveInsights(selectedChild.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id, loadRetentionData, loadProactiveInsights]);

  const handleBirthSubmit = useCallback(async () => {
    if (!selectedChild || !birthDateVal || !birthTimeVal) {
      Alert.alert('알림', '생년월일과 출생시각을 입력해주세요');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateVal)) {
      Alert.alert('알림', 'YYYY-MM-DD 형식으로 입력해주세요');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(birthTimeVal)) {
      Alert.alert('알림', 'HH:MM 형식으로 입력해주세요');
      return;
    }
    setBirthLoading(true);
    try {
      const payload: Record<string, unknown> = {
        birthDate: birthDateVal,
        birthTime: birthTimeVal,
      };
      if (birthName.trim()) payload.name = birthName;
      if (birthGender) payload.gender = birthGender;
      const res = await childApi.birth(selectedChild.id, payload as {
        birthDate: string; birthTime: string; name?: string; gender?: string;
      });
      const updatedChild = res.data?.data;
      if (updatedChild) {
        updateChild(updatedChild);
      }
      setBirthModalVisible(false);
      Alert.alert('축하합니다!', '아이가 태어났어요! 이제부터 육아 코칭이 시작됩니다.');
      // 새로고침
      loadChildren();
    } catch {
      Alert.alert('오류', '출산 전환에 실패했습니다');
    } finally {
      setBirthLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild, birthDateVal, birthTimeVal, birthName, birthGender, updateChild]);

  /* 주간 리포트 닫기 — 향후 복원 시 사용 */

  const loadChildren = async (isRetry = false, _retryCount = 0) => {
    if (isRetry) setLoading(true);
    if (_retryCount === 0) setLoadError(false);
    try {
      const res = await childApi.list();
      setChildren(res.data?.data ?? []);
    } catch (e: unknown) {
      const axErr = e as { response?: { status?: number }; message?: string };
      console.error('loadChildren failed:', axErr.response?.status, axErr.message);
      if (axErr.response?.status === 401) {
        // 인터셉터가 refresh 시도 → 실패 시 이미 로그인 화면으로 이동
        // 여기까지 오면 할 일 없음
      } else if (_retryCount < 2) {
        // OTA 재시작 직후 네트워크 재연결 타이밍 → 1.5초 후 자동 재시도
        await new Promise(r => setTimeout(r, 1500));
        return loadChildren(false, _retryCount + 1);
      } else {
        setLoadError(true);
      }
    } finally {
      if (_retryCount === 0) setLoading(false);
    }
  };

  const checkProactivePopup = async () => {
    try {
      const now = Date.now();
      const lastOpenStr = await AsyncStorage.getItem(LAST_OPEN_KEY);
      await AsyncStorage.setItem(LAST_OPEN_KEY, String(now));

      // Check follow-ups first
      const childState = useChildStore.getState();
      const child = childState.selectedChild;
      if (child) {
        try {
          const res = await coachingApi.followups(child.id);
          const data = res.data?.data;
          if (Array.isArray(data) && data.length > 0) {
            setPopupReason('followup');
            setPopupFollowupText(data[0].followupText);
            setPopupVisible(true);
            return;
          }
        } catch {
          // ignore
        }
      }

      // Check if inactive > 3 days
      if (lastOpenStr) {
        const lastOpen = parseInt(lastOpenStr, 10);
        if (now - lastOpen > THREE_DAYS_MS) {
          setPopupReason('inactive');
          setPopupVisible(true);
          return;
        }
      }

      // Check weekend
      const day = new Date().getDay();
      if (day === 0 || day === 6) {
        const weekendKey = `amatda_weekend_popup_${new Date().toDateString()}`;
        const shown = await AsyncStorage.getItem(weekendKey);
        if (!shown) {
          await AsyncStorage.setItem(weekendKey, '1');
          setPopupReason('weekend');
          setPopupVisible(true);
        }
      }
    } catch {
      // ignore popup errors
    }
  };

  const handlePopupRespond = useCallback((response: string) => {
    setPopupVisible(false);
    router.push('/(main)/chatbot' as never);
  }, []);

  const handlePopupDismiss = useCallback(() => {
    setPopupVisible(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadError(false);
    await loadChildren();
    if (selectedChild) {
      await Promise.allSettled([
        loadRetentionData(selectedChild.id),
        loadProactiveInsights(selectedChild.id),
      ]);
    }
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id, loadRetentionData, loadProactiveInsights]);

  const pickPhoto = async () => {
    if (!selectedChild) return;
    const picked = await pickImageFromLibrary({ quality: 0.8 });
    if (!picked) return;
    const localUri = picked.uri;
    // 즉시 로컬 프리뷰 반영
    const updated = { ...selectedChild, photoUri: localUri };
    updateChild(updated);
    try {
      // Firebase Storage에 업로드 후 클라우드 URL 저장
      const uploaded = await uploadApi.upload(localUri, 'profiles');
      await childApi.update(selectedChild.id, {
        photoUri: uploaded.url,
      } as Record<string, unknown>);
      // 로컬 상태도 클라우드 URL로 갱신
      updateChild({ ...selectedChild, photoUri: uploaded.url });
    } catch {
      Alert.alert('알림', '사진 업로드에 실패했습니다. 다시 시도해주세요.');
    }
  };

  /* Loading */
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLOR.accent} />
      </View>
    );
  }

  /* Network error state */
  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>{'😥'}</Text>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>
          {'서버 연결에 실패했어요'}
        </Text>
        <Text style={{ fontSize: 13, color: '#888', marginBottom: 24, textAlign: 'center', paddingHorizontal: 32 }}>
          {'인터넷 연결을 확인하고 다시 시도해주세요'}
        </Text>
        <TouchableOpacity
          onPress={() => loadChildren(true)}
          style={{ backgroundColor: COLOR.accent, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 }}
        >
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>{'다시 시도'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* Empty state */
  if (children.length === 0) {
    return <EmptyState />;
  }

  const child = selectedChild;

  return (
    <View style={styles.container}>
    <ScrollView
      style={styles.scrollFill}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLOR.accent}
        />
      }
    >
      <OnboardingGuide />

      {/* === 1. Header === */}
      <Header child={child} onPickPhoto={pickPhoto} />

      {/* === Child Selector (multi-child) === */}
      {children.length > 1 && (
        <ChildSelector
          items={children}
          selectedId={selectedChild?.id ?? ''}
          onSelect={selectChild}
        />
      )}

      {child && (
        <>
          {/* === 임산부: 출산했어요 카드 === */}
          {child.isPregnant && (() => {
            const q = getWeeklyQuestion(child.name || '아가', child.pregnancyWeeks ?? 0);
            const isNearDue = (child.pregnancyWeeks ?? 0) >= 37;
            return (
              <>
                {/* 주수별 질문 → 임신 기록으로 이동 */}
                <TouchableOpacity
                  style={styles.birthCard}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(main)/pregnancy' as never)}
                >
                  <Text style={styles.birthCardEmoji}>{q.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.birthCardTitle}>{q.text}</Text>
                    <Text style={styles.birthCardDesc}>탭해서 기록하기</Text>
                  </View>
                  <Text style={styles.birthCardArrow}>{'>'}</Text>
                </TouchableOpacity>

                {/* 만삭(37주+)이면 출산 등록 버튼 별도 표시 */}
                {isNearDue && (
                  <TouchableOpacity
                    style={[styles.birthCard, { backgroundColor: '#FFF0F5', borderColor: '#FFB6C1', borderWidth: 1, marginTop: 8 }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setBirthName(child.name || '');
                      setBirthGender(null);
                      setBirthDateVal('');
                      setBirthTimeVal('');
                      setBirthModalVisible(true);
                    }}
                  >
                    <Text style={styles.birthCardEmoji}>{'🎉'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.birthCardTitle}>출산하셨나요?</Text>
                      <Text style={styles.birthCardDesc}>탭하면 육아 모드로 전환됩니다</Text>
                    </View>
                    <Text style={styles.birthCardArrow}>{'>'}</Text>
                  </TouchableOpacity>
                )}
              </>
            );
          })()}

          {/* === Compact Stats (D-day + Streak) === */}
          <CompactStats countdown={countdown} streak={streak} />

          {/* === Proactive Insight (AI가 먼저 말 거는 카드) === */}
          {proactiveInsights.filter(i => i.type !== 'milestone_tip').length > 0 && (
            <InsightCards insights={proactiveInsights.filter(i => i.type !== 'milestone_tip')} />
          )}

          {/* === Quick Actions (8 icons, 2 rows) === */}
          <AllActionsGrid ageGroup={child.ageInfo?.group ?? 'infant'} child={child} />

          {/* === Monthly Characteristic === */}
          <MonthlyCharCard child={child} />

          {/* === Recommendations === */}
          <RecommendationSection />
        </>
      )}

      {/* Add Child */}
      <TouchableOpacity
        style={styles.addMore}
        onPress={() => router.push('/onboarding/child-info')}
      >
        <Text style={styles.addMoreText}>+ 자녀 추가</Text>
      </TouchableOpacity>

      {/* Proactive Popup */}
      <ProactivePopup
        visible={popupVisible}
        reason={popupReason}
        followupText={popupFollowupText}
        onRespond={handlePopupRespond}
        onDismiss={handlePopupDismiss}
      />

      {/* Trial Expiry Popup */}
      <Modal
        visible={trialPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTrialPopupVisible(false)}
      >
        <View style={styles.trialOverlay}>
          <View style={styles.trialCard}>
            <Text style={styles.trialEmoji}>{'👑'}</Text>
            <Text style={styles.trialTitle}>무료 체험이 종료되었습니다</Text>
            <Text style={styles.trialDesc}>
              프리미엄으로 업그레이드하면 상담이모 무제한, 상세 리포트 등 모든 기능을 이용할 수 있어요.
            </Text>
            <TouchableOpacity
              style={styles.trialPremiumBtn}
              onPress={() => {
                setTrialPopupVisible(false);
                router.push('/(main)/subscription');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.trialPremiumText}>프리미엄 구독하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.trialFreeBtn}
              onPress={async () => {
                setTrialPopupVisible(false);
                await AsyncStorage.setItem(TRIAL_POPUP_KEY, '1');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.trialFreeText}>무료로 계속하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Birth Transition Modal */}
      <Modal
        visible={birthModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBirthModalVisible(false)}
      >
        <View style={styles.birthOverlay}>
          <View style={styles.birthModalCard}>
            <Text style={styles.birthModalEmoji}>{'👶'}</Text>
            <Text style={styles.birthModalTitle}>출산 정보 입력</Text>
            <Text style={styles.birthModalDesc}>축하합니다! 아이 정보를 입력해주세요</Text>

            <View style={styles.birthField}>
              <Text style={styles.birthFieldLabel}>이름 (정식 이름)</Text>
              <TextInput
                style={styles.birthInput}
                value={birthName}
                onChangeText={setBirthName}
                placeholder="아이 이름"
                placeholderTextColor={COLOR.textLight}
              />
            </View>

            <View style={styles.birthField}>
              <Text style={styles.birthFieldLabel}>성별</Text>
              <View style={styles.birthGenderRow}>
                <TouchableOpacity
                  style={[styles.birthGenderBtn, birthGender === 'M' && styles.birthGenderActive]}
                  onPress={() => setBirthGender('M')}
                >
                  <Text style={[styles.birthGenderText, birthGender === 'M' && styles.birthGenderActiveText]}>남아</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.birthGenderBtn, birthGender === 'F' && styles.birthGenderActive]}
                  onPress={() => setBirthGender('F')}
                >
                  <Text style={[styles.birthGenderText, birthGender === 'F' && styles.birthGenderActiveText]}>여아</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.birthField}>
              <Text style={styles.birthFieldLabel}>생년월일 *</Text>
              <TextInput
                style={styles.birthInput}
                value={birthDateVal}
                onChangeText={setBirthDateVal}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLOR.textLight}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={styles.birthField}>
              <Text style={styles.birthFieldLabel}>출생시각 *</Text>
              <TextInput
                style={styles.birthInput}
                value={birthTimeVal}
                onChangeText={setBirthTimeVal}
                placeholder="HH:MM"
                placeholderTextColor={COLOR.textLight}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <TouchableOpacity
              style={[styles.birthSubmitBtn, birthLoading && { opacity: 0.6 }]}
              onPress={handleBirthSubmit}
              disabled={birthLoading}
              activeOpacity={0.8}
            >
              {birthLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.birthSubmitText}>출산 완료!</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.birthCancelBtn}
              onPress={() => setBirthModalVisible(false)}
            >
              <Text style={styles.birthCancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>

    {/* Floating SOS Button */}
    <TouchableOpacity
      style={styles.sosFab}
      onPress={() => router.push('/(main)/sos')}
      activeOpacity={0.8}
    >
      <Text style={styles.sosFabText}>SOS</Text>
    </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Section Components                                                  */
/* ------------------------------------------------------------------ */

function Header({
  child,
  onPickPhoto,
}: {
  child: Child | null;
  onPickPhoto: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={onPickPhoto} activeOpacity={0.7}>
          {child?.photoUri ? (
            <Image
              source={{ uri: child.photoUri }}
              style={styles.childPhoto}
            />
          ) : (
            <Image
              source={child?.gender === 'F'
                ? require('../../assets/avatar-girl.png')
                : require('../../assets/avatar-boy.png')}
              style={styles.childPhoto}
            />
          )}
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerLabel}>우리 아이</Text>
          <Text style={styles.headerName}>
            {child?.name ?? '아이'}{' '}
            <Text style={styles.headerAge}>
              ({child?.isPregnant
                ? `${child.pregnancyWeeks ?? 0}주차`
                : child ? getAgeText(child.ageInfo.months) : ''})
            </Text>
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        {child?.isPregnant && (
          <TouchableOpacity
            style={styles.contractionBox}
            onPress={() => router.push('/(main)/labor-monitor?tab=contraction' as never)}
            activeOpacity={0.8}
          >
            <Text style={styles.contractionBoxEmoji}>{'⏱️'}</Text>
            <Text style={styles.contractionBoxText}>진통{'\n'}체크</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(main)/notification-settings' as never)}
          activeOpacity={0.7}
        >
          <Image source={require('../../assets/icon-bell.png')} style={styles.headerIcon} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(main)/profile' as never)}
          activeOpacity={0.7}
        >
          <Image source={require('../../assets/icon-settings.png')} style={styles.headerIcon} resizeMode="contain" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* TodayCard 제거됨 — 홈화면에서 미사용 */

function MonthlyCharCard({ child }: { child: Child }) {
  const ageMonths = child.birthDate
    ? Math.floor(
        (Date.now() - new Date(child.birthDate).getTime()) /
          (1000 * 60 * 60 * 24 * 30.44),
      )
    : null;

  if (ageMonths === null) return null;

  const temperament = child.innateData?.label ?? undefined;
  const result = getCharacteristicForChild(ageMonths, temperament ?? '');
  if (!result) return null;

  return (
    <TouchableOpacity
      style={styles.monthlyCard}
      activeOpacity={0.7}
      onPress={() => router.push('/(main)/monthly-characteristic')}
    >
      <View style={styles.monthlyTop}>
        <View style={styles.monthlyBadge}>
          <Text style={styles.monthlyBadgeText}>{ageMonths}{'개월'}</Text>
        </View>
        <Text style={styles.monthlyTitle} numberOfLines={1}>
          {ageMonths}{'개월 특징 — '}{result.characteristic.title}
        </Text>
        <Text style={styles.monthlyArrow}>{'>'}</Text>
      </View>
    </TouchableOpacity>
  );
}

function AllActionsGrid({ ageGroup, child }: { ageGroup: AgeGroupKey; child?: Child | null }) {
  const actions = getActionsForAge(ageGroup, child);
  return (
    <View style={styles.quickSection}>
      {actions.map((action) => {
        const isSprout = action.route === '/(main)/parent-level';
        return (
          <TouchableOpacity
            key={action.label}
            style={styles.quickItem}
            onPress={() => router.push(action.route as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickCircle, { backgroundColor: action.bg }]}>
              <Image source={action.icon} style={styles.quickIcon} resizeMode="contain" />
              {isSprout && <View style={styles.sproutBadge}><Text style={styles.sproutBadgeText}>GO</Text></View>}
            </View>
            <Text style={[styles.quickLabel, isSprout && styles.sproutLabel]}>{action.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RecommendationSection() {
  return (
    <View style={styles.recoSection}>
      <View style={styles.recoHeader}>
        <Text style={styles.recoTitle}>{'맞춤 추천'}</Text>
      </View>
      {RECO_CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.category}
          style={styles.recoCard}
          activeOpacity={0.7}
          onPress={() =>
            router.push({
              pathname: '/(main)/recommendation-list',
              params: { category: cat.category },
            })
          }
        >
          <View style={[styles.recoEmojiWrap, { backgroundColor: cat.bg }]}>
            <Image source={cat.icon} style={styles.recoIcon} resizeMode="contain" />
          </View>
          <View style={styles.recoTextWrap}>
            <Text style={styles.recoCardTitle}>{cat.label}</Text>
            <Text style={styles.recoCardDesc}>{cat.desc}</Text>
          </View>
          <Text style={[styles.recoChevron, { color: cat.color }]}>{'>'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CompactStats({
  countdown,
  streak,
}: {
  countdown: CountdownData | null;
  streak: StreakData | null;
}) {
  if (!countdown && !streak) return null;

  const LEVEL_ICONS: Record<number, string> = {
    1: '🌱', 2: '🪴', 3: '🌸', 4: '🌻', 5: '💎',
  };

  return (
    <TouchableOpacity
      style={styles.compactStats}
      onPress={() => router.push('/(main)/parent-level')}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {countdown && (
            <View style={styles.compactStatItem}>
              <Text style={styles.compactStatValue}>
                {countdown.isPregnant ? `D-${countdown.daysUntilDue}` : `D+${countdown.daysSinceBirth}`}
              </Text>
              <Text style={styles.compactStatLabel}>{countdown.childName}</Text>
            </View>
          )}
          {countdown && streak && <View style={styles.compactDivider} />}
          {streak && (
            <View style={styles.compactStatItem}>
              <Text style={styles.compactStatValue}>
                {LEVEL_ICONS[streak.level] ?? '🌱'} {streak.currentStreak}{'일째'}
              </Text>
              <Text style={styles.compactStatLabel}>{streak.levelName}</Text>
            </View>
          )}
          {countdown?.nextMilestone && (
            <>
              <View style={styles.compactDivider} />
              <View style={styles.compactStatItem}>
                <Text style={styles.compactStatValue}>D-{countdown.nextMilestone.daysUntil}</Text>
                <Text style={styles.compactStatLabel}>{countdown.nextMilestone.label}</Text>
              </View>
            </>
          )}
        </View>
        <Text style={styles.compactStatsHint}>👉 눌러서 부모 레벨·보상 확인</Text>
      </View>
      <Text style={{ fontSize: 18, color: COLOR.textLight, marginLeft: 4 }}>{'>'}</Text>
    </TouchableOpacity>
  );
}

function InsightCards({ insights }: { insights: { type: string; title: string; message: string; actionLabel?: string; actionRoute?: string }[] }) {
  const TYPE_COLORS: Record<string, { bg: string; accent: string; icon: string }> = {
    pattern_alert: { bg: '#FFF0E6', accent: '#FF8C5A', icon: '!' },
    // milestone_tip 삭제됨 — 사용자 요청으로 발달포인트 카드 제거
    encouragement: { bg: '#FFF8E1', accent: '#FFD76E', icon: '♥' },
    smart_question: { bg: '#EEEDFC', accent: '#7C83EC', icon: '?' },
    weekly_summary: { bg: '#E8F4FD', accent: '#5BA8D9', icon: 'Σ' },
  };

  return (
    <View style={{ marginBottom: 16 }}>
      {insights.map((ins, idx) => {
        const colors = TYPE_COLORS[ins.type] || TYPE_COLORS.encouragement;
        return (
          <TouchableOpacity
            key={`${ins.type}-${idx}`}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 16,
              marginBottom: idx < insights.length - 1 ? 8 : 0,
              borderLeftWidth: 3,
              borderLeftColor: colors.accent,
              borderWidth: 1,
              borderColor: '#F0F0F0',
            }}
            activeOpacity={ins.actionRoute ? 0.7 : 1}
            onPress={() => {
              if (ins.actionRoute) router.push(ins.actionRoute as never);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
                marginRight: 8,
              }}>
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{colors.icon}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLOR.text }}>{ins.title}</Text>
            </View>
            <Text style={{ fontSize: 13, color: COLOR.textSub, lineHeight: 20 }}>{ins.message}</Text>
            {ins.actionLabel && (
              <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600', marginTop: 8 }}>
                {ins.actionLabel} {'>'}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.center}>
      <Image source={require('../../assets/mascot-waving.png')} style={styles.emptyMascot} resizeMode="contain" />
      <Text style={styles.emptyText}>등록된 자녀가 없습니다</Text>
      <Text style={styles.emptySubtext}>
        자녀를 등록하고 기질을 분석해보세요
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/onboarding/child-info')}
      >
        <Text style={styles.addButtonText}>자녀 등록하기</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

/* 은은하고 부드러운 그림자 — 투명도 5% 이하, blur 높게 */
const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 16,
  elevation: 1,
};

const styles = StyleSheet.create({
  /* Layout */
  container: {
    flex: 1,
    backgroundColor: COLOR.bg,
  },
  scrollFill: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 110,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLOR.bg,
    padding: 32,
  },

  /* === 1. Header === */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLOR.accent,
  },
  childPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLOR.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLOR.accent,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  headerInfo: {
    gap: 2,
  },
  headerLabel: {
    fontSize: 11,
    color: COLOR.textLight,
    fontWeight: '500',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLOR.text,
  },
  headerAge: {
    fontSize: 13,
    fontWeight: '500',
    color: COLOR.textSub,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contractionBox: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: '#FFE0E6',
    borderWidth: 2,
    borderColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  contractionBoxEmoji: {
    fontSize: 26,
  },
  contractionBoxText: {
    color: '#C0392B',
    fontSize: 14,
    fontWeight: '800' as const,
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 15,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 18,
  },

  /* === Monthly Characteristic Card === */
  monthlyCard: {
    backgroundColor: COLOR.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderLeftWidth: 3,
    borderLeftColor: COLOR.mint,
  },
  monthlyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  monthlyBadge: {
    backgroundColor: COLOR.mint,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  monthlyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  monthlyTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLOR.text,
  },
  monthlyArrow: {
    fontSize: 18,
    color: COLOR.textLight,
    fontWeight: '300',
  },

  /* === 3. Quick Action Circles === */
  quickSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 28,
    paddingHorizontal: 4,
    rowGap: 16,
  },
  quickItem: {
    width: '25%',
    alignItems: 'center',
    gap: 8,
  },
  quickCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLOR.text,
  },
  sproutBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLOR.accent,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  sproutBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sproutLabel: {
    color: COLOR.accent,
    fontWeight: '700',
  },


  /* === 4. Recommendations === */
  recoSection: {
    marginBottom: 20,
  },
  recoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  recoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLOR.text,
  },
  recoMore: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.accent,
  },
  recoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLOR.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  recoEmojiWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLOR.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  recoTextWrap: {
    flex: 1,
    gap: 2,
  },
  recoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.text,
  },
  recoCardDesc: {
    fontSize: 12,
    color: COLOR.textSub,
    lineHeight: 17,
  },
  recoChevron: {
    fontSize: 22,
    color: COLOR.textLight,
    marginLeft: 8,
    fontWeight: '300',
  },

  /* === Compact Stats === */
  compactStats: {
    flexDirection: 'row' as const,
    backgroundColor: COLOR.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: '#FFD4BB',
    shadowColor: '#FF8C5A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  compactStatItem: {
    alignItems: 'center' as const,
    flex: 1,
  },
  compactStatValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLOR.accent,
  },
  compactStatLabel: {
    fontSize: 11,
    color: COLOR.textSub,
    marginTop: 2,
  },
  compactDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 8,
  },
  compactStatsHint: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600' as const,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },

  /* === AI Insights === */
  insightsSection: {
    backgroundColor: COLOR.card,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden' as const,
    ...CARD_SHADOW,
  },
  insightsHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: 16,
  },
  insightsTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLOR.text,
  },
  insightsArrow: {
    fontSize: 16,
    color: COLOR.textSub,
    fontWeight: '600' as const,
  },
  insightsBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  /* === Empty state === */
  emptyMascot: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: COLOR.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLOR.textSub,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: COLOR.accent,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },

  /* === Add more === */
  addMore: {
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  addMoreText: {
    color: COLOR.textLight,
    fontSize: 15,
    fontWeight: '500',
  },

  /* === Version === */
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: COLOR.textLight,
    marginBottom: 24,
  },

  /* === Trial Expiry Popup === */
  trialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 32,
  },
  trialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center' as const,
    width: '100%' as const,
  },
  trialEmoji: { fontSize: 44, marginBottom: 16 },
  trialTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLOR.text,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  trialDesc: {
    fontSize: 14,
    color: COLOR.textSub,
    lineHeight: 22,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  trialPremiumBtn: {
    backgroundColor: COLOR.accent,
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  trialPremiumText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  trialFreeBtn: { paddingVertical: 12 },
  trialFreeText: {
    color: COLOR.textLight,
    fontSize: 14,
    fontWeight: '600' as const,
  },

  /* === Birth Card === */
  birthCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0E0E8',
  },
  birthCardEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  birthCardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#E91E63',
    marginBottom: 2,
  },
  birthCardDesc: {
    fontSize: 12,
    color: COLOR.textSub,
  },
  birthCardArrow: {
    fontSize: 20,
    color: '#E91E63',
    fontWeight: '300' as const,
    marginLeft: 8,
  },

  /* === Birth Modal === */
  birthOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
  },
  birthModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center' as const,
    width: '100%' as const,
  },
  birthModalEmoji: { fontSize: 44, marginBottom: 12 },
  birthModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLOR.text,
    marginBottom: 6,
  },
  birthModalDesc: {
    fontSize: 13,
    color: COLOR.textSub,
    marginBottom: 20,
    textAlign: 'center' as const,
  },
  birthField: {
    width: '100%' as const,
    marginBottom: 14,
  },
  birthFieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLOR.text,
    marginBottom: 6,
  },
  birthInput: {
    backgroundColor: '#F8F4F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLOR.text,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  birthGenderRow: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  birthGenderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    alignItems: 'center' as const,
    backgroundColor: '#F8F4F0',
  },
  birthGenderActive: {
    borderColor: '#E91E63',
    backgroundColor: '#FFF0F5',
  },
  birthGenderText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: COLOR.textSub,
  },
  birthGenderActiveText: {
    color: '#E91E63',
  },
  birthSubmitBtn: {
    backgroundColor: '#E91E63',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%' as const,
    alignItems: 'center' as const,
    marginTop: 6,
    marginBottom: 12,
  },
  birthSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  birthCancelBtn: { paddingVertical: 12 },
  birthCancelText: {
    color: COLOR.textLight,
    fontSize: 14,
    fontWeight: '600' as const,
  },

  /* === SOS Floating Button === */
  sosFab: {
    position: 'absolute',
    right: 16,
    bottom: Platform.OS === 'ios' ? 100 : 90,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  sosFabText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
});


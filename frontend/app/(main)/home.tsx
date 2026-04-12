import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
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
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { childApi, coachingApi, retentionApi, premiumApi } from '../../services/api';
import { useChildStore, Child } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { ChildSelector } from '../../components/home/ChildSelector';
import { WeeklyReportCard } from '../../components/home/WeeklyReportCard';
import { DailyDiaryCard } from '../../components/home/DailyDiaryCard';
import {
  ProactivePopup,
  PopupReason,
} from '../../components/coaching/ProactivePopup';
import { getCharacteristicForChild } from '../../constants/monthlyCharacteristics';
import { OnboardingGuide } from '../../components/common/OnboardingGuide';
import { AgeGroupKey } from '../../constants/ageGroups';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const COLOR = {
  bg: '#FFF5EC',
  card: '#FFFFFF',
  accent: '#FF8C5A',
  accentLight: '#FFF0E6',
  text: '#2D2016',
  textSub: '#8C7A6B',
  textLight: '#B5A99A',
  mint: '#7DD3B8',
  mintBg: '#E8F8F0',
  yellow: '#FFD76E',
  yellowBg: '#FFF8E1',
  coralBg: '#FFF0E6',
  shadow: '#2D2016',
};

interface QuickAction {
  icon: ReturnType<typeof require>;
  label: string;
  route: string;
  bg: string;
  ages: AgeGroupKey[]; // 표시할 연령 그룹
}

const ALL_ACTIONS: QuickAction[] = [
  // 공통
  { icon: require('../../assets/quick-learning.png'), label: '육아 기록', route: '/(main)/baby-tracker', bg: COLOR.mintBg, ages: ['infant', 'toddler'] },
  { icon: require('../../assets/quick-learning.png'), label: '생활 기록', route: '/(main)/baby-tracker', bg: COLOR.mintBg, ages: ['elementary'] },
  { icon: require('../../assets/quick-report.png'), label: '성장 통계', route: '/(main)/growth-stats', bg: COLOR.mintBg, ages: ['infant', 'toddler', 'elementary'] },
  // 영아 전용
  { icon: require('../../assets/cat-crying.png'), label: '울음 분석', route: '/(main)/cry-analyzer', bg: '#FFF0E6', ages: ['infant'] },
  { icon: require('../../assets/cat-poop.png'), label: '대변 분석', route: '/(main)/poop-analyzer', bg: '#FFF0E6', ages: ['infant', 'toddler'] },
  // 영유아
  { icon: require('../../assets/quick-sleep.png'), label: '수면 예측', route: '/(main)/sleep-predict', bg: '#EDE7F6', ages: ['infant', 'toddler'] },
  { icon: require('../../assets/quick-lullaby.png'), label: '자장가', route: '/(main)/lullaby', bg: '#EDE7F6', ages: ['infant', 'toddler'] },
  // 유아 + 초등
  { icon: require('../../assets/play-activity.png'), label: '놀이 학습', route: '/(main)/play-learning', bg: COLOR.yellowBg, ages: ['toddler', 'elementary'] },
  // 초등
  { icon: require('../../assets/icon-hospital.png'), label: '소아과', route: '/(main)/clinic', bg: '#E8F5E9', ages: ['infant', 'toddler', 'elementary'] },
  // 공통
  { icon: require('../../assets/quick-timeline.png'), label: '타임라인', route: '/(main)/album', bg: '#E0F2F1', ages: ['infant', 'toddler', 'elementary'] },
  { icon: require('../../assets/quick-coparenting.png'), label: '공동육아', route: '/(main)/coparenting', bg: '#FFF3E0', ages: ['infant', 'toddler', 'elementary'] },
  { icon: require('../../assets/quick-parent-level.png'), label: '새싹부모', route: '/(main)/parent-level', bg: '#E8F5E9', ages: ['infant', 'toddler', 'elementary'] },
];

function getActionsForAge(ageGroup: AgeGroupKey): QuickAction[] {
  return ALL_ACTIONS.filter((a) => a.ages.includes(ageGroup)).slice(0, 8);
}

/* ------------------------------------------------------------------ */
/* Retention Types                                                     */
/* ------------------------------------------------------------------ */

interface CountdownData {
  daysSinceBirth: number;
  childName: string;
  displayText: string;
  nextMilestone: { label: string; daysUntil: number; monthsUntil?: number } | null;
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

interface WeeklyReportData {
  period: string;
  totalSessions: number;
  report: string;
}

interface DailyDiaryData {
  diary: string;
  hasSessions: boolean;
}

const WEEKLY_REPORT_DISMISSED_KEY = 'amatda_weekly_report_dismissed';

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
  const [refreshing, setRefreshing] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupReason, setPopupReason] = useState<PopupReason>('inactive');
  const [popupFollowupText, setPopupFollowupText] = useState<
    string | undefined
  >(undefined);

  const [countdown, setCountdown] = useState<CountdownData | null>(null);
  const [dailyCard, setDailyCard] = useState<DailyCardData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportData | null>(null);
  const [dailyDiary, setDailyDiary] = useState<string | null>(null);

  const [aiInsightsOpen, setAiInsightsOpen] = useState(false);
  const [proactiveInsights, setProactiveInsights] = useState<Array<{
    type: string; title: string; message: string; actionLabel?: string; actionRoute?: string;
  }>>([]);

  const { children, selectedChild, setChildren, selectChild } =
    useChildStore();
  const { updateChild } = useChildStore();
  const logout = useAuthStore((s) => s.logout);
  const [trialPopupVisible, setTrialPopupVisible] = useState(false);

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
  }, []);

  const loadWeeklyReport = useCallback(async (childId: string) => {
    try {
      const dismissedWeek = await AsyncStorage.getItem(WEEKLY_REPORT_DISMISSED_KEY);
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      const weekKey = weekStart.toISOString().slice(0, 10);
      if (dismissedWeek === weekKey) return;

      const isMonday = now.getDay() === 1;
      if (!isMonday && dismissedWeek) return;

      const res = await coachingApi.weeklyReport(childId);
      const data = res.data?.data;
      if (data?.report) {
        setWeeklyReport({
          period: data.period as string,
          totalSessions: data.totalSessions as number,
          report: data.report as string,
        });
      }
    } catch {
      // endpoint not available yet
    }
  }, []);

  const loadDailyDiary = useCallback(async (childId: string) => {
    try {
      const res = await coachingApi.dailyDiary(childId);
      const data = res.data?.data as DailyDiaryData | undefined;
      if (data?.hasSessions && data?.diary) {
        setDailyDiary(data.diary);
      }
    } catch {
      // endpoint not available yet
    }
  }, []);

  const loadProactiveInsights = useCallback(async (childId: string) => {
    try {
      const res = await coachingApi.dailyInsight(childId);
      const data = res.data?.data as { insights?: Array<{ type: string; title: string; message: string; actionLabel?: string; actionRoute?: string }> } | undefined;
      if (data?.insights && data.insights.length > 0) {
        setProactiveInsights(data.insights);
      }
    } catch {
      // 인사이트 로딩 실패해도 앱은 정상
    }
  }, []);

  useEffect(() => {
    if (selectedChild) {
      loadRetentionData(selectedChild.id);
      loadWeeklyReport(selectedChild.id);
      loadDailyDiary(selectedChild.id);
      loadProactiveInsights(selectedChild.id);
    }
  }, [selectedChild?.id, loadRetentionData, loadWeeklyReport, loadDailyDiary, loadProactiveInsights]);

  const handleDismissWeeklyReport = useCallback(async () => {
    setWeeklyReport(null);
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      const weekKey = weekStart.toISOString().slice(0, 10);
      await AsyncStorage.setItem(WEEKLY_REPORT_DISMISSED_KEY, weekKey);
    } catch {
      // ignore
    }
  }, []);

  const loadChildren = async () => {
    try {
      const res = await childApi.list();
      setChildren(res.data?.data ?? []);
    } catch (e: unknown) {
      const axErr = e as { response?: { status?: number }; message?: string };
      console.error('loadChildren failed:', axErr.response?.status, axErr.message);
      if (axErr.response?.status === 401) {
        Alert.alert('인증 만료', '다시 로그인해주세요.');
      }
    } finally {
      setLoading(false);
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
    await loadChildren();
    if (selectedChild) {
      await Promise.allSettled([
        loadRetentionData(selectedChild.id),
        loadWeeklyReport(selectedChild.id),
        loadDailyDiary(selectedChild.id),
      ]);
    }
    setRefreshing(false);
  }, [selectedChild?.id, loadRetentionData, loadWeeklyReport, loadDailyDiary]);

  const pickPhoto = async () => {
    if (!selectedChild) return;
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    const updated = { ...selectedChild, photoUri: uri };
    updateChild(updated);
    try {
      await childApi.update(selectedChild.id, {
        photoUri: uri,
      } as Record<string, unknown>);
    } catch {
      // photo saved locally even if backend fails
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
          {/* === Compact Stats (D-day + Streak) === */}
          <CompactStats countdown={countdown} streak={streak} />

          {/* === Proactive Insight (AI가 먼저 말 거는 카드) === */}
          {proactiveInsights.length > 0 && (
            <InsightCards insights={proactiveInsights} />
          )}

          {/* === Today's Card === */}
          <TodayCard child={child} />

          {/* === Quick Actions (8 icons, 2 rows) === */}
          <AllActionsGrid ageGroup={child.ageInfo?.group ?? 'infant'} />

          {/* === Monthly Characteristic === */}
          <MonthlyCharCard child={child} />

          {/* === AI Insights (collapsible) === */}
          {(weeklyReport || dailyDiary) && (
            <View style={styles.insightsSection}>
              <TouchableOpacity
                style={styles.insightsHeader}
                onPress={() => setAiInsightsOpen((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.insightsTitle}>AI 인사이트</Text>
                <Text style={styles.insightsArrow}>{aiInsightsOpen ? '∧' : '∨'}</Text>
              </TouchableOpacity>
              {aiInsightsOpen && (
                <View style={styles.insightsBody}>
                  {weeklyReport ? (
                    <WeeklyReportCard report={weeklyReport} onDismiss={handleDismissWeeklyReport} />
                  ) : null}
                  {dailyDiary ? (
                    <DailyDiaryCard diary={dailyDiary} />
                  ) : null}
                </View>
              )}
            </View>
          )}

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
              프리미엄으로 업그레이드하면 AI 코칭 무제한, 상세 리포트 등 모든 기능을 이용할 수 있어요.
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
              ({child ? getAgeText(child.ageInfo.months) : ''})
            </Text>
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
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

function TodayCard({ child }: { child: Child }) {
  const report = child.analysisReport;
  const summaryRaw = report?.summary ?? child.innateData.label;

  const displayText = `${child.name}은(는) ${summaryRaw}`;

  return (
    <LinearGradient
      colors={['#FF8C5A', '#FFB88C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.todayCard}
    >
      <Text style={styles.todayQuoteIcon}>{'✨'}</Text>
      <Text style={styles.todayLabel}>오늘의 한마디</Text>
      <Text style={styles.todayText}>{displayText}</Text>
      <Text style={styles.todaySparkle}>{'✨'}</Text>
    </LinearGradient>
  );
}

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

function AllActionsGrid({ ageGroup }: { ageGroup: AgeGroupKey }) {
  const actions = getActionsForAge(ageGroup);
  return (
    <View style={styles.quickSection}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.label}
          style={styles.quickItem}
          onPress={() => router.push(action.route as never)}
          activeOpacity={0.7}
        >
          <View style={[styles.quickCircle, { backgroundColor: action.bg }]}>
            <Image source={action.icon} style={styles.quickIcon} resizeMode="contain" />
          </View>
          <Text style={styles.quickLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
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
      {countdown && (
        <View style={styles.compactStatItem}>
          <Text style={styles.compactStatValue}>D+{countdown.daysSinceBirth}</Text>
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
    </TouchableOpacity>
  );
}

function InsightCards({ insights }: { insights: Array<{ type: string; title: string; message: string; actionLabel?: string; actionRoute?: string }> }) {
  const TYPE_COLORS: Record<string, { bg: string; accent: string; icon: string }> = {
    pattern_alert: { bg: '#FFF0E6', accent: '#FF8C5A', icon: '!' },
    milestone_tip: { bg: '#E8F8F0', accent: '#7DD3B8', icon: '\u2605' },
    encouragement: { bg: '#FFF8E1', accent: '#FFD76E', icon: '\u2665' },
    smart_question: { bg: '#EEEDFC', accent: '#7C83EC', icon: '?' },
    weekly_summary: { bg: '#E8F4FD', accent: '#5BA8D9', icon: '\u03A3' },
  };

  return (
    <View style={{ marginBottom: 16 }}>
      {insights.map((ins, idx) => {
        const colors = TYPE_COLORS[ins.type] || TYPE_COLORS.encouragement;
        return (
          <TouchableOpacity
            key={`${ins.type}-${idx}`}
            style={{
              backgroundColor: colors.bg,
              borderRadius: 16,
              padding: 16,
              marginBottom: idx < insights.length - 1 ? 10 : 0,
              borderLeftWidth: 4,
              borderLeftColor: colors.accent,
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

const CARD_SHADOW = {
  shadowColor: COLOR.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
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
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLOR.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  iconEmoji: {
    fontSize: 18,
  },

  /* === 2. Today's Card === */
  todayCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  todayQuoteIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  todayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
  },
  todayText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 26,
  },
  todaySparkle: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    fontSize: 28,
    opacity: 0.3,
  },

  /* === Monthly Characteristic Card === */
  monthlyCard: {
    backgroundColor: COLOR.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: COLOR.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
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
    justifyContent: 'space-around',
    marginBottom: 28,
    paddingHorizontal: 8,
    rowGap: 16,
  },
  quickItem: {
    alignItems: 'center',
    gap: 8,
  },
  quickCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLOR.text,
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    ...CARD_SHADOW,
  },
  recoEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLOR.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#FFE0CC',
    ...CARD_SHADOW,
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
    backgroundColor: '#F0E6DC',
    marginHorizontal: 8,
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
    borderColor: '#F0E6DC',
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

  /* === SOS Floating Button === */
  sosFab: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 100 : 90,
    width: 56,
    height: 56,
    borderRadius: 28,
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
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
});


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
  Share,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { childApi, coachingApi, retentionApi } from '../../services/api';
import { useChildStore, Child } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { ChildSelector } from '../../components/home/ChildSelector';
import { WeeklyReportCard } from '../../components/home/WeeklyReportCard';
import { DailyDiaryCard } from '../../components/home/DailyDiaryCard';
import {
  ProactivePopup,
  PopupReason,
} from '../../components/coaching/ProactivePopup';

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

const QUICK_ACTIONS: {
  emoji: string;
  label: string;
  route: string;
  bg: string;
}[] = [
  {
    emoji: '🧩',
    label: '기질 요약',
    route: '/(main)/trait-detail',
    bg: COLOR.coralBg,
  },
  {
    emoji: '📊',
    label: '성장 기록',
    route: '/(main)/growth-stats',
    bg: COLOR.mintBg,
  },
  {
    emoji: '📝',
    label: '관찰 일기',
    route: '/(main)/diary',
    bg: COLOR.yellowBg,
  },
  {
    emoji: '📚',
    label: '추천 학습',
    route: '/(main)/academy',
    bg: COLOR.mintBg,
  },
];

/* ------------------------------------------------------------------ */
/* Retention Types                                                     */
/* ------------------------------------------------------------------ */

interface CountdownData {
  daysSinceBirth: number;
  childName: string;
  nextMilestone: string;
  daysUntilMilestone: number;
}

interface DailyCardData {
  emoji: string;
  tip: string;
  category: string;
}

interface StreakData {
  currentStreak: number;
  level: number;
  levelName: string;
  progressToNext: number;
  maxForNext: number;
}

interface ParentMentalData {
  stressLevel: 'low' | 'medium' | 'high';
  encouragement: string;
  feeling: string;
}

interface FuturePredictData {
  currentAge: string;
  predictedAge: string;
  predictions: string[];
  prepTips: string[];
}

interface NowActivityData {
  activityName: string;
  duration: string;
  reason: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
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

function getRecommendations(child: Child): {
  emoji: string;
  title: string;
  desc: string;
  route: string;
}[] {
  const dominant = child.innateData.dominantType;
  const group = child.ageInfo.group;

  const base = [
    {
      emoji: '🎨',
      title: '창의력이 쐑쐑! 미술 체험 추천',
      desc: `${child.name}의 기질에 맞는 창의 활동을 확인하세요`,
      route: '/(main)/play-learning',
    },
    {
      emoji: '📚',
      title: '집에서 할 수 있는 놀이학습 방법',
      desc: '연령에 맞춴 홈스쿨링 가이드',
      route: '/(main)/play-learning',
    },
    {
      emoji: '🥗',
      title: '면역력에 좋은 제철 음식 추천',
      desc: '성장기 영양 밸런스를 맞춰보세요',
      route: '/(main)/nutrition',
    },
  ];

  if (group === 'infant') {
    base[0] = {
      emoji: '👶',
      title: '감각 발달 놀이 추천',
      desc: '오감을 자극하는 놀이 활동이에요',
      route: '/(main)/play-learning',
    };
    base[2] = {
      emoji: '🍜',
      title: '월령별 이유식 가이드',
      desc: '단계별 이유식 레시피를 확인하세요',
      route: '/(main)/nutrition',
    };
  }

  if (dominant.includes('활동') || dominant.includes('火')) {
    base[0] = {
      emoji: '⚽',
      title: '에너지 넘치는 체육 활동 추천',
      desc: '활동적인 기질에 맞는 스포츠를 찾아보세요',
      route: '/(main)/play-learning',
    };
  }

  return base;
}

/* ------------------------------------------------------------------ */
/* Main Screen                                                         */
/* ------------------------------------------------------------------ */

const LAST_OPEN_KEY = 'amatda_last_open_ts';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

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

  const [parentMental, setParentMental] = useState<ParentMentalData | null>(null);
  const [futurePrediction, setFuturePrediction] = useState<FuturePredictData | null>(null);
  const [nowActivity, setNowActivity] = useState<NowActivityData | null>(null);

  const { children, selectedChild, setChildren, selectChild } =
    useChildStore();
  const { updateChild } = useChildStore();
  const logout = useAuthStore((s) => s.logout);

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

  useEffect(() => {
    loadChildren();
    checkProactivePopup();
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

  const loadParentMental = useCallback(async (childId: string, streakDays: number) => {
    if (streakDays < 3) return;
    try {
      const res = await coachingApi.parentMental(childId);
      const data = res.data?.data as ParentMentalData | undefined;
      if (data?.encouragement) {
        setParentMental(data);
      }
    } catch {
      // silently hide section
    }
  }, []);

  const loadFuturePrediction = useCallback(async (childId: string) => {
    try {
      const res = await coachingApi.futurePredict(childId);
      const data = res.data?.data as FuturePredictData | undefined;
      if (data?.predictions && data.predictions.length > 0) {
        setFuturePrediction(data);
      }
    } catch {
      // silently hide section
    }
  }, []);

  const loadNowActivity = useCallback(async (childId: string) => {
    try {
      const res = await coachingApi.nowActivity(childId);
      const data = res.data?.data as NowActivityData | undefined;
      if (data?.activityName) {
        setNowActivity(data);
      }
    } catch {
      // silently hide section
    }
  }, []);

  useEffect(() => {
    if (selectedChild) {
      loadRetentionData(selectedChild.id);
      loadWeeklyReport(selectedChild.id);
      loadDailyDiary(selectedChild.id);
      loadFuturePrediction(selectedChild.id);
      loadNowActivity(selectedChild.id);
    }
  }, [selectedChild?.id, loadRetentionData, loadWeeklyReport, loadDailyDiary, loadFuturePrediction, loadNowActivity]);

  // Load parent mental care after streak data is available (requires 3+ day streak)
  useEffect(() => {
    if (selectedChild && streak) {
      loadParentMental(selectedChild.id, streak.currentStreak);
    }
  }, [selectedChild?.id, streak, loadParentMental]);

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
      setChildren(res.data.data);
    } catch {
      // token expired etc
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
        loadFuturePrediction(selectedChild.id),
        loadNowActivity(selectedChild.id),
      ]);
      // parent mental depends on streak, will reload via useEffect
    }
    setRefreshing(false);
  }, [selectedChild?.id, loadRetentionData, loadWeeklyReport, loadDailyDiary, loadFuturePrediction, loadNowActivity]);

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLOR.accent}
        />
      }
    >
      {/* === 1. Header === */}
      <Header child={child} onPickPhoto={pickPhoto} />

      {/* === Child Selector (multi-child) === */}
      {children.length > 1 && (
        <ChildSelector
          children={children}
          selectedId={selectedChild?.id ?? ''}
          onSelect={selectChild}
        />
      )}

      {child && (
        <>
          {/* === Growth Countdown === */}
          {countdown && <GrowthCountdown data={countdown} />}

          {/* === Now Activity (prominent position) === */}
          {nowActivity && <NowActivityCard data={nowActivity} />}

          {/* === Streak Badge === */}
          {streak && <StreakBadge data={streak} />}

          {/* === Parent Mental Care (3+ day streak) === */}
          {parentMental && <ParentMentalCard data={parentMental} />}

          {/* === 2. Today's Card === */}
          <TodayCard child={child} />

          {/* === Weekly Report === */}
          {weeklyReport ? (
            <WeeklyReportCard
              report={weeklyReport}
              onDismiss={handleDismissWeeklyReport}
            />
          ) : null}

          {/* === Daily Diary === */}
          {dailyDiary ? (
            <DailyDiaryCard diary={dailyDiary} />
          ) : null}

          {/* === Daily Tip Card === */}
          {dailyCard && <DailyTipCard data={dailyCard} />}

          {/* === Future Prediction === */}
          {futurePrediction && <FuturePredictCard data={futurePrediction} />}

          {/* === 3. Quick Action Circles === */}
          <QuickActions />

          {/* === 4. Weekly Recommendations === */}
          <RecommendationSection child={child} />
        </>
      )}

      {/* Add Child */}
      <TouchableOpacity
        style={styles.addMore}
        onPress={() => router.push('/onboarding/child-info')}
      >
        <Text style={styles.addMoreText}>+ 자녀 추가</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>{'아맞다 v1.0.0'}</Text>

      {/* Proactive Popup */}
      <ProactivePopup
        visible={popupVisible}
        reason={popupReason}
        followupText={popupFollowupText}
        onRespond={handlePopupRespond}
        onDismiss={handlePopupDismiss}
      />
    </ScrollView>
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
            <View style={styles.childPhotoPlaceholder}>
              <Text style={styles.childPhotoEmoji}>
                {child?.gender === 'F' ? '👧' : '👦'}
              </Text>
            </View>
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
          onPress={() => router.push('/(main)/chatbot' as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconEmoji}>{'🔔'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(main)/profile' as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconEmoji}>{'⚙️'}</Text>
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

function QuickActions() {
  return (
    <View style={styles.quickSection}>
      {QUICK_ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.label}
          style={styles.quickItem}
          onPress={() => router.push(action.route as never)}
          activeOpacity={0.7}
        >
          <View
            style={[styles.quickCircle, { backgroundColor: action.bg }]}
          >
            <Text style={styles.quickEmoji}>{action.emoji}</Text>
          </View>
          <Text style={styles.quickLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RecommendationSection({ child }: { child: Child }) {
  const items = getRecommendations(child);

  return (
    <View style={styles.recoSection}>
      <View style={styles.recoHeader}>
        <Text style={styles.recoTitle}>이번 주 추천</Text>
        <TouchableOpacity
          onPress={() => router.push('/(main)/academy' as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.recoMore}>더보기 &gt;</Text>
        </TouchableOpacity>
      </View>
      {items.map((item, idx) => (
        <TouchableOpacity
          key={idx}
          style={styles.recoCard}
          activeOpacity={0.7}
          onPress={() => router.push(item.route as never)}
        >
          <View style={styles.recoEmojiWrap}>
            <Text style={styles.recoEmoji}>{item.emoji}</Text>
          </View>
          <View style={styles.recoTextWrap}>
            <Text style={styles.recoCardTitle}>{item.title}</Text>
            <Text style={styles.recoCardDesc}>{item.desc}</Text>
          </View>
          <Text style={styles.recoChevron}>{'›'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function GrowthCountdown({ data }: { data: CountdownData }) {
  return (
    <LinearGradient
      colors={['#FF8C5A', '#FF6B6B']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.countdownCard}
    >
      <Text style={styles.countdownMain}>
        {data.childName}{'가 이 세상에 온 지 '}
        <Text style={styles.countdownDays}>{data.daysSinceBirth}</Text>
        {'일째'}
      </Text>
      <Text style={styles.countdownSub}>
        {'D-'}{data.daysUntilMilestone}{' '}{data.nextMilestone}
      </Text>
    </LinearGradient>
  );
}

function DailyTipCard({ data }: { data: DailyCardData }) {
  const handleShare = async () => {
    try {
      await Share.share({
        message: `${data.emoji} ${data.tip}`,
      });
    } catch {
      // share cancelled or failed
    }
  };

  return (
    <View style={styles.dailyTipCard}>
      <View style={styles.dailyTipHeader}>
        <Text style={styles.dailyTipEmoji}>{data.emoji}</Text>
        <Text style={styles.dailyTipLabel}>{data.category}</Text>
      </View>
      <Text style={styles.dailyTipText}>{data.tip}</Text>
      <TouchableOpacity
        style={styles.dailyTipShareBtn}
        onPress={handleShare}
        activeOpacity={0.7}
      >
        <Text style={styles.dailyTipShareText}>{'공유하기'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function StreakBadge({ data }: { data: StreakData }) {
  const progress = data.maxForNext > 0
    ? Math.min(data.progressToNext / data.maxForNext, 1)
    : 0;

  return (
    <View style={styles.streakCard}>
      <View style={styles.streakTop}>
        <Text style={styles.streakText}>
          {'🔥 연속 '}{data.currentStreak}{'일째! '}
          {data.levelName}{' Lv.'}{data.level}
        </Text>
      </View>
      <View style={styles.streakBarBg}>
        <View
          style={[styles.streakBarFill, { width: `${progress * 100}%` }]}
        />
      </View>
      <Text style={styles.streakNextText}>
        {'다음 레벨까지 '}{data.maxForNext - data.progressToNext}{'일'}
      </Text>
    </View>
  );
}

function ParentMentalCard({ data }: { data: ParentMentalData }) {
  const stressColors: Record<string, string> = {
    low: '#7DD3B8',
    medium: '#FFD76E',
    high: '#FF8C5A',
  };
  const stressLabels: Record<string, string> = {
    low: '안정',
    medium: '보통',
    high: '주의',
  };
  const stressColor = stressColors[data.stressLevel] ?? '#7DD3B8';
  const stressLabel = stressLabels[data.stressLevel] ?? '안정';

  return (
    <View style={aiStyles.mentalCard}>
      <View style={aiStyles.mentalHeader}>
        <Text style={aiStyles.sectionEmoji}>{'💆'}</Text>
        <Text style={aiStyles.sectionTitle}>{'부모 멘탈 케어'}</Text>
      </View>
      <View style={aiStyles.mentalStressRow}>
        <Text style={aiStyles.mentalStressLabel}>{'스트레스 수준'}</Text>
        <View style={[aiStyles.mentalStressBadge, { backgroundColor: stressColor }]}>
          <Text style={aiStyles.mentalStressBadgeText}>{stressLabel}</Text>
        </View>
      </View>
      <Text style={aiStyles.mentalEncouragement}>{data.encouragement}</Text>
      <View style={aiStyles.mentalFeelingRow}>
        <Text style={aiStyles.mentalFeelingLabel}>{'오늘의 위로'}</Text>
        <Text style={aiStyles.mentalFeelingText}>{data.feeling}</Text>
      </View>
    </View>
  );
}

function FuturePredictCard({ data }: { data: FuturePredictData }) {
  return (
    <View style={aiStyles.futureCard}>
      <View style={aiStyles.futureHeader}>
        <Text style={aiStyles.sectionEmoji}>{'🔮'}</Text>
        <Text style={aiStyles.sectionTitle}>{'3개월 후 예측'}</Text>
      </View>
      <View style={aiStyles.futureAgeRow}>
        <Text style={aiStyles.futureAgeText}>{data.currentAge}</Text>
        <Text style={aiStyles.futureArrow}>{'→'}</Text>
        <Text style={aiStyles.futureAgePredicted}>{data.predictedAge}</Text>
      </View>
      {data.predictions.slice(0, 3).map((pred, idx) => (
        <View key={idx} style={aiStyles.futureBulletRow}>
          <Text style={aiStyles.futureBullet}>{'•'}</Text>
          <Text style={aiStyles.futureBulletText}>{pred}</Text>
        </View>
      ))}
      {data.prepTips.length > 0 && (
        <View style={aiStyles.futureTipSection}>
          <Text style={aiStyles.futureTipLabel}>{'미리 준비하세요'}</Text>
          {data.prepTips.slice(0, 2).map((tip, idx) => (
            <View key={idx} style={aiStyles.futureBulletRow}>
              <Text style={aiStyles.futureTipBullet}>{'✓'}</Text>
              <Text style={aiStyles.futureTipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function NowActivityCard({ data }: { data: NowActivityData }) {
  const timeEmojis: Record<string, string> = {
    morning: '🌅',
    afternoon: '☀️',
    evening: '🌙',
  };
  const timeLabels: Record<string, string> = {
    morning: '오전',
    afternoon: '오후',
    evening: '저녁',
  };
  const timeEmoji = timeEmojis[data.timeOfDay] ?? '☀️';
  const timeLabel = timeLabels[data.timeOfDay] ?? '오후';

  return (
    <View style={aiStyles.activityCard}>
      <View style={aiStyles.activityHeader}>
        <Text style={aiStyles.sectionEmoji}>{timeEmoji}</Text>
        <Text style={aiStyles.activityTimeLabel}>{timeLabel}{' 추천 활동'}</Text>
      </View>
      <Text style={aiStyles.activityName}>{data.activityName}</Text>
      <Text style={aiStyles.activityDuration}>{data.duration}</Text>
      <Text style={aiStyles.activityReason}>{data.reason}</Text>
      <TouchableOpacity
        style={aiStyles.activityButton}
        onPress={() => router.push('/(main)/play-learning' as never)}
        activeOpacity={0.7}
      >
        <Text style={aiStyles.activityButtonText}>{'해보기'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyEmoji}>{'👶'}</Text>
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
  childPhotoEmoji: {
    fontSize: 24,
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
  quickEmoji: {
    fontSize: 28,
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
  recoEmoji: {
    fontSize: 22,
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

  /* === Growth Countdown === */
  countdownCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center' as const,
  },
  countdownMain: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    lineHeight: 24,
  },
  countdownDays: {
    fontSize: 28,
    fontWeight: '800' as const,
  },
  countdownSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    fontWeight: '500' as const,
  },

  /* === Daily Tip Card === */
  dailyTipCard: {
    backgroundColor: '#E8F8F0',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  dailyTipHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  dailyTipEmoji: {
    fontSize: 24,
  },
  dailyTipLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4ECDC4',
  },
  dailyTipText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: COLOR.text,
    lineHeight: 23,
    marginBottom: 14,
  },
  dailyTipShareBtn: {
    alignSelf: 'flex-start' as const,
    backgroundColor: '#4ECDC4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dailyTipShareText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },

  /* === Streak Badge === */
  streakCard: {
    backgroundColor: COLOR.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0CC',
    ...CARD_SHADOW,
  },
  streakTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLOR.text,
  },
  streakBarBg: {
    height: 6,
    backgroundColor: '#F0E6DC',
    borderRadius: 3,
    overflow: 'hidden' as const,
    marginBottom: 4,
  },
  streakBarFill: {
    height: 6,
    backgroundColor: COLOR.accent,
    borderRadius: 3,
  },
  streakNextText: {
    fontSize: 11,
    color: COLOR.textSub,
    textAlign: 'right' as const,
  },

  /* === Empty state === */
  emptyEmoji: {
    fontSize: 48,
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
});

/* ------------------------------------------------------------------ */
/* AI Feature Card Styles                                              */
/* ------------------------------------------------------------------ */

const aiStyles = StyleSheet.create({
  /* Shared */
  sectionEmoji: {
    fontSize: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLOR.text,
  },

  /* === Parent Mental Care === */
  mentalCard: {
    backgroundColor: '#F8F0FF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E4D4F4',
    ...CARD_SHADOW,
  },
  mentalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 14,
  },
  mentalStressRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  mentalStressLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLOR.textSub,
  },
  mentalStressBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  mentalStressBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  mentalEncouragement: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: COLOR.text,
    lineHeight: 23,
    marginBottom: 12,
  },
  mentalFeelingRow: {
    backgroundColor: '#F0EAFF',
    borderRadius: 12,
    padding: 12,
  },
  mentalFeelingLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#9B7FD4',
    marginBottom: 4,
  },
  mentalFeelingText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: COLOR.text,
    lineHeight: 21,
  },

  /* === Future Prediction === */
  futureCard: {
    backgroundColor: '#F3EEFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  futureHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 14,
  },
  futureAgeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  futureAgeText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: COLOR.textSub,
  },
  futureArrow: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#A78BFA',
  },
  futureAgePredicted: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#7C3AED',
  },
  futureBulletRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginBottom: 6,
  },
  futureBullet: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '700' as const,
    marginTop: 1,
  },
  futureBulletText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: COLOR.text,
    lineHeight: 21,
    flex: 1,
  },
  futureTipSection: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  futureTipLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#7C3AED',
    marginBottom: 8,
  },
  futureTipBullet: {
    fontSize: 13,
    color: '#A78BFA',
    fontWeight: '700' as const,
    marginTop: 1,
  },
  futureTipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: COLOR.text,
    lineHeight: 20,
    flex: 1,
  },

  /* === Now Activity === */
  activityCard: {
    backgroundColor: COLOR.coralBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFD6C0',
  },
  activityHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  activityTimeLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLOR.accent,
  },
  activityName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLOR.text,
    marginBottom: 4,
  },
  activityDuration: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLOR.textSub,
    marginBottom: 8,
  },
  activityReason: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: COLOR.text,
    lineHeight: 21,
    marginBottom: 14,
  },
  activityButton: {
    alignSelf: 'flex-start' as const,
    backgroundColor: COLOR.accent,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  activityButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});

import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
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
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { pickImageFromLibrary } from '../../utils/imagePicker';
import { getTraitTypeName } from '../../utils/traitTypeName';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { childApi, coachingApi, premiumApi, uploadApi, announcementApi } from '../../services/api';
import { AnnouncementPopup, type Announcement, type DismissChoice } from '../../components/common/AnnouncementPopup';
import { useChildStore, Child } from '../../stores/childStore';
import { useFeverStore } from '../../stores/feverStore';
import { DenseStatsRow } from '../../components/home/DenseStatsRow';
import { PregnancyJourneyCard } from '../../components/home/PregnancyJourneyCard';
import { HospitalRegisterBanner } from '../../components/pregnancy/HospitalRegisterBanner';
import { HospitalRegisterPrompt } from '../../components/pregnancy/HospitalRegisterPrompt';
import { NextCheckupModal } from '../../components/home/NextCheckupModal';
import { getNextCheckup, useCheckupStore } from '../../services/checkup';
import { ChildSelector } from '../../components/home/ChildSelector';
import { useUiStore } from '../../stores/uiStore';
import {
  cancelAllPregnancyLocalNotifications,
  loadNotificationPrefs,
  syncScheduledNotifications,
  scheduleFirstCoachingNudge,
} from '../../services/pushNotifications';
// AI Insights UI 제거됨 (WeeklyReportCard, DailyDiaryCard 미사용)
import {
  ProactivePopup,
  PopupReason,
} from '../../components/coaching/ProactivePopup';
import { getCharacteristicForChild } from '../../constants/monthlyCharacteristics';
import { OnboardingGuide } from '../../components/common/OnboardingGuide';
import { AdSlot } from '../../components/ads/AdSlot';
import { AgeGroupKey } from '../../constants/ageGroups';
import { CenterModal } from '../../components/ui/CenterModal';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';

/* ------------------------------------------------------------------ */
/* Pregnancy week-appropriate questions                                */
/* ------------------------------------------------------------------ */

function getWeeklyQuestion(name: string, week: number, t: TFunction): { emoji: string; text: string; desc: string } {
  if (week <= 6) return { emoji: '🌱', text: t('home.weeklyQuestion.week6', { name }), desc: t('home.weeklyQuestion.descBirthRegister') };
  if (week <= 10) return { emoji: '💓', text: t('home.weeklyQuestion.week10', { name }), desc: t('home.weeklyQuestion.descTapIfBorn') };
  if (week <= 13) return { emoji: '🔬', text: t('home.weeklyQuestion.week13', { name }), desc: t('home.weeklyQuestion.descTapIfBorn') };
  if (week <= 16) return { emoji: '🌿', text: t('home.weeklyQuestion.week16', { name }), desc: t('home.weeklyQuestion.descTapIfBorn') };
  if (week <= 20) return { emoji: '🎀', text: t('home.weeklyQuestion.week20', { name }), desc: t('home.weeklyQuestion.descTapIfBorn') };
  if (week <= 24) return { emoji: '🦶', text: t('home.weeklyQuestion.week24', { name }), desc: t('home.weeklyQuestion.descTapIfBorn') };
  if (week <= 28) return { emoji: '📋', text: t('home.weeklyQuestion.week28', { name }), desc: t('home.weeklyQuestion.descTapIfBorn') };
  if (week <= 32) return { emoji: '📚', text: t('home.weeklyQuestion.week32'), desc: t('home.weeklyQuestion.descTapIfBorn') };
  if (week <= 36) return { emoji: '🧳', text: t('home.weeklyQuestion.week36', { name }), desc: t('home.weeklyQuestion.descTapIfBorn') };
  if (week <= 39) return { emoji: '🤰', text: t('home.weeklyQuestion.week39', { name }), desc: t('home.weeklyQuestion.descTapIfBorn') };
  return { emoji: '👶', text: t('home.weeklyQuestion.week40plus', { name }), desc: t('home.weeklyQuestion.descTapToCare') };
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const COLOR = {
  bg: '#FFFFFF',            // 순백 iOS
  card: '#FFFFFF',
  accent: '#F4A98C',        // 톤다운
  accentLight: '#FFF4EE',
  text: '#333333',          // 부드러운 검정 (베빌 톤)
  textSub: '#666666',
  textLight: '#9E9E9E',
  mint: '#7FD4CD',
  mintBg: '#F0FAF7',
  yellow: '#FFD76E',
  yellowBg: '#FFFCF0',
  coralBg: '#FFF8F3',
  shadow: '#000',
};

interface QuickAction {
  icon: ReturnType<typeof require>;
  /** emoji가 지정되면 icon 대신 큰 이모지로 렌더 (직관성 우선) */
  emoji?: string;
  /** i18n 키 접미사 — home.quickActions.{labelKey} 로 표시 문구 조회 + React key 로도 사용 */
  labelKey: string;
  route: string;
  bg: string;
  ages: AgeGroupKey[]; // 표시할 연령 그룹
  /** 열나열나 등 — 38°C+ 최근 기록이 있으면 깜빡 애니메이션 트리거 */
  feverAlert?: boolean;
}

const ALL_ACTIONS: QuickAction[] = [
  // 임산부 전용 (pregnant 필터링 시 먼저 노출)
  { icon: require('../../assets/quick-learning.png'), labelKey: 'pregnancyAlbum', route: '/(main)/pregnancy', bg: '#FCE4EC', ages: ['pregnant'] },
  { icon: require('../../assets/quick-baby.png'), labelKey: 'weeklyDevelopment', route: '/(main)/growth-stats', bg: '#F3E5F5', ages: ['pregnant'] },
  { icon: require('../../assets/quick-blood.png'), labelKey: 'gdm', route: '/(main)/gdm', bg: '#FCE4EC', ages: ['pregnant'] },
  { icon: require('../../assets/quick-sleep.png'), labelKey: 'kickCheck', route: '/(main)/labor-monitor?tab=kick', bg: '#FCE4EC', ages: ['pregnant'] },
  { icon: require('../../assets/quick-parent-level.png'), labelKey: 'momWellness', route: '/(main)/mom-wellness', bg: '#F8BBD0', ages: ['pregnant'] },
  { icon: require('../../assets/quick-lullaby.png'), labelKey: 'prenatalMusic', route: '/(main)/lullaby?mode=prenatal', bg: '#EDE7F6', ages: ['pregnant'] },

  // 영아·유아 순서 (사용자 요청 순서): 아기시간 → 성장앨범 → 열나 → 성장통계 → 접종달력 → 자장가 → 맘스톡 → 가족육아
  { icon: require('../../assets/quick-learning.png'), labelKey: 'babyTime', route: '/(main)/baby-tracker', bg: COLOR.mintBg, ages: ['infant', 'toddler'] },
  { icon: require('../../assets/quick-timeline.png'), labelKey: 'growthAlbum', route: '/(main)/album', bg: '#E0F2F1', ages: ['infant', 'toddler', 'elementary'] },
  { icon: require('../../assets/quick-thermometer.png'), labelKey: 'fever', route: '/(main)/fever', bg: '#FFF0F0', ages: ['infant', 'toddler'], feverAlert: true },
  { icon: require('../../assets/quick-sprout.png'), labelKey: 'growthStats', route: '/(main)/growth-stats', bg: COLOR.mintBg, ages: ['infant', 'toddler', 'elementary'] },
  { icon: require('../../assets/quick-syringe.png'), labelKey: 'vaccination', route: '/(main)/vaccination', bg: '#E3F2FD', ages: ['infant', 'toddler'] },
  { icon: require('../../assets/quick-lullaby.png'), labelKey: 'lullaby', route: '/(main)/lullaby', bg: '#EDE7F6', ages: ['infant', 'toddler'] },
  { icon: require('../../assets/icon-heart.png'), labelKey: 'momGroup', route: '/(main)/mom-group', bg: '#FCE4EC', ages: ['pregnant', 'infant', 'toddler', 'elementary'] },
  { icon: require('../../assets/quick-coparenting.png'), labelKey: 'coparenting', route: '/(main)/coparenting', bg: '#FFF3E0', ages: ['pregnant', 'infant', 'toddler', 'elementary'] },

  // 초등 전용
  { icon: require('../../assets/quick-learning.png'), labelKey: 'lifeLog', route: '/(main)/baby-tracker', bg: COLOR.mintBg, ages: ['elementary'] },
  // 놀이 학습은 맞춤추천 카드에 이미 있으므로 퀵메뉴에서는 초등만 노출
  { icon: require('../../assets/play-activity.png'), labelKey: 'playLearning', route: '/(main)/play-learning', bg: COLOR.yellowBg, ages: ['elementary'] },
];

const VACCINE_ACTION: QuickAction = {
  icon: require('../../assets/quick-syringe.png'), labelKey: 'vaccination', route: '/(main)/vaccination', bg: '#E3F2FD', ages: ['pregnant'],
};

function getActionsForAge(ageGroup: AgeGroupKey, locale: string, child?: Child | null): QuickAction[] {
  let filtered = ALL_ACTIONS.filter((a) => a.ages.includes(ageGroup));

  // 예방접종은 한국 질병관리청 국가예방접종 일정 기반 — 한국어 로케일에서만 노출.
  // (맘스톡은 개월수+GPS거리 기반이라 로케일 무관하게 유지 — 지역방은 이미 deprecated)
  if (locale !== 'ko') {
    filtered = filtered.filter((a) => a.labelKey !== 'vaccination');
  }

  // 임산부: 출산 1달전부터 접종달력 표시 (한국어 로케일만)
  if (ageGroup === 'pregnant' && child?.dueDate && locale === 'ko') {
    const daysUntilDue = Math.ceil((new Date(child.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= 30) {
      filtered.push(VACCINE_ACTION);
    }
  }

  // 임산부 막달엔 접종달력 포함 9개까지 허용(slice(0,8)에 잘려 영구 미노출되던 문제).
  // 그 외 연령은 4열 그리드 2줄(최대 8개)로 캡.
  return filtered.slice(0, ageGroup === 'pregnant' ? 9 : 8);
}

/* ------------------------------------------------------------------ */
function getAgeText(months: number, t: TFunction): string {
  if (months < 12) return t('home.age.months', { count: months });
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (remaining === 0) return t('home.age.years', { count: years });
  return t('home.age.yearsMonths', { years, months: remaining });
}

/* ── 맞춤 추천 카테고리 (홈 + 마이페이지 동일) ── */

function getRecoCategories(t: TFunction) {
  return [
    { icon: require('../../assets/cat-eating.png'), label: t('recommendations.category.food.label'), category: '음식', desc: t('recommendations.category.food.description'), color: '#F4A98C', bg: '#FFF0E6' },
    { icon: require('../../assets/cat-growth.png'), label: t('recommendations.category.lifestyle.label'), category: '생활습관', desc: t('recommendations.category.lifestyle.description'), color: '#4ECDC4', bg: '#E8FAF8' },
    { icon: require('../../assets/cat-social.png'), label: t('recommendations.category.academy.label'), category: '학원', desc: t('recommendations.category.academy.description'), color: '#7C83EC', bg: '#EEEDFC' },
    { icon: require('../../assets/play-activity.png'), label: t('recommendations.category.playLearning.label'), category: '놀이학습', desc: t('recommendations.category.playLearning.description'), color: '#FFB344', bg: '#FFF8E1' },
  ] as const;
}

/* ------------------------------------------------------------------ */
/* Main Screen                                                         */
/* ------------------------------------------------------------------ */

const LAST_OPEN_KEY = 'amatda_last_open_ts';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const TRIAL_AUTO_KEY = 'amatda_trial_auto_started';
const TRIAL_POPUP_KEY = 'amatda_trial_popup_dismissed';


export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const overlayCount = useUiStore((s) => s.overlayCount);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupReason, setPopupReason] = useState<PopupReason>('inactive');
  const [popupFollowupText, setPopupFollowupText] = useState<
    string | undefined
  >(undefined);

  // 다음 검진 모달 상태 + 현재 저장된 ISO date
  const [checkupModalOpen, setCheckupModalOpen] = useState(false);
  const [currentCheckup, setCurrentCheckup] = useState<string | null>(null);
  const checkupVer = useCheckupStore((s) => s.version);
  // babyTip은 selectedChild 선언 이후에 호출 (TDZ 방지)

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

  // ── 시작 공지 팝업 ──
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [announcementVisible, setAnnouncementVisible] = useState(false);

  const checkAnnouncement = useCallback(async () => {
    try {
      // iOS 터치먹통 방지: 첫 실행 가이드(OnboardingGuide=Modal)가 뜰 차례면
      // 공지 팝업(Modal)을 동시에 띄우지 않는다. iOS는 Modal 2개 동시 노출 시
      // 터치 응답이 죽음. 가이드를 닫은(=key '1') 다음 실행부터 공지 노출.
      const guideShown = await AsyncStorage.getItem('amatda_onboarding_guide_shown');
      if (guideShown !== '1') return;

      const res = await announcementApi.active();
      const ann = res.data?.data as Announcement | null;
      if (!ann || !ann.id) return;
      // "다시 보지 않기" 기간 내면 스킵
      const until = await AsyncStorage.getItem(`announcement_dismiss_${ann.id}`);
      if (until) {
        const ts = Date.parse(until);
        if (!Number.isNaN(ts) && ts > Date.now()) return;
      }
      setAnnouncement(ann);
      setAnnouncementVisible(true);
    } catch (err) {
      console.warn('[home] announcement check failed:', err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleAnnouncementClose = useCallback(async (choice: DismissChoice) => {
    setAnnouncementVisible(false);
    if (!announcement || choice === 'none') return;
    let until: number;
    if (choice === 'week') {
      until = Date.now() + 7 * 24 * 60 * 60 * 1000;
    } else {
      const d = new Date();
      d.setHours(24, 0, 0, 0); // 다음날 0시
      until = d.getTime();
    }
    try {
      await AsyncStorage.setItem(`announcement_dismiss_${announcement.id}`, new Date(until).toISOString());
    } catch { /* best-effort */ }
  }, [announcement]);

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
          Alert.alert(t('home.trialStartAlert.title'), t('home.trialStartAlert.desc'));
          return;
        }
        if (alreadyStarted && status.trialDaysLeft !== undefined && status.trialDaysLeft <= 0) {
          const dismissed = await AsyncStorage.getItem(TRIAL_POPUP_KEY);
          if (!dismissed) {
            setTrialPopupVisible(true);
          }
        }
      }
    } catch (err) {
      console.warn('[home] trial check failed:', err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    // mount 시 3개를 명시적으로 병렬 시작 (각자 내부에서 에러 처리).
    // void + .catch 로 unhandled promise rejection 방지.
    void Promise.allSettled([
      loadChildren(),
      checkProactivePopup(),
      checkTrialStatus(),
      checkAnnouncement(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 다음 검진 ISO 로드 (자녀 변경 + checkupVer 트리거)
  useEffect(() => {
    let cancelled = false;
    if (!selectedChild) {
      setCurrentCheckup(null);
      return;
    }
    (async () => {
      const v = await getNextCheckup(selectedChild.id);
      if (!cancelled) setCurrentCheckup(v);
    })();
    return () => { cancelled = true; };
  }, [selectedChild?.id, checkupVer]);

  const handleBirthSubmit = useCallback(async () => {
    if (!selectedChild || !birthDateVal || !birthTimeVal) {
      Alert.alert(t('common.notice'), t('home.birthAlert.missingFields'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateVal)) {
      Alert.alert(t('common.notice'), t('home.birthAlert.dateFormat'));
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(birthTimeVal)) {
      Alert.alert(t('common.notice'), t('home.birthAlert.timeFormat'));
      return;
    }
    setBirthLoading(true);
    try {
      const payload: Record<string, unknown> = {
        birthDate: birthDateVal,
        birthTime: birthTimeVal,
        locale: i18n.language,
      };
      if (birthName.trim()) payload.name = birthName;
      if (birthGender) payload.gender = birthGender;
      const res = await childApi.birth(selectedChild.id, payload as {
        birthDate: string; birthTime: string; name?: string; gender?: string; locale?: string;
      });
      const updatedChild = res.data?.data;
      if (updatedChild) {
        updateChild(updatedChild);
      }
      // 임신부 모드 → 출생 전환 시 임신 전용 알림(검진/D-Day/데일리 미션 9시) 일괄 취소
      // #15 per-child: 해당 자녀 키만 정리
      await cancelAllPregnancyLocalNotifications(child?.id);
      // 출생 직후 육아 모드 알림 자동 등록 (사용자가 알림 설정 안 들어가도 첫 알림이 오도록)
      if (updatedChild) {
        try {
          const prefs = await loadNotificationPrefs();
          await syncScheduledNotifications(prefs, updatedChild.id, updatedChild.name);
          await scheduleFirstCoachingNudge(updatedChild.id, updatedChild.name);
        } catch {
          /* best-effort */
        }
      }
      setBirthModalVisible(false);
      Alert.alert(t('home.birthAlert.successTitle'), t('home.birthAlert.successDesc'));
      // 새로고침
      loadChildren();
    } catch {
      Alert.alert(t('home.birthAlert.errorTitle'), t('home.birthAlert.errorDesc'));
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

  // 화면 포커스(탭 복귀/네비게이션 복귀) 시 자녀 목록 재동기화.
  // 공동육아 연결이 끊긴 아이가 엄마 앱에 유령처럼 남던 문제 해결 —
  // 소유자가 연결을 해제하면 백엔드 권한이 즉시 사라지므로, 다음 포커스에
  // 재조회하면 setChildren(목록 교체)이 그 아이를 깔끔히 제거한다.
  // 최초 mount 는 위 useEffect 가 이미 로드하므로 첫 포커스는 건너뛴다.
  const didInitialFocus = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didInitialFocus.current) {
        didInitialFocus.current = true;
        return;
      }
      void loadChildren();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

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
        } catch (err) {
          console.warn('[home] followup check failed:', err instanceof Error ? err.message : String(err));
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
    } catch (err) {
      console.warn('[home] proactive popup check failed:', err instanceof Error ? err.message : String(err));
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
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickPhoto = async () => {
    if (!selectedChild) return;
    const picked = await pickImageFromLibrary(t, { quality: 0.8 });
    if (!picked) return;
    const localUri = picked.uri;
    const previousPhotoUri = selectedChild.photoUri;
    // 즉시 로컬 프리뷰 반영
    updateChild({ ...selectedChild, photoUri: localUri });
    try {
      // Firebase Storage에 업로드 후 클라우드 URL 저장 — 업로드와 backend update 둘 다 성공해야 함
      const uploaded = await uploadApi.upload(localUri, 'profiles');
      await childApi.update(selectedChild.id, {
        photoUri: uploaded.url,
      } as Record<string, unknown>);
      // 로컬 상태도 클라우드 URL로 갱신 (다음 fetch 에서도 유지됨)
      updateChild({ ...selectedChild, photoUri: uploaded.url });
    } catch {
      // 업로드 또는 backend update 실패 → store 롤백 (file:// URL 이 다음 fetch 에서
      // 사라져 사진이 없어진 것처럼 보이는 회귀 방지). 사용자에게 명확히 안내.
      updateChild({ ...selectedChild, photoUri: previousPhotoUri ?? null });
      Alert.alert(
        t('home.photoUploadFail.title'),
        t('home.photoUploadFail.desc'),
      );
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
        <Image source={require('../../assets/mascot-worried.png')} style={{ width: 56, height: 56, marginBottom: 16 }} resizeMode="contain" />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 }}>
          {t('home.networkError.title')}
        </Text>
        <Text style={{ fontSize: 13, color: '#888', marginBottom: 24, textAlign: 'center', paddingHorizontal: 32 }}>
          {t('home.networkError.desc')}
        </Text>
        <TouchableOpacity
          onPress={() => loadChildren(true)}
          style={{ backgroundColor: COLOR.accent, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 }}
        >
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 자녀 미등록 시에도 홈 전체 UI 노출 — 풀스크린 EmptyState 제거 + placeholder child 사용.
  //   placeholder: 영아 (0개월) 기본값 → DenseStatsRow / AllActionsGrid 등 정상 렌더.
  //   탭 시 register 유도 배너 + 카드들은 빈 데이터 표시.
  const PLACEHOLDER_CHILD = {
    id: '',
    name: '',
    isPregnant: false as boolean,
    pregnancyWeeks: 0,
    ageInfo: { months: 0, group: 'infant' as const },
    birthDate: undefined as string | undefined,
    innateData: null,
    isHighRiskPregnancy: false,
    gender: undefined as string | undefined,
    photoUri: null as string | null,
  };
  const child = selectedChild ?? (PLACEHOLDER_CHILD as unknown as typeof selectedChild);

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
      {/* === 1. Header === */}
      <Header child={child} onPickPhoto={pickPhoto} />

      {/* 자녀 미등록 배너 — 둘러보기 모드 안내 */}
      {children.length === 0 && (
        <TouchableOpacity
          style={styles.registerBanner}
          activeOpacity={0.8}
          onPress={() => router.push('/onboarding/child-info')}
        >
          <Text style={styles.registerBannerIcon}>👶</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.registerBannerTitle}>{t('home.registerBanner.title')}</Text>
            <Text style={styles.registerBannerDesc}>{t('home.registerBanner.desc')}</Text>
          </View>
          <Text style={styles.registerBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* === Child Selector + 진통 체크 (같은 줄, 양 끝 정렬) ===
          - 좌측: ChildSelector (자녀 1명이면 빈 공간)
          - 우측: ContractionHeaderPill (임신부일 때만)
          - 둘 다 없으면 줄 자체 생략 */}
      {(children.length > 1 || child?.isPregnant) && (
        <View style={styles.childSelectorRow}>
          <View style={{ flex: 1 }}>
            {children.length > 1 ? (
              <ChildSelector
                items={children}
                selectedId={selectedChild?.id ?? ''}
                onSelect={selectChild}
              />
            ) : null}
          </View>
          {child?.isPregnant && (
            <ContractionHeaderPill
              weeks={child.pregnancyWeeks ?? 0}
              onPress={() => router.push('/(main)/labor-monitor?tab=contraction' as never)}
            />
          )}
        </View>
      )}

      {/* === 임신부 분만 병원 미등록 경고 배너 ===
          일반 35주+ / 고위험 28주+ — 등록되면 자동 사라짐 */}
      {child?.isPregnant && (
        <HospitalRegisterBanner
          childId={child.id}
          weeks={child.pregnancyWeeks ?? 0}
          isHighRisk={child.isHighRiskPregnancy === true}
        />
      )}

      {/* HospitalRegisterPrompt(내부 Modal 2개)는 iOS 터치먹통 버그 방지 위해
          ScrollView 밖(아래 모달 영역)으로 이동함. — 여기 두면 안 됨 */}

      {child && (() => {
        // 35주+ 임신부: 출산 임박 → 출산가방을 아이콘 메뉴 앞으로. 그 외엔 기본 순서.
        const weeks = child.pregnancyWeeks ?? 0;
        const isLatePregnancy = !!child.isPregnant && weeks >= 35;

        const heroCard = child.isPregnant && (() => {
          const isNearDue = weeks >= 37;
          const isBagReady = weeks >= 34 && weeks < 37;
          if (isBagReady) {
            return (
              <BirthBagBigCard
                childId={child.id}
                onPress={() => router.push('/(main)/birth-bag' as never)}
              />
            );
          }
          const msg = isNearDue
            ? t('home.pregnancyHero.nearDue', { name: child.name })
            : weeks >= 24
            ? t('home.pregnancyHero.ultrasound', { name: child.name })
            : weeks >= 16
            ? t('home.pregnancyHero.firstKick', { name: child.name })
            : weeks >= 12
            ? t('home.pregnancyHero.stableEntry', { name: child.name })
            : t('home.pregnancyHero.folicAcid', { name: child.name });
          const subMsg = isNearDue
            ? t('home.pregnancyHero.tapToCare')
            : t('home.pregnancyHero.tapToRecord');
          const heroIcon = isNearDue
            ? require('../../assets/preg-ribbon.png')
            : require('../../assets/preg-test.png');
          return (
            <TouchableOpacity
              style={styles.preghomeBigCard}
              activeOpacity={0.85}
              onPress={() => {
                if (isNearDue) {
                  setBirthName(child.name || '');
                  setBirthGender(null);
                  setBirthDateVal('');
                  setBirthTimeVal('');
                  setBirthModalVisible(true);
                } else {
                  router.push('/(main)/pregnancy' as never);
                }
              }}
            >
              <View style={styles.preghomeBigEmojiWrap}>
                <Image source={heroIcon} style={styles.preghomeBigIcon} resizeMode="contain" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.preghomeBigTitle}>{msg}</Text>
                <Text style={styles.preghomeBigSub}>{subMsg}</Text>
              </View>
              <Text style={styles.preghomeBigArrow}>{'>'}</Text>
            </TouchableOpacity>
          );
        })();

        const statsRow = (
          <DenseStatsRow
            child={child as unknown as { id: string; isPregnant?: boolean; ageInfo?: { months: number; group: string }; birthDate?: string; height?: number; weight?: number }}
            onTapCheckup={() => setCheckupModalOpen(true)}
          />
        );
        const actionsGrid = <AllActionsGrid ageGroup={child.ageInfo?.group ?? 'infant'} child={child} />;
        const journey = child.isPregnant ? (
          <PregnancyJourneyCard
            child={child as unknown as { id: string; isPregnant?: boolean; pregnancyWeeks?: number; dueDate?: string }}
          />
        ) : null;

        return (
          <>
            {/* === Dashboard 상단 섹션 (모드별 + 주수별 우선순위 분기) === */}
            {/* 1) 오늘 체크 (4-stat) — 항상 최상단 */}
            {statsRow}

            {/* 2) 35주+ 임신부 → 출산가방을 아이콘 앞으로 (출산 임박 우선순위)
                 그 외 → 기존 순서 (퀵메뉴 → 강조 카드)
                 #21 안정적 key 사용: 35주 전후 reorder 시 React 가 같은 컴포넌트로 인식해
                 unmount/mount 하지 않음 (AllActionsGrid 내부 상태 보존). */}
            {isLatePregnancy ? (
              <Fragment>
                <Fragment key="hero">{heroCard}</Fragment>
                <Fragment key="actions">{actionsGrid}</Fragment>
              </Fragment>
            ) : (
              <Fragment>
                <Fragment key="actions">{actionsGrid}</Fragment>
                <Fragment key="hero">{heroCard}</Fragment>
              </Fragment>
            )}

            {/* 3) 임신부 — 임신 여정 5단계 */}
            {journey}

          {/* 영아 — AI 분석 + 기질 분석 (파스텔 단일 배너) */}
          {!child.isPregnant && (
            <>
              <AIAnalysisCard />
              <TraitAnalysisCard child={child} />
            </>
          )}

            {/* === Monthly Characteristic === */}
            {/* 월령별 발달 특징은 한국 자료 기반 — 한국어 로케일에서만 노출. */}
            {i18n.language === 'ko' && <MonthlyCharCard child={child} />}

            {/* === Recommendations === */}
            <RecommendationSection child={child} />
          </>
        );
      })()}

      {/* Add Child — 거대 배너 (둘째 등록 유도) */}
      <TouchableOpacity
        style={styles.addChildBanner}
        onPress={() => router.push('/onboarding/child-info')}
        activeOpacity={0.85}
        hitSlop={12}
      >
        <View style={styles.addChildBannerImageWrap}>
          <Image
            source={require('../../assets/quick-baby.png')}
            style={styles.addChildBannerImage}
            resizeMode="contain"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.addChildBannerTitle}>{t('home.addChildBanner.title')}</Text>
          <Text style={styles.addChildBannerDesc}>
            {t('home.addChildBanner.desc')}
          </Text>
        </View>
        <Text style={styles.addChildBannerPlus}>{'+'}</Text>
      </TouchableOpacity>
    </ScrollView>

      {/* iOS 터치 버그 방지: 모든 Modal 은 ScrollView 밖(화면 루트)에 렌더한다.
          ScrollView 안에서 Modal 을 닫으면 iOS 에서 하위 콘텐츠의 탭(터치 응답)이 죽는다
          (스크롤은 유지됨). RN/Expo 공식 권장: Modal 은 화면 최상위에 둔다. */}
      <OnboardingGuide />

      {/* 임신부: 분만 병원 미등록 1회성 팝업 (내부 Modal 2개 → ScrollView 밖 렌더) */}
      {child?.isPregnant && (
        <HospitalRegisterPrompt
          childId={child.id}
          weeks={child.pregnancyWeeks ?? 0}
          isHighRisk={child.isHighRiskPregnancy === true}
        />
      )}

      {/* 시작 공지 팝업 */}
      <AnnouncementPopup
        visible={announcementVisible}
        announcement={announcement}
        onClose={handleAnnouncementClose}
      />

      {/* Proactive Popup */}
      <ProactivePopup
        visible={popupVisible}
        reason={popupReason}
        followupText={popupFollowupText}
        onRespond={handlePopupRespond}
        onDismiss={handlePopupDismiss}
      />

      {/* 다음 검진 일정 모달 (임신부 stat 카드 탭 시) */}
      {selectedChild && (
        <NextCheckupModal
          visible={checkupModalOpen}
          onClose={() => setCheckupModalOpen(false)}
          childId={selectedChild.id}
          current={currentCheckup}
        />
      )}

      {/* Trial Expiry Popup */}
      <CenterModal
        visible={trialPopupVisible}
        onRequestClose={() => setTrialPopupVisible(false)}
        animationType="fade"
        overlayStyle={{ padding: 32 }}
      >
        <Image source={require('../../assets/premium-badge.png')} style={styles.trialEmojiImg} resizeMode="contain" />
        <Text style={styles.trialTitle}>{t('home.trialPopup.title')}</Text>
        <Text style={styles.trialDesc}>
          {t('home.trialPopup.desc')}
        </Text>
        <TouchableOpacity
          style={styles.trialPremiumBtn}
          onPress={() => {
            setTrialPopupVisible(false);
            router.push('/(main)/subscription');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.trialPremiumText}>{t('home.trialPopup.subscribeBtn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.trialFreeBtn}
          onPress={async () => {
            setTrialPopupVisible(false);
            await AsyncStorage.setItem(TRIAL_POPUP_KEY, '1');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.trialFreeText}>{t('home.trialPopup.continueFreeBtn')}</Text>
        </TouchableOpacity>
      </CenterModal>

      {/* Birth Transition Modal */}
      <CenterModal
        visible={birthModalVisible}
        onRequestClose={() => setBirthModalVisible(false)}
        animationType="slide"
      >
        <Image source={require('../../assets/quick-baby.png')} style={styles.birthModalEmojiImg} resizeMode="contain" />
            <Text style={styles.birthModalTitle}>{t('home.birthModal.title')}</Text>
            <Text style={styles.birthModalDesc}>{t('home.birthModal.desc')}</Text>

            <View style={styles.birthField}>
              <Text style={styles.birthFieldLabel}>{t('home.birthModal.nameLabel')}</Text>
              <TextInput
                style={styles.birthInput}
                value={birthName}
                onChangeText={setBirthName}
                placeholder={t('home.birthModal.namePlaceholder')}
                placeholderTextColor={COLOR.textLight}
              />
            </View>

            <View style={styles.birthField}>
              <Text style={styles.birthFieldLabel}>{t('home.birthModal.genderLabel')}</Text>
              <View style={styles.birthGenderRow}>
                <TouchableOpacity
                  style={[styles.birthGenderBtn, birthGender === 'M' && styles.birthGenderActive]}
                  onPress={() => setBirthGender('M')}
                >
                  <Text style={[styles.birthGenderText, birthGender === 'M' && styles.birthGenderActiveText]}>{t('home.birthModal.boy')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.birthGenderBtn, birthGender === 'F' && styles.birthGenderActive]}
                  onPress={() => setBirthGender('F')}
                >
                  <Text style={[styles.birthGenderText, birthGender === 'F' && styles.birthGenderActiveText]}>{t('home.birthModal.girl')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.birthField}>
              <Text style={styles.birthFieldLabel}>{t('home.birthModal.birthDateLabel')}</Text>
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
              <Text style={styles.birthFieldLabel}>{t('home.birthModal.birthTimeLabel')}</Text>
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
                <Text style={styles.birthSubmitText}>{t('home.birthModal.submit')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.birthCancelBtn}
              onPress={() => setBirthModalVisible(false)}
            >
              <Text style={styles.birthCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
      </CenterModal>

    {/* 화면 하단 배너 광고 — FREE 사용자만, 프리미엄/체험 사용자는 자동 숨김 (useShowAds) */}
    <AdSlot />

    {/* Floating SOS Button — 모달/오버레이 활성 시 숨김 (선택지를 가리지 않게) / 한국어 버전에서만 노출 (해외는 응급번호·기관이 국가별로 달라 미지원) */}
    {overlayCount === 0 && i18n.language === 'ko' && (
      <TouchableOpacity
        style={styles.sosFab}
        onPress={() => router.push('/(main)/sos')}
        activeOpacity={0.8}
      >
        <Text style={styles.sosFabText}>SOS</Text>
      </TouchableOpacity>
    )}
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
  const { t } = useTranslation();
  // mockup 형식: "지수 8개월 12일 · 여" / "콩 1주차 · 태명"
  const subInfo = (() => {
    if (!child) return '';
    if (child.isPregnant) {
      return `${child.pregnancyWeeks ?? 0}${t('home.header.weekSuffix')}`;
    }
    const age = getAgeText(child.ageInfo.months, t);
    const gender = child.gender === 'F' ? t('home.header.genderF') : child.gender === 'M' ? t('home.header.genderM') : '';
    return gender ? `${age} · ${gender}` : age;
  })();

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
          <Text style={styles.headerNameSimple} numberOfLines={1}>
            <Text style={styles.headerNameStrong}>{child?.name ?? t('home.header.defaultChildName')}</Text>
            {subInfo ? <Text style={styles.headerNameSub}>{`  ${subInfo}`}</Text> : null}
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        {/* 진통 체크는 ChildSelector 줄로 이동 (사용자 요청) */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(main)/notification-settings' as never)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('home.header.notificationSettings')}
        >
          <Image source={require('../../assets/icon-bell.png')} style={styles.headerIcon} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(main)/profile' as never)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('home.header.profileSettings')}
        >
          <Image source={require('../../assets/icon-settings.png')} style={styles.headerIcon} resizeMode="contain" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* TodayCard 제거됨 — 홈화면에서 미사용 */

function TraitAnalysisCard({ child }: { child: Child }) {
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    pulseLoop.start();
    shimmerLoop.start();
    return () => {
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, [pulse, shimmer]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-220, 420] });

  const temperament = child.innateData?.label ?? '';
  if (!temperament) return null;

  // 짧은 기질명만 추출 (예: '활동형 (외향적, 호기심 많은)' → '활동형')
  // dominantType(항상 한글 고정키) 우선 → 표시 언어로 번역. label 은 로케일별 저장이라 fallback 용.
  const typeMatch = temperament.match(/(탐구형|활동형|조화형|분석형|감성형)/);
  const rawType = child.innateData?.dominantType ?? (typeMatch ? typeMatch[1] : temperament);
  const typeName = getTraitTypeName(t, rawType) || temperament;

  return (
    <TouchableOpacity
      style={traitCardStyles.card}
      activeOpacity={0.85}
      onPress={() => router.push('/(main)/trait-detail')}
    >
      {/* 셔머 반짝이 오버레이 */}
      <Animated.View
        pointerEvents="none"
        style={[
          traitCardStyles.shimmer,
          { transform: [{ translateX: shimmerTranslate }, { rotate: '20deg' }] },
        ]}
      />
      <View style={traitCardStyles.iconWrap}>
        <Animated.View
          style={[
            traitCardStyles.iconGlow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />
        <Text style={traitCardStyles.iconText}>{t('home.trait.label')}</Text>
      </View>
      <View style={traitCardStyles.textCol}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Text style={traitCardStyles.title}>{child.name}{t('home.trait.titleSuffix')}</Text>
          <View style={traitCardStyles.typeBadge}>
            <Text style={traitCardStyles.typeBadgeText}>{typeName}</Text>
          </View>
        </View>
        <Text style={traitCardStyles.sub}>{t('home.trait.subtitle')}</Text>
      </View>
      <Text style={traitCardStyles.arrow}>{'›'}</Text>
    </TouchableOpacity>
  );
}

const traitCardStyles = StyleSheet.create({
  // 파스텔 피치 (앱 톤과 매칭)
  card: {
    backgroundColor: '#FFF4ED',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE0CC',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: -40,
    left: 0,
    width: 80,
    height: 160,
    backgroundColor: 'rgba(255,140,90,0.10)',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F4A98C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconGlow: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFB48E',
  },
  iconText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  textCol: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  sub: { fontSize: 12, color: '#7A7A82', marginTop: 2 },
  typeBadge: {
    marginLeft: 6,
    backgroundColor: '#F4A98C',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  arrow: { color: '#F4A98C', fontSize: 18, fontWeight: '500', marginLeft: 6 },
});

function MonthlyCharCard({ child }: { child: Child }) {
  const { t } = useTranslation();
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
          <Text style={styles.monthlyBadgeText}>{t('home.monthly.badge', { count: ageMonths })}</Text>
        </View>
        <Text style={styles.monthlyTitle} numberOfLines={1}>
          {t('home.monthly.titlePrefix', { count: ageMonths })}{result.characteristic.title}
        </Text>
        <Text style={styles.monthlyArrow}>{'>'}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * 최근 4시간 내 38°C+ 발열 기록이 있으면 true
 * — AsyncStorage `fever_history_${childId}` 읽어서 판정
 */
/**
 * BirthBagBigCard — 임신 34~36주차 강조카드.
 * AsyncStorage에서 출산가방 진행률·아빠 담당 카운트 읽어 표시.
 */
function BirthBagBigCard({ childId, onPress }: { childId: string; onPress: () => void }) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<{ done: number; total: number; dadRemaining: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // v3 우선, 없으면 v2 fallback
        let raw = await AsyncStorage.getItem(`amatda_birthbag_v3_${childId}`);
        if (!raw) raw = await AsyncStorage.getItem(`amatda_birthbag_v2_${childId}`);
        if (!raw || cancelled) return;
        const data = JSON.parse(raw) as {
          checked?: Record<string, boolean>;
          owner?: Record<string, string | null>;
          status?: Record<string, string | null>;
          customItems?: { id: string }[];
          hiddenIds?: string[];
        };
        const checked = data.checked ?? {};
        const owner = data.owner ?? {};
        const statusMap = data.status ?? {};
        const customItems = data.customItems ?? [];
        const hiddenIds = new Set(data.hiddenIds ?? []);
        // 출산가방 기본 항목 수 (birth-bag.tsx ALL_ITEMS 기준 — 분만/산후 필터 후 평균 ~32)
        // 정확한 수치 대신 안정적 baseline 사용 + 커스텀 추가
        const BASELINE_TOTAL = 32;
        const customCount = customItems.filter((c) => !hiddenIds.has(c.id)).length;
        // 'na' (해당없음) 항목은 통계 제외
        const allKnownIds = new Set([
          ...Object.keys(checked),
          ...Object.keys(owner),
          ...Object.keys(statusMap),
        ]);
        const naCount = Array.from(allKnownIds).filter((id) => statusMap[id] === 'na').length;
        const total = Math.max(1, BASELINE_TOTAL + customCount - naCount);
        const done = Array.from(allKnownIds).filter((id) => checked[id] && statusMap[id] !== 'na').length;
        const dadRemaining = Array.from(allKnownIds).filter((id) => owner[id] === 'dad' && !checked[id] && statusMap[id] !== 'na').length;
        if (!cancelled) setProgress({ done, total, dadRemaining });
      } catch {
        if (!cancelled) setProgress(null);
      }
    })();
    return () => { cancelled = true; };
  }, [childId]);

  const pct = progress ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  const subText = (() => {
    if (!progress || progress.done === 0) {
      return t('home.birthBag.defaultSub');
    }
    const parts: string[] = [t('home.birthBag.completed', { done: progress.done, total: progress.total, pct })];
    if (progress.dadRemaining > 0) parts.push(t('home.birthBag.dadRemaining', { count: progress.dadRemaining }));
    return parts.join(' · ');
  })();

  return (
    <TouchableOpacity style={styles.preghomeBigCard} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.preghomeBigEmojiWrap}>
        <Image source={require('../../assets/preg-bag.png')} style={styles.preghomeBigIcon} resizeMode="contain" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.preghomeBigTitle}>{t('home.birthBag.title')}</Text>
        <Text style={styles.preghomeBigSub}>{subText}</Text>
        {progress && progress.done > 0 ? (
          <View style={styles.bagProgressTrack}>
            <View style={[styles.bagProgressFill, { width: `${pct}%` }]} />
          </View>
        ) : null}
      </View>
      <Text style={styles.preghomeBigArrow}>{'>'}</Text>
    </TouchableOpacity>
  );
}

/**
 * ContractionHeaderPill — 임신부 헤더 우측 진통 체크 CTA.
 * - 35주 미만: 기본 코랄 pill (정적)
 * - 35-36주: 진한 코랄 + 은은한 pulse + glow
 * - 37주+: 진한 핑크 + 더 강한 pulse + 작은 임박 도트
 *
 * 사이즈: 헤더 라인 안에 들어가는 작은 pill (height 36) — 메인 영역 카드 차지 X.
 */
function ContractionHeaderPill({ weeks, onPress }: { weeks: number; onPress: () => void }) {
  const { t } = useTranslation();
  const emphasized = weeks >= 35;
  const urgent = weeks >= 37;

  // pulse (35주+만)
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!emphasized) return;
    const duration = urgent ? 1500 : 2400;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [emphasized, urgent, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, urgent ? 1.04 : 1.02] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, urgent ? 0.6 : 0.4] });

  return (
    <View style={styles.contractionPillWrap}>
      {emphasized ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.contractionPillGlow,
            urgent ? styles.contractionPillGlowUrgent : styles.contractionPillGlowEmph,
            { opacity: glowOpacity },
          ]}
        />
      ) : null}
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          style={[
            styles.contractionPill,
            emphasized && styles.contractionPillEmph,
            urgent && styles.contractionPillUrgent,
          ]}
          activeOpacity={0.85}
          onPress={onPress}
        >
          <Image
            source={require('../../assets/contraction-clock.png')}
            style={[
              styles.contractionPillIcon,
              emphasized && styles.contractionPillIconEmph,
              urgent && styles.contractionPillIconUrgent,
            ]}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.contractionPillText,
              emphasized && styles.contractionPillTextEmph,
              urgent && styles.contractionPillTextUrgent,
            ]}
          >
            {t('home.contractionCheck')}
          </Text>
          {urgent ? <View style={styles.contractionPillDot} /> : null}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function useFeverAlert(childId: string | undefined): boolean {
  const [isAlert, setIsAlert] = useState(false);
  // fever.tsx에서 측정 시 bump() → 이 hook 재실행
  // (스택 keep으로 useEffect가 자동 재실행 안 되는 문제 해결)
  const alertVersion = useFeverStore((s) => s.alertVersion);

  useEffect(() => {
    setIsAlert(false);
    if (!childId) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`fever_history_${childId}`);
        if (!raw || cancelled) return;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const now = Date.now();
        const FOUR_HOURS = 4 * 60 * 60 * 1000;
        type Entry = { ts: number; t: number };
        const valid: Entry[] = [];
        for (const e of parsed) {
          if (typeof e !== 'object' || e === null) continue;
          const obj = e as Record<string, unknown>;
          const ts = typeof obj.timestamp === 'number' ? obj.timestamp : NaN;
          const adj = typeof obj.adjustedTemp === 'number' ? obj.adjustedTemp : NaN;
          const temp = typeof obj.temperature === 'number' ? obj.temperature : NaN;
          const t = Number.isFinite(adj) ? adj : Number.isFinite(temp) ? temp : NaN;
          if (!Number.isFinite(ts) || !Number.isFinite(t)) continue;
          if (ts <= 0 || ts > now) continue;
          valid.push({ ts, t });
        }
        if (valid.length === 0) {
          if (!cancelled) setIsAlert(false);
          return;
        }
        valid.sort((a, b) => b.ts - a.ts);
        const latest = valid[0];
        const isHighAndFresh = now - latest.ts < FOUR_HOURS && latest.t >= 38.0;
        if (!cancelled) setIsAlert(isHighAndFresh);
      } catch {
        if (!cancelled) setIsAlert(false);
      }
    })();
    return () => { cancelled = true; };
  }, [childId, alertVersion]);
  return isAlert;
}

/**
 * 고열 알람 — AI 분석 카드와 동일한 스타일(글로우 + 셔머).
 * 빨간 링 대신 부드러운 펄스 글로우 + 흰 셔머 배너로 표현.
 */
function FeverPulseCircle({ children }: { children: React.ReactNode; bg: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }),
    );
    pulseLoop.start();
    shimmerLoop.start();
    return () => { pulseLoop.stop(); shimmerLoop.stop(); };
  }, [pulse, shimmer]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-60, 90] });

  return (
    <View style={[styles.quickCircle, { backgroundColor: '#FF6B6B', overflow: 'hidden' }]}>
      {/* 외곽 글로우 (AI 카드 iconGlow 스타일) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#FFB4B4',
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }}
      />
      {/* 흰 셔머 라인 */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -10,
          left: 0,
          width: 28,
          height: 70,
          backgroundColor: 'rgba(255,255,255,0.30)',
          transform: [{ translateX: shimmerTranslate }, { rotate: '20deg' }],
        }}
      />
      {children}
    </View>
  );
}

function AllActionsGrid({ ageGroup, child }: { ageGroup: AgeGroupKey; child?: Child | null }) {
  const { t, i18n } = useTranslation();
  const actions = getActionsForAge(ageGroup, i18n.language, child);
  const feverAlert = useFeverAlert(child?.id);
  return (
    <View style={styles.quickSection}>
      {actions.map((action) => {
        const showPulse = action.feverAlert && feverAlert;

        const inner = (
          <>
            {action.emoji ? (
              <Text style={styles.quickEmoji}>{action.emoji}</Text>
            ) : (
              <Image source={action.icon} style={styles.quickIcon} resizeMode="contain" />
            )}
          </>
        );

        return (
          <TouchableOpacity
            key={action.labelKey}
            style={styles.quickItem}
            onPress={() => router.push(action.route as never)}
            activeOpacity={0.7}
          >
            {showPulse ? (
              <FeverPulseCircle bg={action.bg}>{inner}</FeverPulseCircle>
            ) : (
              <View style={[styles.quickCircle, { backgroundColor: action.bg }]}>{inner}</View>
            )}
            <Text style={[styles.quickLabel, showPulse && styles.feverAlertLabel]}>
              {t(`home.quickActions.${action.labelKey}`)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * 맞춤 추천 — 한 줄 배너로 간소화 (홈 공간 확보).
 * 클릭 시 별도 카테고리 페이지로 이동.
 * 임신부일 경우 임산부용 카테고리/문구로 자동 전환.
 */
function RecommendationSection({ child }: { child: Child }) {
  const { t } = useTranslation();
  const isPregnant = !!child.isPregnant;
  const week = child.pregnancyWeeks ?? 0;

  // 임신부 — 트라이메스터별 강조 카테고리 변경
  let title = t('home.recommendation.generalTitle');
  let desc = t('home.recommendation.generalDesc');

  if (isPregnant) {
    title = t('home.recommendation.pregnantTitle');
    if (week <= 13) {
      desc = t('home.recommendation.trimester1');
    } else if (week <= 27) {
      desc = t('home.recommendation.trimester2');
    } else {
      desc = t('home.recommendation.trimester3');
    }
  }

  return (
    <TouchableOpacity
      style={styles.recoBanner}
      onPress={() => router.push('/(main)/recommendations')}
      activeOpacity={0.85}
    >
      <Image source={require('../../assets/mascot-thinking.png')} style={styles.recoBannerEmojiImg} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <Text style={styles.recoBannerTitle}>{title}</Text>
        <Text style={styles.recoBannerDesc}>{desc}</Text>
      </View>
      <Text style={styles.recoBannerArrow}>{'›'}</Text>
    </TouchableOpacity>
  );
}

function AIAnalysisCard() {
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    pulseLoop.start();
    shimmerLoop.start();
    return () => {
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, [pulse, shimmer]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-220, 420] });

  return (
    <TouchableOpacity
      style={aiCardStyles.card}
      activeOpacity={0.85}
      onPress={() => router.push('/(main)/ai-analysis')}
    >
      {/* 셔머 반짝이 오버레이 */}
      <Animated.View
        pointerEvents="none"
        style={[
          aiCardStyles.shimmer,
          { transform: [{ translateX: shimmerTranslate }, { rotate: '20deg' }] },
        ]}
      />
      <View style={aiCardStyles.iconWrap}>
        <Animated.View
          style={[
            aiCardStyles.iconGlow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />
        <Text style={aiCardStyles.iconText}>AI</Text>
      </View>
      <View style={aiCardStyles.textCol}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Text style={aiCardStyles.title}>{t('home.aiCard.title')}</Text>
          <View style={aiCardStyles.newBadge}>
            <Text style={aiCardStyles.newBadgeText}>NEW</Text>
          </View>
        </View>
        <Text style={aiCardStyles.sub}>{t('home.aiCard.subtitle')}</Text>
      </View>
      <Text style={aiCardStyles.arrow}>{'\u203A'}</Text>
    </TouchableOpacity>
  );
}

const aiCardStyles = StyleSheet.create({
  // 파스텔 라벤더 (앱 전체 톤과 매칭)
  card: {
    backgroundColor: '#EEEDFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8D4F7',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: -40,
    left: 0,
    width: 80,
    height: 160,
    backgroundColor: 'rgba(124,131,236,0.10)',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7C83EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconGlow: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#A9AEF5',
  },
  iconText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  textCol: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  sub: { fontSize: 12, color: '#7A7A82', marginTop: 2 },
  newBadge: {
    marginLeft: 6,
    backgroundColor: '#FFD76E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  newBadgeText: { fontSize: 9, fontWeight: '600', color: '#7C5A00' },
  arrow: { fontSize: 18, color: '#7C83EC', marginLeft: 4 },
});

function EmptyState() {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Image source={require('../../assets/mascot-waving.png')} style={styles.emptyMascot} resizeMode="contain" />
      <Text style={styles.emptyText}>{t('home.emptyState.title')}</Text>
      <Text style={styles.emptySubtext}>
        {t('home.emptyState.subtitle')}
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/onboarding/child-info')}
      >
        <Text style={styles.addButtonText}>{t('home.emptyState.registerBtn')}</Text>
      </TouchableOpacity>

      {/* 자녀 미등록 사용자도 커뮤니티/프로필 접근 가능하게 */}
      <View style={styles.emptySecondaryRow}>
        <TouchableOpacity
          style={styles.emptySecondaryBtn}
          onPress={() => router.push('/(main)/mom-group')}
        >
          <Text style={styles.emptySecondaryText}>{t('home.emptyState.browseMomGroup')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.emptySecondaryBtn}
          onPress={() => router.push('/(main)/profile')}
        >
          <Text style={styles.emptySecondaryText}>{t('home.emptyState.profile')}</Text>
        </TouchableOpacity>
      </View>
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
  /* 자녀 미등록 배너 */
  registerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFF4EE',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FAD8C5',
  },
  registerBannerIcon: { fontSize: 24, marginRight: 12 },
  registerBannerTitle: { fontSize: 14, fontWeight: '600', color: '#2D2D33' },
  registerBannerDesc: { fontSize: 12, color: '#7A7A82', marginTop: 2 },
  registerBannerArrow: { fontSize: 22, color: '#B5B5BD', marginLeft: 8 },
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
  // ChildSelector + 진통체크 같은 줄 정렬 (좌측 셀렉터, 우측 진통)
  childSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    minHeight: 44,
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
  // mockup 단순 헤더 — name 1줄로 통합
  headerNameSimple: {
    fontSize: 15,
    color: COLOR.text,
    flexShrink: 1,
  },
  headerNameStrong: {
    fontWeight: '700',
    color: COLOR.text,
    fontSize: 15,
  },
  headerNameSub: {
    fontWeight: '600',
    color: COLOR.textSub,
    fontSize: 13,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  iconEmoji: {
    fontSize: 18,
  },

  /* === Monthly Characteristic Card === */
  monthlyCard: {
    backgroundColor: COLOR.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
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
    marginTop: 14,
    marginBottom: 16,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  quickEmoji: {
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLOR.text,
  },
  feverAlertLabel: {
    color: '#FF3B30',
    fontWeight: '600',
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

  /* 간소화된 맞춤 추천 배너 */
  recoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F7F4FF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 0,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E1D9FA',
  },
  recoBannerEmoji: { fontSize: 26 },
  recoBannerEmojiImg: { width: 32, height: 32 },
  recoBannerTitle: { fontSize: 15, fontWeight: '700', color: '#3C3450' },
  recoBannerDesc: { fontSize: 12, color: '#6B5E8A', marginTop: 2 },
  recoBannerArrow: { fontSize: 22, color: '#7C5CFF', fontWeight: '700' },
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
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: '#FFD4BB',
    shadowColor: '#F4A98C',
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
  compactStatValueRow: { flexDirection: 'row', alignItems: 'center' },
  compactStatIconImg: { width: 18, height: 18 },
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
    marginTop: 4,
    paddingTop: 4,
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
  emptySecondaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  emptySecondaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  emptySecondaryText: {
    fontSize: 14,
    color: COLOR.textSub,
    fontWeight: '500',
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

  /* === 자녀 추가 배너 (앱 톤 맞춤 파스텔) === */
  addChildBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLOR.accentLight,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginTop: 0,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFD4BB',
    shadowColor: '#F4A98C',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  addChildBannerEmoji: { fontSize: 40 },
  addChildBannerImageWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F4A98C',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  addChildBannerImage: { width: 40, height: 40 },
  addChildBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.text,
    lineHeight: 22,
  },
  addChildBannerDesc: {
    fontSize: 12,
    color: COLOR.textSub,
    fontWeight: '600',
    marginTop: 2,
  },
  addChildBannerPlus: {
    fontSize: 26,
    fontWeight: '600',
    color: COLOR.accent,
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
  trialEmojiImg: { width: 56, height: 56, marginBottom: 16 },
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

  /* === 임신부 home 큰 강조 카드 (출산가방/검진/태동 등 주차별) === */
  preghomeBigCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFD7E5',
    gap: 14,
  },
  /* 진통 체크 헤더 pill — 우측 알림/프로필 옆에 배치 */
  contractionPillWrap: {
    position: 'relative',
  },
  contractionPillGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 22,
    borderWidth: 2,
  },
  contractionPillGlowEmph: {
    borderColor: '#FF6F61', // 코랄
  },
  contractionPillGlowUrgent: {
    borderColor: '#E91E63', // 진한 핑크
  },
  contractionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 11,
    borderRadius: 18,
    backgroundColor: '#FFE0E6', // 기본: 연한 코랄
    borderWidth: 1.5,
    borderColor: '#FF8FA8',
    gap: 5,
    shadowColor: '#FF3B30',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  // 35주+ — 헤더 라인 안에서 자연스럽게 강조 (벨/프로필 아이콘이 36이라 너무 차이 X)
  contractionPillEmph: {
    backgroundColor: '#FFD3DC',
    borderColor: '#FF6F61',
    borderWidth: 2,
    paddingHorizontal: 14,
    height: 42,
    gap: 6,
  },
  // 37주+ — 출산 임박: 한 단계 더 강조
  contractionPillUrgent: {
    backgroundColor: '#FFC7D9',
    borderColor: '#E91E63',
    borderWidth: 2.5,
    paddingHorizontal: 16,
    height: 44,
  },
  contractionPillIcon: {
    width: 22,
    height: 22,
  },
  contractionPillIconEmph: {
    width: 26,
    height: 26,
  },
  contractionPillIconUrgent: {
    width: 28,
    height: 28,
  },
  contractionPillText: {
    color: '#C0392B',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  contractionPillTextEmph: {
    color: '#B71C1C',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  contractionPillTextUrgent: {
    color: '#C2185B',
    fontSize: 14,
  },
  contractionPillDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#E91E63',
    marginLeft: 3,
  },
  preghomeBigEmojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FCE4EC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E91E63',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  preghomeBigEmoji: {
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center' as const,
  },
  preghomeBigIcon: {
    width: 36,
    height: 36,
  },
  preghomeBigTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#E91E63',
    marginBottom: 3,
  },
  preghomeBigSub: {
    fontSize: 12,
    color: COLOR.textSub,
    fontWeight: '600' as const,
  },
  bagProgressTrack: {
    height: 6,
    backgroundColor: '#FCE4EC',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  bagProgressFill: {
    height: '100%',
    backgroundColor: '#E91E63',
    borderRadius: 3,
  },
  preghomeBigArrow: {
    fontSize: 22,
    color: '#E91E63',
    fontWeight: '600' as const,
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
  birthModalEmojiImg: { width: 56, height: 56, marginBottom: 12 },
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

  /* === SOS Floating Button — 카드 컨텐츠 안 가리도록 우측 끝/소형 === */
  sosFab: {
    position: 'absolute',
    right: 10,
    bottom: Platform.OS === 'ios' ? 100 : 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B6B',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    zIndex: 100,
  },
  sosFabText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 1,
  },
});


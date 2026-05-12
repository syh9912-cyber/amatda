import { useEffect, useRef, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { View, ActivityIndicator, Text, Image, Animated, Easing, StyleSheet, Dimensions, AppState, AppStateStatus } from 'react-native';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import { useLocationStore } from '../stores/locationStore';
import { retentionApi } from '../services/api';
import { initSentry, captureError } from '../services/sentry';
import { OfflineBanner } from '../components/common/OfflineBanner';
import {
  registerForPushNotifications,
  loadNotificationPrefs,
  syncScheduledNotifications,
  syncReengagementNotifications,
  trackLastAccess,
} from '../services/pushNotifications';
import { COLORS } from '../constants/theme';

 
const MASCOT_HAPPY = require('../assets/mascot-happy.png') as number;
 

const queryClient = new QueryClient();

function useNotificationSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedChild = useChildStore((s) => s.selectedChild);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !selectedChild) return;

    let cancelled = false;

    const setup = async () => {
      // Register for push and save token to backend
      const token = await registerForPushNotifications();
      if (cancelled) return;

      if (token) {
        const prefs = await loadNotificationPrefs();
        retentionApi.pushSchedule({
          childId: selectedChild.id,
          pushToken: token,
          morning: prefs.morning,
          afternoon: prefs.afternoon,
          evening: prefs.evening,
          weekly: prefs.weekly,
        }).catch(() => {
          // push schedule save failed silently
        });

        // Sync local scheduled notifications
        await syncScheduledNotifications(prefs, selectedChild.name);
      }

      // Track access + reschedule re-engagement (cancel old, set new from now)
      await trackLastAccess();
      await syncReengagementNotifications(selectedChild.name);
    };

    setup().catch(() => {});

    // Handle notification tap -> navigate to relevant screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const screen = typeof data?.screen === 'string' ? data.screen : null;
        if (screen) {
          router.push(`/(main)/${screen}` as never);
        }
      },
    );

    return () => {
      cancelled = true;
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedChild?.id]);
}

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'restarting';

function useOTAUpdate() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const checkingRef = useRef(false);

  const checkAndApply = useCallback(async () => {
    if (__DEV__ || checkingRef.current) return;
    checkingRef.current = true;

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) { checkingRef.current = false; return; }
      setStatus('checking');
      const update = await Updates.checkForUpdateAsync();

      if (!update.isAvailable) {
        setStatus('idle');
        checkingRef.current = false;
        return;
      }

      // 다운로드 시작 — 실제 진행률 시뮬레이션
      setStatus('downloading');
      setProgress(0);

      const startTime = Date.now();
      const progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        // 0~3초: 0→70%, 3~6초: 70→90% (점점 느려지는 느낌)
        const p = elapsed < 3000
          ? (elapsed / 3000) * 0.7
          : 0.7 + Math.min((elapsed - 3000) / 6000, 1) * 0.2;
        setProgress(Math.min(p, 0.9));
      }, 100);

      await Updates.fetchUpdateAsync();

      clearInterval(progressTimer);
      setProgress(1);
      setStatus('ready');

      // 다운로드 완료 UI 잠깐 보여준 뒤 자동 재시작
      await new Promise(r => setTimeout(r, 600));
      setStatus('restarting');
      await Updates.reloadAsync();
    } catch (error) {
      captureError(
        error instanceof Error ? error : new Error(String(error)),
        { context: 'OTA update check' },
      );
      setStatus('idle');
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (__DEV__) return;

    // 앱 시작 후 2초 뒤 체크 (스플래시 끝난 직후, API 호출 전에 OTA 우선 수신)
    const delayedCheck = setTimeout(() => checkAndApply(), 2000);

    // 백그라운드 → 포그라운드 복귀 시 자동 체크
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        checkAndApply();
      }
      appStateRef.current = next;
    });

    return () => { clearTimeout(delayedCheck); sub.remove(); };
  }, [checkAndApply]);

  return { status, progress };
}

function useLocationSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const requestLocation = useLocationStore((s) => s.requestLocation);

  useEffect(() => {
    if (!isAuthenticated) return;
    requestLocation().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
}

/* ── Update Screen (Modern) ── */
const { width: SCREEN_W } = Dimensions.get('window');
const PROGRESS_BAR_W = SCREEN_W * 0.65;

const STATUS_TEXT: Record<UpdateStatus, string> = {
  idle: '',
  checking: '새로운 버전을 확인하고 있어요',
  downloading: '업데이트를 다운로드하고 있어요',
  ready: '다운로드 완료!',
  restarting: '새 버전을 적용하고 있어요',
};

function UpdateScreen({ status, progress }: { status: UpdateStatus; progress: number }) {
  const bounce = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  // 마스코트 부드러운 바운스
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -8, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 8, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 진행률 바 애니메이션
  useEffect(() => {
    Animated.timing(barWidth, {
      toValue: progress * PROGRESS_BAR_W,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  // 완료 체크마크 애니메이션
  useEffect(() => {
    if (status === 'ready' || status === 'restarting') {
      Animated.spring(checkScale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const pct = Math.round(progress * 100);
  const isComplete = status === 'ready' || status === 'restarting';

  return (
    <View style={upS.root}>
      <LinearGradient
        colors={['#FFF8F2', '#FFF0E4', '#FFE8D6']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={{ opacity: fadeIn, alignItems: 'center' }}>
        {/* 마스코트 */}
        <Animated.View style={{ transform: [{ translateY: bounce }], marginBottom: 32 }}>
          <View style={upS.mascotGlow} />
          <Image source={MASCOT_HAPPY} style={upS.mascot} resizeMode="contain" />
        </Animated.View>

        {/* 완료 체크마크 or 퍼센트 */}
        {isComplete ? (
          <Animated.View style={[upS.checkCircle, { transform: [{ scale: checkScale }] }]}>
            <Text style={upS.checkMark}>{'✓'}</Text>
          </Animated.View>
        ) : (
          <Text style={upS.pctText}>{`${pct}%`}</Text>
        )}

        {/* 진행률 바 */}
        <View style={upS.progressTrack}>
          <Animated.View
            style={[
              upS.progressFill,
              { width: barWidth, backgroundColor: isComplete ? '#4CAF50' : '#FF8C5A' },
            ]}
          />
        </View>

        {/* 상태 텍스트 */}
        <Text style={upS.statusText}>{STATUS_TEXT[status]}</Text>

        {/* 하단 안내 */}
        <Text style={upS.footer}>
          {isComplete ? '잠시 후 자동으로 시작됩니다' : '잠시만 기다려주세요'}
        </Text>
      </Animated.View>
    </View>
  );
}

const upS = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F2' },
  mascotGlow: {
    position: 'absolute', top: 10, left: 10, right: 10, bottom: 10,
    borderRadius: 60, backgroundColor: 'rgba(255,140,90,0.08)',
  },
  mascot: { width: 120, height: 120, borderRadius: 60 },
  pctText: { fontSize: 36, fontWeight: '800', color: '#FF8C5A', marginBottom: 16 },
  checkCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  checkMark: { fontSize: 28, color: '#FFF', fontWeight: '700' },
  progressTrack: {
    width: PROGRESS_BAR_W, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,140,90,0.12)', overflow: 'hidden', marginBottom: 20,
  },
  progressFill: { height: 8, borderRadius: 4 },
  statusText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginBottom: 6 },
  footer: { fontSize: 13, color: '#ABABAB', fontWeight: '400' },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);
  const { status, progress } = useOTAUpdate();

  useEffect(() => {
    initSentry();
    hydrate()
      .catch(() => {})
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useNotificationSetup();
  useLocationSetup();

  // 업데이트 다운로드/적용 중이면 업데이트 화면 표시
  if (status === 'downloading' || status === 'ready' || status === 'restarting') {
    return <UpdateScreen status={status} progress={progress} />;
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App ErrorBoundary:', error, info);
    captureError(error, { componentStack: info.componentStack ?? '' });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: COLORS.background }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
            {'오류가 발생했습니다'}
          </Text>
          <Text style={{ fontSize: 13, color: '#888', textAlign: 'center' }}>
            {this.state.error?.message ?? 'Unknown error'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <OfflineBanner />
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

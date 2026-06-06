import React, { useEffect, useRef, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { useSiriVoiceLaunch } from '../hooks/useSiriVoiceLaunch';

import { View, ActivityIndicator, Text, TextInput, Image, Animated, Easing, StyleSheet, Dimensions, AppState, AppStateStatus, TouchableOpacity } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, router, useNavigationContainerRef } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import { useLocationStore } from '../stores/locationStore';
import { retentionApi } from '../services/api';
import { initSentry, captureError, navigationIntegration } from '../services/sentry';
import { OfflineBanner } from '../components/common/OfflineBanner';
import {
  registerForPushNotifications,
  loadNotificationPrefs,
  syncScheduledNotifications,
  syncReengagementNotifications,
  trackLastAccess,
  runOneTimeOrphanCleanup,
} from '../services/pushNotifications';
import { COLORS } from '../constants/theme';

/**
 * Pretendard 폰트 전역 적용 — Text/TextInput.render를 가로채서
 * fontWeight에 따라 자동으로 Pretendard 변형(Regular/Medium/SemiBold/Bold)을 매핑.
 *
 * 한 번만 실행 (모듈 로드 시).
 */
// weight 전역 2단계 다운시프트 — 베빌 톤 매칭.
//   변경 후: 900/bold→SemiBold, 700/800→Medium, 500/600→Regular
function pretendardFamilyForWeight(weight: string | number | undefined): string {
  const w = String(weight ?? '400');
  if (w === '900' || w === 'bold') return 'Pretendard-SemiBold';
  if (w === '700' || w === '800' || w === 'semibold') return 'Pretendard-Medium';
  if (w === '500' || w === '600' || w === 'medium') return 'Pretendard-Regular';
  return 'Pretendard-Regular';
}

// ⚠️ 2026-05-08 긴급 fix: 이 IIFE 가 React 19 + RN 0.81 + Hermes 에서 모듈 로드 시점에
// throw → "Invalid hook call" + "Attempted to navigate before mounting Root Layout" 연쇄로
// 부팅 자체가 깨지는 회귀 발생 (Sentry REACT-NATIVE-9 / REACT-NATIVE-A).
// fail-safe 로 감싸 패치 실패 시 시스템 기본 폰트로 폴백 — 앱 부팅이 우선.
(function applyPretendardDefault() {
  try {
    const patch = (Comp: { render?: (...args: unknown[]) => React.ReactElement | null }) => {
      if (!Comp || typeof Comp.render !== 'function') return;
       
      const orig = Comp.render as any;
      // 이중 patch 방지 — OTA reload / Fast Refresh 시 같은 함수가 두 번 감싸지면 무한 재귀
       
      if ((orig as any).__amatdaPretendardPatched) return;
       
      const wrapped = function (this: unknown, ...args: any[]) {
        try {
          const elem = orig.apply(this, args);
          if (!elem) return elem;
           
          const flat = StyleSheet.flatten((elem as any).props?.style) as Record<string, unknown> | null;
          const family = pretendardFamilyForWeight(flat?.fontWeight as string | number | undefined);
          return React.cloneElement(elem, {
             
            style: [{ fontFamily: family }, (elem as any).props?.style],
          });
        } catch {
          // render 후처리 실패 시 원본 결과 그대로 반환 — 폰트만 기본값으로 폴백
          return orig.apply(this, args);
        }
      };
       
      (wrapped as any).__amatdaPretendardPatched = true;
      Comp.render = wrapped;
    };
     
    patch(Text as any);
     
    patch(TextInput as any);
  } catch {
    // 패치 자체가 실패해도 앱 부팅은 절대 막지 말 것 — 시스템 기본 폰트로 폴백.
  }
})();

 
const MASCOT_HAPPY = require('../assets/mascot-happy.png') as number;
 

const queryClient = new QueryClient();

function useNotificationSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedChild = useChildStore((s) => s.selectedChild);
  const children = useChildStore((s) => s.children);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !selectedChild) return;

    let cancelled = false;

    const setup = async () => {
      // 일회성: OLD 코드(cascade 누락 시절)가 남긴 고아 알림 정리. 한 번 실행 후 영구 no-op.
      await runOneTimeOrphanCleanup(
        children.some((c) => c.isPregnant === true),
      ).catch(() => {});
      if (cancelled) return;

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
        await syncScheduledNotifications(prefs, selectedChild.id, selectedChild.name);
      }

      // Track access + reschedule re-engagement (cancel old, set new from now)
      await trackLastAccess();
      await syncReengagementNotifications(selectedChild.id, selectedChild.name);
    };

    setup().catch(() => {});

    // Handle notification tap -> navigate to relevant screen
    // 보안: data.screen 을 화이트리스트로 제한 (위조 push 의 라우트 탈출 차단).
    const ALLOWED_PUSH_SCREENS = new Set([
      'home', 'baby-tracker', 'pregnancy', 'fever', 'labor-monitor', 'sos',
      'chatbot', 'recommendations', 'vaccination', 'birth-bag',
      'gdm', 'lullaby', 'cry-analyzer', 'poop-analyzer', 'album', 'growth-stats',
      'play-learning', 'monthly-characteristic', 'subscription',
      'notification-settings', 'clinic', 'coparenting',
      'ai-analysis', 'recommendation-list', 'mom-location-setup', 'mom-group',
    ]);
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const screen = typeof data?.screen === 'string' ? data.screen : null;
        if (screen && ALLOWED_PUSH_SCREENS.has(screen)) {
          router.push(`/(main)/${screen}` as never);
        }
      },
    );

    // 콜드 스타트 (앱 종료 상태에서 푸시 클릭) 시 마지막 응답 처리
    // ⚠️ 2026-05-08 fix: expo-router 의 navigation tree 가 mount 완료되기 전에 router.push
    // 호출하면 "Attempted to navigate before mounting Root Layout" fatal (Sentry REACT-NATIVE-A).
    // 다음 tick 으로 미뤄 mount 완료 후 호출 보장.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const screen = typeof data?.screen === 'string' ? data.screen : null;
        if (screen && ALLOWED_PUSH_SCREENS.has(screen)) {
          setTimeout(() => {
            try { router.push(`/(main)/${screen}` as never); }
            catch { /* router 미준비 시 silent */ }
          }, 300);
        }
      })
      .catch(() => {});

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

// 45초 안에 다운로드 안 되면 포기하고 기존 버전으로 진행
const FETCH_TIMEOUT_MS = 45_000;
// 15초 이상 다운로드 중이면 건너뛰기 버튼 노출
const SKIP_SHOW_MS = 15_000;

function useOTAUpdate() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const checkingRef = useRef(false);
  const skipRef = useRef(false);

  const skip = useCallback(() => {
    skipRef.current = true;
    setStatus('idle');
    setCanSkip(false);
  }, []);

  const checkAndApply = useCallback(async () => {
    if (__DEV__ || checkingRef.current) return;
    checkingRef.current = true;
    skipRef.current = false;

    try {
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
      setCanSkip(false);

      const startTime = Date.now();
      const progressTimer = setInterval(() => {
        if (skipRef.current) { clearInterval(progressTimer); return; }
        const elapsed = Date.now() - startTime;
        // 0~3초: 0→70%, 3~6초: 70→90% (점점 느려지는 느낌)
        const p = elapsed < 3000
          ? (elapsed / 3000) * 0.7
          : 0.7 + Math.min((elapsed - 3000) / 6000, 1) * 0.2;
        setProgress(Math.min(p, 0.9));
        // 15초 경과 시 건너뛰기 버튼 노출
        if (elapsed >= SKIP_SHOW_MS) setCanSkip(true);
      }, 100);

      // 45초 타임아웃: 초과 시 에러로 처리 → catch 에서 idle로 복귀
      await Promise.race([
        Updates.fetchUpdateAsync(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('ota_timeout')), FETCH_TIMEOUT_MS)
        ),
      ]);

      clearInterval(progressTimer);

      // 건너뛰기 눌린 경우 여기서 중단
      if (skipRef.current) return;

      setProgress(1);
      setStatus('ready');

      // 다운로드 완료 UI 잠깐 보여준 뒤 자동 재시작
      await new Promise(r => setTimeout(r, 600));
      setStatus('restarting');
      await Updates.reloadAsync();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // 타임아웃은 조용히 처리 (사용자가 건너뛰기로 처리하므로 Sentry 불필요)
      if (msg !== 'ota_timeout') {
        captureError(
          error instanceof Error ? error : new Error(msg),
          { context: 'OTA update check' },
        );
      }
      setStatus('idle');
      setCanSkip(false);
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

  return { status, progress, canSkip, skip };
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

/**
 * 앱 접속 기록 (부모 레벨 streak 카운팅용).
 * 인증된 사용자가 앱에 진입하면 세션당 1회 POST /api/retention/visit 호출.
 * 백엔드가 오늘 날짜를 users.{uid}.visitDates에 추가 (이미 있으면 무시).
 * 실패해도 앱 사용에 영향 없음 (silent catch).
 */
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

function UpdateScreen({ status, progress, canSkip, onSkip }: {
  status: UpdateStatus;
  progress: number;
  canSkip: boolean;
  onSkip: () => void;
}) {
  const bounce = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  // 마스코트 부드러운 바운스
  useEffect(() => {
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -8, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 8, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    bounceLoop.start();
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    return () => bounceLoop.stop();
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
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]} />

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

        {/* 15초 이상 대기 시 건너뛰기 버튼 노출 */}
        {canSkip && !isComplete && (
          <TouchableOpacity style={upS.skipBtn} onPress={onSkip} activeOpacity={0.7}>
            <Text style={upS.skipText}>건너뛰기 (현재 버전 사용)</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const upS = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
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
  skipBtn: {
    marginTop: 28, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: '#E5E5EA',
  },
  skipText: { fontSize: 13, color: '#ABABAB', fontWeight: '500' },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);
  const { status, progress, canSkip, skip } = useOTAUpdate();

  // Pretendard 폰트 로드 — 로드 완료 전엔 ActivityIndicator 표시
  // (앱 번들에 임베드되어 있어도 RN은 명시적 로드 권장)
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
  });

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
    return <UpdateScreen status={status} progress={progress} canSkip={canSkip} onSkip={skip} />;
  }

  if (!ready || !fontsLoaded) {
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

function RootLayout() {
  // Sentry Expo Router 화면 자동 추적 — 화면 이동 시점에 trace 시작
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (navigationRef?.current) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  // iOS Siri App Shortcut("아맞다 육아") 진입 → /voice 이동 + 녹음 시작
  useSiriVoiceLaunch();

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <OfflineBanner />
          <AuthGate>
            <Stack screenOptions={{ headerShown: false, headerTitleAlign: 'center' }} />
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// Sentry로 RootLayout 감싸기 — 자동 에러 캡처 + Touch Event 추적
export default Sentry.wrap(RootLayout);

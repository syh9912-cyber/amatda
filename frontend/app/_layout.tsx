import React, { useEffect, useRef, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import i18n from '../i18n'; // i18n 초기화 (기기 언어 감지 → ko/ja/zh-Hant, 미지원은 ko fallback)
import { useSiriVoiceLaunch } from '../hooks/useSiriVoiceLaunch';

import { View, ActivityIndicator, Text, TextInput, StyleSheet, AppState, AppStateStatus, InteractionManager } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, router, useNavigationContainerRef, usePathname } from 'expo-router';
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
import { analytics } from '../services/analytics';
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
import { applyPersistedDevLanguage } from '../components/ui/DevLanguageSwitcher';
import { COLORS } from '../constants/theme';

// 개발/프리뷰 전용: 저장된 인앱 언어 토글 선택을 스플래시 표시 전에 복원 (프로덕션은 no-op).
// 모듈 로드 시점에 실행해 스플래시 텍스트(~250ms 후 표시)보다 먼저 적용되게 한다.
void applyPersistedDevLanguage();

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
          locale: i18n.language, // 백엔드 푸시(예측알람/휴면/체험/또래맘) 문구 언어
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

// OTA 업데이트: 세션 도중 강제 reload 하지 않고 백그라운드로 "다운로드만" 한다.
// 받아둔 업데이트는 expo-updates 가 다음 앱 실행(cold start) 시 자동 적용
// (app.json: checkAutomatically ON_LOAD + fallbackToCacheTimeout 0).
// ⚠️ 2026-07-06: 세션 도중 Updates.reloadAsync() 강제 호출이 안드로이드 네이티브
// 크래시 + 스플래시 흰 화면 갇힘의 진원지였어 제거. 진행률 UI(UpdateScreen)도 함께 제거.
function useOTAUpdate() {
  const checkingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const checkAndDownload = useCallback(async () => {
    if (__DEV__ || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        // 다운로드만 — reload 안 함. 다음 실행 때 자동 적용.
        await Updates.fetchUpdateAsync();
      }
    } catch {
      // 업데이트 서버 접근/다운로드 실패 — 조용히 무시 (다음 기회에 재시도)
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (__DEV__) return;

    // 앱 시작 후 2초 뒤 1차 체크 (스플래시 끝난 직후, 최신본 미리 받아둠)
    const delayedCheck = setTimeout(() => checkAndDownload(), 2000);

    // 백그라운드 → 포그라운드 복귀 시에도 미리 받아둠 (적용은 다음 실행)
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        checkAndDownload();
      }
      appStateRef.current = next;
    });

    return () => { clearTimeout(delayedCheck); sub.remove(); };
  }, [checkAndDownload]);
}

function useLocationSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const requestLocation = useLocationStore((s) => s.requestLocation);

  useEffect(() => {
    if (!isAuthenticated) return;
    // 위치(GPS+역지오코딩)는 첫 페인트에 불필요 → 인터랙션 정착 후로 미뤄 부팅 자원 경합 완화
    const task = InteractionManager.runAfterInteractions(() => {
      requestLocation().catch(() => {});
    });
    return () => task.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
}

// 화면 열람(조회) 추적 — GA4 screen_view + 대시보드용 열람 기록(throttle).
// ⚠️ perf: usePathname 이 변경마다 리렌더를 유발하므로, 이 훅은 RootLayout 이 아니라
// 아래 <ScreenTracker/>(null 반환)에서만 호출해 리렌더 범위를 격리한다(부팅/네비 비용 최소화).
function useScreenTracking() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);
  const bufferRef = useRef<{ s: string; t: number }[]>([]);

  const flush = useCallback(async () => {
    const buf = bufferRef.current;
    if (buf.length === 0) return;
    bufferRef.current = [];
    if (!useAuthStore.getState().isAuthenticated) return; // 미로그인분은 버림
    try {
      await retentionApi.reportScreens(buf);
    } catch {
      /* best-effort — 열람 기록 유실 허용(사용자 흐름 무영향) */
    }
  }, []);

  // 화면 변경 감지 → GA4 screen_view + 버퍼 적재(로그인 상태만). 15개 쌓이면 즉시 flush.
  useEffect(() => {
    if (!pathname || pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;
    analytics.logScreen(pathname);
    if (useAuthStore.getState().isAuthenticated) {
      bufferRef.current.push({ s: pathname, t: Date.now() });
      if (bufferRef.current.length >= 15) void flush();
    }
  }, [pathname, flush]);

  // 백그라운드 전환 시 flush (세션 종료 자연 지점 → 화면 이동마다 쓰지 않아 비용 최소)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') void flush();
    });
    return () => sub.remove();
  }, [flush]);
}

function ScreenTracker() {
  useScreenTracking();
  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  // ⚠️ 부팅 게이트 fail-safe: hydrate 가 (특히 SecureStore 키체인 stall / OTA reloadAsync
  // 직후) 응답하지 않아 게이트에 영구히 갇히는 것을 막는다. 8초 후엔 무조건 진행.
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);

  // OTA 는 백그라운드 다운로드만 (강제 reload 없음 → 다음 실행 시 자동 적용)
  useOTAUpdate();

  // Pretendard 폰트 로드(등록)만 트리거하고 완료를 "기다리지 않는다"(2026-07-23 부팅 개선).
  // Pretendard 패치가 시스템폰트로 폴백하므로 미로드 상태에서도 즉시 렌더 가능하고,
  // 로드 완료 시 자연 스왑된다(짧은 FOUT 감수). → 폰트 I/O 가 첫 페인트를 막지 않음.
  useFonts({
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
    // hydrate 가 hang 해도(키체인 stall 등) 최대 8초 후 진행 — 무한 스피너 방지.
    // 8초는 정상 hydrate(<100ms)엔 절대 안 걸리고 진짜 hang 에만 발동한다. 그 경우
    // 인증 복원 실패로 로그인 화면으로 갈 수 있으나, 흰 화면 무한대기보다 낫다.
    const bootFailSafe = setTimeout(() => setBootTimedOut(true), 8000);
    return () => clearTimeout(bootFailSafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useNotificationSetup();
  useLocationSetup();

  // 게이트: hydrate(ready) 완료만 대기. 폰트는 더 이상 게이트하지 않는다(위 useFonts 주석).
  // bootTimedOut(8s)는 hydrate hang 시 무한 스피너를 막는 최후 방어선. 정상 부팅에선
  // 항상 ready 로 통과하며, ready 이후에만 splash 가 마운트되어 인증 상태가 이미 복원돼 있다.
  if (!ready && !bootTimedOut) {
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
            {i18n.t('rootLayout.errorBoundary.title')}
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
            <ScreenTracker />
            <Stack screenOptions={{ headerShown: false, headerTitleAlign: 'center' }} />
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// Sentry로 RootLayout 감싸기 — 자동 에러 캡처 + Touch Event 추적
export default Sentry.wrap(RootLayout);

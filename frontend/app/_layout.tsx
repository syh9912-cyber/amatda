import { useEffect, useRef, useState, Component, ErrorInfo, ReactNode } from 'react';
import { View, ActivityIndicator, Text, Image, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
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

/* eslint-disable @typescript-eslint/no-require-imports */
const MASCOT_HAPPY = require('../assets/mascot-happy.png') as number;
/* eslint-enable @typescript-eslint/no-require-imports */

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
  }, [isAuthenticated, selectedChild?.id]);
}

function useOTAUpdate() {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (__DEV__) return; // 개발 모드에서는 스킵

    const check = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdating(true);
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // 업데이트 체크 실패해도 앱은 정상 실행
      }
    };
    check();
  }, []);

  return updating;
}

function useLocationSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const requestLocation = useLocationStore((s) => s.requestLocation);

  useEffect(() => {
    if (!isAuthenticated) return;
    requestLocation().catch(() => {});
  }, [isAuthenticated]);
}

/* ── Update Screen ── */
const { width: _SW } = Dimensions.get('window');

function UpdateScreen() {
  const spin = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const dotOp1 = useRef(new Animated.Value(0.3)).current;
  const dotOp2 = useRef(new Animated.Value(0.3)).current;
  const dotOp3 = useRef(new Animated.Value(0.3)).current;
  const progressW = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Mascot gentle bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -10, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 10, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Spinner rotation
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
    ).start();

    // Dot animation (typing effect)
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotOp1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotOp2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotOp3, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(dotOp1, { toValue: 0.3, duration: 200, useNativeDriver: true }),
          Animated.timing(dotOp2, { toValue: 0.3, duration: 200, useNativeDriver: true }),
          Animated.timing(dotOp3, { toValue: 0.3, duration: 200, useNativeDriver: true }),
        ]),
        Animated.delay(200),
      ]),
    ).start();

    // Progress bar (fake, loops slowly)
    Animated.loop(
      Animated.sequence([
        Animated.timing(progressW, { toValue: _SW * 0.55, duration: 6000, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        Animated.timing(progressW, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    ).start();
  }, []);

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={upS.root}>
      <LinearGradient
        colors={['#FFF5EC', '#FFE0CC', '#FFDAB3']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Mascot */}
      <Animated.View style={{ transform: [{ translateY: bounce }], marginBottom: 24 }}>
        <Image source={MASCOT_HAPPY} style={upS.mascot} resizeMode="contain" />
      </Animated.View>

      {/* Spinner ring */}
      <Animated.View style={[upS.spinnerRing, { transform: [{ rotate: spinDeg }] }]}>
        <View style={upS.spinnerDot} />
      </Animated.View>

      {/* Title */}
      <Text style={upS.title}>{'업데이트 중'}</Text>
      <View style={upS.dotRow}>
        <Animated.Text style={[upS.dot, { opacity: dotOp1 }]}>{'.'}</Animated.Text>
        <Animated.Text style={[upS.dot, { opacity: dotOp2 }]}>{'.'}</Animated.Text>
        <Animated.Text style={[upS.dot, { opacity: dotOp3 }]}>{'.'}</Animated.Text>
      </View>

      {/* Subtitle */}
      <Text style={upS.sub}>{'더 나은 아맞다를 준비하고 있어요'}</Text>

      {/* Progress bar */}
      <View style={upS.progressBg}>
        <Animated.View style={[upS.progressFill, { width: progressW }]} />
      </View>

      {/* Footer */}
      <Text style={upS.footer}>{'잠시만 기다려주세요'}</Text>
    </View>
  );
}

const upS = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF5EC' },
  mascot: { width: 120, height: 120, borderRadius: 60 },
  spinnerRing: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 3, borderColor: 'rgba(255,140,90,0.15)',
    borderTopColor: '#FF8C5A',
    marginBottom: 20,
  },
  spinnerDot: {
    position: 'absolute', top: -4, left: 18,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF8C5A',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#2D2016' },
  dotRow: { flexDirection: 'row', marginTop: -2, marginBottom: 8 },
  dot: { fontSize: 22, fontWeight: '800', color: '#FF8C5A', marginHorizontal: 1 },
  sub: { fontSize: 14, color: '#8C7A6B', fontWeight: '500', marginBottom: 28 },
  progressBg: {
    width: _SW * 0.6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,140,90,0.15)', overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#FF8C5A' },
  footer: { marginTop: 16, fontSize: 12, color: '#B5A99A' },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);
  const updating = useOTAUpdate();

  useEffect(() => {
    initSentry();
    hydrate()
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useNotificationSetup();
  useLocationSetup();

  if (updating) {
    return <UpdateScreen />;
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

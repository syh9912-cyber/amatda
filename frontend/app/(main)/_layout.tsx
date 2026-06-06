import { Tabs, Redirect, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useAuthStore } from '../../stores/authStore';
import { useChildStore } from '../../stores/childStore';
import { usePremiumStore } from '../../stores/premiumStore';
import { authApi } from '../../services/api';

// 약관 버전 게이트 — consent.tsx / register.tsx 와 동기화
//   기존 사용자가 신규 필수 항목(커뮤니티 약관) 누락 시 재동의 화면 강제 라우팅.
const REQUIRED_CONSENT_VERSION = '2026-05-28';

// 알림 priming 화면을 한 번만 띄우기 위한 AsyncStorage 키 (notification-permission.tsx 와 동기화)
// v4: 가입 흐름 간소화 (priming → home 직행).
const NOTIF_PRIMED_KEY = 'notif_primed_v4';

const ACTIVE_COLOR = '#FF8C5A';
const INACTIVE_COLOR = '#8E8E93';

const TAB_ICONS = {
  home: { icon: require('../../assets/tab-home.png'), active: require('../../assets/tab-home-active.png') },
  diary: { icon: require('../../assets/quick-learning.png'), active: require('../../assets/quick-learning.png') },
  family: { icon: require('../../assets/icon-heart.png'), active: require('../../assets/icon-heart.png') },
  chat: { icon: require('../../assets/tab-chat.png'), active: require('../../assets/tab-chat-active.png') },
  more: { icon: require('../../assets/tab-more.png'), active: require('../../assets/tab-more-active.png') },
} as const;

function TabIcon({ iconKey, focused }: { iconKey: keyof typeof TAB_ICONS; focused: boolean }) {
  const cfg = TAB_ICONS[iconKey];
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={focused ? cfg.active : cfg.icon}
        style={{
          width: 32,
          height: 32,
          opacity: focused ? 1 : 0.65,
          tintColor: focused ? ACTIVE_COLOR : undefined,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: focused ? '700' : '400',
        color: focused ? ACTIVE_COLOR : INACTIVE_COLOR,
        marginTop: 0,
      }}
    >
      {label}
    </Text>
  );
}

export default function MainLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedChild = useChildStore((s) => s.selectedChild);
  const fetchPremiumStatus = usePremiumStore((s) => s.fetchStatus);
  const resetPremium = usePremiumStore((s) => s.reset);

  // 로그인 직후 프리미엄 상태 선제 로드 (광고 결정을 위한 캐시 워밍)
  useEffect(() => {
    if (isAuthenticated) {
      fetchPremiumStatus();
    } else {
      // 로그아웃 시 캐시 초기화
      resetPremium();
    }
  }, [isAuthenticated, fetchPremiumStatus, resetPremium]);

  // 약관 버전 게이트 + 알림 priming 게이트 — 인증 통과 후 1회 실행.
  //   ① 약관: 신규 필수 항목(커뮤니티 등) 누락 시 /onboarding/consent?reauth=1 강제
  //   ② 알림: status === 'undetermined' + priming 미경험 시 /onboarding/notification-permission
  //   각 게이트는 redirect 시 (main) 이 unmount → 다음 진입에서 다시 검사.
  const gateChecked = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || gateChecked.current) return;
    gateChecked.current = true;
    (async () => {
      // ① 약관 버전 게이트
      try {
        const res = await authApi.getProfile();
        const consent = res.data?.data?.consent as
          | { community?: boolean; version?: string | null }
          | null
          | undefined;
        const needsReauth =
          !consent ||
          consent.community !== true ||
          consent.version !== REQUIRED_CONSENT_VERSION;
        if (needsReauth) {
          router.replace('/onboarding/consent?reauth=1');
          return; // priming 은 다음 진입에서 처리
        }
      } catch {
        // 네트워크 실패 → priming 검사로 진행
      }

      // ② 알림 priming 게이트 — 폴백 경로 (consent 후 명시 진입 우선).
      //    primed === null 이면 status 무관으로 priming 노출. 교육 목적상 1회는 보여줌.
      try {
        if (!Device.isDevice) return;
        const primed = await AsyncStorage.getItem(NOTIF_PRIMED_KEY);
        if (primed === '1') return;
        router.replace('/onboarding/notification-permission');
      } catch {
        // 권한 조회 실패 — 무시. 다음 진입에서 재시도.
      }
    })();
  }, [isAuthenticated]);

  const ageGroup = selectedChild?.ageInfo?.group;
  const isElementary = ageGroup === 'elementary';
  const isPregnant = ageGroup === 'pregnant';

  // 인증 상태가 false가 되는 순간 (logout, 토큰 만료) 즉시 로그인 화면으로
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        headerTitleAlign: 'center',
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0.33,
          borderTopColor: '#C6C6C8',
          paddingTop: 8,
          paddingBottom: bottomPad - 4,
          height: 62 + bottomPad,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconKey="home" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label={'홈'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="baby-tracker"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconKey="diary" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label={isPregnant ? '임신앨범' : isElementary ? '생활기록' : '아기시간'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconKey="chat" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label={'상담이모'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="momstagram"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconKey="family" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label={'가족피드'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconKey="more" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label={'마이'} focused={focused} />,
        }}
      />

      {/* === Hidden screens === */}
      <Tabs.Screen name="diary" options={{ href: null }} />
      <Tabs.Screen name="album" options={{ href: null }} />
      <Tabs.Screen name="momstagram-post" options={{ href: null }} />
      <Tabs.Screen name="nutrition" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="timer" options={{ href: null }} />
      <Tabs.Screen name="trait-detail" options={{ href: null }} />
      <Tabs.Screen name="growth-stats" options={{ href: null }} />
      <Tabs.Screen name="privacy" options={{ href: null }} />
      <Tabs.Screen name="terms" options={{ href: null }} />
      <Tabs.Screen name="poop-analyzer" options={{ href: null }} />
      <Tabs.Screen name="cry-analyzer" options={{ href: null }} />
      <Tabs.Screen name="play-learning" options={{ href: null }} />
      <Tabs.Screen name="clinic" options={{ href: null }} />
      <Tabs.Screen name="child-card" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="notification-settings" options={{ href: null }} />
      <Tabs.Screen name="recommendation-detail" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="monthly-characteristic" options={{ href: null }} />
      <Tabs.Screen name="recommendations" options={{ href: null }} />
      <Tabs.Screen name="recommendation-list" options={{ href: null }} />
      <Tabs.Screen name="lullaby" options={{ href: null }} />
      <Tabs.Screen name="coparenting" options={{ href: null }} />
      <Tabs.Screen name="sos" options={{ href: null }} />
      <Tabs.Screen name="pregnancy" options={{ href: null }} />
      <Tabs.Screen name="vaccination" options={{ href: null }} />
      <Tabs.Screen name="gdm" options={{ href: null }} />
      <Tabs.Screen name="labor-monitor" options={{ href: null }} />
      <Tabs.Screen name="mom-wellness" options={{ href: null }} />
      <Tabs.Screen name="mom-group" options={{ href: null }} />
      <Tabs.Screen name="child-edit" options={{ href: null }} />
      <Tabs.Screen name="fever" options={{ href: null }} />
      <Tabs.Screen name="voice-settings" options={{ href: null }} />
      <Tabs.Screen name="ai-analysis" options={{ href: null }} />
      <Tabs.Screen name="pregnancy-journey-detail" options={{ href: null }} />
      <Tabs.Screen name="birth-bag" options={{ href: null }} />
      <Tabs.Screen name="mom-location-setup" options={{ href: null }} />
    </Tabs>
  );
}

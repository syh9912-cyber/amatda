import { Tabs, Redirect } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { useChildStore } from '../../stores/childStore';

/* 네비게이션 컬러: 활성 = 브랜드 메인, 비활성 = 깔끔한 연회색 */
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
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0.5,
          borderTopColor: '#F0F0F0',
          paddingTop: 10,
          paddingBottom: bottomPad - 4,
          height: 64 + bottomPad,
          /* 은은한 상단 그림자 */
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
          elevation: 4,
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
          tabBarLabel: ({ focused }) => <TabLabel label={isPregnant ? '임신기록' : isElementary ? '생활기록' : '아기시간'} focused={focused} />,
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
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen name="album" options={{ href: null }} />
      <Tabs.Screen name="momstagram-post" options={{ href: null }} />
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="nutrition" options={{ href: null }} />
      <Tabs.Screen name="academy" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="compatibility" options={{ href: null }} />
      <Tabs.Screen name="timer" options={{ href: null }} />
      <Tabs.Screen name="mates" options={{ href: null }} />
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
      <Tabs.Screen name="parent-level" options={{ href: null }} />
      <Tabs.Screen name="sleep-predict" options={{ href: null }} />
      <Tabs.Screen name="sos" options={{ href: null }} />
      <Tabs.Screen name="pregnancy" options={{ href: null }} />
      <Tabs.Screen name="vaccination" options={{ href: null }} />
      <Tabs.Screen name="gdm" options={{ href: null }} />
      <Tabs.Screen name="child-edit" options={{ href: null }} />
      <Tabs.Screen name="fever" options={{ href: null }} />
      <Tabs.Screen name="voice-settings" options={{ href: null }} />
    </Tabs>
  );
}

import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '../../constants/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    '홈': '🏠', '일기': '📝', '리포트': '📊', '상담': '💬', '프로필': '👤',
  };
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? '📋'}
    </Text>
  );
}

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ focused }) => <TabIcon label="홈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: '일기',
          tabBarIcon: ({ focused }) => <TabIcon label="일기" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: '리포트',
          tabBarIcon: ({ focused }) => <TabIcon label="리포트" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          title: '상담',
          tabBarIcon: ({ focused }) => <TabIcon label="상담" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ focused }) => <TabIcon label="프로필" focused={focused} />,
        }}
      />
      {/* 탭바에 숨기는 화면들 — 홈 카드에서 이동 */}
      <Tabs.Screen name="nutrition" options={{ href: null }} />
      <Tabs.Screen name="academy" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="compatibility" options={{ href: null }} />
      <Tabs.Screen name="timer" options={{ href: null }} />
      <Tabs.Screen name="mates" options={{ href: null }} />
    </Tabs>
  );
}

import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';

const ACTIVE_COLOR = '#6366F1';
const INACTIVE_COLOR = '#B0B0B0';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>
      {emoji}
    </Text>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: focused ? '700' : '400',
        color: focused ? ACTIVE_COLOR : INACTIVE_COLOR,
      }}
    >
      {label}
    </Text>
  );
}

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: '#E5E5E5',
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="홈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📝" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="일기" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="상담" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="⋯" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="더보기" focused={focused} />,
        }}
      />
      {/* Hidden screens accessible from home */}
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="nutrition" options={{ href: null }} />
      <Tabs.Screen name="academy" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="compatibility" options={{ href: null }} />
      <Tabs.Screen name="timer" options={{ href: null }} />
      <Tabs.Screen name="mates" options={{ href: null }} />
      <Tabs.Screen name="trait-detail" options={{ href: null }} />
    </Tabs>
  );
}

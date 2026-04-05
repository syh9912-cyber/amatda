import { Tabs } from 'expo-router';
import { Text, Image, StyleSheet } from 'react-native';

const ACTIVE_COLOR = '#6366F1';
const INACTIVE_COLOR = '#B0B0B0';

const TAB_ICONS = {
  home: require('../../assets/tab-home.png'),
  diary: require('../../assets/tab-diary.png'),
  chatbot: require('../../assets/tab-chat.png'),
  profile: require('../../assets/tab-more.png'),
} as const;

function TabIcon({ name, focused }: { name: keyof typeof TAB_ICONS; focused: boolean }) {
  return (
    <Image
      source={TAB_ICONS[name]}
      style={{ width: 24, height: 24, opacity: focused ? 1 : 0.4 }}
    />
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
          paddingTop: 6,
          paddingBottom: 40,
          height: 90,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="홈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="diary" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="일기" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="chatbot" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label="상담" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
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
      <Tabs.Screen name="album" options={{ href: null }} />
      <Tabs.Screen name="baby-tracker" options={{ href: null }} />
      <Tabs.Screen name="privacy" options={{ href: null }} />
      <Tabs.Screen name="terms" options={{ href: null }} />
    </Tabs>
  );
}

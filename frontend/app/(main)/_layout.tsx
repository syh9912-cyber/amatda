import { Tabs } from 'expo-router';
import { Text, View, Platform } from 'react-native';

const ACTIVE_COLOR = '#FF8C5A';
const INACTIVE_COLOR = '#B8A690';

const TAB_CONFIG = [
  { emoji: '🏠', label: '홈' },
  { emoji: '🧠', label: '기질분석' },
  { emoji: '💬', label: 'AI상담' },
  { emoji: '📸', label: '맘스타그램' },
  { emoji: '🙋', label: '마이' },
] as const;

function EmojiIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>
        {emoji}
      </Text>
    </View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: focused ? '700' : '400',
        color: focused ? ACTIVE_COLOR : INACTIVE_COLOR,
        marginTop: 2,
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
          borderTopWidth: 0,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? 44 : 34,
          height: Platform.OS === 'android' ? 100 : 90,
          shadowColor: '#B8A690',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
      }}
    >
      {/* === Visible tabs === */}
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <EmojiIcon emoji={TAB_CONFIG[0].emoji} focused={focused} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label={TAB_CONFIG[0].label} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="trait-detail"
        options={{
          tabBarIcon: ({ focused }) => (
            <EmojiIcon emoji={TAB_CONFIG[1].emoji} focused={focused} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label={TAB_CONFIG[1].label} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          tabBarIcon: ({ focused }) => (
            <EmojiIcon emoji={TAB_CONFIG[2].emoji} focused={focused} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label={TAB_CONFIG[2].label} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="momstagram"
        options={{
          tabBarIcon: ({ focused }) => (
            <EmojiIcon emoji={TAB_CONFIG[3].emoji} focused={focused} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label={TAB_CONFIG[3].label} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <EmojiIcon emoji={TAB_CONFIG[4].emoji} focused={focused} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label={TAB_CONFIG[4].label} focused={focused} />
          ),
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
      <Tabs.Screen name="baby-tracker" options={{ href: null }} />
      <Tabs.Screen name="growth-stats" options={{ href: null }} />
      <Tabs.Screen name="privacy" options={{ href: null }} />
      <Tabs.Screen name="terms" options={{ href: null }} />
      <Tabs.Screen name="poop-analyzer" options={{ href: null }} />
      <Tabs.Screen name="cry-analyzer" options={{ href: null }} />
      <Tabs.Screen name="play-learning" options={{ href: null }} />
      <Tabs.Screen name="clinic" options={{ href: null }} />
      <Tabs.Screen name="child-card" options={{ href: null }} />
    </Tabs>
  );
}

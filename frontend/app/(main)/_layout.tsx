import { Tabs } from 'expo-router';
import { Image, ImageSourcePropType, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';

const ACTIVE_COLOR = '#FF8C5A';
const INACTIVE_COLOR = '#B8A690';

const TAB_ICONS = {
  home: { icon: require('../../assets/tab-home.png'), active: require('../../assets/tab-home-active.png') },
  diary: { icon: require('../../assets/tab-diary.png'), active: require('../../assets/tab-diary-active.png') },
  chat: { icon: require('../../assets/tab-chat.png'), active: require('../../assets/tab-chat-active.png') },
  more: { icon: require('../../assets/tab-more.png'), active: require('../../assets/tab-more-active.png') },
} as const;

function TabIcon({ iconKey, focused }: { iconKey: keyof typeof TAB_ICONS; focused: boolean }) {
  const cfg = TAB_ICONS[iconKey];
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={focused ? cfg.active : cfg.icon}
        style={{ width: 34, height: 34, borderRadius: 17, opacity: 1 }}
        resizeMode="contain"
      />
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
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16);
  const selectedChild = useChildStore((s) => s.selectedChild);
  const ageGroup = selectedChild?.ageInfo?.group;
  const isElementary = ageGroup === 'elementary';
  const isPregnant = ageGroup === 'pregnant';

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 6,
          paddingBottom: bottomPad - 4,
          height: 56 + bottomPad,
          shadowColor: '#B8A690',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconKey="home" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label={'\uD648'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="baby-tracker"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconKey="diary" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label={isPregnant ? '\uC784\uC2E0\uAE30\uB85D' : isElementary ? '\uC0DD\uD65C\uAE30\uB85D' : '\uC721\uC544\uAE30\uB85D'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chatbot"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconKey="chat" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label={'\uC0C1\uB2F4\uC774\uBAA8'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="momstagram"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconKey="diary" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label={'\uAC00\uC871\uD53C\uB4DC'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon iconKey="more" focused={focused} />,
          tabBarLabel: ({ focused }) => <TabLabel label={'\uB9C8\uC774'} focused={focused} />,
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
    </Tabs>
  );
}

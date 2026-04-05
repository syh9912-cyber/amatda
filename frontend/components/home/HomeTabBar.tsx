import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export interface HomeTab {
  emoji: string;
  label: string;
  navigateTo?: string;
}

export const HOME_TABS: HomeTab[] = [
  { emoji: '📔', label: '일기' },
  { emoji: '🏫', label: '학원' },
  { emoji: '🥗', label: '영양' },
  { emoji: '📊', label: '리포트' },
  { emoji: '📸', label: '맘스타', navigateTo: '/(main)/momstagram' },
];

interface Props {
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function HomeTabBar({ selectedIndex, onSelect }: Props) {
  return (
    <View style={styles.container}>
      {HOME_TABS.map((tab, idx) => {
        const active = !tab.navigateTo && idx === selectedIndex;
        return (
          <TouchableOpacity
            key={tab.label}
            style={styles.tabWrapper}
            onPress={() => {
              if (tab.navigateTo) {
                router.push(tab.navigateTo as never);
              } else {
                onSelect(idx);
              }
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.circle,
                active ? styles.circleActive : styles.circleInactive,
              ]}
            >
              <Text style={[styles.emoji, active && styles.emojiActive]}>
                {tab.emoji}
              </Text>
            </View>
            <Text
              style={[
                styles.label,
                active ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const CIRCLE_SIZE = 56;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  tabWrapper: {
    alignItems: 'center',
    width: CIRCLE_SIZE + 4,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    backgroundColor: '#4338CA',
    transform: [{ scale: 1.08 }],
  },
  circleInactive: {
    backgroundColor: '#F0F0F0',
  },
  emoji: {
    fontSize: 24,
  },
  emojiActive: {
    fontSize: 26,
  },
  label: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
  },
  labelActive: {
    color: '#4338CA',
    fontWeight: '700',
  },
  labelInactive: {
    color: '#A0A0B0',
  },
});

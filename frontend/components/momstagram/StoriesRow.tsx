import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SPACING } from '../../constants/theme';

const STORY_COLORS = [
  '#FFB088', '#FF9B9B', '#A8D8EA', '#FFD3B6',
  '#DCEDC1', '#C9B1FF', '#FFE0AC', '#B5EAD7',
];

interface StoryUser {
  id: string;
  name: string;
  hasNew: boolean;
}

const STORY_USERS: StoryUser[] = [
  { id: 'my', name: '내 스토리', hasNew: false },
  { id: '1', name: '하늘맘', hasNew: true },
  { id: '2', name: '도윤아빠', hasNew: true },
  { id: '3', name: '서준맘', hasNew: true },
  { id: '4', name: '지안맘', hasNew: false },
  { id: '5', name: '유나맘', hasNew: true },
  { id: '6', name: '민준아빠', hasNew: false },
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STORY_COLORS[Math.abs(hash) % STORY_COLORS.length];
}

export function StoriesRow() {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {STORY_USERS.map((user) => {
          const isMyStory = user.id === 'my';
          const bg = getColor(user.name);
          return (
            <TouchableOpacity
              key={user.id}
              style={styles.storyItem}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.avatarRing,
                  user.hasNew ? styles.ringActive : styles.ringInactive,
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: bg }]}>
                  {isMyStory ? (
                    <Text style={styles.plusIcon}>+</Text>
                  ) : (
                    <Text style={styles.avatarText}>
                      {user.name.charAt(0)}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {user.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EFEFEF',
    paddingVertical: SPACING.sm + 2,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    gap: 14,
  },
  storyItem: {
    alignItems: 'center',
    width: 68,
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  ringActive: {
    borderWidth: 2.5,
    borderColor: '#FF6B6B',
  },
  ringInactive: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  plusIcon: {
    fontSize: 26,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  storyName: {
    fontSize: 11,
    color: '#262626',
    textAlign: 'center',
  },
});

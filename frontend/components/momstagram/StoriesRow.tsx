import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { pickImageFromLibrary } from '../../utils/imagePicker';
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

// 실제 스토리 데이터는 Firestore에서 로드 (추후 연동).
// 현재는 "내 스토리" 버튼만 노출하여 가짜 사용자를 표시하지 않는다.
const STORY_USERS: StoryUser[] = [
  { id: 'my', name: '내 스토리', hasNew: false },
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STORY_COLORS[Math.abs(hash) % STORY_COLORS.length];
}

export function StoriesRow() {
  const handleMyStory = async () => {
    const picked = await pickImageFromLibrary({ quality: 0.8 });
    if (picked) {
      router.push({
        pathname: '/(main)/momstagram-post',
        params: { prefillImage: picked.uri },
      });
    }
  };

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
              onPress={isMyStory ? handleMyStory : undefined}
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

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import {
  useMomstagramStore,
  MomstagramPost,
} from '../../stores/momstagramStore';

const CORAL = '#FF6B6B';
const BG = '#FFF5EC';
const WARM_GRAY = '#9E8E82';

const CATEGORIES = [
  '인기글',
  '육아 고민',
  '학원 정보',
  '자유토론',
] as const;
type Category = (typeof CATEGORIES)[number];

interface CategoryStyle {
  bg: string;
  text: string;
  label: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  '육아 고민': { bg: '#E0F5F0', text: '#2BA88C', label: '육아고민' },
  '학원 정보': { bg: '#E0ECFF', text: '#4A7BF7', label: '학원정보' },
  '자유토론': { bg: '#FFE8E8', text: CORAL, label: '자유토론' },
};

const AVATAR_COLORS: string[] = [
  '#FFB088',
  '#FF9B9B',
  '#A8D8EA',
  '#FFD3B6',
  '#DCEDC1',
  '#C9B1FF',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return `${Math.floor(days / 7)}주 전`;
}

function getCategoryForPost(post: MomstagramPost): string {
  const c = post.content;
  if (c.includes('학원') || c.includes('학습') || c.includes('공부')) {
    return '학원 정보';
  }
  if (
    c.includes('고민') ||
    c.includes('걱정') ||
    c.includes('어떻게') ||
    c.includes('도움')
  ) {
    return '육아 고민';
  }
  return '자유토론';
}

function CommunityPostItem({
  post,
  category,
}: {
  post: MomstagramPost;
  category: string;
}) {
  const avatarBg = getAvatarColor(post.userName);
  const initial = post.userName.charAt(0);
  const catStyle = CATEGORY_STYLES[category];
  const title =
    post.content.length > 30
      ? post.content.slice(0, 30) + '...'
      : post.content;
  const preview =
    post.content.length > 60
      ? post.content.slice(0, 60) + '...'
      : post.content;

  return (
    <View style={itemStyles.container}>
      {/* Top row: avatar + name + time */}
      <View style={itemStyles.topRow}>
        <View style={[itemStyles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={itemStyles.avatarText}>{initial}</Text>
        </View>
        <Text style={itemStyles.userName}>{post.userName}</Text>
        <Text style={itemStyles.dot}>{'  '}
        </Text>
        <Text style={itemStyles.time}>{timeAgo(post.createdAt)}</Text>
      </View>

      {/* Category badge */}
      {catStyle && (
        <View
          style={[itemStyles.badge, { backgroundColor: catStyle.bg }]}
        >
          <Text style={[itemStyles.badgeText, { color: catStyle.text }]}>
            {catStyle.label}
          </Text>
        </View>
      )}

      {/* Title */}
      <Text style={itemStyles.title} numberOfLines={1}>
        {title}
      </Text>

      {/* Preview */}
      <Text style={itemStyles.preview} numberOfLines={1}>
        {preview}
      </Text>

      {/* Bottom stats */}
      <View style={itemStyles.statsRow}>
        <Text style={itemStyles.stat}>
          {'❤️ '}{post.likes}
        </Text>
        <Text style={itemStyles.stat}>
          {'💬 '}{post.comments.length}
        </Text>
      </View>

      <View style={itemStyles.separator} />
    </View>
  );
}

const itemStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#1E1E2E',
  },
  dot: {
    fontSize: FONT_SIZE.xs,
    color: WARM_GRAY,
  },
  time: {
    fontSize: FONT_SIZE.xs,
    color: WARM_GRAY,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs + 2,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#1E1E2E',
    marginBottom: SPACING.xs,
  },
  preview: {
    fontSize: FONT_SIZE.sm,
    color: '#6B6B80',
    lineHeight: 19,
    marginBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  stat: {
    fontSize: FONT_SIZE.xs,
    color: WARM_GRAY,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0E8E0',
  },
});

export default function CommunityScreen() {
  const { posts, refresh } = useMomstagramStore();
  const [activeCategory, setActiveCategory] = useState<Category>('인기글');
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const postsWithCategory = posts.map((p) => ({
    post: p,
    category: getCategoryForPost(p),
  }));

  const filteredPosts =
    activeCategory === '인기글'
      ? [...postsWithCategory].sort((a, b) => b.post.likes - a.post.likes)
      : postsWithCategory.filter((p) => p.category === activeCategory);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: { post: MomstagramPost; category: string } }) => (
      <CommunityPostItem post={item.post} category={item.category} />
    ),
    [],
  );

  const renderHeader = () => (
    <View style={styles.tagFilterWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagFilterContent}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.tagPill,
                isActive ? styles.tagPillActive : styles.tagPillInactive,
              ]}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tagPillText,
                  isActive
                    ? styles.tagPillTextActive
                    : styles.tagPillTextInactive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>{'💬'}</Text>
      <Text style={styles.emptyText}>아직 게시물이 없습니다</Text>
      <Text style={styles.emptyHint}>첫 번째 글을 작성해보세요</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>엄마들 커뮤니티</Text>
            <Text style={styles.lockIcon}>{' 🔒'}</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            우리 아이를 위한 정보를 나눠요
          </Text>
        </View>
      </View>

      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.post.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={CORAL}
          />
        }
        ListEmptyComponent={renderEmpty}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>{'✏'}</Text>
        <Text style={styles.fabLabel}>글쓰기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  /* Header */
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E8E0',
  },
  headerCenter: {
    paddingLeft: SPACING.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#1E1E2E',
  },
  lockIcon: {
    fontSize: 16,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: WARM_GRAY,
    marginTop: 1,
  },
  /* Tag filter */
  tagFilterWrap: {
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E8E0',
  },
  tagFilterContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  tagPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  tagPillActive: {
    backgroundColor: CORAL,
  },
  tagPillInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0D8D0',
  },
  tagPillText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  tagPillTextActive: {
    color: '#FFFFFF',
  },
  tagPillTextInactive: {
    color: '#6B6B80',
  },
  /* List */
  listContent: {
    paddingBottom: 100,
  },
  /* Empty */
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: '#1E1E2E',
    marginBottom: SPACING.xs,
  },
  emptyHint: {
    fontSize: FONT_SIZE.sm,
    color: WARM_GRAY,
  },
  /* FAB */
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORAL,
    paddingHorizontal: SPACING.md + 4,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.full,
    gap: SPACING.xs + 2,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  fabLabel: {
    fontSize: FONT_SIZE.sm + 1,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

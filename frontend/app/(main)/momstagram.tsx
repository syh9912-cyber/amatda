import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import {
  useMomstagramStore,
  MomstagramPost,
} from '../../stores/momstagramStore';
import { useChildStore } from '../../stores/childStore';
import { PostCard } from '../../components/momstagram/PostCard';
import { CommentsModal } from '../../components/momstagram/CommentsModal';

const TAG_FILTERS = ['전체', '일상', '학습', '여행', '기념일', '기타'] as const;
type TagFilter = (typeof TAG_FILTERS)[number];

const CORAL = '#FF6B6B';
const BG = '#FFF5EC';
const WARM_GRAY = '#9E8E82';

export default function MomstagramScreen() {
  const { posts, privatePosts, hasMore, toggleLike, addComment, loadMore, refresh, loadPrivatePosts } =
    useMomstagramStore();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [refreshing, setRefreshing] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<TagFilter>('전체');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadPrivatePosts();
  }, [loadPrivatePosts]);

  const allPosts = useMemo(() => {
    const combined = [...posts, ...privatePosts];
    combined.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return combined;
  }, [posts, privatePosts]);

  const commentPost = commentPostId
    ? allPosts.find((p) => p.id === commentPostId) ?? null
    : null;

  const filteredPosts =
    activeTag === '전체'
      ? allPosts
      : allPosts.filter((p) => p.category === activeTag);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleShare = useCallback((_postId: string) => {
    Alert.alert('공유', '이 게시물의 링크가 복사되었습니다.');
  }, []);

  const handleCommentSubmit = useCallback(
    (text: string) => {
      if (!commentPostId) return;
      addComment(commentPostId, {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        userName: '나',
        text,
        createdAt: new Date().toISOString(),
      });
    },
    [commentPostId, addComment],
  );

  const renderItem = useCallback(
    ({ item }: { item: MomstagramPost }) => (
      <PostCard
        post={item}
        onLike={toggleLike}
        onComment={setCommentPostId}
        onShare={handleShare}
      />
    ),
    [toggleLike, handleShare],
  );

  const childName = selectedChild?.name ?? '아이';

  const renderHeader = () => (
    <View style={styles.tagFilterWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagFilterContent}
      >
        {TAG_FILTERS.map((tag) => {
          const isActive = activeTag === tag;
          return (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tagPill,
                isActive ? styles.tagPillActive : styles.tagPillInactive,
              ]}
              onPress={() => setActiveTag(tag)}
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
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>{'📸'}</Text>
      <Text style={styles.emptyText}>아직 게시물이 없습니다</Text>
      <Text style={styles.emptyHint}>첫 번째 게시물을 작성해보세요</Text>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore || filteredPosts.length === 0) return null;
    return (
      <Text style={styles.footerText}>더 불러오는 중...</Text>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {childName} 성장앨범
          </Text>
          <Text style={styles.headerSubtitle}>
            엄마들만 볼 수 있는 공간
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
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
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={() => router.push('/(main)/momstagram-post')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <CommentsModal
        visible={commentPostId !== null}
        comments={commentPost?.comments ?? []}
        onClose={() => setCommentPostId(null)}
        onSubmit={handleCommentSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  /* Header */
  header: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E8E0',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1E1E2E',
  },
  headerCenter: {
    flex: 1,
    marginLeft: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#1E1E2E',
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: WARM_GRAY,
    marginTop: 1,
  },
  headerRight: { width: 36 },
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
  footerText: {
    textAlign: 'center',
    color: WARM_GRAY,
    fontSize: FONT_SIZE.sm,
    paddingVertical: SPACING.md,
  },
  /* FAB */
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CORAL,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 30,
  },
});

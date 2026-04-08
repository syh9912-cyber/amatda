import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SIZE, SPACING } from '../../constants/theme';
import {
  useMomstagramStore,
  MomstagramPost,
} from '../../stores/momstagramStore';
import { PostCard } from '../../components/momstagram/PostCard';
import { CommentsModal } from '../../components/momstagram/CommentsModal';
import { StoriesRow } from '../../components/momstagram/StoriesRow';

const CORAL = '#FF6B6B';

export default function MomstagramScreen() {
  const {
    posts, privatePosts, hasMore, loading,
    toggleLike, addCommentViaApi, loadMore, refresh,
    fetchFeed, loadPrivatePosts,
  } = useMomstagramStore();
  const [refreshing, setRefreshing] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchFeed();
    loadPrivatePosts();
  }, [fetchFeed, loadPrivatePosts]);

  const allPosts = useMemo(() => {
    const combined = [...posts, ...privatePosts];
    combined.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return combined;
  }, [posts, privatePosts]);

  const commentPost = commentPostId
    ? allPosts.find((p) => p.id === commentPostId) ?? null
    : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleShare = useCallback((_postId: string) => {
    Alert.alert('공유', '이 게시물의 링크가 복사되었습니다.');
  }, []);

  const handleCommentSubmit = useCallback(
    (text: string) => {
      if (!commentPostId) return;
      addCommentViaApi(commentPostId, text);
    },
    [commentPostId, addCommentViaApi],
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

  const renderHeader = () => <StoriesRow />;

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color={CORAL} />
          <Text style={styles.emptyHint}>게시물을 불러오는 중...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji}>{'📸'}</Text>
        <Text style={styles.emptyTitle}>아직 게시물이 없습니다</Text>
        <Text style={styles.emptyHint}>
          첫 게시물을 올려보세요!
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!hasMore || allPosts.length === 0) return null;
    return (
      <View style={styles.footerWrap}>
        <ActivityIndicator size="small" color={CORAL} />
        <Text style={styles.footerText}>더 불러오는 중...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Instagram-style header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.headerLogo}>맘스타그램</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push('/(main)/momstagram-post')}
            activeOpacity={0.7}
          >
            <Text style={styles.headerIcon}>{'📷'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={allPosts}
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  /* Instagram-style header */
  header: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EFEFEF',
  },
  headerLogo: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: '#262626',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: { fontSize: 24 },
  /* List */
  listContent: {
    paddingBottom: 100,
  },
  /* Empty */
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 3,
  },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: '#262626',
    marginBottom: SPACING.xs,
  },
  emptyHint: {
    fontSize: FONT_SIZE.sm,
    color: '#8E8E8E',
    marginTop: SPACING.sm,
  },
  footerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  footerText: {
    textAlign: 'center',
    color: '#8E8E8E',
    fontSize: FONT_SIZE.sm,
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

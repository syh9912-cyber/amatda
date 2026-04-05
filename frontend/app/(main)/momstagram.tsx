import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import {
  useMomstagramStore,
  MomstagramPost,
} from '../../stores/momstagramStore';
import { PostCard } from '../../components/momstagram/PostCard';
import { CommentsModal } from '../../components/momstagram/CommentsModal';

export default function MomstagramScreen() {
  const { posts, hasMore, toggleLike, addComment, loadMore, refresh } =
    useMomstagramStore();
  const [refreshing, setRefreshing] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);

  const commentPost = commentPostId
    ? posts.find((p) => p.id === commentPostId) ?? null
    : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleShare = useCallback((postId: string) => {
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

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>{'\uD83D\uDCF8'}</Text>
      <Text style={styles.emptyText}>아직 게시물이 없습니다</Text>
      <Text style={styles.emptyHint}>
        첫 번째 게시물을 작성해보세요
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore || posts.length === 0) return null;
    return (
      <Text style={styles.footerText}>
        더 불러오는 중...
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: '\uB9D8\uC2A4\uD0C0\uADF8\uB7A8', headerShown: true }}
      />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
      />

      {/* FAB - create post */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(main)/momstagram-post')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Comments modal */}
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
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  listContent: {
    padding: SPACING.md,
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
    color: '#A0A0B0',
  },
  footerText: {
    textAlign: 'center',
    color: '#A0A0B0',
    fontSize: FONT_SIZE.sm,
    paddingVertical: SPACING.md,
  },
  /* FAB */
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.elevated,
  },
  fabText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 30,
  },
});

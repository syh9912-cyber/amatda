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
import { FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
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
      <Text style={styles.emptyEmoji}>{'📸'}</Text>
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
        options={{
          title: '맘스타그램',
          headerShown: true,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '700',
            color: '#1E1E2E',
          },
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/(main)/momstagram-post')}
              style={styles.headerAddBtn}
            >
              <Text style={styles.headerAddText}>+</Text>
            </TouchableOpacity>
          ),
        }}
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  listContent: {
    paddingBottom: 100,
  },
  /* Header */
  headerAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E1E2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  headerAddText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E1E2E',
    lineHeight: 22,
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
});

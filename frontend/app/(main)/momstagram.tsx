import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SIZE, SPACING } from '../../constants/theme';
import {
  useMomstagramStore,
  MomstagramPost,
  PostCategory,
} from '../../stores/momstagramStore';
import { useAuthStore } from '../../stores/authStore';
import { AdSlot } from '../../components/ads/AdSlot';
import { PostCard } from '../../components/momstagram/PostCard';
import { CommentsModal } from '../../components/momstagram/CommentsModal';
import { StoriesRow } from '../../components/momstagram/StoriesRow';
import { pickImageFromLibrary } from '../../utils/imagePicker';
import { uploadApi } from '../../services/api';

const CATEGORIES: PostCategory[] = ['일상', '학습', '여행', '기념일', '기타'];

const CORAL = '#FF6B6B';

export default function MomstagramScreen() {
  const {
    posts, privatePosts, hasMore, loading,
    toggleLike, addCommentViaApi, loadMore, refresh,
    fetchFeed, loadPrivatePosts, deletePost, updatePost,
  } = useMomstagramStore();
  const currentUserId = useAuthStore((s) => s.userId);
  const [refreshing, setRefreshing] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<MomstagramPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<PostCategory>('일상');
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editImageChanged, setEditImageChanged] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      fetchFeed();
      loadPrivatePosts();
    }, [fetchFeed, loadPrivatePosts]),
  );

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

  const handleMore = useCallback((postId: string) => {
    const post = allPosts.find((p) => p.id === postId);
    if (!post) return;
    Alert.alert('게시글 메뉴', undefined, [
      {
        text: '수정',
        onPress: () => {
          setEditContent(post.content);
          setEditCategory((post.category as PostCategory) ?? '일상');
          setEditImage(post.imageUri);
          setEditImageChanged(false);
          setEditingPost(post);
        },
      },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          Alert.alert('게시글 삭제', '정말 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
              text: '삭제',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deletePost(postId);
                } catch {
                  Alert.alert('오류', '삭제에 실패했습니다. 다시 시도해주세요.');
                }
              },
            },
          ]);
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  }, [allPosts, deletePost]);

  const handleEditPickImage = useCallback(async () => {
    const picked = await pickImageFromLibrary({ quality: 0.8 });
    if (picked?.uri) {
      setEditImage(picked.uri);
      setEditImageChanged(true);
    }
  }, []);

  const handleEditRemoveImage = useCallback(() => {
    setEditImage(null);
    setEditImageChanged(true);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingPost) return;
    const trimmed = editContent.trim();
    if (!trimmed) {
      Alert.alert('알림', '내용을 입력해주세요.');
      return;
    }
    setEditSaving(true);
    try {
      const payload: {
        content?: string;
        category?: PostCategory;
        imageUrl?: string | null;
        imageUri?: string | null;
      } = {
        content: trimmed,
        category: editCategory,
      };

      if (editImageChanged) {
        if (editingPost.isPrivate) {
          // Private posts store local URI directly
          payload.imageUri = editImage;
        } else if (editImage === null) {
          payload.imageUrl = null;
        } else if (editImage.startsWith('https://')) {
          payload.imageUrl = editImage;
        } else if (editImage.startsWith('file://') || editImage.startsWith('content://') || editImage.startsWith('ph://')) {
          try {
            const uploaded = await uploadApi.upload(editImage, 'momstagram');
            payload.imageUrl = uploaded.url;
          } catch {
            Alert.alert('오류', '이미지 업로드에 실패했습니다.');
            setEditSaving(false);
            return;
          }
        }
      }

      await updatePost(editingPost.id, payload);
      setEditingPost(null);
      setEditContent('');
      setEditImage(null);
      setEditImageChanged(false);
    } catch {
      Alert.alert('오류', '수정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setEditSaving(false);
    }
  }, [editingPost, editContent, editCategory, editImage, editImageChanged, updatePost]);

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
        onMore={handleMore}
        isMine={!!item.isPrivate || (!!currentUserId && item.userId === currentUserId)}
      />
    ),
    [toggleLike, handleShare, handleMore, currentUserId],
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
        <Image source={require('../../assets/icon-camera.png')} style={styles.emptyIcon} resizeMode="contain" />
        <Text style={styles.emptyTitle}>아직 게시물이 없습니다</Text>
        <Text style={styles.emptyHint}>
          가족과 소중한 순간을 공유해보세요
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
        <Text style={styles.headerLogo}>가족 피드</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push('/(main)/momstagram-post')}
            activeOpacity={0.7}
          >
            <Image source={require('../../assets/icon-camera.png')} style={styles.headerIconImg} resizeMode="contain" />
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

      <Modal
        visible={editingPost !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingPost(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editOverlay}
        >
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>게시글 수정</Text>
            <ScrollView
              style={styles.editScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.editLabel}>내용</Text>
              <TextInput
                style={styles.editInput}
                value={editContent}
                onChangeText={setEditContent}
                multiline
                placeholder="내용을 입력하세요"
                placeholderTextColor="#A0A0A0"
                maxLength={1000}
              />

              <Text style={styles.editLabel}>사진</Text>
              {editImage ? (
                <View style={styles.editImageWrap}>
                  <Image source={{ uri: editImage }} style={styles.editImagePreview} resizeMode="cover" />
                  <View style={styles.editImageActions}>
                    <TouchableOpacity
                      style={[styles.editImageBtn, styles.editImageBtnChange]}
                      onPress={handleEditPickImage}
                      disabled={editSaving}
                    >
                      <Text style={styles.editImageBtnText}>📷 사진 변경</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editImageBtn, styles.editImageBtnRemove]}
                      onPress={handleEditRemoveImage}
                      disabled={editSaving}
                    >
                      <Text style={styles.editImageBtnRemoveText}>✕ 삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.editImagePickBtn}
                  onPress={handleEditPickImage}
                  disabled={editSaving}
                >
                  <Text style={styles.editImagePickText}>📷 사진 추가</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.editLabel}>카테고리</Text>
              <View style={styles.editCatRow}>
                {CATEGORIES.map((cat) => {
                  const active = editCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.editCatChip, active && styles.editCatChipActive]}
                      onPress={() => setEditCategory(cat)}
                      disabled={editSaving}
                    >
                      <Text style={[styles.editCatChipText, active && styles.editCatChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.editBtnRow}>
              <TouchableOpacity
                style={[styles.editBtn, styles.editBtnCancel]}
                onPress={() => {
                  setEditingPost(null);
                  setEditContent('');
                  setEditImage(null);
                  setEditImageChanged(false);
                }}
                disabled={editSaving}
                accessibilityRole="button"
                accessibilityLabel="수정 취소"
              >
                <Text style={styles.editBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBtn, styles.editBtnSave, editSaving && { opacity: 0.6 }]}
                onPress={handleEditSave}
                disabled={editSaving}
                accessibilityRole="button"
                accessibilityLabel="수정 저장"
              >
                <Text style={styles.editBtnSaveText}>{editSaving ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AdSlot />
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
  headerIconImg: { width: 24, height: 24 },
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
  emptyIcon: { width: 56, height: 56, marginBottom: SPACING.md },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 30,
  },
  /* Edit modal */
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  editCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.lg,
    maxHeight: '85%',
  },
  editTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#262626',
    marginBottom: SPACING.md,
  },
  editScroll: {
    maxHeight: 520,
  },
  editLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#6B6B80',
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  editInput: {
    minHeight: 100,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: '#262626',
    textAlignVertical: 'top',
    marginBottom: SPACING.md,
  },
  editImageWrap: {
    marginBottom: SPACING.md,
  },
  editImagePreview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  editImageActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  editImageBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  editImageBtnChange: {
    backgroundColor: '#F2F2F7',
    borderColor: '#E0E0E0',
  },
  editImageBtnRemove: {
    backgroundColor: '#FFF0F0',
    borderColor: '#FFCCCC',
  },
  editImageBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#262626',
  },
  editImageBtnRemoveText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#D63030',
  },
  editImagePickBtn: {
    padding: SPACING.lg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  editImagePickText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#8E8E93',
  },
  editCatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  editCatChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 999,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  editCatChipActive: {
    backgroundColor: CORAL,
    borderColor: CORAL,
  },
  editCatChipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#6B6B80',
  },
  editCatChipTextActive: {
    color: '#FFFFFF',
  },
  editBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  editBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  editBtnCancel: {
    backgroundColor: '#F2F2F7',
  },
  editBtnSave: {
    backgroundColor: CORAL,
  },
  editBtnCancelText: {
    color: '#262626',
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  editBtnSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
});

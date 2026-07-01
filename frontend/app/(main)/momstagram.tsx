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
import { useTranslation } from 'react-i18next';
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
import { uploadApi, momstagramApi } from '../../services/api';

const CATEGORIES: PostCategory[] = ['일상', '학습', '여행', '기념일', '기타'];

const CORAL = '#FF6B6B';

export default function MomstagramScreen() {
  const { t } = useTranslation();
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
    Alert.alert(t('momstagram.shareAlert.title'), t('momstagram.shareAlert.desc'));
  }, [t]);

  const handleReportPost = useCallback((postId: string) => {
    Alert.alert(t('momstagram.reportAlert.title'), t('momstagram.reportAlert.desc'), [
      { text: t('momstagram.reportReasons.abuse'), onPress: () => sendReport(postId, 'abuse') },
      { text: t('momstagram.reportReasons.ad'), onPress: () => sendReport(postId, 'ad') },
      { text: t('momstagram.reportReasons.privacy'), onPress: () => sendReport(postId, 'privacy') },
      { text: t('momstagram.reportReasons.sexual'), onPress: () => sendReport(postId, 'sexual') },
      { text: t('momstagram.reportReasons.spam'), onPress: () => sendReport(postId, 'spam') },
      { text: t('momstagram.reportReasons.other'), onPress: () => sendReport(postId, 'other') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [t]);

  const sendReport = async (
    postId: string,
    reason: 'abuse' | 'ad' | 'privacy' | 'spam' | 'sexual' | 'other',
  ) => {
    try {
      await momstagramApi.reportPost(postId, reason);
      Alert.alert(t('momstagram.reportDoneAlert.title'), t('momstagram.reportDoneAlert.desc'));
      refresh();
    } catch {
      Alert.alert(t('common.error'), t('momstagram.reportFailAlert.desc'));
    }
  };

  const handleBlockUser = useCallback((targetUserId: string, userName: string) => {
    Alert.alert(
      t('momstagram.blockConfirmAlert.title', { userName }),
      t('momstagram.blockConfirmAlert.desc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('momstagram.block'),
          style: 'destructive',
          onPress: async () => {
            try {
              await momstagramApi.blockUser(targetUserId);
              Alert.alert(t('momstagram.blockDoneAlert.title'), t('momstagram.blockDoneAlert.desc'));
              refresh();
            } catch {
              Alert.alert(t('common.error'), t('momstagram.blockFailAlert.desc'));
            }
          },
        },
      ],
    );
  }, [refresh, t]);

  const handleMore = useCallback((postId: string) => {
    const post = allPosts.find((p) => p.id === postId);
    if (!post) return;
    const isOwner = !!post.isPrivate || (!!currentUserId && post.userId === currentUserId);

    if (isOwner) {
      // 본인 글 — 수정/삭제
      Alert.alert(t('momstagram.postMenu.title'), undefined, [
        {
          text: t('common.edit'),
          onPress: () => {
            setEditContent(post.content);
            setEditCategory((post.category as PostCategory) ?? '일상');
            setEditImage(post.imageUri);
            setEditImageChanged(false);
            setEditingPost(post);
          },
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('momstagram.deletePostAlert.title'), t('momstagram.deletePostAlert.desc'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deletePost(postId);
                  } catch {
                    Alert.alert(t('common.error'), t('momstagram.deletePostFailAlert.desc'));
                  }
                },
              },
            ]);
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    } else {
      // 타인 글 — 신고/차단 (UGC 정책)
      const targetUserId = post.userId;
      const blockButton = targetUserId
        ? [{
            text: t('momstagram.blockUserMenuItem', { userName: post.userName }),
            style: 'destructive' as const,
            onPress: () => handleBlockUser(targetUserId, post.userName),
          }]
        : [];
      Alert.alert(t('momstagram.postMenu.title'), undefined, [
        {
          text: t('momstagram.reportMenuItem'),
          onPress: () => handleReportPost(postId),
        },
        ...blockButton,
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  }, [allPosts, deletePost, currentUserId, handleReportPost, handleBlockUser, t]);

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
      Alert.alert(t('common.notice'), t('momstagram.contentRequiredAlert.desc'));
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
            Alert.alert(t('common.error'), t('momstagram.imageUploadFailAlert.desc'));
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
      Alert.alert(t('common.error'), t('momstagram.editFailAlert.desc'));
    } finally {
      setEditSaving(false);
    }
  }, [editingPost, editContent, editCategory, editImage, editImageChanged, updatePost, t]);

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
          <Text style={styles.emptyHint}>{t('momstagram.loadingFeed')}</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Image source={require('../../assets/icon-camera.png')} style={styles.emptyIcon} resizeMode="contain" />
        <Text style={styles.emptyTitle}>{t('momstagram.emptyTitle')}</Text>
        <Text style={styles.emptyHint}>
          {t('momstagram.emptyHint')}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    // 실제 추가 로딩 중일 때만 노출 (idle 상태 상시 스피너 = 가짜 로딩 방지)
    if (!loading || !hasMore || allPosts.length === 0) return null;
    return (
      <View style={styles.footerWrap}>
        <ActivityIndicator size="small" color={CORAL} />
        <Text style={styles.footerText}>{t('momstagram.loadingMore')}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Instagram-style header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.headerLogo}>{t('momstagram.headerTitle')}</Text>
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
            <Text style={styles.editTitle}>{t('momstagram.editModal.title')}</Text>
            <ScrollView
              style={styles.editScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.editLabel}>{t('momstagram.editModal.contentLabel')}</Text>
              <TextInput
                style={styles.editInput}
                value={editContent}
                onChangeText={setEditContent}
                multiline
                placeholder={t('momstagram.editModal.contentPlaceholder')}
                placeholderTextColor="#A0A0A0"
                maxLength={1000}
              />

              <Text style={styles.editLabel}>{t('momstagram.editModal.photoLabel')}</Text>
              {editImage ? (
                <View style={styles.editImageWrap}>
                  <Image source={{ uri: editImage }} style={styles.editImagePreview} resizeMode="cover" />
                  <View style={styles.editImageActions}>
                    <TouchableOpacity
                      style={[styles.editImageBtn, styles.editImageBtnChange]}
                      onPress={handleEditPickImage}
                      disabled={editSaving}
                    >
                      <Text style={styles.editImageBtnText}>{t('momstagram.editModal.changePhoto')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editImageBtn, styles.editImageBtnRemove]}
                      onPress={handleEditRemoveImage}
                      disabled={editSaving}
                    >
                      <Text style={styles.editImageBtnRemoveText}>{t('momstagram.editModal.removePhoto')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.editImagePickBtn}
                  onPress={handleEditPickImage}
                  disabled={editSaving}
                >
                  <Text style={styles.editImagePickText}>{t('momstagram.editModal.addPhoto')}</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.editLabel}>{t('momstagram.editModal.categoryLabel')}</Text>
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
                accessibilityLabel={t('momstagram.editModal.cancelA11y')}
              >
                <Text style={styles.editBtnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBtn, styles.editBtnSave, editSaving && { opacity: 0.6 }]}
                onPress={handleEditSave}
                disabled={editSaving}
                accessibilityRole="button"
                accessibilityLabel={t('momstagram.editModal.saveA11y')}
              >
                <Text style={styles.editBtnSaveText}>{editSaving ? t('momstagram.editModal.saving') : t('common.save')}</Text>
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

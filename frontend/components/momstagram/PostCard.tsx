import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { FONT_SIZE, SPACING } from '../../constants/theme';
import { MomstagramPost } from '../../stores/momstagramStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTENT_COLLAPSE = 100;

const AVATAR_COLORS: string[] = [
  '#FFB088', '#FF9B9B', '#A8D8EA', '#FFD3B6',
  '#DCEDC1', '#C9B1FF', '#FFE0AC', '#B5EAD7',
];

interface PostCardProps {
  post: MomstagramPost;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
}

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

export function PostCard({ post, onLike, onComment, onShare }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isLong = post.content.length > CONTENT_COLLAPSE;

  const displayContent =
    isLong && !expanded
      ? post.content.slice(0, CONTENT_COLLAPSE) + '...'
      : post.content;

  const handleLike = useCallback(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.3,
        useNativeDriver: true,
        speed: 50,
        bounciness: 12,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 8,
      }),
    ]).start();
    onLike(post.id);
  }, [post.id, onLike, scaleAnim]);

  const avatarBg = getAvatarColor(post.userName);
  const avatarInitial = post.userName.charAt(0);

  return (
    <View style={styles.card}>
      {/* Header: avatar + username + time + more */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{post.userName}</Text>
              {post.isPrivate && (
                <View style={styles.privateBadge}>
                  <Text style={styles.privateBadgeText}>나만보기</Text>
                </View>
              )}
            </View>
            <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => onShare(post.id)}
          activeOpacity={0.7}
          style={styles.moreBtn}
        >
          <Text style={styles.moreIcon}>{'···'}</Text>
        </TouchableOpacity>
      </View>

      {/* Image (full width, Instagram-style) */}
      {post.imageUri ? (
        <Image
          source={{ uri: post.imageUri }}
          style={styles.postImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholderImage}>
          {post.category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{post.category}</Text>
            </View>
          )}
        </View>
      )}

      {/* Action bar: like, comment, share */}
      <View style={styles.actionBar}>
        <View style={styles.actionLeft}>
          <TouchableOpacity
            onPress={handleLike}
            activeOpacity={0.7}
            style={styles.actionBtn}
          >
            <Animated.Text
              style={[
                styles.actionIcon,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              {post.liked ? '❤️' : '🤍'}
            </Animated.Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onComment(post.id)}
            activeOpacity={0.7}
            style={styles.actionBtn}
          >
            <Text style={styles.actionIcon}>{'💬'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onShare(post.id)}
            activeOpacity={0.7}
            style={styles.actionBtn}
          >
            <Text style={styles.actionIcon}>{'📤'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Like count */}
      {post.likes > 0 && (
        <Text style={styles.likeCount}>
          좋아요 {post.likes}개
        </Text>
      )}

      {/* Milestone badge */}
      {post.milestone && (
        <View style={styles.milestoneBadge}>
          <Text style={styles.milestoneText}>
            {post.milestoneEmoji ? `${post.milestoneEmoji} ` : ''}{post.milestone}
          </Text>
        </View>
      )}

      {/* Caption: username + content */}
      <View style={styles.captionWrap}>
        <Text style={styles.captionText}>
          <Text style={styles.captionUser}>{post.userName}</Text>
          {'  '}
          {displayContent}
        </Text>
        {isLong && (
          <TouchableOpacity onPress={() => setExpanded((p) => !p)}>
            <Text style={styles.expandToggle}>
              {expanded ? '접기' : '더 보기'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Comment count link */}
      {post.comments.length > 1 && (
        <TouchableOpacity
          onPress={() => onComment(post.id)}
          style={styles.viewCommentsWrap}
        >
          <Text style={styles.viewCommentsText}>
            댓글 {post.comments.length}개 모두 보기
          </Text>
        </TouchableOpacity>
      )}

      {/* Latest comment preview */}
      {post.comments.length > 0 && (
        <View style={styles.commentPreviewWrap}>
          <Text style={styles.commentPreview} numberOfLines={1}>
            <Text style={styles.commentUser}>
              {post.comments[post.comments.length - 1].userName}
            </Text>
            {'  '}
            {post.comments[post.comments.length - 1].text}
          </Text>
        </View>
      )}

      {/* Separator */}
      <View style={styles.separator} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
  },
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md - 2,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: FONT_SIZE.sm + 1,
    fontWeight: '600',
    color: '#262626',
  },
  privateBadge: {
    backgroundColor: '#FFF0E6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  privateBadgeText: {
    fontSize: 10,
    color: '#FF8C5A',
    fontWeight: '600',
  },
  timeText: {
    fontSize: 11,
    color: '#8E8E8E',
    marginTop: 1,
  },
  moreBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moreIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#262626',
    letterSpacing: 2,
  },
  /* Image */
  postImage: {
    width: SCREEN_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#F2F2F7',
  },
  placeholderImage: {
    width: SCREEN_WIDTH,
    aspectRatio: 4 / 3,
    backgroundColor: '#F5F0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryChipText: {
    fontSize: FONT_SIZE.sm,
    color: '#6B6B80',
    fontWeight: '500',
  },
  /* Action bar */
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md - 2,
    paddingTop: 10,
    paddingBottom: 6,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    padding: 2,
  },
  actionIcon: {
    fontSize: 24,
  },
  /* Like count */
  likeCount: {
    fontSize: FONT_SIZE.sm + 1,
    fontWeight: '600',
    color: '#262626',
    paddingHorizontal: SPACING.md - 2,
    marginBottom: 4,
  },
  /* Milestone badge */
  milestoneBadge: {
    marginHorizontal: SPACING.md - 2,
    marginBottom: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF5F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FFD5C0',
  },
  milestoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E8713A',
  },
  /* Caption */
  captionWrap: {
    paddingHorizontal: SPACING.md - 2,
    marginBottom: 4,
  },
  captionText: {
    fontSize: FONT_SIZE.sm + 1,
    color: '#262626',
    lineHeight: 20,
  },
  captionUser: {
    fontWeight: '600',
  },
  expandToggle: {
    fontSize: FONT_SIZE.sm,
    color: '#8E8E8E',
    marginTop: 2,
  },
  /* View all comments */
  viewCommentsWrap: {
    paddingHorizontal: SPACING.md - 2,
    marginBottom: 2,
  },
  viewCommentsText: {
    fontSize: FONT_SIZE.sm,
    color: '#8E8E8E',
  },
  /* Comment preview */
  commentPreviewWrap: {
    paddingHorizontal: SPACING.md - 2,
    marginBottom: 4,
  },
  commentPreview: {
    fontSize: FONT_SIZE.sm,
    color: '#262626',
    lineHeight: 18,
  },
  commentUser: {
    fontWeight: '600',
  },
  /* Separator */
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EFEFEF',
    marginTop: 10,
  },
});

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { MomstagramPost } from '../../stores/momstagramStore';

const CONTENT_COLLAPSE = 100;
const CORAL = '#FF6B6B';
const WARM_GRAY = '#9E8E82';

const AVATAR_COLORS: string[] = [
  '#FFB088',
  '#FF9B9B',
  '#A8D8EA',
  '#FFD3B6',
  '#DCEDC1',
  '#C9B1FF',
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

export function PostCard({
  post,
  onLike,
  onComment,
  onShare,
}: PostCardProps) {
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
      {/* Header row */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.avatarText}>{avatarInitial}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{post.userName}</Text>
          <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {/* Text content */}
      <View style={styles.contentWrap}>
        <Text style={styles.content}>{displayContent}</Text>
      </View>
      {isLong && (
        <TouchableOpacity onPress={() => setExpanded((p) => !p)}>
          <Text style={styles.expandToggle}>
            {expanded ? '접기' : '더 보기'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Photo */}
      {post.imageUri && (
        <Image
          source={{ uri: post.imageUri }}
          style={styles.postImage}
          resizeMode="cover"
        />
      )}

      {/* Action bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionLeft}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleLike}
            activeOpacity={0.7}
          >
            <Animated.Text
              style={[
                styles.actionIcon,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              {post.liked ? '❤️' : '🤍'}
            </Animated.Text>
            <Text style={styles.actionCount}>{post.likes}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onComment(post.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>{'💬'}</Text>
            <Text style={styles.actionCount}>
              {post.comments.length}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => onShare(post.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.moreIcon}>{'···'}</Text>
        </TouchableOpacity>
      </View>

      {/* Like count label */}
      {post.likes > 0 && (
        <Text style={styles.likeLabel}>
          좋아요 {post.likes}개
        </Text>
      )}

      {/* Comment preview */}
      {post.comments.length > 0 && (
        <TouchableOpacity
          onPress={() => onComment(post.id)}
          style={styles.commentPreviewWrap}
        >
          {post.comments.length > 1 && (
            <Text style={styles.viewAllComments}>
              댓글 {post.comments.length}개 모두 보기
            </Text>
          )}
          <Text style={styles.commentPreview} numberOfLines={1}>
            <Text style={styles.commentUser}>
              {post.comments[0].userName}
            </Text>
            {'  '}
            {post.comments[0].text}
          </Text>
        </TouchableOpacity>
      )}

      {/* Bottom separator */}
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm + 2,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  userName: {
    fontSize: FONT_SIZE.sm + 1,
    fontWeight: '600',
    color: '#1E1E2E',
  },
  timeText: {
    fontSize: FONT_SIZE.xs,
    color: WARM_GRAY,
    marginTop: 1,
  },
  /* Content */
  contentWrap: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  content: {
    fontSize: FONT_SIZE.sm + 1,
    color: '#1E1E2E',
    lineHeight: 21,
  },
  expandToggle: {
    fontSize: FONT_SIZE.xs,
    color: WARM_GRAY,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  /* Image */
  postImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: RADIUS.sm + 2,
    marginHorizontal: 0,
    backgroundColor: '#F5EDE5',
  },
  /* Action bar */
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm + 2,
    paddingBottom: SPACING.xs,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md + 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionIcon: { fontSize: 20 },
  actionCount: {
    fontSize: FONT_SIZE.sm,
    color: '#6B6B80',
    fontWeight: '500',
  },
  moreIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: WARM_GRAY,
    letterSpacing: 1,
  },
  /* Like label */
  likeLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#1E1E2E',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  /* Comments */
  commentPreviewWrap: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  viewAllComments: {
    fontSize: FONT_SIZE.xs,
    color: WARM_GRAY,
    marginBottom: 2,
  },
  commentPreview: {
    fontSize: FONT_SIZE.sm,
    color: '#1E1E2E',
    lineHeight: 20,
  },
  commentUser: {
    fontWeight: '600',
  },
  /* Separator */
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0E8E0',
    marginTop: SPACING.sm,
  },
});

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { FONT_SIZE, SPACING } from '../../constants/theme';
import { MomstagramPost } from '../../stores/momstagramStore';

const CONTENT_COLLAPSE = 100;

const GENDER_COLORS: Record<string, string> = {
  F: '#FFB6C1',
  M: '#87CEEB',
};

interface PostCardProps {
  post: MomstagramPost;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
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

  const genderEmoji = post.childGender === 'F' ? '👧' : '👦';
  const avatarBg = GENDER_COLORS[post.childGender] ?? '#E0E0FF';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.avatarEmoji}>{genderEmoji}</Text>
        </View>
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{post.userName}</Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{post.dominantType}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {post.childAge} · {timeAgo(post.createdAt)}
          </Text>
        </View>
      </View>

      {/* Image */}
      {post.imageUri && (
        <Image
          source={{ uri: post.imageUri }}
          style={styles.postImage}
          resizeMode="cover"
        />
      )}

      {/* Action Bar - Instagram style */}
      <View style={styles.actionBar}>
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
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onComment(post.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>{'💬'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onShare(post.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>{'📤'}</Text>
        </TouchableOpacity>
      </View>

      {/* Like count */}
      {post.likes > 0 && (
        <Text style={styles.likeCount}>
          좋아요 {post.likes}개
        </Text>
      )}

      {/* Content */}
      <View style={styles.contentWrap}>
        <Text style={styles.content}>
          <Text style={styles.contentUserName}>{post.userName}</Text>
          {'  '}
          {displayContent}
        </Text>
      </View>
      {isLong && (
        <TouchableOpacity onPress={() => setExpanded((p) => !p)}>
          <Text style={styles.expandToggle}>
            {expanded ? '접기' : '더 보기'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Comment preview */}
      {post.comments.length > 0 && (
        <TouchableOpacity onPress={() => onComment(post.id)}>
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarEmoji: { fontSize: 18 },
  headerText: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  userName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#1E1E2E',
  },
  typeBadge: {
    backgroundColor: '#F0EDFF',
    borderRadius: 10,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 1,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
  },
  meta: {
    fontSize: 11,
    color: '#A0A0B0',
    marginTop: 1,
  },
  /* Image */
  postImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F0EDE8',
  },
  /* Action Bar */
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: SPACING.md,
  },
  actionBtn: {
    padding: 2,
  },
  actionIcon: { fontSize: 22 },
  /* Like count */
  likeCount: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#1E1E2E',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  /* Content */
  contentWrap: {
    paddingHorizontal: SPACING.md,
  },
  content: {
    fontSize: FONT_SIZE.sm,
    color: '#1E1E2E',
    lineHeight: 20,
  },
  contentUserName: {
    fontWeight: '600',
  },
  expandToggle: {
    fontSize: FONT_SIZE.xs,
    color: '#A0A0B0',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  /* Comments */
  viewAllComments: {
    fontSize: FONT_SIZE.xs,
    color: '#A0A0B0',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  commentPreview: {
    fontSize: FONT_SIZE.sm,
    color: '#1E1E2E',
    paddingHorizontal: SPACING.md,
    paddingTop: 2,
    lineHeight: 20,
  },
  commentUser: {
    fontWeight: '600',
  },
  /* Separator */
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginTop: SPACING.sm + 2,
  },
});

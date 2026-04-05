import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { MomstagramPost } from '../../stores/momstagramStore';

const CONTENT_COLLAPSE = 100;

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

  const genderEmoji = post.childGender === 'F' ? '\uD83D\uDC67' : '\uD83D\uDC66';

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
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

      {/* Content */}
      <Text style={styles.content}>{displayContent}</Text>
      {isLong && (
        <TouchableOpacity onPress={() => setExpanded((p) => !p)}>
          <Text style={styles.expandToggle}>
            {expanded ? '접기' : '더 보기'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Action Bar */}
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
              post.liked && styles.likedIcon,
            ]}
          >
            {post.liked ? '\u2764\uFE0F' : '\uD83E\uDD0D'}
          </Animated.Text>
          <Text style={[styles.actionCount, post.liked && styles.likedCount]}>
            {post.likes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onComment(post.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>{'\uD83D\uDCAC'}</Text>
          <Text style={styles.actionCount}>{post.comments.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onShare(post.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionIcon}>{'\uD83D\uDD17'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.soft,
  },
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0EDFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarEmoji: { fontSize: 20 },
  headerText: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  userName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: '#1E1E2E',
  },
  typeBadge: {
    backgroundColor: '#E0E0FF',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366F1',
  },
  meta: {
    fontSize: FONT_SIZE.xs,
    color: '#A0A0B0',
    marginTop: 2,
  },
  /* Image */
  postImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#F0EDE8',
  },
  /* Content */
  content: {
    fontSize: FONT_SIZE.sm,
    color: '#1E1E2E',
    lineHeight: 21,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  expandToggle: {
    fontSize: FONT_SIZE.xs,
    color: '#6366F1',
    fontWeight: '600',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  /* Action Bar */
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    marginTop: SPACING.sm,
    gap: SPACING.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionIcon: { fontSize: 18 },
  actionCount: {
    fontSize: FONT_SIZE.sm,
    color: '#6B6B80',
    fontWeight: '500',
  },
  likedIcon: { fontSize: 18 },
  likedCount: { color: '#EF4444', fontWeight: '600' },
});

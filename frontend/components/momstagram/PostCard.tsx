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
import { EmojiIcon } from '../common/EmojiIcon';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTENT_COLLAPSE = 100;

// 엄마 기분 라벨 → emoji 매핑 (backend MOM_SYMPTOM_PRESETS + frontend FALLBACK_SYMPTOMS 합집합).
// content 안에 "[엄마기분: 허리/골반통]" 형태로 들어 있는 텍스트를 emoji 일러스트로 변환.
const SYMPTOM_LABEL_TO_EMOJI: Record<string, string> = {
  '입덧': '🤢',
  '입덧/메스꺼움': '🤢',
  '피로감': '😴',
  '심한 피로': '😴',
  '허리/골반 통증': '🦴',
  '허리/골반통': '🦴',
  '부종': '🦶',
  '가려움': '😣',
  '두통': '🤕',
  '속쓰림': '🫠',
  '불면': '🌙',
  '변비': '💩',
  '다리 쥐남': '🦵',
  '배 뭉침/경련': '😖',
  '감정 기복': '😢',
  '감정기복': '😢',
  '빈뇨': '🚽',
  '컨디션 좋음': '😊',
  '출혈/분비물': '🩸',
};

const AVATAR_COLORS: string[] = [
  '#FFB088', '#FF9B9B', '#A8D8EA', '#FFD3B6',
  '#DCEDC1', '#C9B1FF', '#FFE0AC', '#B5EAD7',
];

interface PostCardProps {
  post: MomstagramPost;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onMore?: (postId: string) => void;
  isMine?: boolean;
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

export function PostCard({ post, onLike, onComment, onShare, onMore, isMine }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // content 안의 [엄마기분: 라벨] 추출 + content 에서 제거 (라벨은 이미지로만 표시)
  const moodMatch = post.content.match(/\[엄마기분:\s*(.+?)\]/);
  const moodLabel = moodMatch?.[1]?.trim();
  const moodEmoji = moodLabel ? SYMPTOM_LABEL_TO_EMOJI[moodLabel] : undefined;
  const cleanedContent = post.content
    .replace(/\n?\[엄마기분:\s*.+?\]/g, '')
    .trim();

  const isLong = cleanedContent.length > CONTENT_COLLAPSE;
  const displayContent =
    isLong && !expanded
      ? cleanedContent.slice(0, CONTENT_COLLAPSE) + '...'
      : cleanedContent;

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
          onPress={() => {
            // UGC 정책(Apple 1.2 / Google): 타인 글에도 신고/차단 메뉴 노출 필수.
            // isMine 분기는 onMore 핸들러 내부에서 본인=수정/삭제, 타인=신고/차단 으로 처리.
            if (onMore) onMore(post.id);
            else onShare(post.id);
          }}
          activeOpacity={0.7}
          style={styles.moreBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="게시글 메뉴"
          accessibilityRole="button"
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

      {/* Milestone & Mood — 한글 라벨 없이 일러스트 아이콘만 (인스타그램 풍 미니멀) */}
      {(post.milestoneEmoji || post.milestone || moodEmoji) && (
        <View style={styles.milestoneRow}>
          {(post.milestoneEmoji || post.milestone) && (
            <View style={styles.milestoneIcon}>
              <EmojiIcon emoji={post.milestoneEmoji ?? null} size={14} />
            </View>
          )}
          {moodEmoji && (
            <View style={styles.milestoneIcon}>
              <EmojiIcon emoji={moodEmoji} size={14} />
            </View>
          )}
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
    gap: 14,
  },
  actionBtn: {
    padding: 2,
  },
  actionIcon: {
    // 인스타그램 풍 슬림 — 24 → 18 (작고 세련된 느낌)
    fontSize: 18,
  },
  /* Like count */
  likeCount: {
    fontSize: FONT_SIZE.sm + 1,
    fontWeight: '600',
    color: '#262626',
    paddingHorizontal: SPACING.md - 2,
    marginBottom: 4,
  },
  /* Milestone + Mood row — 작은 일러스트 아이콘만, 인스타 풍 미니멀 */
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: SPACING.md - 2,
    marginBottom: 6,
  },
  milestoneIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF5F0',
    borderWidth: 1,
    borderColor: '#FFE0D0',
    alignItems: 'center',
    justifyContent: 'center',
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

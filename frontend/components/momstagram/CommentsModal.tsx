import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { MomstagramComment } from '../../stores/momstagramStore';

interface CommentsModalProps {
  visible: boolean;
  comments: MomstagramComment[];
  onClose: () => void;
  onSubmit: (text: string) => void;
}

function timeAgo(iso: string, t: TFunction): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('components.commentsModal.justNow');
  if (mins < 60) return t('components.commentsModal.minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('components.commentsModal.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('components.commentsModal.daysAgo', { count: days });
}

function CommentRow({ item, t }: { item: MomstagramComment; t: TFunction }) {
  return (
    <View style={styles.commentRow}>
      <View style={styles.commentAvatar}>
        <Text style={styles.commentAvatarText}>
          {item.userName.charAt(0)}
        </Text>
      </View>
      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentName}>{item.userName}</Text>
          <Text style={styles.commentTime}>{timeAgo(item.createdAt, t)}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
      </View>
    </View>
  );
}

export function CommentsModal({
  visible,
  comments,
  onClose,
  onSubmit,
}: CommentsModalProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setText('');
    }
  }, [visible]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Tap backdrop to close */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Title */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {t('components.commentsModal.title')} {comments.length > 0 ? `(${comments.length})` : ''}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>

          {/* Comment list */}
          {comments.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('components.commentsModal.emptyText')}</Text>
              <Text style={styles.emptyHint}>{t('components.commentsModal.emptyHint')}</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => <CommentRow item={item} t={t} />}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={t('components.commentsModal.inputPlaceholder')}
              placeholderTextColor="#A0A0B0"
              value={text}
              onChangeText={setText}
              maxLength={300}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                !text.trim() && styles.sendBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!text.trim()}
            >
              <Text style={styles.sendBtnText}>{t('components.commentsModal.send')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '70%',
    minHeight: 300,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handleWrap: { alignItems: 'center', paddingTop: SPACING.sm },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#1E1E2E',
  },
  closeBtn: {
    fontSize: FONT_SIZE.sm,
    color: '#6366F1',
    fontWeight: '600',
  },
  listContent: { padding: SPACING.md },
  /* Comment row */
  commentRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EDFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  commentAvatarText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#6366F1',
  },
  commentBody: { flex: 1 },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 2,
  },
  commentName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#1E1E2E',
  },
  commentTime: {
    fontSize: 10,
    color: '#A0A0B0',
  },
  commentText: {
    fontSize: FONT_SIZE.sm,
    color: '#1E1E2E',
    lineHeight: 19,
  },
  /* Empty */
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: '#6B6B80',
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: FONT_SIZE.sm,
    color: '#A0A0B0',
    marginTop: SPACING.xs,
  },
  /* Input bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8F7F4',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: '#1E1E2E',
    maxHeight: 80,
  },
  sendBtn: {
    backgroundColor: '#6366F1',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

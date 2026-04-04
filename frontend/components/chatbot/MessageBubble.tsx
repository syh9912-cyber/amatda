import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
  createdAt: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h < 12 ? '오전' : '오후';
  const hour12 = h % 12 || 12;
  return `${period} ${hour12}:${m}`;
}

export function MessageBubble({ message, isUser, createdAt }: MessageBubbleProps) {
  if (isUser) {
    return (
      <View style={styles.userRow}>
        <Text style={styles.timeRight}>{formatTime(createdAt)}</Text>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.botRow}>
      <Text style={styles.botAvatar}>{'🤖'}</Text>
      <View style={styles.botContent}>
        <View style={styles.botBubble}>
          <Text style={styles.botText}>{message}</Text>
        </View>
        <Text style={styles.timeLeft}>{formatTime(createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginBottom: SPACING.sm,
    gap: 6,
  },
  userBubble: {
    maxWidth: '75%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  userText: {
    fontSize: FONT_SIZE.sm,
    color: '#FFF',
    lineHeight: 20,
  },
  timeRight: {
    fontSize: 10,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  botRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.sm,
  },
  botAvatar: {
    fontSize: 20,
    marginRight: 6,
    marginBottom: 2,
  },
  botContent: { maxWidth: '75%' },
  botBubble: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  botText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  timeLeft: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 3,
    marginLeft: 4,
  },
});

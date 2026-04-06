import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { CoachingMessage, COACHING_COLORS } from './types';

interface Props {
  message: CoachingMessage;
}

export function CoachMessage({ message }: Props) {
  const [reasonOpen, setReasonOpen] = useState(false);

  const timeStr = formatTime(message.createdAt);
  const sourceBadge = message.source === 'ai' ? 'AI' : 'DB';
  const sourceEmoji = message.source === 'ai' ? '🤖' : '📚';

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{'🤖'}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.bubble}>
          <Text style={styles.messageText}>{message.text}</Text>

          {message.reason ? (
            <TouchableOpacity
              style={styles.reasonToggle}
              onPress={() => setReasonOpen(!reasonOpen)}
              activeOpacity={0.7}
            >
              <Text style={styles.reasonToggleText}>
                💡 {reasonOpen ? '이유 ▲' : '이유 ▼'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {reasonOpen && message.reason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>{message.reason}</Text>
            </View>
          ) : null}

          {message.solutions && message.solutions.length > 0 ? (
            <View style={styles.solutionBox}>
              <Text style={styles.solutionTitle}>
                ✅ 해결방법
              </Text>
              {message.solutions.map((sol, idx) => (
                <Text key={idx} style={styles.solutionItem}>
                  {idx + 1}. {sol}
                </Text>
              ))}
            </View>
          ) : null}

          {message.detailPrompt ? (
            <View style={styles.detailBox}>
              <Text style={styles.detailTitle}>📋 더 정확한 상담을 위해</Text>
              <Text style={styles.detailText}>{message.detailPrompt}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.meta}>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>
              {sourceEmoji} {sourceBadge}
            </Text>
          </View>
          <Text style={styles.timestamp}>{timeStr}</Text>
        </View>
      </View>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const hour = h % 12 || 12;
  return `${ampm} ${hour}:${m}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingRight: 48,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COACHING_COLORS.coachAvatar,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  avatarText: { fontSize: 18 },
  content: { flex: 1 },
  bubble: {
    backgroundColor: COACHING_COLORS.coachBubble,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    padding: 14,
    shadowColor: '#B8A690',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  messageText: {
    fontSize: 14,
    color: COACHING_COLORS.text,
    lineHeight: 22,
  },
  reasonToggle: {
    marginTop: 10,
    paddingVertical: 4,
  },
  reasonToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D4A017',
  },
  reasonBox: {
    backgroundColor: COACHING_COLORS.reasonBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  reasonText: {
    fontSize: 13,
    color: COACHING_COLORS.textSub,
    lineHeight: 20,
  },
  solutionBox: {
    backgroundColor: COACHING_COLORS.solutionBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  solutionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2BA89E',
    marginBottom: 6,
  },
  solutionItem: {
    fontSize: 13,
    color: COACHING_COLORS.text,
    lineHeight: 22,
    paddingLeft: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  sourceBadge: {
    backgroundColor: '#F0E6DA',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COACHING_COLORS.textSub,
  },
  timestamp: {
    fontSize: 11,
    color: COACHING_COLORS.textLight,
  },
  detailBox: {
    backgroundColor: '#FFF0E6',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFD4B8',
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E67040',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#8B5E3C',
    lineHeight: 20,
  },
});

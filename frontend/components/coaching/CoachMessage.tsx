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
          {message.redFlag ? (
            <View style={styles.redFlagBox}>
              <Text style={styles.redFlagText}>
                {'⚠️ '}{message.redFlag}
              </Text>
            </View>
          ) : null}

          <Text style={styles.messageText}>{message.text}</Text>

          {message.reasons && message.reasons.length > 0 ? (
            <View style={styles.reasonsBox}>
              <Text style={styles.reasonsTitle}>
                {'💡 가능한 이유'}
              </Text>
              {message.reasons.map((r, idx) => (
                <Text key={idx} style={styles.reasonItem}>
                  {'• '}{r}
                </Text>
              ))}
            </View>
          ) : null}

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

          {message.medical ? (
            <View style={styles.medicalBox}>
              <Text style={styles.medicalTitle}>{'🏥 진료 안내'}</Text>
              <Text style={styles.medicalText}>{message.medical}</Text>
            </View>
          ) : null}

          {message.followup ? (
            <View style={styles.followupBox}>
              <Text style={styles.followupTitle}>{'💬 다음에 확인해볼게요'}</Text>
              <Text style={styles.followupText}>{message.followup}</Text>
            </View>
          ) : null}

          {message.detailPrompt ? (
            <View style={styles.detailBox}>
              <Text style={styles.detailTitle}>{'📋 더 정확한 상담을 위해'}</Text>
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
  redFlagBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFB8B8',
  },
  redFlagText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D32F2F',
    lineHeight: 20,
  },
  reasonsBox: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  reasonsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D4A017',
    marginBottom: 4,
  },
  reasonItem: {
    fontSize: 13,
    color: COACHING_COLORS.text,
    lineHeight: 20,
    paddingLeft: 4,
  },
  medicalBox: {
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#B8CCFF',
  },
  medicalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1565C0',
    marginBottom: 4,
  },
  medicalText: {
    fontSize: 13,
    color: '#2D2016',
    lineHeight: 20,
  },
  followupBox: {
    backgroundColor: '#F0F0FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#C8C8FF',
  },
  followupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C5CAE',
    marginBottom: 4,
  },
  followupText: {
    fontSize: 13,
    color: '#2D2016',
    lineHeight: 20,
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

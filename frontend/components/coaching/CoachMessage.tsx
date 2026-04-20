import { View, Text, Image, StyleSheet } from 'react-native';
import { CoachingMessage, COACHING_COLORS } from './types';

const IC_WARN = require('../../assets/icon-redflag.png') as number;
const IC_HOSPITAL = require('../../assets/icon-hospital.png') as number;
const IC_CHAT = require('../../assets/icon-comment.png') as number;
const IC_AI = require('../../assets/badge-ai.png') as number;
const IC_DB = require('../../assets/badge-db.png') as number;

interface Props {
  message: CoachingMessage;
}

function safeFollowupText(followup: unknown): string | undefined {
  if (typeof followup === 'string') return followup;
  if (followup && typeof followup === 'object' && 'question' in (followup as Record<string, unknown>)) {
    return String((followup as { question: unknown }).question);
  }
  return undefined;
}

function SectionIcon({ src, size = 14 }: { src: number; size?: number }) {
  return <Image source={src} style={{ width: size, height: size, marginRight: 4 }} resizeMode="contain" />;
}

export function CoachMessage({ message }: Props) {
  const timeStr = formatTime(message.createdAt);
  const sourceBadge = message.source === 'ai' ? 'AI' : 'DB';
  const sourceIcon = message.source === 'ai' ? IC_AI : IC_DB;
  const followupDisplay = safeFollowupText(message.followup);

  return (
    <View style={styles.row}>
      <Image source={require('../../assets/coach-avatar.png')} style={styles.avatarImg} resizeMode="cover" />
      <View style={styles.content}>
        <View style={styles.bubble}>
          {/* Red flag */}
          {message.redFlag ? (
            <View style={styles.redFlagBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_WARN} />
                <Text style={styles.redFlagText}>{message.redFlag}</Text>
              </View>
            </View>
          ) : null}

          {/* Main conversational text */}
          <Text style={styles.messageText}>{message.text}</Text>

          {/* Medical notice */}
          {message.medical ? (
            <View style={styles.medicalBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_HOSPITAL} />
                <Text style={styles.medicalTitle}>{'진료 안내'}</Text>
              </View>
              <Text style={styles.medicalText}>{message.medical}</Text>
            </View>
          ) : null}

          {/* Follow-up question */}
          {followupDisplay ? (
            <View style={styles.followupBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_CHAT} size={13} />
                <Text style={styles.followupText}>{followupDisplay}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.meta}>
          <View style={styles.sourceBadge}>
            <Image source={sourceIcon} style={{ width: 10, height: 10, marginRight: 3 }} resizeMode="contain" />
            <Text style={styles.sourceBadgeText}>{sourceBadge}</Text>
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  content: { flex: 1, marginLeft: 8 },
  bubble: {
    backgroundColor: COACHING_COLORS.coachBubble,
    borderRadius: 20,
    borderTopLeftRadius: 4,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 1,
  },
  messageText: {
    fontSize: 14.5,
    color: COACHING_COLORS.text,
    lineHeight: 23,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E5EA',
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
  /* Red flag */
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
    flex: 1,
  },
  /* Medical */
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
  },
  medicalText: {
    fontSize: 13,
    color: '#1C1C1E',
    lineHeight: 20,
    marginTop: 4,
  },
  /* Follow-up question */
  followupBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  followupText: {
    fontSize: 13.5,
    color: '#5C5CAE',
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },
});

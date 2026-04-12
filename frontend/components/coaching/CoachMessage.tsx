import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { CoachingMessage, COACHING_COLORS } from './types';

/* eslint-disable @typescript-eslint/no-require-imports */
const IC_WARN = require('../../assets/icon-redflag.png') as number;
const IC_BULB = require('../../assets/badge-ai.png') as number;
const IC_CHECK = require('../../assets/growth-cognitive.png') as number;
const IC_HOSPITAL = require('../../assets/icon-hospital.png') as number;
const IC_CHAT = require('../../assets/icon-comment.png') as number;
const IC_CLIP = require('../../assets/quick-report.png') as number;
const IC_AI = require('../../assets/badge-ai.png') as number;
const IC_DB = require('../../assets/badge-db.png') as number;
/* eslint-enable @typescript-eslint/no-require-imports */

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
  const [reasonOpen, setReasonOpen] = useState(false);

  const timeStr = formatTime(message.createdAt);
  const sourceBadge = message.source === 'ai' ? 'AI' : 'DB';
  const sourceIcon = message.source === 'ai' ? IC_AI : IC_DB;
  const followupDisplay = safeFollowupText(message.followup);

  return (
    <View style={styles.row}>
      <Image source={require('../../assets/coach-avatar.png')} style={styles.avatarImg} resizeMode="cover" />
      <View style={styles.content}>
        <View style={styles.bubble}>
          {message.redFlag ? (
            <View style={styles.redFlagBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_WARN} />
                <Text style={styles.redFlagText}>{message.redFlag}</Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.messageText}>{message.text}</Text>

          {message.reasons && message.reasons.length > 0 ? (
            <View style={styles.reasonsBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_BULB} />
                <Text style={styles.reasonsTitle}>{'가능한 이유'}</Text>
              </View>
              {message.reasons.map((r, idx) => (
                <Text key={idx} style={styles.reasonItem}>{'  \u2022 '}{r}</Text>
              ))}
            </View>
          ) : null}

          {message.reason ? (
            <TouchableOpacity
              style={styles.reasonToggle}
              onPress={() => setReasonOpen(!reasonOpen)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_BULB} />
                <Text style={styles.reasonToggleText}>
                  {reasonOpen ? '이유 \u25B2' : '이유 \u25BC'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {reasonOpen && message.reason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>{message.reason}</Text>
            </View>
          ) : null}

          {message.solutions && message.solutions.length > 0 ? (
            <View style={styles.solutionBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_CHECK} />
                <Text style={styles.solutionTitle}>{'해결방법'}</Text>
              </View>
              {message.solutions.map((sol, idx) => (
                <Text key={idx} style={styles.solutionItem}>{idx + 1}. {sol}</Text>
              ))}
            </View>
          ) : null}

          {message.medical ? (
            <View style={styles.medicalBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_HOSPITAL} />
                <Text style={styles.medicalTitle}>{'진료 안내'}</Text>
              </View>
              <Text style={styles.medicalText}>{message.medical}</Text>
            </View>
          ) : null}

          {followupDisplay ? (
            <View style={styles.followupBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_CHAT} />
                <Text style={styles.followupTitle}>{'다음에 확인해볼게요'}</Text>
              </View>
              <Text style={styles.followupText}>{followupDisplay}</Text>
            </View>
          ) : null}

          {message.detailPrompt ? (
            <View style={styles.detailBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_CLIP} />
                <Text style={styles.detailTitle}>{'더 정확한 상담을 위해'}</Text>
              </View>
              <Text style={styles.detailText}>{message.detailPrompt}</Text>
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
  const ampm = h < 12 ? '\uC624\uC804' : '\uC624\uD6C4';
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
    marginBottom: 4,
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
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
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
    flexDirection: 'row',
    alignItems: 'center',
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
    flex: 1,
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
  },
  detailText: {
    fontSize: 13,
    color: '#8B5E3C',
    lineHeight: 20,
  },
});

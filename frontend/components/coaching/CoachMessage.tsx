import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CoachingMessage, COACHING_COLORS } from './types';

const IC_WARN = require('../../assets/icon-redflag.png') as number;
const IC_HOSPITAL = require('../../assets/icon-hospital.png') as number;
const IC_CHAT = require('../../assets/icon-comment.png') as number;
const IC_AI = require('../../assets/badge-ai.png') as number;
const IC_DB = require('../../assets/badge-db.png') as number;
const IC_BULB = require('../../assets/badge-ai.png') as number;
const IC_CHECK = require('../../assets/icon-heart.png') as number;

interface Props {
  message: CoachingMessage;
  /** 추천 질문 칩 탭 시 호출 (해당 질문 바로 전송) */
  onPickFollowup?: (question: string) => void;
  /** 최신 답변일 때만 추천 질문 칩 노출 */
  isLatest?: boolean;
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

export function CoachMessage({ message, onPickFollowup, isLatest }: Props) {
  const { t } = useTranslation();
  const timeStr = formatTime(message.createdAt, t);
  const sourceBadge = message.source === 'ai' ? 'AI' : 'DB';
  const sourceIcon = message.source === 'ai' ? IC_AI : IC_DB;
  const followupDisplay = safeFollowupText(message.followup);
  // 추천 질문 칩 — 최신 답변 + 핸들러 있을 때만 (없으면 기존 단일 followup 텍스트로 fallback)
  const chips = (message.followups ?? []).filter((q) => q && q.trim().length > 0).slice(0, 3);
  const showChips = isLatest && !!onPickFollowup && chips.length > 0;

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

          {/* Reasons (가능한 이유) — AI가 추정하는 원인 목록 */}
          {message.reasons && message.reasons.length > 0 ? (
            <View style={styles.reasonsBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_BULB} />
                <Text style={styles.reasonsTitle}>{t('components.coachMessage.possibleReasons')}</Text>
              </View>
              {message.reasons.map((r, idx) => (
                <Text key={idx} style={styles.reasonItem}>{'  • '}{r}</Text>
              ))}
            </View>
          ) : null}

          {/* Reason (단일 이유 — 일부 응답 형식) */}
          {message.reason && !(message.reasons && message.reasons.length > 0) ? (
            <View style={styles.reasonsBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_BULB} />
                <Text style={styles.reasonsTitle}>{t('components.coachMessage.reason')}</Text>
              </View>
              <Text style={styles.reasonItem}>{message.reason}</Text>
            </View>
          ) : null}

          {/* Solutions (해결방법) */}
          {message.solutions && message.solutions.length > 0 ? (
            <View style={styles.solutionBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_CHECK} />
                <Text style={styles.solutionTitle}>{t('components.coachMessage.solutions')}</Text>
              </View>
              {message.solutions.map((sol, idx) => (
                <Text key={idx} style={styles.solutionItem}>{idx + 1}. {sol}</Text>
              ))}
            </View>
          ) : null}

          {/* Medical notice */}
          {message.medical ? (
            <View style={styles.medicalBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_HOSPITAL} />
                <Text style={styles.medicalTitle}>{t('components.coachMessage.medicalNotice')}</Text>
              </View>
              <Text style={styles.medicalText}>{message.medical}</Text>
            </View>
          ) : null}

          {/* Follow-up question (단일) — 칩 안 보일 때만 fallback 표시 */}
          {followupDisplay && !showChips ? (
            <View style={styles.followupBox}>
              <View style={styles.sectionRow}>
                <SectionIcon src={IC_CHAT} size={13} />
                <Text style={styles.followupText}>{followupDisplay}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* 추천 질문 칩 — 탭하면 바로 이어서 질문 */}
        {showChips ? (
          <View style={styles.chipWrap}>
            {chips.map((q, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.chip}
                activeOpacity={0.7}
                onPress={() => onPickFollowup?.(q)}
              >
                <Text style={styles.chipText} numberOfLines={2}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

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

function formatTime(iso: string, t: TFunction): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? t('components.coachMessage.am') : t('components.coachMessage.pm');
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
  /* Reasons (가능한 이유) — iOS 미니멀 톤 */
  reasonsBox: {
    backgroundColor: '#FFF8EC',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFE5B5',
  },
  reasonsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B8860B',
    marginBottom: 6,
  },
  reasonItem: {
    fontSize: 13,
    color: '#1C1C1E',
    lineHeight: 20,
    marginTop: 2,
  },
  /* Solutions (해결방법) — iOS 미니멀 톤 */
  solutionBox: {
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#A8D5BA',
  },
  solutionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 6,
  },
  solutionItem: {
    fontSize: 13,
    color: '#1C1C1E',
    lineHeight: 20,
    marginTop: 4,
    paddingLeft: 4,
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
  /* 추천 질문 칩 */
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    backgroundColor: '#F0F0FA',
    borderWidth: 1,
    borderColor: '#D9D9F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12.5,
    color: '#5C5CAE',
    fontWeight: '600',
    lineHeight: 17,
  },
});

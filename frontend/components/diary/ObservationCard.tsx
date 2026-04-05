import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const TRAIT_COLORS: Record<string, { bg: string; text: string }> = {
  emotion: { bg: '#FDE8E8', text: '#D94A4A' },
  interest: { bg: '#E8F0FE', text: '#2A6DD9' },
  social: { bg: '#E0F7EC', text: '#2AA66B' },
};

const COLLAPSE_THRESHOLD = 120;

interface ObservationCardProps {
  rawContent: string;
  createdAt: string;
  emotions: string[];
  interests: string[];
  socialStyle: string;
  summary: string;
  onShare?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const wd = weekdays[d.getDay()];
  return `${month}월 ${day}일 (${wd})`;
}

export function ObservationCard({
  rawContent, createdAt, emotions, interests, socialStyle, summary, onShare,
}: ObservationCardProps) {
  const isLong = rawContent.length > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);

  const displayContent = isLong && !expanded
    ? rawContent.slice(0, COLLAPSE_THRESHOLD) + '...'
    : rawContent;

  return (
    <View style={styles.card}>
      <View style={styles.dateRow}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{formatDate(createdAt)}</Text>
        </View>
        {onShare && (
          <TouchableOpacity onPress={onShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.shareBtn}>{'\uD83D\uDCF8'} 맘스타그램 공유</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.content}>{displayContent}</Text>
      {isLong && (
        <TouchableOpacity onPress={() => setExpanded((p) => !p)}>
          <Text style={styles.toggle}>
            {expanded ? '접기' : '더 보기'}
          </Text>
        </TouchableOpacity>
      )}

      {summary.length > 0 && (
        <Text style={styles.summary}>{summary}</Text>
      )}

      <View style={styles.badgeRow}>
        {emotions.map((e, i) => (
          <Badge key={`e${i}`} label={e} type="emotion" />
        ))}
        {socialStyle.length > 0 && (
          <Badge label={socialStyle} type="social" />
        )}
        {interests.map((e, i) => (
          <Badge key={`i${i}`} label={e} type="interest" />
        ))}
      </View>
    </View>
  );
}

function Badge({ label, type }: { label: string; type: string }) {
  const colors = TRAIT_COLORS[type] ?? TRAIT_COLORS.emotion;
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  shareBtn: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  dateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
  },
  dateText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  content: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 21,
    marginBottom: SPACING.xs,
  },
  toggle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  summary: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
    lineHeight: 17,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  badge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
  },
});

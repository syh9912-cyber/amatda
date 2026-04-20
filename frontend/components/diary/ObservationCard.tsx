import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const COLLAPSE_THRESHOLD = 120;

interface ObservationCardProps {
  rawContent: string;
  createdAt: string;
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

export function ObservationCard({ rawContent, createdAt, onShare }: ObservationCardProps) {
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
            <Text style={styles.shareBtn}>{'📸'} 가족피드 공유</Text>
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
  },
  toggle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
});

import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Recommendation {
  category: string;
  emoji: string;
  reason: string;
  priority: number;
  naverMapUrl: string;
}

interface Props {
  item: Recommendation;
}

const PRIORITY_LABELS: Record<number, { text: string; bg: string; fg: string }> = {
  1: { text: '최적', bg: COLORS.successLight, fg: COLORS.successDark },
  2: { text: '추천', bg: COLORS.primaryLight, fg: COLORS.primary },
  3: { text: '참고', bg: '#F3F4F6', fg: COLORS.textSecondary },
};

export default function RecommendCard({ item }: Props) {
  const badge = PRIORITY_LABELS[item.priority] || PRIORITY_LABELS[3];

  const openNaverMap = () => {
    Linking.openURL(item.naverMapUrl);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{item.emoji}</Text>
        <View style={styles.titleArea}>
          <View style={styles.titleRow}>
            <Text style={styles.category}>{item.category}</Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.fg }]}>
                {badge.text}
              </Text>
            </View>
          </View>
          <Text style={styles.reason} numberOfLines={3}>
            {item.reason}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.naverBtn} onPress={openNaverMap}>
        <Text style={styles.naverBtnText}>
          {'🗺️ 네이버 지도에서 검색'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  emoji: { fontSize: 32, marginTop: 2 },
  titleArea: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  category: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  badge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  reason: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  naverBtn: {
    backgroundColor: '#1EC800',
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  naverBtnText: {
    fontSize: FONT_SIZE.sm,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

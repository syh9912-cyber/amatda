import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import api from '../../services/api';
import { openExternalUrl } from '../../utils/safeLink';

interface AdData {
  id: string;
  title: string;
  description: string;
  linkUrl: string;
  sponsor: string;
}

interface Props {
  ad: AdData;
  variant?: 'card' | 'inline';
}

export function AdBanner({ ad, variant = 'card' }: Props) {
  const handlePress = async () => {
    try {
      await api.post(`/ads/${ad.id}/click`);
    } catch { /* ignore */ }
    // 서버에서 받은 광고 URL — schema 검증 (javascript:/file: 차단)
    openExternalUrl(ad.linkUrl);
  };

  if (variant === 'inline') {
    return (
      <TouchableOpacity style={styles.inline} onPress={handlePress} activeOpacity={0.8}>
        <View style={styles.inlineBody}>
          <Text style={styles.inlineTitle}>{ad.title}</Text>
          <Text style={styles.inlineDesc} numberOfLines={1}>{ad.description}</Text>
        </View>
        <Text style={styles.adTag}>AD</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <Text style={styles.adTag}>AD</Text>
        <Text style={styles.sponsor}>{ad.sponsor}</Text>
      </View>
      <Text style={styles.cardTitle}>{ad.title}</Text>
      <Text style={styles.cardDesc}>{ad.description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFBF0', borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: '#F5E6C8',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  adTag: {
    fontSize: 9, fontWeight: '700', color: '#B8860B',
    backgroundColor: '#FFF3CD', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden',
  },
  sponsor: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginLeft: SPACING.sm },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  cardDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 18 },
  inline: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBF0',
    borderRadius: RADIUS.sm, padding: SPACING.sm, marginVertical: SPACING.xs,
    borderWidth: 1, borderColor: '#F5E6C8',
  },
  inlineBody: { flex: 1 },
  inlineTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  inlineDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
});

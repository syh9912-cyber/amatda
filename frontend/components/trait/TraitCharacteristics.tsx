import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TRAIT_COLORS } from './traitConstants';
import type { DetailItem } from '../../stores/childStore';

interface Props {
  strengthsDetail: DetailItem[] | undefined;
  weaknessesDetail: DetailItem[] | undefined;
}

const STRENGTH_EMOJIS = ['💪', '🌟', '🎯', '🏆', '✨'];
const WEAKNESS_EMOJIS = ['💡', '🔧', '📌', '🪴', '🌱'];

function DetailCard({
  item,
  emoji,
}: {
  item: DetailItem;
  emoji: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{item.item}</Text>
      </View>
      <Text style={styles.reason}>{item.reason}</Text>
    </View>
  );
}

export function TraitCharacteristics({
  strengthsDetail,
  weaknessesDetail,
}: Props) {
  const { t } = useTranslation();
  return (
    <View>
      {strengthsDetail && strengthsDetail.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('components.traitCharacteristics.strengths')}</Text>
          {strengthsDetail.map((d, i) => (
            <DetailCard
              key={`s-${i}`}
              item={d}
              emoji={STRENGTH_EMOJIS[i % STRENGTH_EMOJIS.length]}
            />
          ))}
        </View>
      )}
      {weaknessesDetail && weaknessesDetail.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('components.traitCharacteristics.weaknesses')}</Text>
          {weaknessesDetail.map((d, i) => (
            <DetailCard
              key={`w-${i}`}
              item={d}
              emoji={WEAKNESS_EMOJIS[i % WEAKNESS_EMOJIS.length]}
            />
          ))}
        </View>
      )}
      {!strengthsDetail?.length && !weaknessesDetail?.length && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {t('components.traitCharacteristics.emptyText')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TRAIT_COLORS.textBrown,
    marginBottom: 12,
  },
  card: {
    backgroundColor: TRAIT_COLORS.cardBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  emoji: { fontSize: 20, marginRight: 8 },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: TRAIT_COLORS.textBrown,
    flex: 1,
  },
  reason: {
    fontSize: 13,
    color: TRAIT_COLORS.textBrownLight,
    lineHeight: 20,
    paddingLeft: 28,
  },
  emptyCard: {
    backgroundColor: TRAIT_COLORS.cardBg,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: TRAIT_COLORS.textBrownLight,
  },
});

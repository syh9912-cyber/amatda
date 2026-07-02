/**
 * MissionInfoModal — 물/영양제 long-press 시 의학적 의미 + 주간 통계 설명 모달
 *
 * 사용처: DailyMissionBadges, DenseStatsRow (임신부 모드)
 */

import { Modal, View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';

const WATER_ICON = require('../../assets/quick-water.png') as ImageSourcePropType;
const PILL_ICON = require('../../assets/quick-pill.png') as ImageSourcePropType;

export type MissionInfoKind = 'water' | 'supplements' | null;

interface Props {
  kind: MissionInfoKind;
  water: number;
  supplements: boolean;
  onClose: () => void;
}

export function MissionInfoModal({ kind, water, supplements, onClose }: Props) {
  const { t } = useTranslation();
  if (!kind) return null;
  const isWater = kind === 'water';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.iconCircle, { backgroundColor: isWater ? '#E3F2FD' : '#F3E5F5' }]}>
              <Image
                source={isWater ? WATER_ICON : PILL_ICON}
                style={styles.iconImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.title}>
              {isWater ? t('components.missionInfoModal.waterTitle') : t('components.missionInfoModal.supplementTitle')}
            </Text>

            <Text style={styles.subtitle}>
              {isWater
                ? t('components.missionInfoModal.waterSubtitle', { water })
                : supplements
                  ? t('components.missionInfoModal.supplementSubtitleDone')
                  : t('components.missionInfoModal.supplementSubtitleNotYet')}
            </Text>

            {isWater ? (
              <>
                <ReasonRow emoji="🌊" title={t('components.missionInfoModal.water.amnioticTitle')} desc={t('components.missionInfoModal.water.amnioticDesc')} />
                <ReasonRow emoji="🩸" title={t('components.missionInfoModal.water.bloodFlowTitle')} desc={t('components.missionInfoModal.water.bloodFlowDesc')} />
                <ReasonRow emoji="💆‍♀️" title={t('components.missionInfoModal.water.swellingTitle')} desc={t('components.missionInfoModal.water.swellingDesc')} />
                <ReasonRow emoji="🍼" title={t('components.missionInfoModal.water.breastMilkTitle')} desc={t('components.missionInfoModal.water.breastMilkDesc')} />
                <View style={styles.factBox}>
                  <Text style={styles.factTitle}>{t('components.missionInfoModal.factTitle')}</Text>
                  <Text style={styles.factText}>
                    {t('components.missionInfoModal.water.factText')}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <ReasonRow emoji="🧠" title={t('components.missionInfoModal.supplement.folateTitle')} desc={t('components.missionInfoModal.supplement.folateDesc')} />
                <ReasonRow emoji="❤️" title={t('components.missionInfoModal.supplement.ironTitle')} desc={t('components.missionInfoModal.supplement.ironDesc')} />
                <ReasonRow emoji="🦴" title={t('components.missionInfoModal.supplement.calciumTitle')} desc={t('components.missionInfoModal.supplement.calciumDesc')} />
                <ReasonRow emoji="🐟" title={t('components.missionInfoModal.supplement.dhaTitle')} desc={t('components.missionInfoModal.supplement.dhaDesc')} />
                <View style={styles.factBox}>
                  <Text style={styles.factTitle}>{t('components.missionInfoModal.factTitle')}</Text>
                  <Text style={styles.factText}>
                    {t('components.missionInfoModal.supplement.factText')}
                  </Text>
                </View>
              </>
            )}

            <Text style={styles.disclaimer}>
              {t('components.missionInfoModal.disclaimer')}
            </Text>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.closeBtnText}>{t('components.missionInfoModal.closeButton')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ReasonRow({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={styles.reasonRow}>
      <Text style={styles.reasonEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.reasonTitle}>{title}</Text>
        <Text style={styles.reasonDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    maxHeight: '88%',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  iconImage: { width: 56, height: 56 },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    fontWeight: '600',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  reasonEmoji: { fontSize: 24 },
  reasonTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginBottom: 3 },
  reasonDesc: { fontSize: 12.5, color: '#555', lineHeight: 19 },
  factBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  factTitle: { fontSize: 13, fontWeight: '900', color: '#F57C00', marginBottom: 6 },
  factText: { fontSize: 12.5, color: '#5D4037', lineHeight: 19 },
  disclaimer: {
    fontSize: 11,
    color: '#9E9E9E',
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  closeBtn: {
    backgroundColor: '#FF8C5A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  closeBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
});

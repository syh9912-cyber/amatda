import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { COACHING_COLORS } from './types';

 
const IC_WAVING = require('../../assets/mascot-waving.png') as number;
const IC_SUNNY = require('../../assets/weather-sunny.png') as number;
const IC_BELL = require('../../assets/icon-bell.png') as number;
 

export type PopupReason = 'inactive' | 'weekend' | 'followup';

interface Props {
  visible: boolean;
  reason: PopupReason;
  followupText?: string;
  onRespond: (response: string) => void;
  onDismiss: () => void;
}

function getContent(t: TFunction, reason: PopupReason, followupText?: string) {
  switch (reason) {
    case 'inactive':
      return {
        icon: IC_WAVING,
        title: t('components.proactivePopup.inactive.title'),
        question: t('components.proactivePopup.inactive.question'),
        options: [
          t('components.proactivePopup.inactive.optionGood'),
          t('components.proactivePopup.inactive.optionNormal'),
          t('components.proactivePopup.inactive.optionWorried'),
        ],
      };
    case 'weekend':
      return {
        icon: IC_SUNNY,
        title: t('components.proactivePopup.weekend.title'),
        question: t('components.proactivePopup.weekend.question'),
        options: [
          t('components.proactivePopup.weekend.optionOuting'),
          t('components.proactivePopup.weekend.optionHomePlay'),
          t('components.proactivePopup.weekend.optionStillPlanning'),
        ],
      };
    case 'followup':
      return {
        icon: IC_BELL,
        title: t('components.proactivePopup.followup.title'),
        question: followupText ?? t('components.proactivePopup.followup.questionFallback'),
        options: [
          t('components.proactivePopup.followup.optionMuchBetter'),
          t('components.proactivePopup.followup.optionSimilar'),
          t('components.proactivePopup.followup.optionWantConsult'),
        ],
      };
  }
}

export function ProactivePopup({
  visible,
  reason,
  followupText,
  onRespond,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const content = getContent(t, reason, followupText);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Image source={content.icon} style={styles.popupIcon} resizeMode="contain" />
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.question}>{content.question}</Text>

          <View style={styles.optionsRow}>
            {content.options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.optionBtn}
                onPress={() => onRespond(opt)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissText}>
              {t('components.proactivePopup.respondLater')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFF4EE',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  popupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COACHING_COLORS.text,
    marginBottom: 8,
  },
  question: {
    fontSize: 15,
    color: COACHING_COLORS.textSub,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  optionsRow: {
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  optionBtn: {
    backgroundColor: COACHING_COLORS.white,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COACHING_COLORS.accent,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COACHING_COLORS.accent,
  },
  dismissBtn: {
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 13,
    color: COACHING_COLORS.textLight,
  },
});

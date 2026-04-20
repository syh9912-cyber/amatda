import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

function getContent(reason: PopupReason, followupText?: string) {
  switch (reason) {
    case 'inactive':
      return {
        icon: IC_WAVING,
        title: '오랫만이에요!',
        question: '요즘 아이 컨디션은 어떤가요?',
        options: ['좋아요', '보통이에요', '고민이 있어요'],
      };
    case 'weekend':
      return {
        icon: IC_SUNNY,
        title: '즐거운 주말!',
        question: '주말에 아이와 어떤 시간을 보냈나요?',
        options: ['바깥 나들이', '집에서 놀이', '아직 계획 중'],
      };
    case 'followup':
      return {
        icon: IC_BELL,
        title: '그 후로 어떤가요?',
        question: followupText ?? '이전에 물어봐 주신 고민, 그 후로 어떤가요?',
        options: ['많이 좋아졌어요', '비슷해요', '상담하고 싶어요'],
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
  const content = getContent(reason, followupText);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#F2F2F7', '#FFE4D6']}
          style={styles.card}
        >
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
              {'다음에 응답할게요'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
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

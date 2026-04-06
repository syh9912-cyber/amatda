import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COACHING_COLORS } from './types';

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
        emoji: '\uD83D\uDC4B',
        title: '\uC624\uB7AB\uB9CC\uC774\uC5D0\uC694!',
        question: '\uC694\uC998 \uC544\uC774 \uCEE8\uB514\uC158\uC740 \uC5B4\uB5A4\uAC00\uC694?',
        options: ['\uC88B\uC544\uC694', '\uBCF4\uD1B5\uC774\uC5D0\uC694', '\uACE0\uBBFC\uC774 \uC788\uC5B4\uC694'],
      };
    case 'weekend':
      return {
        emoji: '\u2600\uFE0F',
        title: '\uC990\uAC70\uC6B4 \uC8FC\uB9D0!',
        question: '\uC8FC\uB9D0\uC5D0 \uC544\uC774\uC640 \uC5B4\uB5A4 \uC2DC\uAC04\uC744 \uBCF4\uB0C8\uB098\uC694?',
        options: ['\uBC14\uAE65 \uB098\uB4E4\uC774', '\uC9D1\uC5D0\uC11C \uB180\uC774', '\uC544\uC9C1 \uACC4\uD68D \uC911'],
      };
    case 'followup':
      return {
        emoji: '\uD83D\uDD14',
        title: '\uADF8 \uD6C4\uB85C \uC5B4\uB5A4\uAC00\uC694?',
        question: followupText ?? '\uC774\uC804\uC5D0 \uBB3C\uC5B4\uBD10 \uC8FC\uC2E0 \uACE0\uBBFC, \uADF8 \uD6C4\uB85C \uC5B4\uB5A4\uAC00\uC694?',
        options: ['\uB9CE\uC774 \uC88B\uC544\uC84C\uC5B4\uC694', '\uBE44\uC2B7\uD574\uC694', '\uC0C1\uB2F4\uD558\uACE0 \uC2F6\uC5B4\uC694'],
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
          colors={['#FFF5EC', '#FFE4D6']}
          style={styles.card}
        >
          <Text style={styles.emoji}>{content.emoji}</Text>
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
              {'\uB2E4\uC74C\uC5D0 \uC751\uB2F5\uD560\uAC8C\uC694'}
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
  emoji: {
    fontSize: 40,
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

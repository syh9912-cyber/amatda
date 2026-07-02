import { View, Text, Image, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CoachingMessage, COACHING_COLORS } from './types';

interface Props {
  message: CoachingMessage;
}

export function ParentMessage({ message }: Props) {
  const { t } = useTranslation();
  const timeStr = formatTime(message.createdAt, t);

  return (
    <View style={styles.row}>
      <View style={styles.content}>
        <View style={styles.bubble}>
          {message.imageUri ? (
            <Image
              source={{ uri: message.imageUri }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : null}
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
        <Text style={styles.timestamp}>{timeStr}</Text>
      </View>
    </View>
  );
}

function formatTime(iso: string, t: TFunction): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? t('components.parentMessage.am') : t('components.parentMessage.pm');
  const hour = h % 12 || 12;
  return `${ampm} ${hour}:${m}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
    paddingLeft: 48,
  },
  content: {
    alignItems: 'flex-end',
  },
  bubble: {
    backgroundColor: COACHING_COLORS.parentBubble,
    borderRadius: 20,
    borderTopRightRadius: 4,
    padding: 14,
    maxWidth: '100%',
  },
  messageText: {
    fontSize: 14,
    color: COACHING_COLORS.white,
    lineHeight: 22,
  },
  photo: {
    width: 180,
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 11,
    color: COACHING_COLORS.textLight,
    marginTop: 4,
  },
});

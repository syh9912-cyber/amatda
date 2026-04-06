import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FollowupItem, COACHING_COLORS } from './types';

interface Props {
  followup: FollowupItem;
  onRespond: (id: string, response: string) => void;
  onDismiss: (id: string) => void;
}

export function FollowupCard({ followup, onRespond, onDismiss }: Props) {
  const [inputMode, setInputMode] = useState(false);
  const [text, setText] = useState('');

  const quickOptions = [
    '\uB9CE\uC774 \uC88B\uC544\uC84C\uC5B4\uC694',
    '\uBE44\uC2B7\uD574\uC694',
    '\uC544\uC9C1 \uACE0\uBBFC\uC774\uC5D0\uC694',
  ];

  const handleQuickRespond = (response: string) => {
    onRespond(followup.id, response);
  };

  const handleTextRespond = () => {
    if (!text.trim()) return;
    onRespond(followup.id, text.trim());
    setText('');
    setInputMode(false);
  };

  return (
    <LinearGradient
      colors={['#FFF0E6', '#FFE4D6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.bellIcon}>{'\uD83D\uDD14'}</Text>
      <Text style={styles.questionText}>{followup.followupText}</Text>

      {inputMode ? (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder={'\uC0C1\uD669\uC744 \uC54C\uB824\uC8FC\uC138\uC694...'}
            placeholderTextColor={COACHING_COLORS.textLight}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleTextRespond}
          >
            <Text style={styles.sendBtnText}>{'\uC804\uC1A1'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.quickRow}>
          {quickOptions.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={styles.quickBtn}
              onPress={() => handleQuickRespond(opt)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickBtnText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.bottomRow}>
        {!inputMode ? (
          <TouchableOpacity
            onPress={() => setInputMode(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.directText}>
              {'\uC9C1\uC811 \uC785\uB825'}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => onDismiss(followup.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>{'\uB098\uC911\uC5D0'}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  bellIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COACHING_COLORS.text,
    lineHeight: 24,
    marginBottom: 14,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  quickBtn: {
    backgroundColor: COACHING_COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COACHING_COLORS.accent,
  },
  quickBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COACHING_COLORS.accent,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: COACHING_COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COACHING_COLORS.text,
  },
  sendBtn: {
    backgroundColor: COACHING_COLORS.accent,
    borderRadius: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendBtnText: {
    color: COACHING_COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  directText: {
    fontSize: 12,
    fontWeight: '500',
    color: COACHING_COLORS.accent,
  },
  dismissText: {
    fontSize: 12,
    fontWeight: '500',
    color: COACHING_COLORS.textLight,
  },
});

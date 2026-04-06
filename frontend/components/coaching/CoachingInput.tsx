import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COACHING_COLORS } from './types';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPhoto: (uri: string) => void;
  disabled: boolean;
}

export function CoachingInput({
  value,
  onChangeText,
  onSend,
  onPhoto,
  disabled,
}: Props) {
  const handlePhoto = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '\uAD8C\uD55C \uD544\uC694',
        '\uC0AC\uC9C4 \uB77C\uC774\uBE0C\uB7EC\uB9AC \uC811\uADFC \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      onPhoto(result.assets[0].uri);
    }
  };

  const handleVoice = () => {
    Alert.alert(
      '\uC900\uBE44 \uC911',
      '\uC74C\uC131 \uC785\uB825 \uAE30\uB2A5\uC740 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4.'
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handlePhoto}
          activeOpacity={0.7}
        >
          <Text style={styles.actionEmoji}>{'\uD83D\uDCF7'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleVoice}
          activeOpacity={0.7}
        >
          <Text style={styles.actionEmoji}>{'\uD83C\uDFA4'}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={'\uACE0\uBBFC\uC744 \uB9D0\uC500\uD574\uC8FC\uC138\uC694...'}
          placeholderTextColor={COACHING_COLORS.textLight}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSend}
          editable={!disabled}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, disabled && styles.sendDisabled]}
          onPress={onSend}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.sendEmoji}>{'\uD83D\uDCE4'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: COACHING_COLORS.border,
    backgroundColor: COACHING_COLORS.white,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 34,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5EDE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji: { fontSize: 18 },
  input: {
    flex: 1,
    backgroundColor: COACHING_COLORS.bg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COACHING_COLORS.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COACHING_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendEmoji: { fontSize: 18 },
});

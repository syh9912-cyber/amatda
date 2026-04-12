import {
  View,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COACHING_COLORS } from './types';

/* eslint-disable @typescript-eslint/no-require-imports */
const IC_CAMERA = require('../../assets/icon-camera.png') as number;
const IC_SEND = require('../../assets/icon-send.png') as number;
/* eslint-enable @typescript-eslint/no-require-imports */

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
        '권한 필요',
        '사진 라이브러리 접근 권한이 필요합니다.'
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

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handlePhoto}
          activeOpacity={0.7}
        >
          <Image source={IC_CAMERA} style={styles.actionIcon} resizeMode="contain" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={'고민을 말씀해주세요...'}
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
          <Image source={IC_SEND} style={styles.sendIcon} resizeMode="contain" />
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
  actionIcon: { width: 20, height: 20 },
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
  sendIcon: { width: 20, height: 20, tintColor: '#FFFFFF' },
});

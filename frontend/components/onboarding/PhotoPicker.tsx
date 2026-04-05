import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, Platform } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

interface PhotoPickerProps {
  photoUri: string | null;
  onChangePhoto: (uri: string | null) => void;
}

async function pickImage(): Promise<string | null> {
  const ImagePicker = await import('expo-image-picker');

  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다');
      return null;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
}

export function PhotoPicker({ photoUri, onChangePhoto }: PhotoPickerProps) {
  const handlePress = async () => {
    const uri = await pickImage();
    if (uri) {
      onChangePhoto(uri);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.circle} onPress={handlePress}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <Text style={styles.emoji}>{'👶'}</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
        탭하여 사진 추가
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  emoji: {
    fontSize: 36,
  },
  hint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
});

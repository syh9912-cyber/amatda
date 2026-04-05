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
      Alert.alert('\uAD8C\uD55C \uD544\uC694', '\uC0AC\uC9C4 \uB77C\uC774\uBE0C\uB7EC\uB9AC \uC811\uADFC \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4');
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
          <Text style={styles.emoji}>{'\uD83D\uDC76'}</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
        {'\uD0ED\uD558\uC5EC \uC0AC\uC9C4 \uCD94\uAC00'}
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

import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';
import { pickImageFromLibrary } from '../../utils/imagePicker';

interface PhotoPickerProps {
  photoUri: string | null;
  onChangePhoto: (uri: string | null) => void;
}

export function PhotoPicker({ photoUri, onChangePhoto }: PhotoPickerProps) {
  const handlePress = async () => {
    const picked = await pickImageFromLibrary({ quality: 0.7 });
    if (picked) onChangePhoto(picked.uri);
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

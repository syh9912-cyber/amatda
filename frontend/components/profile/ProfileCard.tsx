import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';
import { Child } from '../../stores/childStore';
import { childApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';

interface ProfileCardProps {
  child: Child | null;
  onDeleteChild?: () => void;
}

function calcAge(birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;
  if (totalMonths < 12) return `${totalMonths}\uAC1C\uC6D4`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m > 0 ? `${y}\uC138 ${m}\uAC1C\uC6D4` : `${y}\uC138`;
}

function getTemperamentLabel(dominantType: string): string {
  const map: Record<string, string> = {
    wood: '\uD0D0\uAD6C\uD615',
    fire: '\uD65C\uB3D9\uD615',
    earth: '\uC548\uC815\uD615',
    metal: '\uBD84\uC11D\uD615',
    water: '\uCC3D\uC758\uD615',
  };
  return map[dominantType] || dominantType;
}

function getGenderLabel(gender: string): string {
  return gender === 'F' ? '\uC5EC\uC544' : '\uB0A8\uC544';
}

export function ProfileCard({ child, onDeleteChild }: ProfileCardProps) {
  const updateChild = useChildStore((s) => s.updateChild);
  const [uploading, setUploading] = useState(false);

  if (!child) {
    return (
      <View style={styles.card}>
        <View style={styles.photoCircle}>
          <Text style={styles.photoEmoji}>{'\uD83D\uDC76'}</Text>
        </View>
        <Text style={styles.nameText}>
          {'\uC544\uC774\uB97C \uB4F1\uB85D\uD574\uC8FC\uC138\uC694'}
        </Text>
      </View>
    );
  }

  const age = calcAge(child.birthDate);
  const emoji = child.gender === 'F' ? '\uD83D\uDC67' : '\uD83D\uDC66';
  const temperament = getTemperamentLabel(
    child.innateData?.dominantType ?? ''
  );

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '\uAD8C\uD55C \uD544\uC694',
        '\uC0AC\uC9C4 \uC811\uADFC \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const photoUri = result.assets[0].uri;
      await childApi.update(child.id, { photoUri });
      updateChild({ ...child, photoUri });
    } catch {
      Alert.alert(
        '\uC624\uB958',
        '\uC0AC\uC9C4 \uC5C5\uB370\uC774\uD2B8\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* Photo */}
      <TouchableOpacity
        onPress={handlePickPhoto}
        style={styles.photoCircle}
        disabled={uploading}
      >
        {child.photoUri ? (
          <Image source={{ uri: child.photoUri }} style={styles.photoImage} />
        ) : (
          <Text style={styles.photoEmoji}>{emoji}</Text>
        )}
        <View style={styles.editBadge}>
          <Text style={styles.editBadgeText}>
            {uploading
              ? '\u2026'
              : '\uD83D\uDCF7'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Name + Age */}
      <Text style={styles.nameText}>
        {child.name} ({age})
      </Text>

      {/* Info row */}
      <View style={styles.infoRow}>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>
            {getGenderLabel(child.gender)}
          </Text>
        </View>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>{child.birthDate}</Text>
        </View>
        {child.birthTime ? (
          <View style={styles.infoPill}>
            <Text style={styles.infoPillText}>{child.birthTime}</Text>
          </View>
        ) : null}
      </View>

      {/* Temperament */}
      {temperament ? (
        <View style={styles.temperamentBadge}>
          <Text style={styles.temperamentText}>
            {'\uAE30\uC9C8: '}
            {temperament}
          </Text>
        </View>
      ) : null}

      {/* Delete button */}
      {onDeleteChild ? (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDeleteChild}
        >
          <Text style={styles.deleteBtnText}>
            {'\uC544\uC774 \uC0AD\uC81C'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  photoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  photoImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  photoEmoji: {
    fontSize: 40,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  editBadgeText: {
    fontSize: 14,
  },
  nameText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  infoPill: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  infoPillText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  temperamentBadge: {
    backgroundColor: '#FFF0E6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  temperamentText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deleteBtn: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E8847C',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deleteBtnText: {
    fontSize: FONT_SIZE.sm,
    color: '#E8847C',
    fontWeight: '600',
  },
});

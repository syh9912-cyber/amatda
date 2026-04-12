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
  if (totalMonths < 12) return `${totalMonths}개월`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m > 0 ? `${y}세 ${m}개월` : `${y}세`;
}

function getTemperamentLabel(dominantType: string): string {
  const map: Record<string, string> = {
    wood: '탐구형',
    fire: '활동형',
    earth: '안정형',
    metal: '분석형',
    water: '창의형',
  };
  return map[dominantType] || dominantType;
}

function getGenderLabel(gender: string): string {
  return gender === 'F' ? '여아' : '남아';
}

export function ProfileCard({ child, onDeleteChild }: ProfileCardProps) {
  const updateChild = useChildStore((s) => s.updateChild);
  const [uploading, setUploading] = useState(false);

  if (!child) {
    return (
      <View style={styles.card}>
        <View style={styles.photoCircle}>
          <Image source={require('../../assets/mascot-waving.png')} style={styles.photoImage} resizeMode="cover" />
        </View>
        <Text style={styles.nameText}>
          {'아이를 등록해주세요'}
        </Text>
      </View>
    );
  }

  const age = calcAge(child.birthDate);
  const avatarSource = child.gender === 'F'
    ? require('../../assets/avatar-girl.png')
    : require('../../assets/avatar-boy.png');
  const temperament = getTemperamentLabel(
    child.innateData?.dominantType ?? ''
  );

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '권한 필요',
        '사진 접근 권한이 필요합니다.'
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
        '오류',
        '사진 업데이트에 실패했습니다.'
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
          <Image
            source={child.gender === 'F'
              ? require('../../assets/avatar-girl.png')
              : require('../../assets/avatar-boy.png')}
            style={styles.photoImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.editBadge}>
          <Image source={require('../../assets/icon-camera.png')} style={styles.editBadgeIcon} resizeMode="contain" />
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
            {'기질: '}
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
            {'아이 삭제'}
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
  editBadgeIcon: {
    width: 14,
    height: 14,
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

import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { pickImageFromLibrary } from '../../utils/imagePicker';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';
import { Child, useChildStore } from '../../stores/childStore';
import { childApi } from '../../services/api';

interface ProfileCardProps {
  child: Child | null;
  onDeleteChild?: () => void;
}

function calcAge(t: TFunction, birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  let totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  // 생일이 이번 달 안에 아직 안 지났다면 한 달 빼기 (홈 탭의 ageInfo.months 와 동일 계산)
  if (now.getDate() < birth.getDate()) totalMonths -= 1;
  if (totalMonths < 0) totalMonths = 0;
  if (totalMonths < 12) return t('components.profileCard.ageMonths', { count: totalMonths });
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m > 0
    ? t('components.profileCard.ageYearsMonths', { years: y, months: m })
    : t('components.profileCard.ageYears', { years: y });
}

function getTemperamentLabel(t: TFunction, dominantType: string): string {
  const map: Record<string, string> = {
    wood: t('components.profileCard.temperament.wood'),
    fire: t('components.profileCard.temperament.fire'),
    earth: t('components.profileCard.temperament.earth'),
    metal: t('components.profileCard.temperament.metal'),
    water: t('components.profileCard.temperament.water'),
  };
  return map[dominantType] || dominantType;
}

function getGenderLabel(t: TFunction, gender: string): string {
  return gender === 'F' ? t('childEdit.girl') : t('childEdit.boy');
}

export function ProfileCard({ child, onDeleteChild }: ProfileCardProps) {
  const { t } = useTranslation();
  const updateChild = useChildStore((s) => s.updateChild);
  const [uploading, setUploading] = useState(false);

  if (!child) {
    return (
      <View style={styles.card}>
        <View style={styles.photoCircle}>
          <Image source={require('../../assets/mascot-waving.png')} style={styles.photoImage} resizeMode="cover" />
        </View>
        <Text style={styles.nameText}>
          {t('components.profileCard.registerChildPrompt')}
        </Text>
      </View>
    );
  }

  const age = child.birthDate ? calcAge(t, child.birthDate) : (child.isPregnant ? t('components.profileCard.pregnancyWeek', { week: child.pregnancyWeeks ?? 0 }) : '');
  const temperament = getTemperamentLabel(
    t,
    child.innateData?.dominantType ?? ''
  );

  const handlePickPhoto = async () => {
    const picked = await pickImageFromLibrary({ quality: 0.7 });
    if (!picked) return;
    setUploading(true);
    try {
      const photoUri = picked.uri;
      await childApi.update(child.id, { photoUri });
      updateChild({ ...child, photoUri });
    } catch {
      Alert.alert(
        t('common.error'),
        t('components.profileCard.photoUpdateFailed')
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
            {getGenderLabel(t, child.gender)}
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

      {/* Temperament or Pregnancy week */}
      {child.isPregnant ? (
        <View style={[styles.temperamentBadge, { backgroundColor: '#FCE4EC' }]}>
          <Text style={[styles.temperamentText, { color: '#E91E63' }]}>
            {t('components.profileCard.pregnancyWeek', { week: child.pregnancyWeeks ?? 0 })}
          </Text>
        </View>
      ) : temperament ? (
        <View style={styles.temperamentBadge}>
          <Text style={styles.temperamentText}>
            {t('components.profileCard.temperamentLabel', { temperament })}
          </Text>
        </View>
      ) : null}

      {/* Health info pills */}
      {(child.bloodType || child.momBloodType) && (
        <View style={styles.infoRow}>
          {child.isPregnant && child.momBloodType ? (
            <View style={styles.infoPill}><Text style={styles.infoPillText}>{t('childEdit.bloodTypeSuffix', { type: child.momBloodType })}</Text></View>
          ) : child.bloodType ? (
            <View style={styles.infoPill}><Text style={styles.infoPillText}>{t('childEdit.bloodTypeSuffix', { type: child.bloodType })}</Text></View>
          ) : null}
          {child.isPregnant && child.momHeight ? (
            <View style={styles.infoPill}><Text style={styles.infoPillText}>{child.momHeight}cm</Text></View>
          ) : child.height ? (
            <View style={styles.infoPill}><Text style={styles.infoPillText}>{child.height}cm</Text></View>
          ) : null}
          {child.isPregnant && child.momWeight ? (
            <View style={styles.infoPill}><Text style={styles.infoPillText}>{child.momWeight}kg</Text></View>
          ) : child.weight ? (
            <View style={styles.infoPill}><Text style={styles.infoPillText}>{child.weight}kg</Text></View>
          ) : null}
        </View>
      )}

      {/* Manage button */}
      <TouchableOpacity
        style={styles.manageBtn}
        onPress={() => router.push('/(main)/child-edit')}
      >
        <Text style={styles.manageBtnText}>
          {child.isPregnant ? t('childEdit.pregnancyInfoManagement') : t('childEdit.childInfoManagement')}
        </Text>
      </TouchableOpacity>
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
  manageBtn: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  manageBtnText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

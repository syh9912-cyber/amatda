import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import apiInstance, { authApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';
import { ScreenHeader } from '../../components/common/ScreenHeader';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UserProfile {
  id: string;
  email: string;
  nickname: string | null;
  authProvider: string;
  parentRole?: string;
}

// 별명 유효성 — 저장 버튼 disabled 조건과 저장 검증을 동일 기준으로 통일
function isValidNickname(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 10;
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

const PARENT_ROLES: { value: string; labelKey: string }[] = [
  { value: '엄마', labelKey: 'onboardingSetNickname.roleMom' },
  { value: '아빠', labelKey: 'onboardingSetNickname.roleDad' },
  { value: '할머니', labelKey: 'onboardingSetNickname.roleGrandma' },
  { value: '할아버지', labelKey: 'onboardingSetNickname.roleGrandpa' },
  { value: '고모/이모', labelKey: 'onboardingSetNickname.roleAunt' },
  { value: '삼촌', labelKey: 'onboardingSetNickname.roleUncle' },
  { value: '기타', labelKey: 'onboardingSetNickname.roleOther' },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { userId, setUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Nickname + parentRole
  const [nickname, setNickname] = useState('');
  const [parentRole, setParentRole] = useState<string>('엄마');

  // Password section
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Is social login user (no existing password)?
  const isSocialUser = profile?.authProvider !== 'LOCAL';

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await apiInstance.get('/auth/me');
      const data = res.data?.data as UserProfile;
      setProfile(data);
      setNickname(data.nickname ?? '');
      if (data.parentRole) setParentRole(data.parentRole);
    } catch {
      Alert.alert(t('common.error'), t('editProfile.alert.loadProfileFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNickname = async () => {
    const trimmed = nickname.trim();
    if (!isValidNickname(trimmed)) {
      Alert.alert(
        t('common.notice'),
        trimmed.length === 0 ? t('editProfile.alert.enterNickname') : t('editProfile.alert.nicknameLength'),
      );
      return;
    }

    setSaving(true);
    try {
      await apiInstance.put('/auth/nickname', { nickname: trimmed, parentRole });
      await setUser(userId ?? '', trimmed);
      Alert.alert(t('common.complete'), t('editProfile.alert.nicknameChanged'));
      // Reload profile to reflect change
      if (profile) setProfile({ ...profile, nickname: trimmed });
    } catch {
      Alert.alert(t('common.error'), t('editProfile.alert.nicknameChangeFailed'));
    } finally {
      setSaving(false);
    }
  };

  // 부모 역할 변경을 별명 저장 버튼과 독립적으로 즉시 저장.
  // (기존엔 별명 저장 버튼을 눌러야만 반영 → 별명 2자 미만이면 역할 저장 불가)
  const handleSelectRole = async (role: string) => {
    setParentRole(role);
    const currentNick = (nickname.trim() || profile?.nickname || '').trim();
    // 유효한 별명이 아직 없으면 로컬 선택만 — 별명 저장 시 함께 반영됨
    if (!isValidNickname(currentNick)) return;
    try {
      await apiInstance.put('/auth/nickname', { nickname: currentNick, parentRole: role });
      if (profile) setProfile({ ...profile, parentRole: role });
    } catch {
      Alert.alert(t('common.error'), t('editProfile.alert.roleSaveFailed'));
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(t('common.notice'), t('editProfile.alert.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.notice'), t('editProfile.alert.passwordMismatch'));
      return;
    }

    if (isSocialUser) {
      // Social user setting password for the first time
      setSaving(true);
      try {
        await apiInstance.post('/auth/set-password', { newPassword });
        Alert.alert(t('common.complete'), t('editProfile.alert.passwordSet'));
        setShowPasswordSection(false);
        setNewPassword('');
        setConfirmPassword('');
        // Reload profile
        await loadProfile();
      } catch {
        Alert.alert(t('common.error'), t('editProfile.alert.passwordSetFailed'));
      } finally {
        setSaving(false);
      }
    } else {
      // Local user changing password
      if (!currentPassword) {
        Alert.alert(t('common.notice'), t('editProfile.alert.enterCurrentPassword'));
        return;
      }
      setSaving(true);
      try {
        await authApi.changePassword(currentPassword, newPassword);
        Alert.alert(t('common.complete'), t('editProfile.alert.passwordChanged'));
        setShowPasswordSection(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch {
        Alert.alert(t('common.error'), t('editProfile.alert.passwordChangeFailed'));
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerWrap}>
        <ScreenHeader title={t('editProfile.screenTitle')} onBack={() => router.back()} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Account Info (read-only) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('editProfile.accountInfo')}</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('editProfile.email')}</Text>
            <Text style={styles.fieldValue}>{profile?.email ?? '-'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('editProfile.loginMethod')}</Text>
            <View style={styles.providerBadge}>
              <Text style={styles.providerText}>
                {profile?.authProvider === 'LOCAL'
                  ? t('editProfile.emailProvider')
                  : profile?.authProvider ?? '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Nickname Edit */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('editProfile.nickname')}</Text>
          <Text style={styles.cardSubtitle}>{t('editProfile.nicknameSubtitle')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('editProfile.nicknamePlaceholder')}
              placeholderTextColor={COLORS.textLight}
              value={nickname}
              onChangeText={setNickname}
              maxLength={10}
            />
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (saving || !isValidNickname(nickname)) && styles.saveBtnDisabled,
              ]}
              onPress={handleSaveNickname}
              disabled={saving || !isValidNickname(nickname)}
              activeOpacity={0.7}
            >
              <Text style={styles.saveBtnText}>
                {saving ? '...' : t('common.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Parent Role */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('editProfile.parentRole')}</Text>
          <Text style={styles.cardSubtitle}>{t('editProfile.parentRoleSubtitle')}</Text>
          <View style={styles.roleWrap}>
            {PARENT_ROLES.map(({ value, labelKey }) => (
              <TouchableOpacity
                key={value}
                style={[styles.roleBtn, parentRole === value && styles.roleBtnActive]}
                onPress={() => handleSelectRole(value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.roleBtnText, parentRole === value && styles.roleBtnTextActive]}>
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Password Section */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>
              {isSocialUser ? t('editProfile.setPasswordTitle') : t('editProfile.changePasswordTitle')}
            </Text>
            {!showPasswordSection && (
              <TouchableOpacity
                onPress={() => setShowPasswordSection(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.editLink}>
                  {isSocialUser ? t('editProfile.setUp') : t('common.change')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {isSocialUser && !showPasswordSection && (
            <Text style={styles.cardSubtitle}>
              {t('editProfile.socialUserPasswordHint')}
            </Text>
          )}

          {showPasswordSection && (
            <View style={styles.passwordFields}>
              {/* Current password (only for LOCAL users) */}
              {!isSocialUser && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>{t('editProfile.currentPassword')}</Text>
                  <TextInput
                    style={styles.inputFull}
                    placeholder={t('editProfile.currentPasswordPlaceholder')}
                    placeholderTextColor={COLORS.textLight}
                    secureTextEntry
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                </View>
              )}

              {/* New password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>
                  {isSocialUser ? t('editProfile.password') : t('editProfile.newPassword')}
                </Text>
                <TextInput
                  style={styles.inputFull}
                  placeholder={t('editProfile.newPasswordPlaceholder')}
                  placeholderTextColor={COLORS.textLight}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>

              {/* Confirm password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>{t('editProfile.confirmPassword')}</Text>
                <TextInput
                  style={[
                    styles.inputFull,
                    confirmPassword.length > 0 &&
                      confirmPassword !== newPassword &&
                      styles.inputError,
                  ]}
                  placeholder={t('editProfile.confirmPasswordPlaceholder')}
                  placeholderTextColor={COLORS.textLight}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                  <Text style={styles.errorHint}>{t('editProfile.passwordMismatchHint')}</Text>
                )}
                {confirmPassword.length > 0 && confirmPassword === newPassword && (
                  <Text style={styles.matchHint}>{t('editProfile.passwordMatchHint')}</Text>
                )}
              </View>

              {/* Buttons */}
              <View style={styles.pwBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowPasswordSection(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pwSaveBtn,
                    (saving || !newPassword || newPassword !== confirmPassword) &&
                      styles.saveBtnDisabled,
                  ]}
                  onPress={handleChangePassword}
                  disabled={saving || !newPassword || newPassword !== confirmPassword}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pwSaveBtnText}>
                    {saving
                      ? t('editProfile.processing')
                      : isSocialUser
                        ? t('editProfile.setComplete')
                        : t('editProfile.changeComplete')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  headerWrap: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  cardTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  fieldLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  fieldValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  providerBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  providerText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  editLink: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  passwordFields: {
    marginTop: SPACING.md,
  },
  fieldGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputFull: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 1.5,
  },
  errorHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 4,
  },
  matchHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    marginTop: 4,
    marginLeft: 4,
  },
  pwBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  cancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  pwSaveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
  },
  pwSaveBtnText: {
    color: '#FFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  roleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roleBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    minWidth: '28%',
  },
  roleBtnActive: {
    borderColor: '#FF8C5A',
    backgroundColor: '#FFF5F0',
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  roleBtnTextActive: {
    color: '#FF8C5A',
  },
});

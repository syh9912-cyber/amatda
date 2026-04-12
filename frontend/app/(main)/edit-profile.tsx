import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import apiInstance, { authApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UserProfile {
  id: string;
  email: string;
  nickname: string | null;
  authProvider: string;
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export default function EditProfileScreen() {
  const router = useRouter();
  const { userId, email, setUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Nickname
  const [nickname, setNickname] = useState('');

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
    } catch {
      Alert.alert('오류', '프로필 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNickname = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      Alert.alert('알림', '별명을 입력해주세요');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 10) {
      Alert.alert('알림', '별명은 2~10자로 입력해주세요');
      return;
    }

    setSaving(true);
    try {
      await apiInstance.put('/auth/nickname', { nickname: trimmed });
      setUser(userId ?? '', trimmed);
      Alert.alert('완료', '별명이 변경되었습니다');
      // Reload profile to reflect change
      if (profile) setProfile({ ...profile, nickname: trimmed });
    } catch {
      Alert.alert('오류', '별명 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('알림', '새 비밀번호는 6자 이상이어야 합니다');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('알림', '새 비밀번호가 일치하지 않습니다');
      return;
    }

    if (isSocialUser) {
      // Social user setting password for the first time
      setSaving(true);
      try {
        await apiInstance.post('/auth/set-password', { newPassword });
        Alert.alert('완료', '비밀번호가 설정되었습니다');
        setShowPasswordSection(false);
        setNewPassword('');
        setConfirmPassword('');
        // Reload profile
        await loadProfile();
      } catch {
        Alert.alert('오류', '비밀번호 설정에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    } else {
      // Local user changing password
      if (!currentPassword) {
        Alert.alert('알림', '현재 비밀번호를 입력해주세요');
        return;
      }
      setSaving(true);
      try {
        await authApi.changePassword(currentPassword, newPassword);
        Alert.alert('완료', '비밀번호가 변경되었습니다');
        setShowPasswordSection(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch {
        Alert.alert('오류', '비밀번호 변경에 실패했습니다.\n현재 비밀번호를 확인해주세요.');
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 정보 수정</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Account Info (read-only) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>계정 정보</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>이메일</Text>
            <Text style={styles.fieldValue}>{profile?.email ?? '-'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>로그인 방식</Text>
            <View style={styles.providerBadge}>
              <Text style={styles.providerText}>
                {profile?.authProvider === 'LOCAL'
                  ? '이메일'
                  : profile?.authProvider ?? '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Nickname Edit */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>별명</Text>
          <Text style={styles.cardSubtitle}>앱에서 표시되는 이름이에요 (2~10자)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="별명 입력"
              placeholderTextColor={COLORS.textLight}
              value={nickname}
              onChangeText={setNickname}
              maxLength={10}
            />
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (saving || nickname.trim().length < 2) && styles.saveBtnDisabled,
              ]}
              onPress={handleSaveNickname}
              disabled={saving || nickname.trim().length < 2}
              activeOpacity={0.7}
            >
              <Text style={styles.saveBtnText}>
                {saving ? '...' : '저장'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Password Section */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>
              {isSocialUser ? '비밀번호 설정' : '비밀번호 변경'}
            </Text>
            {!showPasswordSection && (
              <TouchableOpacity
                onPress={() => setShowPasswordSection(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.editLink}>
                  {isSocialUser ? '설정하기' : '변경하기'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {isSocialUser && !showPasswordSection && (
            <Text style={styles.cardSubtitle}>
              소셜 로그인 계정입니다. 비밀번호를 설정하면 이메일로도 로그인할 수 있어요.
            </Text>
          )}

          {showPasswordSection && (
            <View style={styles.passwordFields}>
              {/* Current password (only for LOCAL users) */}
              {!isSocialUser && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>현재 비밀번호</Text>
                  <TextInput
                    style={styles.inputFull}
                    placeholder="현재 비밀번호 입력"
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
                  {isSocialUser ? '비밀번호' : '새 비밀번호'}
                </Text>
                <TextInput
                  style={styles.inputFull}
                  placeholder="6자 이상 입력"
                  placeholderTextColor={COLORS.textLight}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>

              {/* Confirm password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>비밀번호 확인</Text>
                <TextInput
                  style={[
                    styles.inputFull,
                    confirmPassword.length > 0 &&
                      confirmPassword !== newPassword &&
                      styles.inputError,
                  ]}
                  placeholder="비밀번호 다시 입력"
                  placeholderTextColor={COLORS.textLight}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                  <Text style={styles.errorHint}>비밀번호가 일치하지 않아요</Text>
                )}
                {confirmPassword.length > 0 && confirmPassword === newPassword && (
                  <Text style={styles.matchHint}>비밀번호가 일치합니다</Text>
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
                  <Text style={styles.cancelBtnText}>취소</Text>
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
                      ? '처리 중...'
                      : isSocialUser
                        ? '설정 완료'
                        : '변경 완료'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 36,
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
});

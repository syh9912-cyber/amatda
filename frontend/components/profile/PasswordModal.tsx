import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { authApi } from '../../services/api';

interface PasswordModalProps {
  onClose: () => void;
}

export function PasswordModal({ onClose }: PasswordModalProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async () => {
    if (!currentPassword) {
      Alert.alert(t('common.error'), t('components.passwordModal.currentPwPrompt'));
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(t('common.error'), t('register.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('components.passwordModal.mismatch'));
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      Alert.alert(t('common.complete'), t('profile.changePasswordAlert.successDesc'));
      onClose();
    } catch {
      Alert.alert(t('common.error'), t('components.passwordModal.changeFailDesc'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('profile.changePasswordAlert.title')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('components.passwordModal.currentPwPlaceholder')}
          placeholderTextColor={COLORS.textLight}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <TextInput
          style={styles.input}
          placeholder={t('components.passwordModal.newPwPlaceholder')}
          placeholderTextColor={COLORS.textLight}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          style={[
            styles.input,
            passwordsMismatch && styles.inputError,
            passwordsMatch && styles.inputMatch,
          ]}
          placeholder={t('components.passwordModal.confirmPwPlaceholder')}
          placeholderTextColor={COLORS.textLight}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        {passwordsMismatch && (
          <Text style={styles.hintError}>{t('editProfile.passwordMismatchHint')}</Text>
        )}
        {passwordsMatch && (
          <Text style={styles.hintMatch}>{t('editProfile.passwordMatchHint')}</Text>
        )}
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (saving || !passwordsMatch) && styles.confirmBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving || !passwordsMatch}
          >
            <Text style={styles.confirmText}>{saving ? t('editProfile.processing') : t('common.change')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 340,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  cancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
  },
  confirmText: {
    color: '#FFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  inputError: {
    borderColor: '#FF6B6B',
    borderWidth: 1.5,
  },
  inputMatch: {
    borderColor: '#4ECDC4',
    borderWidth: 1.5,
  },
  hintError: {
    fontSize: FONT_SIZE.xs,
    color: '#FF6B6B',
    marginTop: -SPACING.sm,
    marginBottom: SPACING.sm,
    marginLeft: 4,
  },
  hintMatch: {
    fontSize: FONT_SIZE.xs,
    color: '#4ECDC4',
    marginTop: -SPACING.sm,
    marginBottom: SPACING.sm,
    marginLeft: 4,
  },
});

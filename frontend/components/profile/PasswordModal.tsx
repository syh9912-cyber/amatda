import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { useState } from 'react';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { authApi } from '../../services/api';

interface PasswordModalProps {
  onClose: () => void;
}

export function PasswordModal({ onClose }: PasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async () => {
    if (!currentPassword) {
      Alert.alert('오류', '현재 비밀번호를 입력하세요');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('오류', '새 비밀번호는 6자 이상이어야 합니다');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('오류', '새 비밀번호가 일치하지 않습니다');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      Alert.alert('완료', '비밀번호가 변경되었습니다');
      onClose();
    } catch {
      Alert.alert('오류', '비밀번호 변경에 실패했습니다.\n현재 비밀번호를 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>비밀번호 변경</Text>
        <TextInput
          style={styles.input}
          placeholder="현재 비밀번호"
          placeholderTextColor={COLORS.textLight}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="새 비밀번호 (6자 이상)"
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
          placeholder="새 비밀번호 확인"
          placeholderTextColor={COLORS.textLight}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        {passwordsMismatch && (
          <Text style={styles.hintError}>비밀번호가 일치하지 않아요</Text>
        )}
        {passwordsMatch && (
          <Text style={styles.hintMatch}>비밀번호가 일치합니다</Text>
        )}
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (saving || !passwordsMatch) && styles.confirmBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving || !passwordsMatch}
          >
            <Text style={styles.confirmText}>{saving ? '처리 중...' : '변경'}</Text>
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

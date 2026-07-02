import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AuthInput } from '../../components/ui/AuthInput';
import { pendingSignup } from '../../utils/pendingSignup';

const PARENT_ROLES: { value: string; labelKey: string }[] = [
  { value: '엄마', labelKey: 'onboardingSetNickname.roleMom' },
  { value: '아빠', labelKey: 'onboardingSetNickname.roleDad' },
  { value: '할머니', labelKey: 'onboardingSetNickname.roleGrandma' },
  { value: '할아버지', labelKey: 'onboardingSetNickname.roleGrandpa' },
  { value: '고모/이모', labelKey: 'onboardingSetNickname.roleAunt' },
  { value: '삼촌', labelKey: 'onboardingSetNickname.roleUncle' },
  { value: '기타', labelKey: 'onboardingSetNickname.roleOther' },
];

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [parentRole, setParentRole] = useState<string>('엄마');
  const [loading, setLoading] = useState(false);

  // 약관 동의는 별도 화면(/onboarding/consent)에서 처리. 여기서는 자격증명만 수집.
  const handleNext = async () => {
    if (!email || !password) {
      Alert.alert(t('common.notice'), t('register.fillEmailPassword'));
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) {
      Alert.alert(t('common.notice'), t('register.invalidEmailFormat'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('common.notice'), t('register.passwordMismatch'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.notice'), t('register.passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      // 자격증명 임시 보관 후 약관 화면으로 이동. 가입 API 호출은 consent.tsx 에서 수행.
      pendingSignup.set({ email: email.trim(), password, parentRole });
      router.push('/onboarding/consent?signup=email');
    } catch {
      Alert.alert(t('register.signupFailedTitle'), t('register.signupFailedMessage'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.header}>
          <Image source={require('../../assets/preg-leaf.png')} style={styles.emojiImg} resizeMode="contain" />
          <Text style={styles.title}>{t('register.title')}</Text>
          <Text style={styles.subtitle}>
            {t('register.subtitle')}
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.form}>
            <AuthInput
              icon={require('../../assets/icon-comment.png')}
              placeholder={t('register.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthInput
              icon={require('../../assets/icon-lock.png')}
              placeholder={t('register.passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <AuthInput
              icon={require('../../assets/icon-lock.png')}
              placeholder={t('register.confirmPasswordPlaceholder')}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
            />
          </View>

          <Text style={styles.roleLabel}>{t('onboardingSetNickname.roleQuestion')}</Text>
          <View style={styles.roleWrap}>
            {PARENT_ROLES.map(({ value: role, labelKey }) => (
              <TouchableOpacity
                key={role}
                style={[styles.roleBtn, parentRole === role && styles.roleBtnActive]}
                onPress={() => setParentRole(role)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: parentRole === role }}
                accessibilityLabel={t('register.roleAccessibilityLabel', { role: t(labelKey) })}
              >
                <Text style={[styles.roleBtnText, parentRole === role && styles.roleBtnTextActive]}>
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.consentNote}>
            <Text style={styles.consentNoteText}>
              {t('register.consentNoteText')}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleNext}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={loading ? t('register.inProgress') : t('common.next')}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <Text style={styles.buttonText}>
              {loading ? t('register.inProgressEllipsis') : t('common.next')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.back()}
            accessibilityRole="link"
            accessibilityLabel={t('register.alreadyHaveAccountLogin')}
          >
            <Text style={styles.loginText}>
              {t('register.alreadyHaveAccount')}
              <Text style={styles.loginBold}>{t('register.loginLinkText')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// 약관 동의는 별도 화면(/onboarding/consent)에서 처리. ConsentItem 정의는 consent.tsx 참조.

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  scroll: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 100,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 32,
  },
  emojiImg: { width: 40, height: 40 },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    fontWeight: '400',
  },
  body: {
    paddingHorizontal: 32,
    marginTop: 40,
    flex: 1,
  },
  form: {
    gap: 12,
  },
  button: {
    backgroundColor: '#4338CA',
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  loginLink: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  loginBold: {
    color: '#4338CA',
    fontWeight: '600',
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'center',
  },
  roleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  roleBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
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
    color: '#9CA3AF',
  },
  roleBtnTextActive: {
    color: '#FF8C5A',
  },
  consentNote: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
  },
  consentNoteText: {
    fontSize: 12,
    color: '#9A6635',
    lineHeight: 18,
  },
  consentBox: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  consentDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
  },
  checkboxTouch: {
    paddingRight: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxOn: {
    backgroundColor: '#FF8C5A',
    borderColor: '#FF8C5A',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  consentAll: {
    fontWeight: '700',
    fontSize: 14,
    color: '#1A1A1A',
  },
  consentRequired: {
    color: '#FF8C5A',
    fontWeight: '600',
  },
  consentOptional: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  consentLinkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  consentLink: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  dormantNote: {
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 16,
    paddingTop: 6,
    paddingHorizontal: 2,
  },
});

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { socialLogin, SocialProvider } from '../../services/social-auth';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

const SOCIAL_BUTTONS: { provider: SocialProvider; label: string; emoji: string; bg: string; color: string }[] = [
  { provider: 'GOOGLE', label: 'Google로 로그인', emoji: 'G', bg: '#FFFFFF', color: '#333333' },
  { provider: 'NAVER', label: '네이버로 로그인', emoji: 'N', bg: '#03C75A', color: '#FFFFFF' },
  { provider: 'KAKAO', label: '카카오로 로그인', emoji: 'K', bg: '#FEE500', color: '#191919' },
];

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const { setTokens, setUser } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const { user, accessToken, refreshToken } = res.data.data;
      setTokens(accessToken, refreshToken);
      setUser(user.id, user.email);
      router.replace('/(main)/home');
    } catch {
      Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해주세요');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialLoading(provider);
    try {
      // 1. 소셜 OAuth 진행 → access_token 획득
      const result = await socialLogin(provider);
      if (!result) {
        setSocialLoading(null);
        return; // 유저가 취소
      }

      // 2. 백엔드에 소셜 토큰 전송 → JWT 발급
      const res = await authApi.socialLogin(result.provider, result.accessToken);
      const { user, accessToken, refreshToken, isNewUser } = res.data.data;
      setTokens(accessToken, refreshToken);
      setUser(user.id, user.email ?? `${provider} 유저`);

      // 신규 유저면 온보딩, 기존 유저면 홈
      if (isNewUser) {
        router.replace('/onboarding/child-info');
      } else {
        router.replace('/(main)/home');
      }
    } catch {
      Alert.alert('소셜 로그인 실패', '다시 시도해주세요');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>아맞다</Text>
        <Text style={styles.subtitle}>
          아이의 고유한 기질을 발견하세요
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor={COLORS.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            placeholderTextColor={COLORS.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? '로그인 중...' : '로그인'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 구분선 */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* 소셜 로그인 버튼 */}
        <View style={styles.socialButtons}>
          {SOCIAL_BUTTONS.map((btn) => (
            <TouchableOpacity
              key={btn.provider}
              style={[
                styles.socialButton,
                { backgroundColor: btn.bg },
                btn.provider === 'GOOGLE' && styles.socialGoogleBorder,
                socialLoading === btn.provider && styles.buttonDisabled,
              ]}
              onPress={() => handleSocialLogin(btn.provider)}
              disabled={socialLoading !== null}
            >
              <View style={[styles.socialIcon, { backgroundColor: btn.provider === 'GOOGLE' ? '#4285F4' : 'transparent' }]}>
                <Text style={[styles.socialIconText, { color: btn.provider === 'GOOGLE' ? '#FFF' : btn.color }]}>
                  {btn.emoji}
                </Text>
              </View>
              <Text style={[styles.socialText, { color: btn.color }]}>
                {socialLoading === btn.provider ? '로그인 중...' : btn.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.registerText}>
            계정이 없으신가요? <Text style={styles.registerBold}>회원가입</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  form: { gap: SPACING.md },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
  },
  socialButtons: { gap: SPACING.sm },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  socialGoogleBorder: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  socialIcon: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  socialIconText: {
    fontSize: 16,
    fontWeight: '700',
  },
  socialText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  registerLink: { marginTop: SPACING.lg, alignItems: 'center' },
  registerText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  registerBold: { color: COLORS.primary, fontWeight: '600' },
});

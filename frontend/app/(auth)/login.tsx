import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { AuthInput } from '../../components/ui/AuthInput';
import { AuthDivider } from '../../components/ui/AuthDivider';
import { SocialLoginButtons } from '../../components/ui/SocialLoginButtons';
import { useLoginHandlers } from './useLoginHandlers';

export default function LoginScreen() {
  const h = useLoginHandlers();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>{'\u{1F33F}'}</Text>
          <Text style={styles.title}>아맞다</Text>
          <Text style={styles.subtitle}>
            아이의 고유한 기질을 발견하세요
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.form}>
            <AuthInput
              icon={'\u{1F4E7}'}
              placeholder="이메일"
              value={h.email}
              onChangeText={h.setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthInput
              icon={'\u{1F512}'}
              placeholder="비밀번호"
              value={h.password}
              onChangeText={h.setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, h.loading && styles.buttonDisabled]}
            onPress={h.handleLogin}
            disabled={h.loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {h.loading ? '로그인 중...' : '로그인'}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerWrap}>
            <AuthDivider />
          </View>

          <SocialLoginButtons
            onPress={h.handleSocialLogin}
            loadingProvider={h.socialLoading}
          />

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.registerText}>
              {'계정이 없으신가요? '}
              <Text style={styles.registerBold}>회원가입</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
  dividerWrap: {
    marginTop: 28,
    marginBottom: 16,
  },
  registerLink: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  registerBold: {
    color: '#4338CA',
    fontWeight: '600',
  },
});

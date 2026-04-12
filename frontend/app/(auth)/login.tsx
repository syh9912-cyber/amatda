import {
  View,
  Text,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { AppNameDisplay } from '../../components/ui/AppNameDisplay';
import { AuthInput } from '../../components/ui/AuthInput';
import { AuthDivider } from '../../components/ui/AuthDivider';
import { SocialLoginButtons } from '../../components/ui/SocialLoginButtons';
import { useLoginHandlers } from '../../hooks/useLoginHandlers';

export default function LoginScreen() {
  const h = useLoginHandlers();

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
          <View style={{ width: 360, height: 360, backgroundColor: '#FDF6F0', borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FDF6F0' }} />
            <Image
              source={require('../../assets/child-diary.png')}
              style={{ width: 350, height: 350, backgroundColor: '#FDF6F0', marginLeft: -12 }}
              resizeMode="contain"
              fadeDuration={0}
            />
          </View>
          <View style={styles.nameWrap}>
            <AppNameDisplay size="small" />
          </View>
          <Text style={styles.tagline}>
            아이의 기질을 기록하는 특별한 다이어리
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.form}>
            <AuthInput
              icon={require('../../assets/icon-comment.png')}
              placeholder="이메일"
              value={h.email}
              onChangeText={h.setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthInput
              icon={require('../../assets/icon-lock.png')}
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
              {h.loading
                ? '로그인 중...'
                : '로그인'}
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
              <Text style={styles.registerBold}>
                회원가입
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.version}>{`v${require('../../app.json').expo.version}`}</Text>
          <Text style={styles.companyName}>SY Labs</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF6F0',
  },
  scroll: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 48,
    alignItems: 'center',
  },
  nameWrap: {
    marginTop: 12,
  },
  tagline: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
    fontWeight: '400',
  },
  body: {
    paddingHorizontal: 32,
    marginTop: 32,
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
    marginBottom: 16,
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
  footer: {
    alignItems: 'center' as const,
    paddingBottom: 28,
    paddingTop: 16,
  },
  version: {
    fontSize: 11,
    color: '#C0C0C0',
  },
  companyName: {
    fontSize: 10,
    color: '#D0C8C0',
    marginTop: 4,
    letterSpacing: 1,
    fontWeight: '500' as const,
  },
});

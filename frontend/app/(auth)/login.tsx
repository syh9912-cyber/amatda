import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { AuthHeader } from '../../components/ui/AuthHeader';
import { AuthInput } from '../../components/ui/AuthInput';
import { AuthDivider } from '../../components/ui/AuthDivider';
import { SocialLoginButtons } from '../../components/ui/SocialLoginButtons';
import { AuthBottomWave } from '../../components/ui/AuthBottomWave';
import { useLoginHandlers } from './useLoginHandlers';
import { styles } from './login.styles';

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
        <AuthHeader title="아맞다" subtitle="아이의 고유한 기질을 발견하세요" />
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
          </View>
          <AuthDivider />
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
        <AuthBottomWave />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

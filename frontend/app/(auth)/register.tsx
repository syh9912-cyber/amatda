import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { AuthHeader } from '../../components/ui/AuthHeader';
import { AuthInput } from '../../components/ui/AuthInput';
import { AuthBottomWave } from '../../components/ui/AuthBottomWave';
import { styles } from './register.styles';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { setTokens, setUser } = useAuthStore();

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요');
      return;
    }
    if (password !== confirm) {
      Alert.alert('알림', '비밀번호가 일치하지 않습니다');
      return;
    }
    if (password.length < 6) {
      Alert.alert('알림', '비밀번호는 6자 이상이어야 합니다');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(email, password);
      const { user, accessToken, refreshToken } = res.data.data;
      setTokens(accessToken, refreshToken);
      setUser(user.id, user.email);
      router.replace('/onboarding/child-info');
    } catch {
      Alert.alert('가입 실패', '이미 사용 중인 이메일이거나 서버 오류입니다');
    } finally {
      setLoading(false);
    }
  };

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
        <AuthHeader title="회원가입" subtitle="아맞다에 오신 것을 환영합니다" />
        <View style={styles.body}>
          <View style={styles.form}>
            <AuthInput
              icon={'\u{1F4E7}'}
              placeholder="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthInput
              icon={'\u{1F512}'}
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <AuthInput
              icon={'\u{1F512}'}
              placeholder="비밀번호 확인"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {loading ? '가입 중...' : '가입하기'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.back()}
          >
            <Text style={styles.loginText}>
              {'이미 계정이 있으신가요? '}
              <Text style={styles.loginBold}>로그인</Text>
            </Text>
          </TouchableOpacity>
        </View>
        <AuthBottomWave />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

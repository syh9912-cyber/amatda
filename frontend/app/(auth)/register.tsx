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
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { AuthInput } from '../../components/ui/AuthInput';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [parentRole, setParentRole] = useState<string>('엄마');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

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
      const res = await authApi.register(email, password, parentRole);
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth({ accessToken, refreshToken, userId: user.id, email: user.email });
      // 가입 직후 별명 설정 화면을 거쳐 child-info로 이동 (set-nickname에서 child-info로 redirect)
      router.replace('/onboarding/set-nickname');
    } catch {
      Alert.alert('가입 실패', '이미 사용 중인 이메일이거나 서버 오류입니다');
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
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>
            아맞다에 오신 것을 환영합니다
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.form}>
            <AuthInput
              icon={require('../../assets/icon-comment.png')}
              placeholder="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthInput
              icon={require('../../assets/icon-lock.png')}
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <AuthInput
              icon={require('../../assets/icon-lock.png')}
              placeholder="비밀번호 확인"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
            />
          </View>

          <Text style={styles.roleLabel}>누구로 가입하시나요?</Text>
          <View style={styles.roleWrap}>
            {['엄마', '아빠', '할머니', '할아버지', '고모/이모', '삼촌', '기타'].map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.roleBtn, parentRole === role && styles.roleBtnActive]}
                onPress={() => setParentRole(role)}
                activeOpacity={0.8}
              >
                <Text style={[styles.roleBtnText, parentRole === role && styles.roleBtnTextActive]}>
                  {role}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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
});

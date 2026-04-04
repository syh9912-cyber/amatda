import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { socialLogin, SocialProvider } from '../../services/social-auth';

export function useLoginHandlers() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(
    null,
  );
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
      const result = await socialLogin(provider);
      if (!result) {
        setSocialLoading(null);
        return;
      }
      const res = await authApi.socialLogin(
        result.provider,
        result.accessToken,
      );
      const { user, accessToken, refreshToken, isNewUser } = res.data.data;
      setTokens(accessToken, refreshToken);
      setUser(user.id, user.email ?? `${provider} 유저`);
      router.replace(isNewUser ? '/onboarding/child-info' : '/(main)/home');
    } catch {
      Alert.alert('소셜 로그인 실패', '다시 시도해주세요');
    } finally {
      setSocialLoading(null);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    loading,
    socialLoading,
    handleLogin,
    handleSocialLogin,
  };
}

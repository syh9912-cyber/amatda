import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { socialLogin, SocialProvider } from '../services/social-auth';

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
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : '이메일 또는 비밀번호를 확인해주세요';
      Alert.alert('로그인 실패', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialLoading(provider);
    try {
      console.log('[SocialLogin] Starting', provider);
      const result = await socialLogin(provider);
      console.log('[SocialLogin] Result:', result ? 'got result' : 'null');
      if (!result) {
        setSocialLoading(null);
        return;
      }

      if (result.directLogin) {
        const dl = result.directLogin;
        setTokens(dl.accessToken, dl.refreshToken);
        const displayName = dl.nickname || dl.email || `${provider} 유저`;
        setUser(dl.userId, displayName);

        if (dl.isNewUser) {
          router.replace('/(auth)/set-nickname');
        } else if (!dl.nickname) {
          router.replace('/(auth)/set-nickname');
        } else {
          router.replace('/(main)/home');
        }
        return;
      }

      const res = result.authCode
        ? await authApi.socialLoginWithCode(
            result.provider,
            result.authCode,
            result.redirectUri ?? '',
          )
        : await authApi.socialLogin(
            result.provider,
            result.accessToken ?? '',
          );

      const { user, accessToken, refreshToken, isNewUser } = res.data.data;
      setTokens(accessToken, refreshToken);
      setUser(user.id, user.email ?? `${provider} 유저`);
      router.replace(isNewUser ? '/onboarding/child-info' : '/(main)/home');
    } catch (e: unknown) {
      const detail =
        e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다';
      console.error(`[SocialLogin] ${provider} error:`, detail);
      Alert.alert(
        '소셜 로그인 실패',
        `${provider} 로그인 중 오류가 발생했습니다.\n${detail}`,
      );
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

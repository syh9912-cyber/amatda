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
  const { setAuth } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth({ accessToken, refreshToken, userId: user.id, email: user.email });
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
        Alert.alert('로그인 실패', '로그인이 완료되지 않았습니다. 다시 시도해주세요.');
        return;
      }

      if (result.directLogin) {
        const dl = result.directLogin;
        const displayName = dl.nickname || dl.email || `${provider} 유저`;
        setAuth({ accessToken: dl.accessToken, refreshToken: dl.refreshToken, userId: dl.userId, email: displayName });

        if (dl.isNewUser || !dl.nickname) {
          router.replace('/onboarding/set-nickname');
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

      const { user, accessToken, refreshToken, isNewUser } = res.data.data as {
        user: { id: string; email?: string; nickname?: string | null };
        accessToken: string;
        refreshToken: string;
        isNewUser?: boolean;
        needsOnboarding?: boolean;
      };
      // PII 보호 — email 로그 제외 (Sentry breadcrumb 수집 가능성)
      console.log('[SocialLogin] backend response:', JSON.stringify({
        isNewUser, hasNickname: !!user.nickname, userId: user.id,
      }));
      setAuth({ accessToken, refreshToken, userId: user.id, email: user.email ?? `${provider} 유저` });
      // 신규 가입자 OR 닉네임 미설정 → 별명 화면. 그 외 → 홈
      if (isNewUser || !user.nickname) {
        console.log('[SocialLogin] → set-nickname');
        router.replace('/onboarding/set-nickname');
      } else {
        console.log('[SocialLogin] → home');
        router.replace('/(main)/home');
      }
    } catch (e: unknown) {
      const rawMsg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다';
      console.error(`[SocialLogin] ${provider} error:`, rawMsg);

      // 사용자 친화적 메시지
      let friendlyMsg = rawMsg;
      if (rawMsg.includes('cancel') || rawMsg.includes('Cancel') || rawMsg.includes('RNKakaoLogins')) {
        friendlyMsg = '로그인을 취소했습니다.';
      } else if (rawMsg.includes('KakaoTalkNotInstalled')) {
        friendlyMsg = '카카오톡이 설치되어 있지 않습니다.\n카카오톡을 설치 후 다시 시도해주세요.';
      } else if (rawMsg.includes('network') || rawMsg.includes('Network') || rawMsg.includes('timeout')) {
        friendlyMsg = '네트워크 연결을 확인해주세요.';
      } else if (rawMsg.includes('카카오 토큰 검증 실패')) {
        friendlyMsg = '카카오 인증 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.';
      }

      Alert.alert(
        provider === 'KAKAO' ? '카카오 로그인 실패' : '소셜 로그인 실패',
        friendlyMsg,
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

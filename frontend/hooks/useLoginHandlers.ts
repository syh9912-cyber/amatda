import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { socialLogin, SocialProvider } from '../services/social-auth';
import { analytics } from '../services/analytics';

export function useLoginHandlers() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(
    null,
  );
  const { setAuth } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.notice'), t('login.errors.emailPasswordRequired'));
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const { user, accessToken, refreshToken } = res.data.data;
      await setAuth({ accessToken, refreshToken, userId: user.id, email: user.email });
      analytics.setUserId(user.id);
      analytics.logLogin('email');
      router.replace('/(main)/home');
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : t('login.errors.loginFailedDefaultMessage');
      Alert.alert(t('login.errors.loginFailedTitle'), msg);
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
        Alert.alert(t('login.errors.loginFailedTitle'), t('login.errors.socialLoginIncomplete'));
        return;
      }

      if (result.directLogin) {
        const dl = result.directLogin;
        const displayName = dl.nickname || dl.email || t('login.errors.socialUserFallback', { provider });
        await setAuth({ accessToken: dl.accessToken, refreshToken: dl.refreshToken, userId: dl.userId, email: displayName });
        analytics.setUserId(dl.userId);
        if (dl.isNewUser) analytics.logSignUp(provider);
        else analytics.logLogin(provider);

        if (dl.isNewUser) {
          // 신규 가입자 — 약관 동의 먼저 (PIPA 15·22조)
          router.replace('/onboarding/consent');
        } else if (!dl.nickname) {
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
      await setAuth({ accessToken, refreshToken, userId: user.id, email: user.email ?? t('login.errors.socialUserFallback', { provider }) });
      // 신규 가입자 → 약관 동의 (PIPA 15·22조), 닉네임 미설정 → 별명 화면, 그 외 → 홈
      if (isNewUser) {
        console.log('[SocialLogin] → consent');
        router.replace('/onboarding/consent');
      } else if (!user.nickname) {
        console.log('[SocialLogin] → set-nickname');
        router.replace('/onboarding/set-nickname');
      } else {
        console.log('[SocialLogin] → home');
        router.replace('/(main)/home');
      }
    } catch (e: unknown) {
      // 서버가 준 안내 메시지(e.response.data.error)를 우선 사용 — axios e.message 는
      // "Request failed with status code 409" 처럼 무의미해서 409 충돌 안내가 가려졌었음.
      const axErr = e as { response?: { status?: number; data?: { error?: string } } };
      const serverMsg = axErr?.response?.data?.error;
      const rawMsg = serverMsg ?? (e instanceof Error ? e.message : t('login.errors.unknownError'));
      console.error(`[SocialLogin] ${provider} error:`, rawMsg);

      // 사용자 친화적 메시지 (서버 안내 메시지가 있으면 그대로 노출)
      let friendlyMsg = rawMsg;
      if (rawMsg.includes('cancel') || rawMsg.includes('Cancel') || rawMsg.includes('RNKakaoLogins')) {
        friendlyMsg = t('login.errors.loginCancelled');
      } else if (rawMsg.includes('KakaoTalkNotInstalled')) {
        friendlyMsg = t('login.errors.kakaoNotInstalled');
      } else if (rawMsg.includes('network') || rawMsg.includes('Network') || rawMsg.includes('timeout')) {
        friendlyMsg = t('login.errors.networkError');
      } else if (rawMsg.includes('카카오 토큰 검증 실패')) {
        friendlyMsg = t('login.errors.kakaoAuthError');
      }

      Alert.alert(
        provider === 'KAKAO' ? t('login.errors.kakaoLoginFailedTitle') : t('login.errors.socialLoginFailedTitle'),
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

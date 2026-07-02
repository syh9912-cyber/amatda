import { Image, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, View } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { authApi, childApi } from '../../services/api';
import {
  cancelAllChildLocalNotifications,
  cancelAllPregnancyLocalNotifications,
  cancelAllLocalNotifications,
} from '../../services/pushNotifications';
import { clearAllSocialSessions } from '../../services/social-auth';
import { COLORS, SPACING } from '../../constants/theme';
import { ProfileCard } from '../../components/profile/ProfileCard';
import { ProfileMenuList } from '../../components/profile/ProfileMenuList';
import { ProfileFooter } from '../../components/profile/ProfileFooter';
import { PasswordModal } from '../../components/profile/PasswordModal';
import { DataRetentionCard } from '../../components/profile/DataRetentionCard';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { AdSlot } from '../../components/ads/AdSlot';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const removeChild = useChildStore((s) => s.removeChild);
  const logout = useAuthStore((s) => s.logout);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleDeleteChild = () => {
    if (!selectedChild) return;
    Alert.alert(
      t('profile.deleteChildAlert.title'),
      t('profile.deleteChildAlert.desc', { name: selectedChild.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await childApi.delete(selectedChild.id);
              // 삭제된 아이 관련 로컬 알림 모두 취소
              // (서버 cascade는 push schedules 컬렉션 삭제, 로컬은 별도 처리)
              await cancelAllChildLocalNotifications(selectedChild.id, selectedChild.name);
              if (selectedChild.isPregnant) {
                // #15 per-child: 해당 자녀 임신 알림만 정리
                await cancelAllPregnancyLocalNotifications(selectedChild.id);
              }
              removeChild(selectedChild.id);
              Alert.alert(t('common.complete'), t('profile.deleteChildAlert.successDesc'));
            } catch {
              Alert.alert(t('common.error'), t('profile.deleteChildAlert.failDesc'));
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logoutAlert.title'), t('profile.logoutAlert.desc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logoutAlert.title'),
        style: 'destructive',
        onPress: async () => {
          // 즉시 로컬 정리 + 리다이렉트 (사용자 흐름 안 막음)
          logout();
          await cancelAllLocalNotifications();
          router.replace('/');
          // SDK 정리는 fire-and-forget — 어떤 이유로 실패/지연돼도 사용자 영향 없음
          clearAllSocialSessions().catch(() => {});
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccountAlert.title'),
      t('profile.deleteAccountAlert.desc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccountAlert.title'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('profile.deleteAccountAlert.finalConfirmTitle'), t('profile.deleteAccountAlert.finalConfirmDesc'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('profile.deleteAccountAlert.confirmDeleteBtn'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    // 1. 백엔드: user 데이터 삭제 + 소셜 unlink REST 호출 (서버측 unlink 완료)
                    await authApi.deleteAccount();
                    // 2. 즉시 로컬 정리 + 리다이렉트
                    logout();
                    await cancelAllLocalNotifications();
                    router.replace('/');
                    // 3. 디바이스 SDK 캐시 정리는 fire-and-forget
                    //    (서버가 이미 unlink했으므로 디바이스는 logout만 — unlink 호출 시 네이티브 크래시 위험)
                    clearAllSocialSessions().catch(() => {});
                  } catch {
                    Alert.alert(t('common.error'), t('profile.deleteAccountAlert.failDesc'));
                  }
                },
              },
            ]);
          },
        },
      ],
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleChangePassword = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(t('profile.changePasswordAlert.title'), t('profile.changePasswordAlert.currentPwPrompt'), (currentPw) => {
        if (!currentPw) return;
        Alert.prompt(t('profile.changePasswordAlert.title'), t('profile.changePasswordAlert.newPwPrompt'), async (newPw) => {
          if (!newPw || newPw.length < 8) {
            Alert.alert(t('common.error'), t('profile.changePasswordAlert.tooShort'));
            return;
          }
          try {
            await authApi.changePassword(currentPw, newPw);
            Alert.alert(t('common.complete'), t('profile.changePasswordAlert.successDesc'));
          } catch {
            Alert.alert(t('common.error'), t('profile.changePasswordAlert.failDesc'));
          }
        }, 'secure-text');
      }, 'secure-text');
    } else {
      setShowPasswordModal(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title={t('profile.title')}
        right={
          <TouchableOpacity
            onPress={() => router.push('/(main)/edit-profile')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('profile.settingsLabel')}
          >
            <Image source={require('../../assets/icon-settings.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />
          </TouchableOpacity>
        }
      />

      <ProfileCard child={selectedChild} onDeleteChild={handleDeleteChild} />

      <ProfileMenuList />

      <DataRetentionCard />

      <ProfileFooter
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* 마이탭 하단 광고 (FREE 유저만) */}
      <AdSlot />
    </ScrollView>

      {/* PasswordModal 은 ScrollView 밖(화면 루트)에 둔다.
          전체화면 절대배치 오버레이라 ScrollView 안이면 스크롤 콘텐츠 기준으로 배치돼 화면을 못 덮음 (iOS). */}
      {showPasswordModal && (
        <PasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 120,
  },
});

import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { authApi, childApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';
import { ProfileCard } from '../../components/profile/ProfileCard';
import { ProfileMenuList } from '../../components/profile/ProfileMenuList';
import { ProfileFooter } from '../../components/profile/ProfileFooter';
import { PasswordModal } from '../../components/profile/PasswordModal';

export default function ProfileScreen() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const removeChild = useChildStore((s) => s.removeChild);
  const logout = useAuthStore((s) => s.logout);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleDeleteChild = () => {
    if (!selectedChild) return;
    Alert.alert(
      '아이 삭제',
      `${selectedChild.name}의 모든 데이터가 영구적으로 삭제됩니다.\n정말 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await childApi.delete(selectedChild.id);
              removeChild(selectedChild.id);
              Alert.alert('완료', '아이 정보가 삭제되었습니다.');
            } catch {
              Alert.alert('오류', '아이 삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '계정 삭제',
      '정말 계정을 삭제하시겠습니까?\n\n모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '계정 삭제',
          style: 'destructive',
          onPress: () => {
            Alert.alert('최종 확인', '이 작업은 되돌릴 수 없습니다.', [
              { text: '취소', style: 'cancel' },
              {
                text: '삭제 확인',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await authApi.deleteAccount();
                    logout();
                    router.replace('/');
                  } catch {
                    Alert.alert('오류', '계정 삭제에 실패했습니다.');
                  }
                },
              },
            ]);
          },
        },
      ],
    );
  };

  const handleChangePassword = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt('비밀번호 변경', '현재 비밀번호를 입력하세요', (currentPw) => {
        if (!currentPw) return;
        Alert.prompt('비밀번호 변경', '새 비밀번호를 입력하세요 (8자 이상)', async (newPw) => {
          if (!newPw || newPw.length < 8) {
            Alert.alert('오류', '새 비밀번호는 8자 이상이어야 합니다');
            return;
          }
          try {
            await authApi.changePassword(currentPw, newPw);
            Alert.alert('완료', '비밀번호가 변경되었습니다');
          } catch {
            Alert.alert('오류', '비밀번호 변경에 실패했습니다.');
          }
        }, 'secure-text');
      }, 'secure-text');
    } else {
      setShowPasswordModal(true);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      <ProfileHeader onSettingsPress={handleChangePassword} />

      <ProfileCard child={selectedChild} onDeleteChild={handleDeleteChild} />

      <ProfileMenuList />

      <ProfileFooter
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
      />

      {showPasswordModal && (
        <PasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </ScrollView>
  );
}

function ProfileHeader({ onSettingsPress }: { onSettingsPress: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.backArrow}>{'<'}</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>마이페이지</Text>
      <TouchableOpacity onPress={onSettingsPress}>
        <Text style={styles.headerGear}>{'⚙️'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5EC',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
    paddingRight: SPACING.sm,
  },
  headerGear: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
});

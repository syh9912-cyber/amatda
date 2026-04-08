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
      '\uC544\uC774 \uC0AD\uC81C',
      `${selectedChild.name}\uC758 \uBAA8\uB4E0 \uB370\uC774\uD130\uAC00 \uC601\uAD6C\uC801\uC73C\uB85C \uC0AD\uC81C\uB429\uB2C8\uB2E4.\n\uC815\uB9D0 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`,
      [
        { text: '\uCDE8\uC18C', style: 'cancel' },
        {
          text: '\uC0AD\uC81C',
          style: 'destructive',
          onPress: async () => {
            try {
              await childApi.delete(selectedChild.id);
              removeChild(selectedChild.id);
              Alert.alert('\uC644\uB8CC', '\uC544\uC774 \uC815\uBCF4\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
            } catch {
              Alert.alert('\uC624\uB958', '\uC544\uC774 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('\uB85C\uADF8\uC544\uC6C3', '\uC815\uB9D0 \uB85C\uADF8\uC544\uC6C3 \uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?', [
      { text: '\uCDE8\uC18C', style: 'cancel' },
      {
        text: '\uB85C\uADF8\uC544\uC6C3',
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
      '\uACC4\uC815 \uC0AD\uC81C',
      '\uC815\uB9D0 \uACC4\uC815\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\n\uBAA8\uB4E0 \uB370\uC774\uD130\uAC00 \uC601\uAD6C\uC801\uC73C\uB85C \uC0AD\uC81C\uB418\uBA70 \uBCF5\uAD6C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.',
      [
        { text: '\uCDE8\uC18C', style: 'cancel' },
        {
          text: '\uACC4\uC815 \uC0AD\uC81C',
          style: 'destructive',
          onPress: () => {
            Alert.alert('\uCD5C\uC885 \uD655\uC778', '\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.', [
              { text: '\uCDE8\uC18C', style: 'cancel' },
              {
                text: '\uC0AD\uC81C \uD655\uC778',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await authApi.deleteAccount();
                    logout();
                    router.replace('/');
                  } catch {
                    Alert.alert('\uC624\uB958', '\uACC4\uC815 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
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
      Alert.prompt('\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD', '\uD604\uC7AC \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD558\uC138\uC694', (currentPw) => {
        if (!currentPw) return;
        Alert.prompt('\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD', '\uC0C8 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD558\uC138\uC694 (8\uC790 \uC774\uC0C1)', async (newPw) => {
          if (!newPw || newPw.length < 8) {
            Alert.alert('\uC624\uB958', '\uC0C8 \uBE44\uBC00\uBC88\uD638\uB294 8\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4');
            return;
          }
          try {
            await authApi.changePassword(currentPw, newPw);
            Alert.alert('\uC644\uB8CC', '\uBE44\uBC00\uBC88\uD638\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
          } catch {
            Alert.alert('\uC624\uB958', '\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
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

import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, TextInput } from 'react-native';
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { useChildStore, Child } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { childApi, authApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { UserAvatar } from '../../components/profile/UserAvatar';
import { EnergyChart } from '../../components/profile/EnergyChart';
import { SettingsSection } from '../../components/profile/SettingsSection';

const MENU_ITEMS = [
  { label: '맘스타그램', emoji: '📸', route: '/(main)/momstagram' },
  { label: '영양 가이드', emoji: '🥗', route: '/(main)/nutrition' },
  { label: '학원 추천', emoji: '🏫', route: '/(main)/academy' },
  { label: '교구 구독', emoji: '📦', route: '/(main)/subscription' },
  { label: '형제자매 궁합', emoji: '💕', route: '/(main)/compatibility' },
  { label: '육아 상담', emoji: '💬', route: '/(main)/chatbot' },
  { label: 'Quality Time', emoji: '⏱️', route: '/(main)/timer' },
  { label: '동네 기질 메이트', emoji: '👫', route: '/(main)/mates' },
];

export default function ProfileScreen() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const children = useChildStore((s) => s.children);
  const email = useAuthStore((s) => s.email);
  const logout = useAuthStore((s) => s.logout);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

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

  const handleChangePassword = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        '비밀번호 변경',
        '현재 비밀번호를 입력하세요',
        (currentPw) => {
          if (!currentPw) return;
          Alert.prompt(
            '비밀번호 변경',
            '새 비밀번호를 입력하세요 (8자 이상)',
            async (newPw) => {
              if (!newPw || newPw.length < 8) {
                Alert.alert('오류', '새 비밀번호는 8자 이상이어야 합니다');
                return;
              }
              try {
                await authApi.changePassword(currentPw, newPw);
                Alert.alert('완료', '비밀번호가 변경되었습니다');
              } catch {
                Alert.alert('오류', '비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요.');
              }
            },
            'secure-text',
          );
        },
        'secure-text',
      );
    } else {
      setShowPasswordModal(true);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!currentPassword) {
      Alert.alert('오류', '현재 비밀번호를 입력하세요');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('오류', '새 비밀번호는 8자 이상이어야 합니다');
      return;
    }
    try {
      await authApi.changePassword(currentPassword, newPassword);
      Alert.alert('완료', '비밀번호가 변경되었습니다');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      Alert.alert('오류', '비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요.');
    }
  };

  const handleNotificationSettings = () => {
    Alert.alert('알림 설정', '알림 설정은 준비 중입니다');
  };

  const handleAppInfo = () => {
    Alert.alert('앱 정보', '아맞다 v1.0.0\nBlooming Corp.\n아이맞춤다이어리');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '계정 삭제',
      '정말 계정을 삭제하시겠습니까?\n\n모든 데이터(자녀 정보, 관찰 일기, 사진, 구독 등)가 영구적으로 삭제되며 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '계정 삭제',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '최종 확인',
              '이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?',
              [
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
                      Alert.alert('오류', '계정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const settingsItems = [
    { emoji: '🔑', label: '비밀번호 변경', onPress: handleChangePassword },
    { emoji: '🔔', label: '알림 설정', onPress: handleNotificationSettings },
    { emoji: '📋', label: '개인정보 처리방침', onPress: () => router.push('/(main)/privacy' as never) },
    { emoji: '📄', label: '이용약관', onPress: () => router.push('/(main)/terms' as never) },
    { emoji: 'ℹ️', label: '앱 정보', onPress: handleAppInfo },
    { emoji: '🚪', label: '로그아웃', onPress: handleLogout, isDestructive: true },
    { emoji: '⛔', label: '계정 삭제', onPress: handleDeleteAccount, isDestructive: true },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '프로필', headerShown: true }} />

      <UserAvatar email={email} childrenCount={children.length} />

      {selectedChild && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {selectedChild.name}의 기질 프로필
          </Text>
          <ChildInfoRows child={selectedChild} />
          <EnergyChart fiveElements={selectedChild.innateData.fiveElements} />
        </View>
      )}

      <ChildrenListCard children={children} />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>더 보기</Text>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.menuRow}
            onPress={() => router.push(item.route as never)}
          >
            <Text style={styles.menuEmoji}>{item.emoji}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>{'›'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SettingsSection items={settingsItems} />

      {showPasswordModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>비밀번호 변경</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="현재 비밀번호"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="새 비밀번호 (8자 이상)"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handlePasswordSubmit}
              >
                <Text style={styles.modalConfirmText}>변경</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function ChildInfoRows({ child }: { child: Child }) {
  const rows = [
    { label: '성별', value: child.gender === 'F' ? '여아' : '남아' },
    { label: '생년월일', value: child.birthDate },
    { label: '출생시각', value: child.birthTime },
    { label: '연령 구간', value: `${child.ageInfo.label} (${child.ageInfo.months}개월)` },
  ];

  return (
    <View>
      {rows.map((r) => (
        <View key={r.label} style={styles.infoRow}>
          <Text style={styles.infoLabel}>{r.label}</Text>
          <Text style={styles.infoValue}>{r.value}</Text>
        </View>
      ))}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>기질 유형</Text>
        <Text style={[styles.infoValue, styles.dominantType]}>
          {child.innateData.dominantType}
        </Text>
      </View>
    </View>
  );
}

function ChildrenListCard({ children }: { children: Child[] }) {
  const removeChild = useChildStore((s) => s.removeChild);

  const handleDelete = (childId: string, childName: string) => {
    Alert.alert(
      '자녀 삭제',
      `${childName}의 모든 정보(관찰일기, 구독 포함)가 삭제됩니다. 정말 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await childApi.delete(childId);
              removeChild(childId);
            } catch {
              Alert.alert('오류', '자녀 삭제에 실패했습니다');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>등록된 자녀</Text>
      {children.map((child) => (
        <View key={child.id} style={styles.childRow}>
          <View style={styles.childTextWrap}>
            <Text style={styles.childName}>{child.name}</Text>
            <Text style={styles.childInfo}>
              {child.innateData.dominantType} · {child.ageInfo.label}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(child.id, child.name)}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteBtnText}>삭제</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => router.push('/onboarding/child-info')}
      >
        <Text style={styles.addBtnText}>+ 자녀 추가</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text,
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: SPACING.xs + 2, borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  infoValue: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  dominantType: { color: COLORS.primary, fontWeight: '600' },
  childRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  childTextWrap: { flex: 1 },
  childName: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  childInfo: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  deleteBtn: {
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm, backgroundColor: COLORS.error + '18',
    marginLeft: SPACING.sm,
  },
  deleteBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.error, fontWeight: '500' },
  addBtn: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center',
    marginTop: SPACING.md,
  },
  addBtnText: { color: COLORS.textSecondary },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  menuEmoji: { fontSize: 20, marginRight: SPACING.md },
  menuLabel: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text },
  menuArrow: { fontSize: 20, color: COLORS.textLight },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  modalCancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  modalConfirmBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
  },
  modalConfirmText: {
    color: '#FFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});

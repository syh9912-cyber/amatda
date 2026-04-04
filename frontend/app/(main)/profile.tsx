import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useChildStore, Child } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { childApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { UserAvatar } from '../../components/profile/UserAvatar';
import { EnergyChart } from '../../components/profile/EnergyChart';
import { SettingsSection } from '../../components/profile/SettingsSection';

const MENU_ITEMS = [
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

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const settingsItems = [
    { emoji: '🔑', label: '비밀번호 변경', onPress: () => {} },
    { emoji: '🔔', label: '알림 설정', onPress: () => {} },
    { emoji: 'ℹ️', label: '앱 정보', onPress: () => {} },
    { emoji: '🚪', label: '로그아웃', onPress: handleLogout, isDestructive: true },
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
            <Text style={styles.menuArrow}>{'\u203A'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SettingsSection items={settingsItems} />
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
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
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
});

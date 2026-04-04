import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

const ELEMENT_LABELS: Record<string, string> = {
  wood: '탐구', fire: '활동', earth: '안정', metal: '분석', water: '감성',
};
const ELEMENT_COLORS: Record<string, string> = {
  wood: COLORS.wood, fire: COLORS.fire, earth: COLORS.earth,
  metal: COLORS.metal, water: COLORS.water,
};

const MENU_ITEMS = [
  { label: '영양 가이드', emoji: '🥗', route: '/(main)/nutrition' },
  { label: '학원 추천', emoji: '🏫', route: '/(main)/academy' },
  { label: '교구 구독', emoji: '📦', route: '/(main)/subscription' },
  { label: '형제자매 궁합', emoji: '💕', route: '/(main)/compatibility' },
  { label: '육아 상담', emoji: '💬', route: '/(main)/chatbot' },
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '프로필', headerShown: true }} />

      {/* 유저 정보 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>내 정보</Text>
        <Text style={styles.infoText}>{email ?? '이메일 없음'}</Text>
        <Text style={styles.infoSub}>자녀 {children.length}명 등록</Text>
      </View>

      {/* 선택된 자녀 상세 */}
      {selectedChild && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{selectedChild.name}의 기질 프로필</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>성별</Text>
            <Text style={styles.infoValue}>
              {selectedChild.gender === 'F' ? '여아' : '남아'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>생년월일</Text>
            <Text style={styles.infoValue}>{selectedChild.birthDate}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>출생시각</Text>
            <Text style={styles.infoValue}>{selectedChild.birthTime}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>연령 구간</Text>
            <Text style={styles.infoValue}>
              {selectedChild.ageInfo.label} ({selectedChild.ageInfo.months}개월)
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>기질 유형</Text>
            <Text style={[styles.infoValue, { color: COLORS.primary, fontWeight: '600' }]}>
              {selectedChild.innateData.dominantType}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>에너지 분포</Text>
          {Object.entries(selectedChild.innateData.fiveElements).map(([key, val]) => (
            <View key={key} style={styles.barRow}>
              <Text style={styles.barLabel}>{ELEMENT_LABELS[key]}</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${val}%`, backgroundColor: ELEMENT_COLORS[key] },
                  ]}
                />
              </View>
              <Text style={styles.barVal}>{val}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 전체 자녀 목록 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>등록된 자녀</Text>
        {children.map((child) => (
          <View key={child.id} style={styles.childRow}>
            <Text style={styles.childName}>{child.name}</Text>
            <Text style={styles.childInfo}>
              {child.innateData.dominantType} · {child.ageInfo.label}
            </Text>
          </View>
        ))}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/onboarding/child-info')}
        >
          <Text style={styles.addBtnText}>+ 자녀 추가</Text>
        </TouchableOpacity>
      </View>

      {/* 메뉴 바로가기 */}
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
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 로그아웃 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text,
    marginBottom: SPACING.md,
  },
  infoText: { fontSize: FONT_SIZE.md, color: COLORS.text },
  infoSub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  infoValue: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  barLabel: { width: 36, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  barBg: {
    flex: 1, height: 10, backgroundColor: COLORS.border,
    borderRadius: 5, overflow: 'hidden', marginHorizontal: SPACING.sm,
  },
  barFill: { height: '100%', borderRadius: 5 },
  barVal: { width: 28, fontSize: FONT_SIZE.sm, color: COLORS.text, textAlign: 'right' },
  childRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  childName: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  childInfo: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  addBtn: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginTop: SPACING.md,
  },
  addBtnText: { color: COLORS.textSecondary },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  menuEmoji: { fontSize: 20, marginRight: SPACING.md },
  menuLabel: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text },
  menuArrow: { fontSize: 20, color: COLORS.textLight },
  logoutBtn: {
    borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center',
    backgroundColor: COLORS.error, marginTop: SPACING.sm,
  },
  logoutText: { color: '#FFF', fontWeight: '600' },
});

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { childApi } from '../../services/api';
import { useChildStore, Child } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { ChildSelector } from '../../components/home/ChildSelector';
import { TraitSummary } from '../../components/home/TraitSummary';
import { AgeCards } from '../../components/home/AgeCards';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const { children, selectedChild, setChildren, selectChild } = useChildStore();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildren = async () => {
    try {
      const res = await childApi.list();
      setChildren(res.data.data);
    } catch {
      // 토큰 만료 등
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (children.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>등록된 자녀가 없습니다</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/onboarding/child-info')}
        >
          <Text style={styles.addButtonText}>자녀 등록하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>아맞다</Text>
        <TouchableOpacity onPress={() => { logout(); router.replace('/'); }}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      {/* 자녀 선택 (다자녀 분기) */}
      {children.length > 1 && (
        <ChildSelector
          children={children}
          selectedId={selectedChild?.id ?? ''}
          onSelect={selectChild}
        />
      )}

      {selectedChild && (
        <>
          {/* 기질 요약 */}
          <TraitSummary child={selectedChild} />

          {/* 연령별 카드 */}
          <AgeCards child={selectedChild} />
        </>
      )}

      {/* 자녀 추가 */}
      <TouchableOpacity
        style={styles.addMore}
        onPress={() => router.push('/onboarding/child-info')}
      >
        <Text style={styles.addMoreText}>+ 자녀 추가</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: SPACING.xl + 20 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  appTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  logoutText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  emptyText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  addButtonText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '600' },
  addMore: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  addMoreText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
});

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { childApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { ChildSelector } from '../../components/home/ChildSelector';
import { TraitSummary } from '../../components/home/TraitSummary';
import { AgeCards } from '../../components/home/AgeCards';
import { WeatherWidget } from '../../components/home/WeatherWidget';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    setRefreshing(false);
  }, []);

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
        <Text style={styles.emptyEmoji}>👶</Text>
        <Text style={styles.emptyText}>등록된 자녀가 없습니다</Text>
        <Text style={styles.emptySubtext}>자녀를 등록하고 기질을 분석해보세요</Text>
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
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
          {/* 기질 날씨 위젯 */}
          <WeatherWidget childId={selectedChild.id} />

          {/* 기질 요약 */}
          <TraitSummary child={selectedChild} />

          {/* 연령별 카드 */}
          <AgeCards child={selectedChild} />

          {/* 퀵 액션 그리드 */}
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => router.push('/(main)/report')}
            >
              <Text style={styles.quickEmoji}>📊</Text>
              <Text style={styles.quickLabel}>리포트</Text>
            </TouchableOpacity>
            {children.length > 1 && (
              <TouchableOpacity
                style={styles.quickItem}
                onPress={() => router.push('/(main)/compatibility')}
              >
                <Text style={styles.quickEmoji}>💕</Text>
                <Text style={styles.quickLabel}>형제 궁합</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => router.push('/(main)/academy')}
            >
              <Text style={styles.quickEmoji}>🏫</Text>
              <Text style={styles.quickLabel}>학원</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => router.push('/(main)/subscription')}
            >
              <Text style={styles.quickEmoji}>📦</Text>
              <Text style={styles.quickLabel}>교구</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => router.push('/(main)/timer')}
            >
              <Text style={styles.quickEmoji}>⏱️</Text>
              <Text style={styles.quickLabel}>Quality Time</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => router.push('/(main)/mates')}
            >
              <Text style={styles.quickEmoji}>👫</Text>
              <Text style={styles.quickLabel}>기질 메이트</Text>
            </TouchableOpacity>
          </View>
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
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, padding: SPACING.xl,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.lg,
  },
  appTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.primary },
  logoutText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.lg, color: COLORS.text, fontWeight: '600', marginBottom: SPACING.xs },
  emptySubtext: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  addButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
  },
  addButtonText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '600' },
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  quickItem: {
    flex: 1, minWidth: '45%', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  quickEmoji: { fontSize: 28, marginBottom: SPACING.xs },
  quickLabel: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '500' },
  addMore: {
    borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed',
    borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center',
    marginTop: SPACING.lg, marginBottom: SPACING.xl,
  },
  addMoreText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
});

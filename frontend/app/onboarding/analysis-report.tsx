import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useChildStore, AnalysisReport } from '../../stores/childStore';
import { childApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { EditorialCover } from '../../components/report/EditorialCover';

/**
 * 분석 결과 — 첫 페이지 (풀스크린 표지).
 * "리포트 자세히 보기" 누르면 /onboarding/analysis-detail 로 이동.
 *
 * ⚠️ 사주/오행 용어(火/木 등) UI 노출 절대 금지 — 기질명만 사용.
 */

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export default function AnalysisReportScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const updateChild = useChildStore((s) => s.updateChild);
  const child = children.find((c) => c.id === childId);
  const storeReport = child?.analysisReport;

  const [localReport, setLocalReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);

  const report = storeReport ?? localReport;

  useEffect(() => {
    if (childId && !storeReport && !localReport && !loading) {
      setLoading(true);
      childApi.list()
        .then((res) => {
          const list = res.data?.data as Record<string, unknown>[] | undefined;
          const found = list?.find((c) => (c.id as string) === childId);
          if (found) {
            const parsed = found.analysisReport as AnalysisReport | null;
            if (parsed) {
              setLocalReport(parsed);
              updateChild(found as unknown as ReturnType<typeof useChildStore.getState>['children'][0]);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [childId, storeReport, localReport, loading, updateChild]);

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: '분석 결과', headerShown: false }} />
        <ActivityIndicator size="large" color="#FF8C5A" />
        <Text style={[styles.emptyText, { marginTop: 16 }]}>분석 결과를 불러오는 중...</Text>
      </View>
    );
  }

  if (!child || !report) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: '분석 결과', headerShown: false }} />
        <Text style={styles.emptyText}>분석 결과를 불러올 수 없습니다</Text>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(main)/home')}
        >
          <Text style={styles.homeBtnText}>홈으로 이동</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSeeDetail = () => {
    router.push({
      pathname: '/onboarding/analysis-detail',
      params: { childId: childId ?? '' },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '분석 결과', headerShown: false }} />
      <EditorialCover
        childName={safeString(child.name)}
        ageMonths={child.ageInfo?.months ?? 0}
        dominantType={safeString(child.innateData?.dominantType ?? '')}
        label={safeString(child.innateData?.label ?? '')}
        fiveElements={child.innateData?.fiveElements ?? null}
        description={safeString(report.summary)}
        fullScreen
        onSeeDetail={handleSeeDetail}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0E0B' },
  emptyContainer: {
    flex: 1, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  homeBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
  },
  homeBtnText: { color: '#FFF', fontWeight: '600', fontSize: FONT_SIZE.md },
});

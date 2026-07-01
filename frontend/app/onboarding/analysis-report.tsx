import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useChildStore, AnalysisReport } from '../../stores/childStore';
import { childApi } from '../../services/api';
import { captureError } from '../../services/sentry';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorialCover, TYPE_GRADIENT } from '../../components/report/EditorialCover';

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
  const { t } = useTranslation();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const updateChild = useChildStore((s) => s.updateChild);
  const child = children.find((c) => c.id === childId);
  const storeReport = child?.analysisReport;

  const [localReport, setLocalReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const fetchAttempted = useRef(false);

  const report = storeReport ?? localReport;

  // 색: trait-detail 과 동일하게 기질 타입별 네이비 그라디언트 사용 (하드코딩 다크 제거).
  // 안전영역: 상단 상태바 / 하단 네비바와 겹쳐 클릭 안 되던 문제 해결.
  const insets = useSafeAreaInsets();
  const gradient = TYPE_GRADIENT[child?.innateData?.dominantType ?? ''] ?? TYPE_GRADIENT['분석형'];
  const rootBg = gradient[0];

  useEffect(() => {
    // fetchAttempted ref로 1회만 시도 — 실패 시 loading 토글로 effect가 재실행되어
    // 무한 재요청되던 루프 방지. 재시도는 '다시 시도' 버튼이 ref를 초기화해 트리거.
    if (!childId || storeReport || localReport || fetchAttempted.current) return;
    fetchAttempted.current = true;
    setLoading(true);
    setLoadError(false);
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
      .catch((e) => {
        captureError(e, { ctx: 'analysis-report/fetch', childId });
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [childId, storeReport, localReport, updateChild]);

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: t('onboardingAnalysisReport.screenTitle'), headerShown: false }} />
        <ActivityIndicator size="large" color="#FF8C5A" />
        <Text style={[styles.emptyText, { marginTop: 16 }]}>{t('onboardingAnalysisReport.loadingResult')}</Text>
      </View>
    );
  }

  if (!child || !report) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: t('onboardingAnalysisReport.screenTitle'), headerShown: false }} />
        <Text style={styles.emptyText}>
          {loadError ? t('onboardingAnalysisReport.loadErrorMessage') : t('onboardingAnalysisReport.loadFailed')}
        </Text>
        {loadError && (
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => {
              fetchAttempted.current = false;
              setLoadError(false);
              setLocalReport(null);
            }}
          >
            <Text style={styles.homeBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.homeBtn, { marginTop: SPACING.sm }]}
          onPress={() => router.replace({ pathname: '/onboarding/questions', params: { childId: childId ?? '' } })}
        >
          <Text style={styles.homeBtnText}>{t('onboardingAnalysisReport.reAnalyze')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.homeLink}
          onPress={() => router.replace('/(main)/home')}
        >
          <Text style={styles.homeLinkText}>{t('onboardingAnalysisReport.goHome')}</Text>
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
    <View style={[styles.container, { backgroundColor: rootBg }]}>
      <Stack.Screen options={{ title: t('onboardingAnalysisReport.screenTitle'), headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <EditorialCover
          childName={safeString(child.name)}
          ageMonths={child.ageInfo?.months ?? 0}
          dominantType={safeString(child.innateData?.dominantType ?? '')}
          label={safeString(child.innateData?.label ?? '')}
          fiveElements={child.innateData?.fiveElements ?? null}
          description={safeString(report.summary)}
          fullScreen
          // onSeeDetail 미전달 — CTA는 아래 bottomActions 로 분리(다시분석과 간격 통일)
        />
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.fullReportBtn} onPress={handleSeeDetail} activeOpacity={0.85}>
            <Text style={styles.fullReportBtnText}>{t('onboardingAnalysisReport.readFullReport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reAnalyzeBtn}
            onPress={() => router.push({ pathname: '/onboarding/questions', params: { childId: childId ?? '' } })}
            activeOpacity={0.7}
          >
            <Text style={styles.reAnalyzeBtnText}>{t('onboardingAnalysisReport.reAnalyze')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  homeLink: { marginTop: SPACING.lg, paddingVertical: SPACING.sm },
  homeLinkText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  bottomActions: { paddingHorizontal: 24, paddingTop: 12, gap: 10 },
  fullReportBtn: { backgroundColor: '#FFFFFF', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  fullReportBtnText: { color: '#1C1C1E', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  reAnalyzeBtn: {
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255, 210, 168, 0.3)',
    backgroundColor: 'rgba(255, 210, 168, 0.06)',
  },
  reAnalyzeBtnText: { color: '#E0C8B8', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
});

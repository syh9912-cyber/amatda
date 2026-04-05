import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useChildStore, AnalysisReport } from '../../stores/childStore';
import { TraitTabBar } from '../../components/trait/TraitTabBar';
import { TraitTypeCard } from '../../components/trait/TraitTypeCard';
import { TraitBars } from '../../components/trait/TraitBars';
import { TraitSummaryText } from '../../components/trait/TraitSummaryText';
import { TraitCharacteristics } from '../../components/trait/TraitCharacteristics';
import { TRAIT_COLORS, TraitTab } from '../../components/trait/traitConstants';

export default function TraitDetailScreen() {
  const router = useRouter();
  const child = useChildStore((s) => s.selectedChild);
  const [activeTab, setActiveTab] = useState<TraitTab>('summary');

  if (!child) return null;

  const { innateData, analysisReport } = child;
  const analysisDate = child.birthDate
    ? child.birthDate.replace(/-/g, '.')
    : '';

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{child.name}의 기질 분석</Text>
        <TouchableOpacity hitSlop={12}>
          <Text style={styles.shareIcon}>{'🔗'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.dateLabel}>분석일: {analysisDate}</Text>

      {/* Tab Bar */}
      <View style={styles.tabWrap}>
        <TraitTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'summary' && (
          <SummaryContent
            name={child.name}
            innateData={innateData}
            summary={analysisReport?.summary}
          />
        )}
        {activeTab === 'traits' && (
          <TraitCharacteristics
            strengthsDetail={analysisReport?.strengthsDetail}
            weaknessesDetail={analysisReport?.weaknessesDetail}
          />
        )}
        {activeTab === 'detail' && (
          <DetailContent analysisReport={analysisReport} />
        )}

        {/* Re-analysis button */}
        <TouchableOpacity
          style={styles.reAnalyzeBtn}
          onPress={() =>
            router.push({
              pathname: '/onboarding/questions',
              params: { childId: child.id },
            })
          }
          activeOpacity={0.7}
        >
          <Text style={styles.reAnalyzeBtnText}>다시 분석하기</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/** 종합 요약 tab content */
function SummaryContent({
  name,
  innateData,
  summary,
}: {
  name: string;
  innateData: { fiveElements: Record<string, number>; dominantType: string; label: string };
  summary: string | undefined;
}) {
  return (
    <>
      <TraitTypeCard
        name={name}
        dominantType={innateData.dominantType}
        label={innateData.label}
      />
      <TraitBars fiveElements={innateData.fiveElements} />
      <TraitSummaryText
        name={name}
        summary={summary}
        label={innateData.label}
      />
    </>
  );
}

/** 상세분석 tab content */
function DetailContent({
  analysisReport,
}: {
  analysisReport: AnalysisReport | null;
}) {
  if (!analysisReport) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>상세 분석 데이터가 준비 중이에요.</Text>
      </View>
    );
  }

  return (
    <View>
      {analysisReport.parentingTip ? (
        <InfoBlock title="양육 팁" emoji="💡" text={analysisReport.parentingTip} />
      ) : null}
      {analysisReport.studyStyle ? (
        <InfoBlock title="학습 스타일" emoji="📖" text={analysisReport.studyStyle} />
      ) : null}
      {analysisReport.educationDirection ? (
        <InfoBlock title="교육 방향" emoji="🎓" text={analysisReport.educationDirection} />
      ) : null}
      {analysisReport.specialTalent ? (
        <InfoBlock title="특별 재능" emoji="🌟" text={analysisReport.specialTalent} />
      ) : null}
    </View>
  );
}

function InfoBlock({
  title,
  emoji,
  text,
}: {
  title: string;
  emoji: string;
  text: string;
}) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>{emoji} {title}</Text>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TRAIT_COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 4,
  },
  backArrow: {
    fontSize: 22,
    color: TRAIT_COLORS.textBrown,
  },
  shareIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TRAIT_COLORS.textBrown,
  },
  dateLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: TRAIT_COLORS.textBrownLight,
    marginBottom: 16,
  },
  tabWrap: { paddingHorizontal: 20 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },
  emptyCard: {
    backgroundColor: TRAIT_COLORS.cardBg,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: TRAIT_COLORS.textBrownLight },
  infoCard: {
    backgroundColor: TRAIT_COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TRAIT_COLORS.textBrown,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: TRAIT_COLORS.textBrownLight,
    lineHeight: 22,
  },
  reAnalyzeBtn: {
    backgroundColor: TRAIT_COLORS.coral,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 20,
    marginBottom: 20,
  },
  reAnalyzeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});

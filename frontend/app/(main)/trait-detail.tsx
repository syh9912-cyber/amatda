import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useChildStore, AnalysisReport } from '../../stores/childStore';
import { AdSlot } from '../../components/ads/AdSlot';
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

  const innateData = child.innateData;
  const analysisReport = child.analysisReport;
  const analysisDate = child.birthDate
    ? child.birthDate.replace(/-/g, '.')
    : '';

  const handleShare = async () => {
    const personalityTraits = analysisReport?.personality?.length
      ? analysisReport.personality.join(', ')
      : '';

    const lines: string[] = [
      `${child.name}의 기질 유형: ${innateData?.label ?? ''}`,
    ];

    if (personalityTraits) {
      lines.push(`주요 성향: ${personalityTraits}`);
    }

    if (analysisReport?.summary) {
      const summarySnippet = analysisReport.summary.length > 100
        ? analysisReport.summary.slice(0, 100) + '...'
        : analysisReport.summary;
      lines.push(`요약: ${summarySnippet}`);
    }

    lines.push('');
    lines.push('아맞다 앱에서 분석했어요');

    try {
      await Share.share({
        message: lines.join('\n'),
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : '공유에 실패했습니다';
      Alert.alert('오류', errorMessage);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{child.name}의 기질 분석</Text>
        <TouchableOpacity hitSlop={12} onPress={handleShare}>
          <Text style={styles.shareIcon}>{'공유'}</Text>
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

      <AdSlot />
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
  innateData: { fiveElements: Record<string, number>; dominantType: string; label: string } | null;
  summary: string | undefined;
}) {
  if (!innateData) return null;
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

/** 상세분석 tab content
 *
 * 온보딩 analysis-report.tsx와 동일한 12개 섹션을 모두 표시한다.
 * (이전엔 4개만 표시되어 회귀로 누락됨 — 사용자 보고로 복구)
 */
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
      {/* 성격 특성 (list) */}
      {analysisReport.personality && analysisReport.personality.length > 0 ? (
        <InfoListBlock title="성격 특성" emoji="🎭" items={analysisReport.personality} />
      ) : null}

      {/* 학습 스타일 (text) */}
      {analysisReport.studyStyle ? (
        <InfoBlock title="학습 스타일" emoji="📚" text={analysisReport.studyStyle} />
      ) : null}

      {/* 잘하는 분야 (list) */}
      {analysisReport.bestSubjects && analysisReport.bestSubjects.length > 0 ? (
        <InfoListBlock title="잘하는 분야" emoji="⭐" items={analysisReport.bestSubjects} />
      ) : null}

      {/* 보완할 분야 (list) */}
      {analysisReport.weakAreas && analysisReport.weakAreas.length > 0 ? (
        <InfoListBlock title="보완할 분야" emoji="💡" items={analysisReport.weakAreas} />
      ) : null}

      {/* 미래 진로 — 어울리는 직장 (list) */}
      {analysisReport.futureFields && analysisReport.futureFields.length > 0 ? (
        <InfoListBlock title="미래 진로" emoji="🚀" items={analysisReport.futureFields} />
      ) : null}

      {/* 잘 맞는 운동 (list) */}
      {analysisReport.sportsMatch && analysisReport.sportsMatch.length > 0 ? (
        <InfoListBlock title="잘 맞는 운동" emoji="⚽" items={analysisReport.sportsMatch} />
      ) : null}

      {/* 학원 스타일 (text) */}
      {analysisReport.academyStyle ? (
        <InfoBlock title="학원 스타일" emoji="🏫" text={analysisReport.academyStyle} />
      ) : null}

      {/* 좋은 음식 (list) */}
      {analysisReport.goodFoods && analysisReport.goodFoods.length > 0 ? (
        <InfoListBlock title="좋은 음식" emoji="🍎" items={analysisReport.goodFoods} />
      ) : null}

      {/* 피할 음식 (list) */}
      {analysisReport.badFoods && analysisReport.badFoods.length > 0 ? (
        <InfoListBlock title="피할 음식" emoji="⚠️" items={analysisReport.badFoods} />
      ) : null}

      {/* 교육 방향 (text) */}
      {analysisReport.educationDirection ? (
        <InfoBlock title="교육 방향" emoji="🎯" text={analysisReport.educationDirection} />
      ) : null}

      {/* 특별 재능 (text) */}
      {analysisReport.specialTalent ? (
        <InfoBlock title="특출난 재능" emoji="🏆" text={analysisReport.specialTalent} />
      ) : null}

      {/* 양육 팁 (text) */}
      {analysisReport.parentingTip ? (
        <InfoBlock title="양육 팁" emoji="💜" text={analysisReport.parentingTip} />
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

function InfoListBlock({
  title,
  emoji,
  items,
}: {
  title: string;
  emoji: string;
  items: string[];
}) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>{emoji} {title}</Text>
      {items.map((item, idx) => (
        <Text key={idx} style={styles.infoListItem}>{'• '}{item}</Text>
      ))}
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
  infoListItem: {
    fontSize: 13,
    color: TRAIT_COLORS.textBrownLight,
    lineHeight: 22,
    marginTop: 4,
    paddingLeft: 4,
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

import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useChildStore, AnalysisReport } from '../../stores/childStore';
import { AdSlot } from '../../components/ads/AdSlot';
import { useShowAds } from '../../hooks/useShowAds';
import { TraitTabBar } from '../../components/trait/TraitTabBar';
import { TraitTypeCard } from '../../components/trait/TraitTypeCard';
import { TraitBars } from '../../components/trait/TraitBars';
import { TraitSummaryText } from '../../components/trait/TraitSummaryText';
import { TraitCharacteristics } from '../../components/trait/TraitCharacteristics';
import { TRAIT_COLORS, TraitTab } from '../../components/trait/traitConstants';
import { EditorialCover, TYPE_GRADIENT } from '../../components/report/EditorialCover';

export default function TraitDetailScreen() {
  const router = useRouter();
  const child = useChildStore((s) => s.selectedChild);
  const insets = useSafeAreaInsets();
  const adsActive = useShowAds(); // 광고 활성 시 cover 압축
  const [activeTab, setActiveTab] = useState<TraitTab>('summary');
  const [sharing, setSharing] = useState(false);
  const coverRef = useRef<View>(null);

  if (!child) return null;

  const innateData = child.innateData;
  const analysisReport = child.analysisReport;
  const analysisDate = child.birthDate
    ? child.birthDate.replace(/-/g, '.')
    : '';

  // 표지 화면을 JPG 이미지로 캡쳐 → 카톡/메일 등에 공유.
  // 카톡 미리보기 잘 보이도록 PDF 가 아닌 JPG 사용 (사용자 피드백 반영).
  const handleShare = async () => {
    if (sharing) return;
    if (!coverRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(coverRef, {
        format: 'jpg',
        quality: 0.95,
        result: 'tmpfile',
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/jpeg',
          dialogTitle: `${child.name}의 기질 분석 리포트`,
          UTI: 'public.jpeg',
        });
      } else {
        Alert.alert('저장 완료', `이미지가 생성됐어요.\n${uri}`);
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : '이미지 생성에 실패했습니다';
      Alert.alert('오류', errorMessage);
    } finally {
      setSharing(false);
    }
  };

  // 화면 자체를 Editorial Magazine Dark 표지로. "READ THE FULL REPORT" 누르면
  // /onboarding/analysis-detail 로 이동(전체 12 섹션 풀 리포트).
  const ageMonths = child.ageInfo?.months ?? 0;
  // dominantType 별 코발트 톤 그라디언트 (EditorialCover 와 동일 색)
  const gradient = TYPE_GRADIENT[innateData?.dominantType ?? ''] ?? TYPE_GRADIENT['분석형'];

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.darkRoot}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* 다크 헤더 — 표지 위에 floating, status bar 안전 마진 반영 (좀 더 위로) */}
      <View style={[styles.darkHeader, { paddingTop: insets.top + 2 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.darkHeaderArrow}>{'←'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity hitSlop={12} onPress={handleShare} disabled={sharing}>
          {sharing ? (
            <ActivityIndicator size="small" color="#FFD2A8" />
          ) : (
            <Text style={styles.darkShareIcon}>{'공유'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ScrollView 제거 — 화면 딱 맞게 flex 레이아웃 (위아래 스크롤 없음).
          captureRef → flexBody 전체 영역(cover + bottomActions)을 캡처해서 공유.
          flexBody 자체는 transparent → captureRef 시 검정 fallback 방지 위해
          내부에 root 와 동일한 LinearGradient 를 absoluteFill 로 깐다. */}
      <View ref={coverRef} collapsable={false} style={[styles.flexBody, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* 표지 — 남은 공간 채움 (flex 1).
            CTA(READ FULL REPORT)는 cover 외부 bottomActions 로 분리 — 다시 분석하기 버튼과
            물리적으로 겹치지 않도록(이전엔 cover 내부 space-between 때문에 좁은 화면에서 충돌) */}
        <View style={styles.coverWrap}>
          <EditorialCover
            childName={child.name}
            ageMonths={ageMonths}
            dominantType={innateData?.dominantType ?? ''}
            label={innateData?.label ?? ''}
            fiveElements={innateData?.fiveElements ?? null}
            description={analysisReport?.summary}
            fullScreen
            compact={adsActive}
            // onSeeDetail 의도적으로 미전달 — CTA는 아래 bottomActions 에 별도 배치
          />
        </View>

        {/* 하단 액션 블록 — READ FULL REPORT + 다시 분석하기를 하나의 묶음으로.
            광고 유무에 따라 함께 움직여서 위치 일관성 확보 + 두 버튼 사이 명시적 gap.
            공유 캡처에도 포함됨 (사용자가 "전체 캡처" 요청). */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.fullReportBtn}
            onPress={() =>
              router.push({
                pathname: '/onboarding/analysis-detail',
                params: { childId: child.id },
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.fullReportBtnText}>{'READ THE FULL REPORT  →'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.darkReAnalyzeBtn}
            onPress={() =>
              router.push({
                pathname: '/onboarding/questions',
                params: { childId: child.id },
              })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.darkReAnalyzeBtnText}>다시 분석하기</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AdSlot />
    </LinearGradient>
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
  // ─── Editorial Dark 표지용 (메인 화면) ───
  // root 자체가 LinearGradient — status bar 부터 화면 끝까지 매끄럽게 한 장 그라디언트
  darkRoot: { flex: 1 },
  darkHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 10,
    // paddingTop 은 인라인으로 insets.top + 8 적용
  },
  darkHeaderArrow: {
    fontSize: 24,
    color: '#FFD2A8',
    fontWeight: '600',
  },
  darkShareIcon: {
    fontSize: 14,
    color: '#FFD2A8',
    fontWeight: '700',
    letterSpacing: 1,
  },
  flexBody: {
    flex: 1,
  },
  coverWrap: {
    flex: 1,
    // 좁은 화면에서 cover 내부 컨텐츠가 늘어나도 bottomActions 영역 침범 방지
    overflow: 'hidden',
  },
  // CTA + 다시 분석하기 묶음 — 화면 하단에 고정 (광고 유무와 상관없이 한 덩어리로 이동)
  bottomActions: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  // READ THE FULL REPORT — primary CTA (cover 디자인 톤 유지)
  fullReportBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  fullReportBtnText: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  // 다시 분석하기 — secondary, ghost 스타일 (primary 와 시각적 구분)
  darkReAnalyzeBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 210, 168, 0.3)',
    backgroundColor: 'rgba(255, 210, 168, 0.06)',
  },
  darkReAnalyzeBtnText: {
    color: '#E0C8B8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ─── 기존 라이트 스타일 (DetailContent 등 자식 컴포넌트가 사용) ───
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

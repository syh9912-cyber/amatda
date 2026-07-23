import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Animated, LayoutChangeEvent, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { GuideButton } from '../../components/common/GuideButton';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import { getGrowthGuide } from '../../features/guide/growthGuide';
import { getWeeklyDevGuide } from '../../features/guide/weeklyDevGuide';
import { WEEKLY_DEV_I18N } from '../../constants/weeklyDevI18n';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';
import { useChildStore } from '../../stores/childStore';
import { canDo } from '../../features/coparenting/permissions';
import { childApi, coachingApi, growthApi, pregnancyApi } from '../../services/api';
import { getQuestionByProgress, getQuestionCount } from '../../constants/dailyQuestions';
import { getTraitTypeName } from '../../utils/traitTypeName';
import { createGrowthAnalysisTranslator } from '../../utils/growthAnalysisI18n';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import type { ImageSourcePropType } from 'react-native';

const IC_THINKING = require('../../assets/mascot-thinking.png') as ImageSourcePropType;
const IC_CAMERA = require('../../assets/icon-camera.png') as ImageSourcePropType;
const IC_REPORT = require('../../assets/quick-report.png') as ImageSourcePropType;
const IC_DIARY = require('../../assets/child-diary.png') as ImageSourcePropType;
const IC_REDFLAG = require('../../assets/icon-redflag.png') as ImageSourcePropType;
const IC_HAPPY = require('../../assets/mascot-happy.png') as ImageSourcePropType;

type TabKey = 'physical';

function getTabs(t: TFunction): { key: TabKey; label: string }[] {
  return [
    { key: 'physical', label: t('growthStats.tabPhysical') },
  ];
}

/* ---- Milestone Types ---- */

interface MilestoneItem {
  id: string;
  label: string;
  domain: string;
  description: string;
  completed: boolean;
}

interface MilestoneData {
  ageLabel: string;
  items: MilestoneItem[];
  nextMilestone: string;
  daysUntilNext: number;
}

/* ---- Growth Analysis Types ---- */

interface GrowthMetricItem {
  metric: string;
  value: number;
  level: string;
  title: string;
  emoji: string;
  comment: string;
  advice: string;
  percentileLabel?: string;
  percentile?: number;
}

interface GrowthAnalysisResult {
  ageLabel: string;
  childMonths?: number;
  overallSummary: string;
  growthMetrics: GrowthMetricItem[];
  trackerMetrics: GrowthMetricItem[];
}

function isGrowthMetricItem(item: unknown): item is GrowthMetricItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.metric === 'string' &&
    typeof obj.value === 'number' &&
    typeof obj.level === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.emoji === 'string' &&
    typeof obj.comment === 'string' &&
    typeof obj.advice === 'string'
  );
}

function parseGrowthAnalysis(raw: unknown): GrowthAnalysisResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.overallSummary !== 'string') return null;

  const growthMetrics = Array.isArray(obj.growthMetrics)
    ? (obj.growthMetrics as unknown[]).filter(isGrowthMetricItem)
    : [];
  const trackerMetrics = Array.isArray(obj.trackerMetrics)
    ? (obj.trackerMetrics as unknown[]).filter(isGrowthMetricItem)
    : [];

  return {
    ageLabel: typeof obj.ageLabel === 'string' ? obj.ageLabel : '',
    childMonths: typeof obj.childMonths === 'number' ? obj.childMonths : undefined,
    overallSummary: obj.overallSummary,
    growthMetrics,
    trackerMetrics,
  };
}

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  very_low: { bg: '#FFF0F0', text: '#D32F2F' },
  very_high: { bg: '#FFF0F0', text: '#D32F2F' },
  low: { bg: '#FFF8E1', text: '#F57C00' },
  high: { bg: '#FFF8E1', text: '#F57C00' },
  normal: { bg: '#E8FAF8', text: '#2BA89E' },
};

function getLevelColor(level: string): { bg: string; text: string } {
  return LEVEL_COLORS[level] ?? { bg: '#F2F2F7', text: '#888888' };
}

function getLevelLabel(level: string, t: TFunction): string {
  switch (level) {
    case 'very_low': return t('growthStats.levelVeryLow');
    case 'low': return t('growthStats.levelLow');
    case 'normal': return t('growthStats.levelNormal');
    case 'high': return t('growthStats.levelHigh');
    case 'very_high': return t('growthStats.levelVeryHigh');
    default: return level;
  }
}

/* ---- Growth Percentile Standards (WHO approximate data) ---- */

interface PercentileData {
  p3: number;
  p50: number;
  p97: number;
}

interface GrowthStandard {
  height: PercentileData;
  weight: PercentileData;
}

const GROWTH_STANDARDS_BOYS: Record<number, GrowthStandard> = {
  0: { height: { p3: 46.3, p50: 49.9, p97: 53.4 }, weight: { p3: 2.5, p50: 3.3, p97: 4.3 } },
  3: { height: { p3: 57.6, p50: 61.4, p97: 65.3 }, weight: { p3: 5.1, p50: 6.4, p97: 8.0 } },
  6: { height: { p3: 63.6, p50: 67.6, p97: 71.6 }, weight: { p3: 6.4, p50: 7.9, p97: 9.8 } },
  9: { height: { p3: 67.7, p50: 72.0, p97: 76.2 }, weight: { p3: 7.2, p50: 8.9, p97: 11.0 } },
  12: { height: { p3: 71.0, p50: 75.7, p97: 80.5 }, weight: { p3: 8.1, p50: 9.6, p97: 11.8 } },
  18: { height: { p3: 76.0, p50: 81.7, p97: 87.5 }, weight: { p3: 9.2, p50: 10.9, p97: 13.2 } },
  24: { height: { p3: 80.5, p50: 87.1, p97: 93.8 }, weight: { p3: 10.0, p50: 12.2, p97: 14.7 } },
  30: { height: { p3: 84.0, p50: 91.1, p97: 98.2 }, weight: { p3: 10.8, p50: 13.3, p97: 16.0 } },
  36: { height: { p3: 87.5, p50: 95.1, p97: 102.8 }, weight: { p3: 11.3, p50: 14.0, p97: 17.0 } },
  48: { height: { p3: 93.4, p50: 102.0, p97: 110.5 }, weight: { p3: 12.7, p50: 16.3, p97: 20.5 } },
  60: { height: { p3: 99.0, p50: 108.0, p97: 117.0 }, weight: { p3: 14.1, p50: 18.3, p97: 23.5 } },
  72: { height: { p3: 104.0, p50: 113.8, p97: 123.5 }, weight: { p3: 15.9, p50: 20.5, p97: 26.8 } },
  84: { height: { p3: 109.0, p50: 119.2, p97: 129.4 }, weight: { p3: 17.4, p50: 22.9, p97: 30.5 } },
  96: { height: { p3: 113.5, p50: 124.5, p97: 135.5 }, weight: { p3: 19.2, p50: 25.6, p97: 34.8 } },
  108: { height: { p3: 118.0, p50: 129.5, p97: 141.0 }, weight: { p3: 21.3, p50: 28.8, p97: 39.8 } },
  120: { height: { p3: 122.5, p50: 134.5, p97: 146.5 }, weight: { p3: 23.6, p50: 32.4, p97: 45.6 } },
  132: { height: { p3: 127.5, p50: 140.0, p97: 152.5 }, weight: { p3: 26.4, p50: 36.5, p97: 51.5 } },
  144: { height: { p3: 133.0, p50: 146.0, p97: 159.0 }, weight: { p3: 29.8, p50: 41.2, p97: 58.0 } },
};

const GROWTH_STANDARDS_GIRLS: Record<number, GrowthStandard> = {
  0: { height: { p3: 45.6, p50: 49.1, p97: 52.7 }, weight: { p3: 2.4, p50: 3.2, p97: 4.2 } },
  3: { height: { p3: 56.2, p50: 59.8, p97: 63.5 }, weight: { p3: 4.6, p50: 5.8, p97: 7.4 } },
  6: { height: { p3: 61.8, p50: 65.7, p97: 69.8 }, weight: { p3: 5.8, p50: 7.3, p97: 9.2 } },
  9: { height: { p3: 65.6, p50: 70.1, p97: 74.5 }, weight: { p3: 6.6, p50: 8.2, p97: 10.4 } },
  12: { height: { p3: 68.9, p50: 74.0, p97: 79.2 }, weight: { p3: 7.0, p50: 8.9, p97: 11.5 } },
  18: { height: { p3: 74.0, p50: 80.0, p97: 86.1 }, weight: { p3: 8.2, p50: 10.2, p97: 12.8 } },
  24: { height: { p3: 79.3, p50: 85.7, p97: 92.2 }, weight: { p3: 9.2, p50: 11.5, p97: 14.5 } },
  30: { height: { p3: 83.0, p50: 89.8, p97: 96.6 }, weight: { p3: 10.0, p50: 12.7, p97: 16.0 } },
  36: { height: { p3: 86.5, p50: 93.9, p97: 101.4 }, weight: { p3: 10.8, p50: 13.9, p97: 17.5 } },
  48: { height: { p3: 92.5, p50: 100.8, p97: 109.2 }, weight: { p3: 12.3, p50: 16.1, p97: 20.8 } },
  60: { height: { p3: 98.0, p50: 107.2, p97: 116.4 }, weight: { p3: 13.7, p50: 18.2, p97: 24.1 } },
  72: { height: { p3: 103.5, p50: 113.0, p97: 122.5 }, weight: { p3: 15.3, p50: 20.2, p97: 27.5 } },
  84: { height: { p3: 108.5, p50: 118.5, p97: 128.5 }, weight: { p3: 17.0, p50: 22.4, p97: 31.2 } },
  96: { height: { p3: 113.5, p50: 124.0, p97: 134.5 }, weight: { p3: 18.8, p50: 25.0, p97: 35.5 } },
  108: { height: { p3: 118.5, p50: 130.0, p97: 141.5 }, weight: { p3: 21.0, p50: 28.2, p97: 40.5 } },
  120: { height: { p3: 124.0, p50: 136.5, p97: 149.0 }, weight: { p3: 23.5, p50: 32.0, p97: 46.0 } },
  132: { height: { p3: 130.0, p50: 143.0, p97: 156.0 }, weight: { p3: 26.5, p50: 36.5, p97: 52.0 } },
  144: { height: { p3: 135.5, p50: 149.0, p97: 162.5 }, weight: { p3: 30.0, p50: 41.5, p97: 58.5 } },
};

function getClosestStandard(months: number, gender: 'M' | 'F'): GrowthStandard | null {
  const table = gender === 'M' ? GROWTH_STANDARDS_BOYS : GROWTH_STANDARDS_GIRLS;
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) return null;

  let closest = keys[0];
  let minDiff = Math.abs(months - closest);
  for (const k of keys) {
    const diff = Math.abs(months - k);
    if (diff < minDiff) {
      minDiff = diff;
      closest = k;
    }
  }
  return table[closest] ?? null;
}

function calculatePercentile(value: number, std: PercentileData): number {
  if (value <= std.p3) return 97;
  if (value >= std.p97) return 3;

  if (value <= std.p50) {
    const ratio = (value - std.p3) / (std.p50 - std.p3);
    return Math.round(97 - ratio * 47);
  }
  const ratio = (value - std.p50) / (std.p97 - std.p50);
  return Math.round(50 - ratio * 47);
}

function getPercentileLabel(percentile: number, t: TFunction): string {
  // calculatePercentile은 (100 - 실제백분위)를 반환(작을수록 큰 아이)하므로
  // 실제 백분위(p)로 환산해 또래 대비 위치를 정확히, 구간별로 표기한다.
  const p = Math.max(1, Math.min(99, 100 - percentile));
  if (p >= 90) return t('growthStats.percentileLarge', { value: 100 - p });
  if (p >= 60) return t('growthStats.percentileSlightlyLarge', { value: p });
  if (p >= 40) return t('growthStats.percentileAverage', { value: p });
  if (p >= 11) return t('growthStats.percentileSlightlySmall', { value: p });
  return t('growthStats.percentileSmall', { value: p });
}

export default function GrowthStatsScreen() {
  // 기질 탭 제거됨: 키/몸무게/성장 단일 뷰
  const { t } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const isPregnant = selectedChild?.isPregnant === true;

  // 모드별 가이드: 임신(주수별 발달) / 육아(성장 기록)
  const guideKey = isPregnant ? 'weekly_dev' : 'growth';
  const growthGuide = useMemo(() => getGrowthGuide(t), [t]);
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    shouldAutoShowGuide(guideKey).then((sh) => { if (sh) setGuideVisible(true); });
  }, [guideKey]);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen(guideKey); };

  if (isPregnant) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Stack.Screen options={{ headerShown: false }} />
          <ScreenHeader title={t('growthStats.weeklyDevTitle')} right={<GuideButton onPress={() => setGuideVisible(true)} />} />
          <MedicalCitation
            compact
            note={t('growthStats.weeklyDevCitationNote')}
            sources={[
              { label: t('growthStats.citationSourceChildcare'), url: 'https://www.childcare.go.kr' },
              { label: t('growthStats.citationSourceKsog'), url: 'https://www.ksog.org' },
            ]}
          />
          <PregnancyWeeklyDevelopment />
        </ScrollView>
        <AdSlot />
        <GuideCarousel visible={guideVisible} pages={getWeeklyDevGuide(t)} onClose={closeGuide} onComplete={closeGuide} accent="#F0976C" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ headerShown: false }} />

        <GrowthHeader onGuide={() => setGuideVisible(true)} />

        <MedicalCitation
          compact
          note={t('growthStats.growthCitationNote')}
          sources={[
            { label: t('growthStats.citationSourceKdca'), url: 'https://www.kdca.go.kr' },
            { label: t('growthStats.citationSourceWho'), url: 'https://www.who.int/tools/child-growth-standards' },
          ]}
        />
        <PhysicalTab childName={selectedChild?.name ?? t('growthStats.defaultChildName')} />
      </ScrollView>
      <AdSlot />
      <GuideCarousel visible={guideVisible} pages={growthGuide} onClose={closeGuide} onComplete={closeGuide} accent="#7CA46E" />
    </KeyboardAvoidingView>
  );
}

function GrowthHeader({ onGuide }: { onGuide?: () => void }) {
  const { t } = useTranslation();
  return (
    <ScreenHeader title={t('growthStats.growthHeaderTitle')} right={onGuide ? <GuideButton onPress={onGuide} /> : undefined} />
  );
}

/* ---- Pregnancy Weekly Development ---- */

interface WeekDev {
  week: number;
  size: string;
  length: string;
  weight: string;
  features: string[];
  momTip: string;
  // ─── 풍부한 컨텐츠 (선택) — 후반기에 매일 들어와도 새 내용이 있도록 추가 ───
  /** 엄마 몸 변화 (호르몬/체형/통증 등) */
  momChange?: string;
  /** 오늘의 흥미 사실 — 짧은 toast 형식 */
  dailyFact?: string;
  /** 추천 음식 / 영양 팁 */
  foodTip?: string;
  /** 주의사항 */
  caution?: string;
}

interface TimelineItem {
  id: string;
  source: string;
  type: string;
  title: string;
  mediaUri?: string;
  mediaType?: string;
}

/* Static weekly development data — embedded to avoid API dependency */
const WEEKLY_DEVELOPMENT: WeekDev[] = [
  { week: 4, size: '양귀비씨', length: '0.1cm', weight: '1g 미만', features: ['수정란이 자궁벽에 착상 완료', '태반과 양막 형성 시작', '심장 원시 박동이 시작됨 (분당 약 65회)', '배아가 3개 세포층으로 분화', '신경관(뇌+척수 원형) 형성 시작'], momTip: '엽산 400~800mcg을 매일 복용하세요',
    momChange: 'HCG 호르몬 급증으로 임신테스트 양성. 가슴이 부풀고 따끔거리며 평소보다 졸리고 피곤해요.',
    dailyFact: '아기는 양귀비씨만 한 크기지만 이미 심장 원시 박동이 시작됐어요 (분당 약 65회).',
    foodTip: '엽산 400~800mcg/일이 1순위 — 신경관 결손 예방. 시금치·브로콜리·영양제로 챙기세요.',
    caution: '카페인은 하루 200mg(커피 1잔) 이하. 술·담배는 즉시 끊고, 약 복용 전 반드시 의사 상의.' },

  { week: 5, size: '참깨', length: '0.2cm', weight: '1g 미만', features: ['심장이 본격적으로 뛰기 시작 (2개의 방)', '뇌와 척수가 빠르게 발달', '탯줄이 형성되어 영양 공급 시작', '눈/코/입 자리가 잡히기 시작', '팔다리의 아주 작은 싹이 돋아남'], momTip: '입덧이 시작될 수 있어요. 소량씩 자주 드세요',
    momChange: '입덧이 슬슬 시작될 수 있어요. 가슴 통증·피로·잦은 소변이 흔해져요.',
    dailyFact: '아기 심장이 본격적으로 뛰기 시작! 작은 두 개의 방으로 분화됐어요.',
    foodTip: '빈속에 입덧 심해져요. 머리맡에 크래커 두고 일어나기 전 한두 개 드세요.',
    caution: '한쪽 골반 심한 통증·출혈은 자궁외임신 신호 가능. 즉시 병원에 가세요.' },

  { week: 6, size: '렌즈콩', length: '0.5cm', weight: '1g 미만', features: ['얼굴 윤곽이 형성되기 시작', '팔다리 싹이 더 뚜렷해짐', '심장 박동을 초음파로 확인 가능 (분당 100~160회)', '내이(균형감각 기관) 형성 시작', '폐의 기초 구조(기관지 싹) 발달'], momTip: '첫 산부인과 방문을 계획하세요. 임신 확인 초음파 시기예요',
    momChange: '호르몬이 급변해 감정 기복이 심해질 수 있어요. 본인 탓 아니에요.',
    dailyFact: '초음파로 아기 심장 박동을 처음 확인할 수 있는 시기 (분당 100~160회).',
    foodTip: '비타민B6(바나나·닭가슴살)가 입덧 완화에 도움. 생강차도 좋아요.',
    caution: '6주 전에 술 마셨다고 너무 자책 마세요. 지금부터 안 마시면 충분합니다.' },

  { week: 7, size: '블루베리', length: '1cm', weight: '1g', features: ['뇌가 분당 100개의 신경세포 생성 (급속 성장)', '손가락과 발가락 형성 시작 (아직 물갈퀴 형태)', '간과 콩팥이 기능을 시작', '입술과 혀가 형성됨', '망막에 색소 침착 시작'], momTip: '수분을 하루 2L 이상 섭취하세요. 변비 예방에도 도움돼요',
    momChange: '자궁이 자몽 크기로 커졌어요. 아랫배 묵직함·메스꺼움이 본격화될 수 있어요.',
    dailyFact: '아기 뇌는 1분에 100개의 신경세포를 만드는 중! 손가락도 형성 시작.',
    foodTip: '수분 2L+ / 식이섬유(통곡물·과일) 충분히 — 변비 예방.',
    caution: '갑자기 입덧이 사라지면 점검 필요 — 정상이지만 드물게 유산 신호일 수 있어요.' },

  { week: 8, size: '라즈베리', length: '1.6cm', weight: '1g', features: ['모든 주요 장기의 기초 완성 (배아→태아 전환)', '손가락과 발가락이 구분되기 시작', '얼굴의 이목구비가 뚜렷해짐', '귀의 외부 형태가 잡히기 시작', '꼬리뼈가 줄어들기 시작'], momTip: '첫 초음파 검사로 심장 박동을 확인하세요',
    momChange: '가슴이 컵 1~2 더 커지고 유두가 진해지기 시작. 모두 정상이에요.',
    dailyFact: '오늘이 배아→태아 전환점! 모든 주요 장기의 기초가 완성됐어요.',
    foodTip: '작게 자주 먹기 (하루 6번). 위가 비면 입덧이 심해져요.',
    caution: '갈색 점액 분비물은 보통 정상이지만, 선홍색 출혈은 즉시 병원으로.' },

  { week: 9, size: '체리', length: '2.3cm', weight: '2g', features: ['꼬리가 완전히 사라지고 사람 형태를 갖춤', '근육이 형성되어 미세한 움직임 시작', '생식기 발달 시작 (아직 외부 구분 불가)', '눈꺼풀이 형성되어 눈을 덮기 시작', '손목/발목 관절이 형성됨'], momTip: '극심한 피로감이 올 수 있어요. 무리하지 말고 충분히 쉬세요',
    momChange: '극심한 피로감 — 호르몬이 급변하는 시기. 무리하지 마세요.',
    dailyFact: '꼬리가 사라지고 사람 형태! 작은 손목·발목 관절도 생겼어요.',
    foodTip: '단백질을 매끼 챙기세요. 두부·계란·살코기로 간단히.',
    caution: '38℃ 이상 발열은 태아 영향 가능. 해열제 먹기 전 반드시 의사 상의.' },

  { week: 10, size: '대추', length: '3.1cm', weight: '4g', features: ['뼈와 연골이 형성되기 시작', '치아의 기초(치배)가 잇몸 안에서 형성', '손톱과 발톱이 자라기 시작', '위장이 소화액을 생산하기 시작', '뇌에서 뇌파 활동 시작'], momTip: '11~14주 사이 NT 검사(목투명대)를 예약하세요',
    momChange: '자궁이 자두 크기. 아직 배는 안 나오지만 옷이 살짝 끼는 느낌이 들어요.',
    dailyFact: '아기 콩팥이 소변을 만들어 양수로 배출해요. 양수 순환이 시작됐어요!',
    foodTip: '칼슘 1000mg/일 — 우유·요거트·멸치. 카페인은 칼슘 흡수를 방해해요.',
    caution: '11~14주 NT 검사(목투명대) 예약 — 다운증후군 1차 선별검사예요.' },

  { week: 11, size: '무화과', length: '4.1cm', weight: '7g', features: ['손가락을 펴고 오므릴 수 있게 됨', '횡격막이 형성되어 호흡 연습 시작', '얼굴 근육이 발달하여 표정 변화 가능', '머리가 전체 길이의 약 절반을 차지', '외부 생식기가 분화되기 시작'], momTip: '입덧이 서서히 줄어들 수 있어요. 조금만 참으세요!',
    momChange: '입덧이 정점을 찍은 후 서서히 줄어드는 시기. 조금만 참아요!',
    dailyFact: '아기가 손가락을 폈다 오므릴 수 있어요. 표정도 살짝 짓고 있어요!',
    foodTip: '과일 1~2회/일로 비타민 보충. 사과·바나나·딸기 추천.',
    caution: '비행기 탑승은 12주 이후 권장. 장거리 여행은 의사 상담 후.' },

  { week: 12, size: '라임', length: '5.4cm', weight: '14g', features: ['반사 반응이 시작됨 (자극에 움츠림)', '성대가 형성됨', '골수에서 백혈구 생산 시작 (면역 기초)', '뇌하수체에서 호르몬 분비 시작', '손가락에 고유한 지문 패턴이 잡히기 시작'], momTip: '12주 정밀 초음파(1차 기형아 검사) 시기예요. 유산 위험이 크게 줄어요',
    momChange: '안정기 진입! 유산 위험이 크게 줄어요. 입덧도 완화 시작해요.',
    dailyFact: '아기 손가락에 고유한 지문 패턴이 형성되는 중. 골수에서 백혈구도 만들어요!',
    foodTip: '입덧이 가라앉으면 균형 잡힌 식단으로 복귀. 과식은 피하세요.',
    caution: '12주 정밀 초음파(1차 기형아 검사) 꼭 받으세요. NT + 혈액검사 동시 진행.' },

  { week: 13, size: '완두콩 꼬투리', length: '7.4cm', weight: '23g', features: ['지문이 형성됨', '뼈가 점점 단단해짐 (석회화 진행)', '성별 구분이 가능해지기 시작', '성대와 후두가 완성되어 울음 준비', '몸 전체에 솜털이 자라기 시작'], momTip: '안정기에 접어들어요! 입덧이 줄고 에너지가 돌아올 거예요',
    momChange: '1분기 끝! 에너지가 돌아오기 시작하고 머리도 맑아져요.',
    dailyFact: '안정기 진입! 아기는 약 7cm — 손바닥 안에 쏙 들어가는 크기예요.',
    foodTip: '철분 보충 시작 좋은 시기. 시금치·소고기·견과류로 자연스럽게.',
    caution: '안정기지만 무거운 짐 들기·과한 운동은 여전히 주의하세요.' },

  { week: 14, size: '레몬', length: '8.7cm', weight: '43g', features: ['얼굴 표정을 지을 수 있게 됨 (찡그림/미소)', '온몸에 솜털(라누고)이 자라기 시작', '갑상선에서 호르몬 분비 시작', '목이 길어져 머리를 돌릴 수 있음', '입천장(구개)이 완성됨'], momTip: '철분이 풍부한 음식(시금치, 소고기)을 챙겨 드세요',
    momChange: '2분기 진입! 살이 붙기 시작하고 배가 살짝 나와요. 임부복 준비 시기.',
    dailyFact: '아기가 표정을 짓기 시작 — 찡그림·미소·눈살 찌푸림 모두 가능!',
    foodTip: '철분(시금치·소고기)+비타민C(오렌지) 함께 — 흡수율 ↑',
    caution: '잇몸 출혈 심해질 수 있어요. 부드러운 칫솔로 가볍게 닦으세요.' },

  { week: 15, size: '사과', length: '10cm', weight: '70g', features: ['눈이 빛에 반응하기 시작 (눈꺼풀은 닫힌 상태)', '양수를 마시고 배출하는 연습 시작', '다리 길이가 팔보다 길어짐', '귓속 뼈(이소골)가 경화되어 소리 전달 준비', '두피에 머리카락 패턴이 결정됨'], momTip: '태교 음악이나 아빠의 목소리를 들려주세요. 청각이 발달 중이에요',
    momChange: '머리카락·손톱이 빨리 자라고 피부가 좋아진 느낌(임신 광채).',
    dailyFact: '아기가 빛에 반응 시작! 눈은 닫혀 있지만 배에 강한 빛 비추면 움찔해요.',
    foodTip: '오메가-3(연어·호두·아마씨) — 아기 뇌 발달의 핵심 영양소.',
    caution: '코피·잇몸 출혈이 잦아져요. 비타민C(키위·딸기) 챙기세요.' },

  { week: 16, size: '아보카도', length: '11.6cm', weight: '100g', features: ['손가락 빨기 시작 (초음파에서 확인 가능)', '다양한 표정 연습 (찡그림, 눈살)', '청각이 발달하여 엄마 심장 소리를 들음', '눈이 정면을 향하도록 위치 이동', '태반이 완성되어 본격적 영양/산소 공급'], momTip: '16~18주 트리플/쿼드 검사(2차 기형아 검사) 시기예요',
    momChange: '살이 본격 붙어요(주당 약 0.5kg). 처음 태동 느낄 수도 있어요.',
    dailyFact: '아기가 손가락을 빨아요! 청각도 발달해 엄마 심장 소리를 들어요.',
    foodTip: '16~18주 쿼드 검사 시기 — 검사 전엔 평소대로 식사하면 돼요.',
    caution: '두통 시 타이레놀(아세트아미노펜) OK. 이부프로펜 등 NSAIDs는 금지.' },

  { week: 17, size: '배', length: '13cm', weight: '140g', features: ['피부 아래 지방(갈색지방) 축적 시작', '탯줄이 두꺼워지고 강해짐', '뼈 석회화가 진행됨 (X선에 보이기 시작)', '땀샘이 형성됨', '엄마 항체(IgG)가 태반을 통해 전달 시작'], momTip: '처음으로 태동을 느낄 수 있어요! 나비가 날개짓하는 듯한 느낌이에요',
    momChange: '자궁이 배꼽 아래 약 5cm까지 올라와요. 인대가 늘어나며 옆구리 통증이 올 수 있어요.',
    dailyFact: '처음으로 태동을 느낄 수 있어요! "나비가 날개짓 하는 듯" 가벼운 움직임.',
    foodTip: '단백질 매끼 — 분만 회복과 모유 준비. 콩·두부·살코기로.',
    caution: '갑작스런 옆구리 통증은 인대 통증일 수 있어요. 자세 바꾸면 가라앉으면 정상.' },

  { week: 18, size: '고구마', length: '14.2cm', weight: '190g', features: ['하품과 딸꾹질을 시작', '초산부도 태동을 느끼기 시작', '귀의 외부 형태가 완성됨', '수초화(신경 전달 속도 향상) 시작', '맥박이 청진기로 들릴 수 있음'], momTip: '18~22주 정밀 초음파(중기 정밀) 시기예요. 모든 장기를 자세히 봐요',
    momChange: '잇몸이 부어 음식이 끼는 느낌. 부드러운 칫솔과 치실 챙기세요.',
    dailyFact: '아기는 하품도 하고 딸꾹질도 해요! 양수 속에서 자유롭게 회전해요.',
    foodTip: '18~22주 정밀 초음파 — 다양한 영양소 골고루 드세요.',
    caution: '갑자기 어지러움·시야 흐림은 빈혈/혈당 신호. 어지러우면 바로 앉으세요.' },

  { week: 19, size: '망고', length: '15.3cm', weight: '240g', features: ['피부에 태지(흰 보호막) 형성 시작', '오감(시각/청각/미각/후각/촉각) 발달 가속', '뇌에서 감각 전담 영역이 분화', '영구치의 치배가 유치 뒤에서 형성', '여아: 난소에 원시 난포 약 600만 개 형성'], momTip: '잠잘 때 왼쪽으로 눕는 습관을 들이세요 (자궁 혈류 개선)',
    momChange: '코로 숨쉬기 답답할 수 있어요. 점막이 부어서 그래요. 정상이에요.',
    dailyFact: '아기 뇌에서 감각 전담 영역이 분화 중. 오감이 빠르게 발달!',
    foodTip: '잠잘 때 왼쪽으로 — 자궁 혈류가 가장 좋아요. 초기부터 습관 들이세요.',
    caution: '코피 잦아져요. 코를 세게 풀지 말고 입으로 호흡하세요.' },

  { week: 20, size: '바나나', length: '25cm', weight: '300g', features: ['삼킴 연습이 활발해짐 (하루 양수 약 500ml 삼킴)', '손톱이 손끝까지 자람', '머리카락이 자라기 시작', '감각신경이 성숙하여 촉각에 민감하게 반응', '태동 패턴이 뚜렷해짐'], momTip: '임신 절반 왔어요! 성별 확인이 가능한 시기예요. 중기 초음파를 꼭 하세요',
    momChange: '임신 절반! 자궁이 배꼽 위까지 올라와요. 본격적으로 배가 나와요.',
    dailyFact: '성별 확인 가능 시기! 손톱이 끝까지 자랐고 머리카락도 자라요.',
    foodTip: '마그네슘(시금치·아몬드) 챙기세요. 다리 쥐 예방에 좋아요.',
    caution: '다리 쥐가 자주 와요. 자기 전 종아리 스트레칭 습관을 들이세요.' },

  { week: 21, size: '큰 바나나', length: '26.7cm', weight: '360g', features: ['양수를 통해 엄마가 먹은 음식 맛을 경험', '눈꺼풀과 눈썹이 완성됨', '피부가 반투명에서 불투명으로 변하기 시작', '소장에서 영양분 흡수 연습 시작', '움직임이 더 힘차짐'], momTip: '배가 눈에 띄게 나오기 시작해요. 임부복이 필요할 수 있어요',
    momChange: '배가 눈에 띄게 나와요. 임부복이 편해지고, 임신선이 보일 수도.',
    dailyFact: '아기가 양수를 통해 엄마가 먹은 음식 맛을 경험해요! 다양하게 드세요.',
    foodTip: '임당 검사 대비 — 단순당(주스·과자) 줄이고 통곡물로 바꾸세요.',
    caution: '등 통증이 심해져요. 굽 낮은 신발, 베개로 허리 받치기 권장.' },

  { week: 22, size: '파파야', length: '27.8cm', weight: '430g', features: ['눈썹과 속눈썹이 뚜렷하게 형성', '외부 소리에 놀라는 반응을 보임', '미각이 발달하여 단맛/쓴맛 구분 시작', '뇌의 주름(이랑과 고랑)이 형성되기 시작', '남아: 고환에서 테스토스테론 분비'], momTip: '칼슘 섭취를 충분히 하세요 (하루 1000mg). 유제품, 멸치, 두부가 좋아요',
    momChange: '발이 살짝 부어요. 굽 낮은 신발로 바꾸세요. 임신선·튼살이 시작될 수 있어요.',
    dailyFact: '아기가 외부 소리에 놀라요! 단맛/쓴맛도 구분 시작 — 미각 발달!',
    foodTip: '칼슘 1000mg — 유제품·멸치·두부. 아기가 엄마 뼈에서 가져가요.',
    caution: '신발이 끼면 한 사이즈 더 큰 걸로 — 부종이 점점 늘어요.' },

  { week: 23, size: '큰 망고', length: '28.9cm', weight: '500g', features: ['빠른 안구 운동(REM)이 시작됨', '폐에서 계면활성제(서팩턴트) 소량 생산 시작', '청각이 거의 완성 — 음악/목소리에 반응', '손바닥 잡기(파악 반사) 연습', '균형감각(전정기관)이 발달'], momTip: '태교 음악이나 동화책 읽어주기를 시작해보세요. 아기가 듣고 있어요!',
    momChange: '자궁이 배꼽 위 약 4cm. 옆구리·아랫배 결림이 자주 와요.',
    dailyFact: '아기가 REM 수면(꿈?)을 시작해요. 청각 거의 완성 — 음악 들려주세요!',
    foodTip: '칼륨(바나나·고구마) — 부종 예방. 짠 음식 줄이세요.',
    caution: '23주 미만 진통/출혈은 자연유산 위험기. 즉시 병원에 가세요.' },

  { week: 24, size: '옥수수', length: '30cm', weight: '600g', features: ['폐 발달이 가속화 (폐포 형성 시작)', '눈을 뜰 수 있게 됨 (아직 시야 흐릿)', '생존 가능 시기 진입 (NICU 치료 시)', '피부 세포에서 멜라닌 생산 시작', '규칙적인 수면-각성 주기가 형성'], momTip: '24~28주 임신성 당뇨 검사(GCT/OGTT) 시기예요. 꼭 받으세요',
    momChange: 'NICU 생존 가능 시기 진입. 마음이 조금 편해져요. 자궁이 농구공만큼.',
    dailyFact: '아기가 눈을 뜨기 시작! 폐포가 본격적으로 형성되고 있어요.',
    foodTip: '24~28주 임당 검사(GCT/OGTT) — 평소처럼 드시면 됩니다.',
    caution: '임당 진단 시 조기 관리 중요. 식단·운동·혈당 체크를 시작하세요.' },

  { week: 25, size: '큰 옥수수', length: '34.6cm', weight: '660g', features: ['콧구멍이 열리기 시작', '척수 신경이 성숙하여 복잡한 움직임 가능', '피하지방이 쌓이면서 피부 주름이 펴지기 시작', '대뇌 피질 층이 형성됨', '손을 꽉 쥐었다 펴는 동작을 반복'], momTip: '소변이 자주 마려울 수 있어요. 자궁이 커지면서 방광을 눌러요',
    momChange: '잦은 소변이 다시 시작. 자궁이 방광을 누르기 시작해요.',
    dailyFact: '아기 콧구멍이 열리고 척수 신경이 성숙 — 복잡한 움직임 가능!',
    foodTip: '단백질 + 채소 위주. 임당 위험기라 단순당은 주의하세요.',
    caution: '부기·체중 갑작스런 증가는 임신중독증 신호. 혈압 체크 필수.' },

  { week: 26, size: '양배추', length: '35.6cm', weight: '760g', features: ['눈을 깜빡일 수 있게 됨', '폐에서 계면활성제 생산이 증가', '뇌파 활동이 활발해짐 (청각/시각 자극 반응)', '면역체계가 발달하여 감염 방어 준비', '엄마 목소리와 다른 소리를 구분할 수 있음'], momTip: '태동 횟수를 체크하세요. 2시간에 10회 이상이면 건강한 신호예요',
    momChange: '다리 부종·하지정맥류가 시작될 수 있어요. 자주 다리를 올리세요.',
    dailyFact: '아기가 눈을 깜빡일 수 있어요! 엄마 목소리를 다른 소리와 구분해요.',
    foodTip: '오메가-3 + 비타민D — 아기 뇌·뼈 발달 골든타임이에요.',
    caution: '태동 횟수 매일 체크. 2시간에 10회 미만이면 병원에 연락하세요.' },

  { week: 27, size: '콜리플라워', length: '36.6cm', weight: '875g', features: ['맛과 냄새를 구별하는 능력 향상', '눈의 망막 층이 형성 완료', '뇌가 매우 활발하게 성장 (표면적 증가)', '딸꾹질이 빈번해짐 (횡격막 훈련)', '빛에 반응하여 고개를 돌릴 수 있음'], momTip: '2분기가 끝나가요! 출산 준비 교실을 알아보세요',
    momChange: '2분기 끝! 자궁이 배꼽 위 7cm까지. 잠자기가 점점 어려워져요.',
    dailyFact: '아기는 빛에 반응해 고개를 돌려요! 딸꾹질도 자주 — 횡격막 훈련.',
    foodTip: '출산 준비 교실 시작 시기. 식단·분만법 코칭을 받으세요.',
    caution: '발걸음이 무거우면 천천히. 갑자기 일어나지 마세요(어지러움 위험).' },
  { week: 28, size: '큰 가지', length: '37.6cm', weight: '1kg', features: ['꿈을 꾸기 시작 (REM 수면 확인)', '맛을 구별하고 선호도가 생김', '체온 조절 능력 발달 시작', '뇌 표면 주름(뇌회)이 뚜렷해짐', '엄마에게서 받은 항체로 면역 강화'], momTip: '3분기 시작! Rh- 혈액형이면 항D글로불린 주사 시기예요',
    momChange: '자궁이 배꼽 위 약 8cm까지 올라와요. 호흡이 가빠지고 위가 눌려 한 번에 많이 못 먹을 수 있어요.',
    dailyFact: '아기가 양수 안에서 꿈을 꿔요! REM 수면이 시작돼서 눈동자가 빠르게 움직이는 게 초음파로 보일 정도예요.',
    foodTip: '하루 칼로리 +300kcal 권장. 단백질·철분·DHA(등푸른생선)를 챙기세요. 견과류 한 줌이 좋은 간식이에요.',
    caution: '두통·심한 부종·시야 흐림은 임신중독증 신호일 수 있어요. 즉시 병원에 가세요.' },

  { week: 29, size: '버터넛 호박', length: '38.6cm', weight: '1.15kg', features: ['뼈가 단단해지며 칼슘을 많이 흡수', '근육과 폐가 계속 성숙', '뇌에서 수십억 개의 뉴런이 발달 중', '피하지방이 늘어 체온 유지 향상', '태아가 두정위(머리 아래) 시도'], momTip: '등과 허리 통증이 심해질 수 있어요. 바른 자세와 스트레칭이 도움돼요',
    momChange: '인대가 느슨해져 골반이 벌어지고 있어요. 앉을 때 다리를 꼬지 말고 똑바로 앉으세요.',
    dailyFact: '아기는 매일 칼슘 250mg 이상을 엄마 뼈에서 가져가요. 엄마는 칼슘 1000mg 챙겨야 본인 뼈가 약해지지 않아요.',
    foodTip: '유제품(우유 1잔=300mg), 멸치, 브로콜리, 두부가 좋아요. 카페인은 칼슘 흡수를 방해하니 줄이세요.',
    caution: '하지정맥류 예방 — 같은 자세로 30분 이상 있지 말고, 잠시라도 다리를 올리세요.' },

  { week: 30, size: '양상추', length: '39.9cm', weight: '1.3kg', features: ['골수에서 적혈구 생산 시작 (간→골수 전환)', '머리카락이 풍성해짐', '체지방 비율 3.5% → 8% 증가', '폐 발달이 빠르게 진행', '눈동자가 빛/어둠을 구분'], momTip: '출산 준비를 서서히 시작하세요. 분만법, 산후조리원을 알아보세요',
    momChange: '브랙스턴 힉스 수축(가성진통)이 잦아질 수 있어요. 불규칙하고 자세 바꾸면 사라지면 정상이에요.',
    dailyFact: '오늘부터 아기는 한 시간에 6번 이상 움직여요. 태동이 줄면 바로 병원에 가세요.',
    foodTip: '오메가-3(연어, 호두) 챙기세요. 아기 뇌 발달 + 임신중독증 예방 효과가 있어요.',
    caution: '체중이 1주 1kg 이상 갑자기 늘면 부종/임신중독증 신호일 수 있어요. 병원에 알리세요.' },

  { week: 31, size: '코코넛', length: '41.1cm', weight: '1.5kg', features: ['뇌 연결(시냅스)이 급격히 증가', '홍채가 빛에 따라 수축/확장 가능', '5가지 감각이 모두 기능', '피부가 덜 붉어지고 분홍빛으로', '양수량 최대치 (약 800ml)'], momTip: '잠들기 어려울 수 있어요. 베개로 배를 받치고 옆으로 누우세요',
    momChange: '가슴에서 초유가 살짝 새어 나올 수 있어요. 정상이고 모유 수유 준비 신호예요.',
    dailyFact: '아기 뇌에서 매 초 1,000개 이상의 시냅스가 만들어져요. 출생 시까지 약 1조 개가 형성됩니다.',
    foodTip: '비타민D(햇볕 15분 or 등푸른생선)를 챙기세요. 아기 뼈 발달과 엄마 우울감 예방에 좋아요.',
    caution: '왼쪽으로 누워 자기를 권장 — 자궁 혈류가 가장 좋아져요.' },

  { week: 32, size: '큰 코코넛', length: '42.4cm', weight: '1.7kg', features: ['폐가 거의 완성 (계면활성제 충분)', '피부 주름이 펴지며 통통해짐', '엄마 면역 항체(IgG) 대량 전달', '발톱이 발가락 끝까지 자람', '하루 약 500ml 양수를 삼킴'], momTip: 'NST(비수축검사) 시작 시기예요. 태동이 줄면 바로 병원에 가세요',
    momChange: '소화불량·속쓰림이 심해져요. 작게 자주 먹고 식후 바로 눕지 마세요. 베개로 상체를 약간 올리고 자면 좋아요.',
    dailyFact: '아기는 이미 엄마 목소리를 알고, 출생 후에도 다른 목소리와 구분해요. 매일 말 걸어주세요!',
    foodTip: '철분(붉은 살코기·시금치) 부족하면 분만 시 출혈 위험 ↑. 비타민C와 함께 먹으면 흡수율이 좋아요.',
    caution: '갑자기 태동이 약해지거나 사라지면 즉시 병원행. 평소 패턴과 다른 게 중요해요.' },

  { week: 33, size: '파인애플', length: '43.7cm', weight: '1.9kg', features: ['두개골은 유연함 유지 (산도 통과 위해)', '면역 체계가 더 강화됨', '양수 속 호흡 연습이 규칙적', '동공이 빛에 반응하여 수축', '남아: 고환이 음낭으로 하강 중'], momTip: '가슴이 답답하거나 숨이 찰 수 있어요. 자궁이 횡격막을 밀어 올려요',
    momChange: '손목 저림(임신성 손목터널증후군)이 올 수 있어요. 손을 위로 올리고 자면 부기가 빠져요.',
    dailyFact: '아기가 손을 빨거나 손가락을 만지작거리는 모습을 자주 해요. 빠는 반사를 미리 연습 중이에요.',
    foodTip: '식이섬유(고구마·귀리·과일) 충분히 — 변비가 심해지는 시기예요. 물 2L 이상 꼭.',
    caution: '발/손/얼굴 부기가 갑자기 심해지면 임신중독증 검사 필요. 혼자 판단 말고 병원 연락.' },

  { week: 34, size: '멜론', length: '45cm', weight: '2.1kg', features: ['폐 성숙 거의 완료 (생존율 매우 높음)', '뇌가 급속 성장 (대뇌 피질 확장)', '손톱이 손끝을 넘어감', '태지가 두꺼워져 피부 보호', '수면-각성 주기가 신생아와 비슷'], momTip: '출산가방을 준비하세요. 산모수첩, 속옷, 수유패드, 아기 옷을 챙기세요',
    momChange: '치골 통증이 심해질 수 있어요. 다리를 모으고 옆으로 누워서 일어나면 통증이 덜해요.',
    dailyFact: '아기는 이제 빛을 향해 고개를 돌릴 수 있어요. 배에 손전등을 비추면 반응을 보일 수도!',
    foodTip: '단백질 매끼 챙기세요 (계란·두부·살코기). 분만 회복과 모유 생성에 필수예요.',
    caution: '34주 이후엔 비행기 탑승 제한 항공사가 많아요. 장거리 이동은 의사와 상의 후.' },

  { week: 35, size: '큰 멜론', length: '46.2cm', weight: '2.4kg', features: ['신장(콩팥)이 완전히 성숙', '간에서 일부 노폐물 처리 가능', '팔다리가 통통해짐 (피하지방 급증)', '반사 반응이 대부분 완성 (빨기/잡기/놀람)', '청각이 출생 후와 거의 같은 수준'], momTip: '부종이 심해질 수 있어요. 다리를 높이 올리고 염분을 줄이세요',
    momChange: '잦은 소변이 심해져요. 자궁이 방광을 누르고 있어서 그래요. 밤에 자다 깨도 정상.',
    dailyFact: '아기 머리가 점점 골반으로 내려가요(진입). 배 윗부분이 가벼워지고 숨쉬기가 편해질 수 있어요.',
    foodTip: '짠 음식·국물은 최대한 줄이세요. 부종을 악화시켜요. 칼륨(바나나·고구마)이 도움돼요.',
    caution: '37주 미만 진통은 조산 위험. 1시간에 4회 이상 규칙 수축이면 병원 가세요.' },

  { week: 36, size: '큰 파인애플', length: '47.4cm', weight: '2.6kg', features: ['태지가 줄어들기 시작', '대부분 머리가 아래를 향함 (두정위)', '피하지방이 완성되어 통통한 모습', '솜털(라누고)이 빠지기 시작', '소화계가 완성되어 모유 소화 준비'], momTip: '35~37주 GBS(B군 연쇄상구균) 검사를 받으세요',
    momChange: '골반이 벌어지면서 걷는 게 뒤뚱거려요(임신부 걸음). 절뚝일 정도면 골반 벨트를 추천.',
    dailyFact: '아기 폐포는 이제 출생 후 첫 호흡을 받을 준비가 돼요. 첫 울음은 폐가 펴지는 신호예요!',
    foodTip: '대추차·라즈베리잎차는 자궁 수축에 도움된다고 알려져 있지만, 36주 이전엔 피하세요.',
    caution: '37주 전 양막 파수(양수 터짐)는 조산 위험. 즉시 병원행 — 색·양·시간을 메모해두세요.' },

  { week: 37, size: '겨울호박', length: '48.6cm', weight: '2.9kg', features: ['만삭 기준 진입 (37주부터 조산 아님)', '폐와 뇌의 최종 성숙 단계', '면역 체계가 출생 후 독립 가능 수준', '지방이 하루 약 14g씩 증가', '장내에 태변이 가득 참'], momTip: '이슬(피 묻은 점액)이나 불규칙 수축은 출산이 가까운 신호예요',
    momChange: '가진통이 잦아져요. 진짜 진통은 시간이 갈수록 더 강해지고 간격이 짧아져요(5-1-1 법칙).',
    dailyFact: '오늘부터 아기는 "만삭"이에요. 지금 태어나도 안전한 정상아 — 마음 편히 가지세요.',
    foodTip: '가벼운 산책 30분이 분만 진행에 도움. 의사가 허락하면 계단 오르기도 좋아요.',
    caution: '이슬·진통·양수 터짐 = 분만 신호. 5-1-1 (5분 간격, 1분 지속, 1시간 이상) 이면 병원 출발.' },

  { week: 38, size: '참외', length: '49.8cm', weight: '3.1kg', features: ['태지가 거의 사라짐 (접힌 부분만)', '장내 태변이 진한 녹색으로 완성', '모든 장기가 독립적으로 기능', '쥐기 반사가 매우 강함', '뇌 무게가 출생 시의 약 70%에 도달'], momTip: '분만 징후(이슬, 규칙적 진통, 양수 파수)를 잘 관찰하세요',
    momChange: '체중 증가가 멈추거나 살짝 빠질 수 있어요. 정상이에요 — 출산이 임박한 신호.',
    dailyFact: '오늘 아기 손톱은 손끝보다 길어요. 출생 후 얼굴을 긁을 수 있으니 손싸개를 준비하세요.',
    foodTip: '소화 잘 되는 음식 위주로. 분만 시 위가 비어있는 게 좋아요. 자정 이후 금식 권장(제왕절개 가능성).',
    caution: '진통이 5분 간격으로 1분 이상 지속, 1시간 계속되면 병원에 가세요(5-1-1 법칙).' },

  { week: 39, size: '작은 수박', length: '50.7cm', weight: '3.3kg', features: ['피부 색소 형성 완료', '반사 신경 80가지 이상 완성', '모든 출생 준비 완료', '탯줄 길이 약 50cm로 최종', '자궁 안 공간이 좁아 움직임 줄지만 힘차게 발차기'], momTip: '곧 만나요! 마음의 준비를 하세요. 호흡법을 연습하세요',
    momChange: '에너지가 갑자기 솟거나(둥지 본능) vs 무기력 — 둘 다 분만 임박 신호예요.',
    dailyFact: '아기는 이미 100개 이상의 반사 동작을 할 수 있어요. 출생 후 빨기·삼키기·울기가 자동으로 시작돼요.',
    foodTip: '수분 충분히 + 바나나·견과류로 에너지 비축. 분만은 마라톤이에요.',
    caution: '두통·복통·시야 이상 + 손발 붓기는 임신중독증 응급 상황. 새벽이라도 바로 병원.' },

  { week: 40, size: '수박', length: '51.2cm', weight: '3.5kg', features: ['출산 예정일!', '모든 장기 발달 완료', '두개골 봉합선이 유연해 산도 통과 가능', '폐가 첫 호흡을 위한 준비 완료', '예정일 ±2주는 정상 범위'], momTip: '예정일이에요! 40주 2일까지 안 오면 유도분만을 상의하세요',
    momChange: '예정일 지나도 조급해 마세요. 한국 통계상 첫째는 평균 +5일, 둘째는 -1일이에요.',
    dailyFact: '예정일에 정확히 태어나는 아기는 약 4%에요. 38~42주 사이가 모두 만삭 정상이에요.',
    foodTip: '분만 직전엔 가볍게. 에너지 음료·꿀물 한 잔이 진통 중 도움될 수 있어요.',
    caution: '41주 넘으면 과숙임신 — 태반 기능 저하 위험. 의사와 유도분만 일정을 상의하세요.' },
];

const SIZE_EMOJI: Record<string, string> = {
  '양귀비씨': '🌸', '참깨': '🫘', '렌즈콩': '🫘', '블루베리': '🫐',
  '라즈베리': '🫐', '체리': '🍒', '대추': '🫒', '무화과': '🫒',
  '라임': '🍋', '완두콩 꼬투리': '🫛', '레몬': '🍋', '사과': '🍎',
  '아보카도': '🥑', '배': '🍐', '고구마': '🍠', '망고': '🥭',
  '큰 망고': '🥭', '바나나': '🍌', '큰 바나나': '🍌', '파파야': '🥭',
  '옥수수': '🌽', '큰 옥수수': '🌽', '양배추': '🥬', '콜리플라워': '🥦',
  '큰 가지': '🍆', '버터넛 호박': '🎃', '양상추': '🥬', '코코넛': '🥥',
  '큰 코코넛': '🥥', '파인애플': '🍍', '멜론': '🍈', '큰 멜론': '🍈',
  '큰 파인애플': '🍍', '겨울호박': '🎃', '참외': '🍈', '작은 수박': '🍉', '수박': '🍉',
};

/* ── 주차별 할 일/검사 체크리스트 ── */
interface WeeklyTask {
  minWeek: number;
  maxWeek: number;
  emoji: string;
  title: string;
  type: 'exam' | 'todo';
}

function getWeeklyTasks(t: TFunction): WeeklyTask[] {
  return [
    { minWeek: 1, maxWeek: 12, emoji: '💊', title: t('growthStats.task1'), type: 'todo' },
    { minWeek: 6, maxWeek: 10, emoji: '🏥', title: t('growthStats.task2'), type: 'exam' },
    { minWeek: 11, maxWeek: 14, emoji: '🔬', title: t('growthStats.task3'), type: 'exam' },
    { minWeek: 14, maxWeek: 16, emoji: '🥬', title: t('growthStats.task4'), type: 'todo' },
    { minWeek: 15, maxWeek: 20, emoji: '🧪', title: t('growthStats.task5'), type: 'exam' },
    { minWeek: 18, maxWeek: 22, emoji: '📋', title: t('growthStats.task6'), type: 'exam' },
    { minWeek: 20, maxWeek: 24, emoji: '🎀', title: t('growthStats.task7'), type: 'todo' },
    { minWeek: 24, maxWeek: 28, emoji: '🩸', title: t('growthStats.task8'), type: 'exam' },
    { minWeek: 28, maxWeek: 32, emoji: '📚', title: t('growthStats.task9'), type: 'todo' },
    { minWeek: 28, maxWeek: 36, emoji: '🦶', title: t('growthStats.task10'), type: 'todo' },
    { minWeek: 32, maxWeek: 36, emoji: '🏥', title: t('growthStats.task11'), type: 'exam' },
    { minWeek: 35, maxWeek: 37, emoji: '🔬', title: t('growthStats.task12'), type: 'exam' },
    { minWeek: 32, maxWeek: 40, emoji: '🧳', title: t('growthStats.task13'), type: 'todo' },
    { minWeek: 36, maxWeek: 40, emoji: '⏱️', title: t('growthStats.task14'), type: 'todo' },
  ];
}

function getTasksForWeek(week: number, t: TFunction): WeeklyTask[] {
  return getWeeklyTasks(t).filter((task) => week >= task.minWeek && week <= task.maxWeek);
}

function calculateDDay(dueDate?: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getTrimesterInfo(week: number, t: TFunction) {
  if (week <= 13) return { label: t('growthStats.trimester1'), color: '#E8F5E9', textColor: '#2E7D32' };
  if (week <= 27) return { label: t('growthStats.trimester2'), color: '#E3F2FD', textColor: '#1565C0' };
  return { label: t('growthStats.trimester3'), color: '#FCE4EC', textColor: '#C62828' };
}

// 로케일별 주차 발달 데이터 — size는 SIZE_EMOJI 조회용으로 한국어 키(sizeKey) 유지, 표시 필드만 번역.
// 번역 JSON의 옵션 필드는 null 가능 → 렌더에서 falsy 체크로 처리.
type LocalizedWeekDev = Omit<WeekDev, 'momChange' | 'dailyFact' | 'foodTip' | 'caution'> & {
  sizeKey: string;
  momChange?: string | null;
  dailyFact?: string | null;
  foodTip?: string | null;
  caution?: string | null;
};
function getLocalizedWeeks(lang: string): LocalizedWeekDev[] {
  return WEEKLY_DEVELOPMENT.map((w) => {
    if (lang === 'ja' || lang === 'zh-Hant') {
      const tr = WEEKLY_DEV_I18N[w.week]?.[lang];
      if (tr) return { ...w, ...tr, sizeKey: w.size };
    }
    return { ...w, sizeKey: w.size };
  });
}

function PregnancyWeeklyDevelopment() {
  const { t, i18n } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const weeks = useMemo(() => getLocalizedWeeks(i18n.language), [i18n.language]);
  const [imagesByWeek, setImagesByWeek] = useState<Record<number, TimelineItem[]>>({});
  const [, setLoading] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const weekPositions = useRef<Record<number, number>>({});

  const currentWeek = selectedChild?.pregnancyWeeks ?? 0;
  const dDay = calculateDDay(selectedChild?.dueDate);
  const weeklyTasks = getTasksForWeek(currentWeek, t);

  // 금기 검색
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyQuery, setSafetyQuery] = useState('');
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyResult, setSafetyResult] = useState<{
    level: 'safe' | 'caution' | 'avoid';
    title: string; summary: string;
    dos: string[]; donts: string[];
    disclaimer?: string;
  } | null>(null);

  const handleSafetyCheck = async () => {
    const q = safetyQuery.trim();
    if (q.length === 0) return;
    setSafetyLoading(true);
    setSafetyResult(null);
    try {
      const res = await pregnancyApi.safetyCheck(q, currentWeek || undefined);
      setSafetyResult(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? t('growthStats.safetySearchFail');
      Alert.alert(t('common.notice'), msg);
    }
    setSafetyLoading(false);
  };

  // Only fetch timeline images from API (user photos per week)
  useEffect(() => {
    if (!selectedChild?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const tlRes = await pregnancyApi.getTimeline(selectedChild.id);
        if (cancelled) return;
        if (tlRes?.data?.data && Array.isArray(tlRes.data.data)) {
          const map: Record<number, TimelineItem[]> = {};
          for (const entry of tlRes.data.data as { week: number; items: TimelineItem[] }[]) {
            const imgs = entry.items.filter((it) => it.source === 'record' && it.mediaUri);
            if (imgs.length > 0) map[entry.week] = imgs;
          }
          setImagesByWeek(map);
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedChild?.id]);

  // Auto-expand and scroll to current week after data loads
  useEffect(() => {
    if (weeks.length > 0 && currentWeek > 0) {
      setExpandedWeek(currentWeek);
      // Scroll after layout
      setTimeout(() => {
        const y = weekPositions.current[currentWeek];
        if (y != null && scrollRef.current) {
          // This scrollRef won't work since parent ScrollView owns scrolling.
          // We'll use the onLayout to at least highlight the current week.
        }
      }, 500);
    }
  }, [weeks.length, currentWeek]);

  const handleWeekLayout = useCallback((week: number, e: LayoutChangeEvent) => {
    weekPositions.current[week] = e.nativeEvent.layout.y;
  }, []);

  if (weeks.length === 0) {
    return null;
  }

  // Find closest week data to currentWeek
  const currentDev = weeks.find((w) => w.week === currentWeek)
    ?? weeks.reduce((prev, curr) =>
      Math.abs(curr.week - currentWeek) < Math.abs(prev.week - currentWeek) ? curr : prev,
    );

  // Pre-compute trimester separators — show current week and future only
  const visibleWeeks = currentWeek > 0
    ? weeks.filter((w) => w.week >= currentWeek)
    : weeks;
  const weekItems = visibleWeeks.map((dev, idx) => {
    const tri = getTrimesterInfo(dev.week, t);
    const prevTri = idx > 0 ? getTrimesterInfo(visibleWeeks[idx - 1].week, t) : null;
    return { dev, showTrimester: !prevTri || prevTri.label !== tri.label, trimester: tri };
  });

  return (
    <View>
      {/* 의료 disclaimer — 약물·증상·응급 신호 안내 시 의료기기성 위험 회피 (App Store/Play Store 심사) */}
      <View style={pwStyles.disclaimerCard}>
        <Text style={pwStyles.disclaimerText}>
          {t('growthStats.medicalDisclaimer')}
        </Text>
      </View>

      {/* Current Week Summary Card */}
      {currentWeek > 0 && currentDev && (
        <View style={[pwStyles.currentCard, { backgroundColor: '#FF8C94' }]}>
          <Text style={pwStyles.currentLabel}>{t('growthStats.currentlyPregnant')}</Text>
          <Text style={pwStyles.currentWeekText}>{t('growthStats.weekNumber', { week: currentWeek })}</Text>
          <Text style={pwStyles.currentSize}>
            {SIZE_EMOJI[currentDev.sizeKey] ?? '🤰'} {t('growthStats.sizeOf', { size: currentDev.size })}
          </Text>
          <Text style={pwStyles.currentMeasure}>
            {currentDev.length} / {currentDev.weight}
          </Text>
        </View>
      )}

      {/* D-Day 카드 */}
      {dDay !== null && (
        <View style={pwStyles.dDayCard}>
          <View style={pwStyles.dDayLeft}>
            <Text style={pwStyles.dDayLabel}>{t('growthStats.daysUntilDueDate')}</Text>
            <Text style={pwStyles.dDayValue}>
              {dDay > 0 ? `D-${dDay}` : dDay === 0 ? 'D-Day!' : `D+${Math.abs(dDay)}`}
            </Text>
            <Text style={pwStyles.dDayHint}>{t('growthStats.dDayHint')}</Text>
          </View>
          <View style={pwStyles.dDayRight}>
            <Text style={pwStyles.dDayDate}>
              {selectedChild?.dueDate ? new Date(selectedChild.dueDate).toLocaleDateString('ko-KR') : ''}
            </Text>
          </View>
        </View>
      )}

      {/* 이번 주 할 일 / 검사 */}
      {weeklyTasks.length > 0 && (
        <View style={pwStyles.tasksCard}>
          <Text style={pwStyles.tasksTitle}>{t('growthStats.weeklyTasksTitle')}</Text>
          {weeklyTasks.map((task, i) => (
            <View key={`${task.type}-${i}`} style={pwStyles.taskRow}>
              <Text style={pwStyles.taskEmoji}>{task.emoji}</Text>
              <Text style={pwStyles.taskText}>{task.title}</Text>
              <View style={[
                pwStyles.taskBadge,
                task.type === 'exam' ? { backgroundColor: '#FCE4EC' } : { backgroundColor: '#E3F2FD' },
              ]}>
                <Text style={[
                  pwStyles.taskBadgeText,
                  task.type === 'exam' ? { color: '#C2185B' } : { color: '#1565C0' },
                ]}>
                  {task.type === 'exam' ? t('growthStats.taskTypeExam') : t('growthStats.taskTypeTodo')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 금기 검색 버튼 */}
      <TouchableOpacity style={pwStyles.safetyBtn} onPress={() => setShowSafetyModal(true)}>
        <Text style={pwStyles.safetyBtnEmoji}>🔍</Text>
        <View style={{ flex: 1 }}>
          <Text style={pwStyles.safetyBtnTitle}>{t('growthStats.safetySearchTitle')}</Text>
          <Text style={pwStyles.safetyBtnSub}>{t('growthStats.safetySearchSub')}</Text>
        </View>
        <Text style={pwStyles.safetyBtnArrow}>{'>'}</Text>
      </TouchableOpacity>

      {/* Week Cards */}
      {weekItems.map(({ dev, showTrimester, trimester }) => {
        const isCurrent = dev.week === currentDev?.week;
        const isFuture = dev.week > currentWeek;
        const isExpanded = expandedWeek === dev.week;
        const emoji = SIZE_EMOJI[dev.sizeKey] ?? '🤰';
        const imgs = imagesByWeek[dev.week] ?? [];

        return (
          <View key={dev.week} onLayout={(e) => handleWeekLayout(dev.week, e)}>
            {showTrimester && (
              <View style={[pwStyles.trimesterBar, { backgroundColor: trimester.color }]}>
                <Text style={[pwStyles.trimesterText, { color: trimester.textColor }]}>
                  {trimester.label}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                pwStyles.weekCard,
                isCurrent && pwStyles.weekCardCurrent,
                isFuture && pwStyles.weekCardFuture,
              ]}
              onPress={() => setExpandedWeek(isExpanded ? null : dev.week)}
              activeOpacity={0.7}
            >
              {/* Header row */}
              <View style={pwStyles.weekHeader}>
                <Text style={pwStyles.weekEmoji}>{emoji}</Text>
                <View style={pwStyles.weekMeta}>
                  <View style={pwStyles.weekLabelRow}>
                    <Text style={[pwStyles.weekNum, isCurrent && pwStyles.weekNumCurrent]}>
                      {t('growthStats.weekLabel', { week: dev.week })}
                    </Text>
                    {isCurrent && (
                      <View style={pwStyles.nowBadge}>
                        <Text style={pwStyles.nowBadgeText}>NOW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={pwStyles.weekSizeText}>{t('growthStats.sizeOf', { size: dev.size })}</Text>
                  <Text style={pwStyles.weekMeasure}>{dev.length} / {dev.weight}</Text>
                </View>
                <Text style={pwStyles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
              </View>

              {/* Expanded content */}
              {isExpanded && (
                <View style={pwStyles.expandedBox}>
                  {/* 오늘의 흥미 사실 — 가장 위에 (가벼운 톤) */}
                  {dev.dailyFact && (
                    <View style={pwStyles.factBox}>
                      <Text style={pwStyles.factEmoji}>{'💡'}</Text>
                      <Text style={pwStyles.factText}>{dev.dailyFact}</Text>
                    </View>
                  )}

                  {/* Features — 아기 발달 */}
                  <View style={pwStyles.featBox}>
                    <Text style={pwStyles.featTitle}>{t('growthStats.featTitle')}</Text>
                    {dev.features.map((f, i) => (
                      <View key={i} style={pwStyles.featRow}>
                        <Text style={pwStyles.featDot}>{'•'}</Text>
                        <Text style={pwStyles.featText}>{f}</Text>
                      </View>
                    ))}
                  </View>

                  {/* 엄마 몸 변화 */}
                  {dev.momChange && (
                    <View style={pwStyles.momChangeBox}>
                      <Text style={pwStyles.subSectionTitle}>{t('growthStats.momChangeTitle')}</Text>
                      <Text style={pwStyles.subSectionText}>{dev.momChange}</Text>
                    </View>
                  )}

                  {/* 추천 음식·영양 */}
                  {dev.foodTip && (
                    <View style={pwStyles.foodTipBox}>
                      <Text style={pwStyles.subSectionTitle}>{t('growthStats.foodTipTitle')}</Text>
                      <Text style={pwStyles.subSectionText}>{dev.foodTip}</Text>
                    </View>
                  )}

                  {/* 주의사항 */}
                  {dev.caution && (
                    <View style={pwStyles.cautionBox}>
                      <Text style={pwStyles.cautionTitle}>{t('growthStats.cautionTitle')}</Text>
                      <Text style={pwStyles.cautionText}>{dev.caution}</Text>
                    </View>
                  )}

                  {/* Mom tip */}
                  <View style={pwStyles.momTipBox}>
                    <Image source={IC_THINKING} style={pwStyles.momTipIconImg} resizeMode="contain" />
                    <Text style={pwStyles.momTipText}>{dev.momTip}</Text>
                  </View>

                  {/* User images for this week */}
                  {imgs.length > 0 && (
                    <View style={pwStyles.imgSection}>
                      <View style={pwStyles.imgTitleRow}>
                        <Image source={IC_CAMERA} style={pwStyles.imgTitleIconImg} resizeMode="contain" />
                        <Text style={pwStyles.imgTitle}>{t('growthStats.weekPhotosTitle')}</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pwStyles.imgScroll}>
                        {imgs.map((img) => (
                          <Image
                            key={img.id}
                            source={{ uri: img.mediaUri }}
                            style={pwStyles.imgThumb}
                            resizeMode="cover"
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Bottom hint */}
      <View style={pwStyles.bottomHint}>
        <Text style={pwStyles.bottomHintText}>
          {t('growthStats.bottomHint')}
        </Text>
      </View>

      {/* 금기 검색 Modal */}
      <Modal visible={showSafetyModal} animationType="slide" transparent onRequestClose={() => setShowSafetyModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={pwStyles.safetyModalOverlay}>
            <View style={pwStyles.safetyModalCard}>
              <View style={pwStyles.safetyModalHeader}>
                <TouchableOpacity
                  onPress={() => { setShowSafetyModal(false); setSafetyResult(null); setSafetyQuery(''); }}
                >
                  <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.md, fontWeight: '600' }}>{`< ${t('common.close')}`}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text }}>{t('growthStats.safetySearchTitle')}</Text>
                <View style={{ width: 50 }} />
              </View>

              <View style={pwStyles.safetyInputRow}>
                <TextInput
                  style={pwStyles.safetyInput}
                  placeholder={t('growthStats.safetySearchPlaceholder')}
                  placeholderTextColor={COLORS.textLight}
                  value={safetyQuery}
                  onChangeText={setSafetyQuery}
                  onSubmitEditing={handleSafetyCheck}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={[pwStyles.safetyGoBtn, safetyLoading && { opacity: 0.5 }]}
                  onPress={handleSafetyCheck}
                  disabled={safetyLoading || safetyQuery.trim().length === 0}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{t('growthStats.safetySearchButton')}</Text>
                </TouchableOpacity>
              </View>

              {safetyLoading && (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={{ marginTop: SPACING.md, color: COLORS.textSecondary }}>{t('growthStats.safetyAnalyzing')}</Text>
                </View>
              )}

              {safetyResult && !safetyLoading && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={[
                    pwStyles.safetyResultCard,
                    safetyResult.level === 'safe' && { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
                    safetyResult.level === 'caution' && { backgroundColor: '#FFF8E1', borderColor: '#FFA726' },
                    safetyResult.level === 'avoid' && { backgroundColor: '#FFEBEE', borderColor: '#E53935' },
                  ]}>
                    <Text style={pwStyles.safetyLevelBadge}>
                      {safetyResult.level === 'safe' ? t('growthStats.safetyLevelSafe') : safetyResult.level === 'caution' ? t('growthStats.safetyLevelCaution') : t('growthStats.safetyLevelAvoid')}
                    </Text>
                    <Text style={pwStyles.safetyResultTitle}>{safetyResult.title}</Text>
                    <Text style={pwStyles.safetyResultSummary}>{safetyResult.summary}</Text>
                  </View>

                  {safetyResult.dos.length > 0 && (
                    <View style={pwStyles.safetyListCard}>
                      <Text style={[pwStyles.safetyListTitle, { color: '#2E7D32' }]}>{t('growthStats.safetyDosTitle')}</Text>
                      {safetyResult.dos.map((d, i) => (
                        <Text key={i} style={pwStyles.safetyListItem}>• {d}</Text>
                      ))}
                    </View>
                  )}

                  {safetyResult.donts.length > 0 && (
                    <View style={pwStyles.safetyListCard}>
                      <Text style={[pwStyles.safetyListTitle, { color: '#C62828' }]}>{t('growthStats.safetyDontsTitle')}</Text>
                      {safetyResult.donts.map((d, i) => (
                        <Text key={i} style={pwStyles.safetyListItem}>• {d}</Text>
                      ))}
                    </View>
                  )}

                  {safetyResult.disclaimer && (
                    <Text style={pwStyles.safetyDisclaimer}>{safetyResult.disclaimer}</Text>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const pwStyles = StyleSheet.create({
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  loadingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  currentCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  currentLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  currentWeekText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  currentSize: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  currentMeasure: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  trimesterBar: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  trimesterText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  weekCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.soft,
  },
  weekCardCurrent: {
    borderWidth: 2,
    borderColor: '#FF8C94',
    backgroundColor: '#FFF5F5',
  },
  weekCardFuture: {
    opacity: 0.6,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekEmoji: {
    fontSize: 36,
    marginRight: SPACING.md,
  },
  weekMeta: {
    flex: 1,
  },
  weekLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekNum: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  weekNumCurrent: {
    color: '#FF8C94',
  },
  nowBadge: {
    backgroundColor: '#FF8C94',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nowBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  weekSizeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  weekMeasure: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
  expandIcon: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: SPACING.sm,
  },
  expandedBox: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.md,
  },
  featBox: {
    marginBottom: SPACING.md,
  },
  featTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  featRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 4,
  },
  featDot: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    marginRight: 6,
    lineHeight: 20,
  },
  featText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  momTipBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8F0',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    gap: 8,
    marginBottom: SPACING.sm,
  },
  momTipIcon: {
    fontSize: 16,
  },
  momTipIconImg: { width: 18, height: 18 },
  momTipText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: '#8B6914',
    lineHeight: 20,
  },
  // 의료 disclaimer — 화면 상단 고정 안내
  disclaimerCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: '#F57C00',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#5D4037',
    lineHeight: 16,
  },

  // ─── 새 컨텐츠 카드들 (3분기 풍부화) ───
  factBox: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    gap: 8,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#43A047',
  },
  factEmoji: { fontSize: 16 },
  factText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: '#2E7D32',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  momChangeBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  foodTipBox: {
    backgroundColor: '#F3E5F5',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cautionBox: {
    backgroundColor: '#FFEBEE',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#C62828',
  },
  cautionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 4,
  },
  cautionText: {
    fontSize: FONT_SIZE.sm,
    color: '#B71C1C',
    lineHeight: 20,
  },
  subSectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  subSectionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  imgSection: {
    marginTop: SPACING.sm,
  },
  imgTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  imgTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  imgTitleIconImg: { width: 16, height: 16 },
  imgScroll: {
    marginBottom: 4,
  },
  imgThumb: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
  },
  bottomHint: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  bottomHintText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    textAlign: 'center',
  },

  /* D-Day 카드 */
  dDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FCE4EC',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  dDayLeft: { flex: 1 },
  dDayLabel: { fontSize: FONT_SIZE.sm, color: '#880E4F', marginBottom: 4 },
  dDayValue: { fontSize: 32, fontWeight: '700', color: '#C2185B' },
  dDayRight: { alignItems: 'flex-end' },
  dDayDate: { fontSize: FONT_SIZE.sm, color: '#880E4F', fontWeight: '600' },
  dDayHint: { fontSize: FONT_SIZE.xs, color: '#AD1457', marginTop: 6, lineHeight: 16 },

  /* 이번 주 할 일 */
  tasksCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  tasksTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  taskEmoji: { fontSize: 18 },
  taskText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text },
  taskBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  taskBadgeText: { fontSize: 11, fontWeight: '600' },

  /* 금기 검색 버튼 */
  safetyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: 12,
  },
  safetyBtnEmoji: { fontSize: 24 },
  safetyBtnTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#6A1B9A' },
  safetyBtnSub: { fontSize: FONT_SIZE.xs, color: '#8E24AA', marginTop: 2 },
  safetyBtnArrow: { fontSize: 18, color: '#8E24AA', fontWeight: '700' },

  /* 금기 검색 Modal */
  safetyModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  safetyModalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.lg, maxHeight: '90%',
  },
  safetyModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  safetyInputRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  safetyInput: {
    flex: 1,
    backgroundColor: '#F8F5F2',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  safetyGoBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  safetyResultCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  safetyLevelBadge: { fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: SPACING.sm },
  safetyResultTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  safetyResultSummary: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
  safetyListCard: {
    backgroundColor: '#F5F0EB',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  safetyListTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: SPACING.sm },
  safetyListItem: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 22, marginBottom: 2 },
  safetyDisclaimer: {
    fontSize: FONT_SIZE.xs, color: COLORS.textLight, textAlign: 'center',
    marginVertical: SPACING.md, paddingHorizontal: SPACING.md, lineHeight: 16,
  },
});

/* ---- End Pregnancy Weekly Development ---- */

function FilterTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}) {
  const { t } = useTranslation();
  const tabs = getTabs(t);
  return (
    <View style={styles.tabsRow}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.key)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ---- Growth Analysis Section ---- */

function GrowthAnalysisSection({ childId }: { childId: string }) {
  const { t, i18n } = useTranslation();
  // 백엔드가 한국어 고정 문자열로 내려주는 분석 텍스트를 표시 시점에 번역
  const gaT = useMemo(() => createGrowthAnalysisTranslator(t, i18n), [t, i18n]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GrowthAnalysisResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const startLoadingAnimation = useCallback(() => {
    // 가짜 진행률 시뮬레이션 제거(rule #4) — 실제 단계 정보가 없으므로
    // 무한(indeterminate) 스피너만 사용한다.
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => {
      spin.stop();
    };
  }, [spinAnim]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setShowModal(true);

    const cleanup = startLoadingAnimation();

    try {
      const res = await growthApi.analysis(childId);
      const raw: unknown = res.data?.data;
      const parsed = parseGrowthAnalysis(raw);

      if (!parsed) {
        setError(t('growthStats.analysisParseFail'));
        return;
      }

      setResult(parsed);
    } catch {
      setError(t('growthStats.analysisRequestFail'));
    } finally {
      cleanup();
      setLoading(false);
    }
  };

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const allMetrics = [
    ...(result?.growthMetrics ?? []),
    ...(result?.trackerMetrics ?? []),
  ];

  return (
    <>
      {/* Analysis Button */}
      <TouchableOpacity
        style={gaStyles.analyzeBtn}
        onPress={handleAnalyze}
        activeOpacity={0.8}
      >
        <View style={[gaStyles.analyzeBtnGradient, { backgroundColor: '#4ECDC4' }]}>
          <Image source={require('../../assets/quick-report.png')} style={gaStyles.analyzeBtnImg} resizeMode="contain" />
          <Text style={gaStyles.analyzeBtnText}>{t('growthStats.analyzeBtn')}</Text>
        </View>
      </TouchableOpacity>

      {/* Analysis Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (!loading) setShowModal(false);
        }}
      >
        <View style={gaStyles.modalContainer}>
          {/* Header */}
          <View style={gaStyles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                if (!loading) setShowModal(false);
              }}
              disabled={loading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={[gaStyles.modalClose, loading && { opacity: 0.3 }]}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={gaStyles.modalTitle}>{t('growthStats.analysisModalTitle')}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={gaStyles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Loading State */}
            {loading && (
              <View style={gaStyles.loadingWrap}>
                <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
                  <Image source={IC_REPORT} style={gaStyles.loadingSpinnerImg} resizeMode="contain" />
                </Animated.View>
                <Text style={gaStyles.loadingTitle}>
                  {t('growthStats.analysisLoadingTitle')}
                </Text>
                <Text style={gaStyles.loadingSubtitle}>
                  {t('growthStats.analysisLoadingSubtitle')}
                </Text>
              </View>
            )}

            {/* Error State */}
            {!loading && error && (
              <View style={gaStyles.errorWrap}>
                <Image source={IC_REDFLAG} style={gaStyles.errorIconImg} resizeMode="contain" />
                <Text style={gaStyles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={gaStyles.retryBtn}
                  onPress={handleAnalyze}
                >
                  <Text style={gaStyles.retryBtnText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Result State */}
            {!loading && !error && result && (
              <View>
                {/* Overall Summary */}
                <View style={[gaStyles.summaryCard, { backgroundColor: '#F4A98C' }]}>
                  {result.ageLabel ? (
                    <Text style={gaStyles.summaryAge}>{gaT.ageLabel(result.ageLabel, result.childMonths)}</Text>
                  ) : null}
                  <Text style={gaStyles.summaryTitle}>{t('growthStats.overallAnalysisTitle')}</Text>
                  <Text style={gaStyles.summaryText}>{gaT.overallSummary(result.overallSummary)}</Text>
                </View>

                {/* Metrics */}
                {allMetrics.length > 0 && (
                  <View>
                    <Text style={gaStyles.sectionTitle}>{t('growthStats.detailItemsTitle')}</Text>
                    {allMetrics.map((item, idx) => {
                      const levelColor = getLevelColor(item.level);
                      return (
                        <View key={`${item.metric}-${idx}`} style={gaStyles.metricCard}>
                          {/* Metric Header */}
                          <View style={gaStyles.metricHeader}>
                            <Text style={gaStyles.metricEmoji}>{item.emoji}</Text>
                            <View style={gaStyles.metricTitleWrap}>
                              <Text style={gaStyles.metricTitle}>
                                {gaT.field(item.metric, item.level, 'title', item.title)}
                              </Text>
                              {item.percentileLabel ? (
                                <Text style={gaStyles.metricPercentile}>
                                  {gaT.percentileLabel(item.metric, item.level, item.percentile, item.percentileLabel)}
                                </Text>
                              ) : null}
                            </View>
                            <View style={[gaStyles.levelBadge, { backgroundColor: levelColor.bg }]}>
                              <Text style={[gaStyles.levelBadgeText, { color: levelColor.text }]}>
                                {getLevelLabel(item.level, t)}
                              </Text>
                            </View>
                          </View>
                          {/* Comment */}
                          <Text style={gaStyles.metricComment}>
                            {gaT.field(item.metric, item.level, 'comment', item.comment)}
                          </Text>
                          {/* Advice */}
                          <View style={gaStyles.adviceBox}>
                            <Image source={IC_THINKING} style={gaStyles.adviceIconImg} resizeMode="contain" />
                            <Text style={gaStyles.adviceText}>
                              {gaT.field(item.metric, item.level, 'advice', item.advice)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const gaStyles = StyleSheet.create({
  analyzeBtn: {
    marginBottom: SPACING.md,
  },
  analyzeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    gap: SPACING.sm,
  },
  analyzeBtnIcon: {
    fontSize: 20,
  },
  analyzeBtnImg: {
    width: 22,
    height: 22,
  },
  analyzeBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    ...SHADOWS.soft,
  },
  modalClose: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
    paddingRight: SPACING.sm,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  /* Loading */
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  loadingSpinner: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  loadingSpinnerImg: { width: 56, height: 56, marginBottom: SPACING.lg },
  loadingTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  loadingSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  progressBarBg: {
    width: '80%',
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  /* Error */
  errorWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  errorIconImg: { width: 56, height: 56, marginBottom: SPACING.md },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  /* Summary */
  summaryCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  summaryAge: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
  },
  summaryText: {
    fontSize: FONT_SIZE.sm,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  /* Section */
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  /* Metric Card */
  metricCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  metricEmoji: {
    fontSize: 28,
    marginRight: SPACING.sm,
  },
  metricTitleWrap: {
    flex: 1,
  },
  metricTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  metricPercentile: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  levelBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  metricComment: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  adviceBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  adviceIcon: {
    fontSize: 16,
  },
  adviceIconImg: { width: 18, height: 18 },
  adviceText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

/** 성장기록 첫 기록 날짜 = 아이 등록일(createdAt) YYYY-MM-DD. 생일 아님.
 *  createdAt 이 아직 없으면(리페치 전/구 데이터) '' 반환 → 편입 보류(잘못된 날짜 편입 방지). */
function growthRegDate(child: { createdAt?: string | null } | null): string {
  const c = child?.createdAt ? String(child.createdAt).slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(c) ? c : '';
}

function PhysicalTab({ childName }: { childName: string }) {
  const { t } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const updateChildInStore = useChildStore((s) => s.updateChild);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [recordDate, setRecordDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<{ date: string; height?: number; weight?: number }[]>([]);
  // 수정 중인 기록의 원래 날짜(날짜를 바꿔 저장해도 원본이 중복 안 되게)
  const [editingDate, setEditingDate] = useState<string | null>(null);

  const initialHeight = selectedChild?.height ?? null;
  const initialWeight = selectedChild?.weight ?? null;
  const ageMonths = selectedChild?.ageInfo.months ?? 0;
  const rawGender = selectedChild?.gender ?? 'M';
  const gender = rawGender === 'U' ? 'M' : rawGender;
  const ageLabel = selectedChild?.ageInfo.label ?? '';

  // 로컬 기록 로드 + 온보딩(등록 시) 키/몸무게를 "등록일" 기록으로 1회 편입
  // (기존엔 차트에서 온보딩 값이 '생일'로 잘못 찍히던 버그 → 등록일로 교정. 편입 후엔 일반 기록이라 수정/삭제 가능.)
  useEffect(() => {
    if (!selectedChild) return;
    const child = selectedChild;
    const loadRecords = async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const key = `growth_records_${child.id}`;
        const stored = await AsyncStorage.getItem(key);
        let recs = stored ? (JSON.parse(stored) as typeof records) : [];

        const iH = child.height ?? null;
        const iW = child.weight ?? null;
        const seededKey = `growth_seeded_${child.id}`;
        const alreadySeeded = await AsyncStorage.getItem(seededKey);
        const regDate = growthRegDate(child);
        // regDate(등록일)가 확보됐을 때만 편입 + 완료 플래그. 없으면 보류하고 다음 진입 때 재시도
        // (그동안 온보딩 값은 '첫 기록' 카드로 계속 보임 → 정보 손실 없음)
        if (!alreadySeeded && regDate && (iH != null || iW != null)) {
          if (!recs.some((r) => r.date === regDate)) {
            recs = [...recs, { date: regDate, height: iH ?? undefined, weight: iW ?? undefined }]
              .sort((a, b) => a.date.localeCompare(b.date));
            await AsyncStorage.setItem(key, JSON.stringify(recs));
          }
          await AsyncStorage.setItem(seededKey, '1'); // 1회만 — 이후 사용자가 지워도 재편입 안 함
        }
        setRecords(recs);
      } catch { /* ignore */ }
    };
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id]);

  const standard = useMemo(
    () => getClosestStandard(ageMonths, gender),
    [ageMonths, gender],
  );

  const heightPercentile = useMemo(() => {
    if (!initialHeight || !standard) return null;
    return calculatePercentile(initialHeight, standard.height);
  }, [initialHeight, standard]);

  const weightPercentile = useMemo(() => {
    if (!initialWeight || !standard) return null;
    return calculatePercentile(initialWeight, standard.weight);
  }, [initialWeight, standard]);

  const genderLabel = gender === 'M' ? t('growthStats.genderBoy') : t('growthStats.genderGirl');

  const handleSave = async () => {
    if (!height && !weight) {
      Alert.alert(t('common.notice'), t('growthStats.heightWeightRequired'));
      return;
    }
    if (!selectedChild) return;
    // 공동육아: 성장 기록 저장은 editProfile 권한 필요 (열람 전용 멤버 차단)
    if (!(await canDo(selectedChild.id, 'editProfile'))) {
      Alert.alert(t('growthStats.viewOnlyTitle'), t('growthStats.viewOnlyMessage'));
      return;
    }
    setSaving(true);
    try {
      const parsedHeight = height ? parseFloat(height) : undefined;
      const parsedWeight = weight ? parseFloat(weight) : undefined;
      const newRecord = {
        date: recordDate,
        height: parsedHeight,
        weight: parsedWeight,
      };
      const updated = [...records.filter((r) => r.date !== recordDate && r.date !== editingDate), newRecord].sort(
        (a, b) => a.date.localeCompare(b.date),
      );
      setRecords(updated);
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(`growth_records_${selectedChild.id}`, JSON.stringify(updated));
      // 서버에도 싱크 (fire-and-forget)
      growthApi.update(selectedChild.id, {
        date: recordDate,
        height: parsedHeight,
        weight: parsedWeight,
      }).catch(() => { /* 서버 싱크 실패해도 로컬은 유지 */ });
      // 스토어 갱신 — 최신 기록이면 selectedChild.height/weight 도 업데이트
      const latest = updated[updated.length - 1];
      if (latest && latest.date === recordDate) {
        updateChildInStore({
          ...selectedChild,
          height: parsedHeight ?? selectedChild.height ?? null,
          weight: parsedWeight ?? selectedChild.weight ?? null,
        });
      }
      Alert.alert(t('growthStats.saveCompleteTitle'), t('growthStats.saveCompleteMessage', { date: recordDate }));
      setHeight('');
      setWeight('');
      setEditingDate(null);
    } catch {
      Alert.alert(t('common.error'), t('growthStats.saveFailMessage'));
    } finally {
      setSaving(false);
    }
  };

  // 기록 수정 — 값/날짜를 입력 폼으로 불러오고, 저장 시 원본을 대체(editingDate 로 중복 방지)
  const startEdit = (rec: { date: string; height?: number; weight?: number }) => {
    setEditingDate(rec.date);
    setRecordDate(rec.date);
    setHeight(rec.height != null ? String(rec.height) : '');
    setWeight(rec.weight != null ? String(rec.weight) : '');
  };

  // 기록 삭제 — 로컬 records 에서 제거 후 최신값 재계산, 서버/스토어 동기화
  const handleDelete = (date: string) => {
    if (!selectedChild) return;
    Alert.alert(
      t('growthStats.deleteConfirmTitle'),
      t('growthStats.deleteConfirmMessage', { date }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (!(await canDo(selectedChild.id, 'editProfile'))) {
              Alert.alert(t('growthStats.viewOnlyTitle'), t('growthStats.viewOnlyMessage'));
              return;
            }
            const updated = records.filter((r) => r.date !== date);
            setRecords(updated);
            try {
              const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
              await AsyncStorage.setItem(`growth_records_${selectedChild.id}`, JSON.stringify(updated));
            } catch { /* 로컬 저장 실패해도 화면 상태는 반영됨 */ }
            // 최신 기록으로 selectedChild 키/몸무게 갱신(서버는 best-effort)
            const latest = updated[updated.length - 1];
            updateChildInStore({
              ...selectedChild,
              height: latest?.height ?? selectedChild.height ?? null,
              weight: latest?.weight ?? selectedChild.weight ?? null,
            });
            if (latest && (latest.height != null || latest.weight != null)) {
              growthApi.update(selectedChild.id, {
                date: latest.date,
                height: latest.height,
                weight: latest.weight,
              }).catch(() => { /* ignore */ });
            }
            // 수정 중이던 기록을 지웠으면 폼 초기화
            if (editingDate === date) { setEditingDate(null); setHeight(''); setWeight(''); }
          },
        },
      ],
    );
  };

  return (
    <View>
      {/* Initial record from onboarding */}
      {(initialHeight || initialWeight) ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('growthStats.firstRecordTitle', { ageLabel })}</Text>
          <View style={styles.statsRow}>
            <StatBox
              label={t('growthStats.heightLabel')}
              value={initialHeight ? `${initialHeight}cm` : '-- cm'}
              color={COLORS.secondary}
            />
            <StatBox
              label={t('growthStats.weightLabel')}
              value={initialWeight ? `${initialWeight}kg` : '-- kg'}
              color={COLORS.primary}
            />
          </View>

          {/* Percentile display */}
          {(heightPercentile !== null || weightPercentile !== null) ? (
            <View style={pStyles.percentileWrap}>
              <Text style={pStyles.percentileHeader}>
                {t('growthStats.percentileHeader', { genderLabel })}
              </Text>
              {heightPercentile !== null && initialHeight ? (
                <View style={pStyles.percentileRow}>
                  <View style={pStyles.percentileTop}>
                    <Text style={pStyles.percentileLabel}>{t('growthStats.heightLabel')}</Text>
                    <Text style={pStyles.percentileValue}>
                      {getPercentileLabel(heightPercentile, t)}
                    </Text>
                  </View>
                  <View style={pStyles.barBg}>
                    <View
                      style={[
                        pStyles.barFill,
                        { width: `${Math.max(5, 100 - heightPercentile)}%` },
                      ]}
                    />
                  </View>
                </View>
              ) : null}
              {weightPercentile !== null && initialWeight ? (
                <View style={pStyles.percentileRow}>
                  <View style={pStyles.percentileTop}>
                    <Text style={pStyles.percentileLabel}>{t('growthStats.weightLabel')}</Text>
                    <Text style={pStyles.percentileValue}>
                      {getPercentileLabel(weightPercentile, t)}
                    </Text>
                  </View>
                  <View style={pStyles.barBg}>
                    <View
                      style={[
                        pStyles.barFill,
                        { width: `${Math.max(5, 100 - weightPercentile)}%`, backgroundColor: COLORS.primary },
                      ]}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Growth Analysis Button */}
      {selectedChild ? (
        <GrowthAnalysisSection childId={selectedChild.id} />
      ) : null}

      {(() => {
        // 성장 기록은 records(로컬)만 사용 — 온보딩(등록 시) 값은 로드 시 "등록일" 기록으로 편입됨.
        // (기존엔 여기서 생일 날짜로 강제 삽입해 차트가 태어난날로 찍히던 버그를 제거)
        const merged: { date: string; height?: number; weight?: number }[] =
          [...records].sort((a, b) => a.date.localeCompare(b.date));
        const latest = merged[merged.length - 1];
        const latestHeight = latest?.height ?? initialHeight;
        const latestWeight = latest?.weight ?? initialWeight;

        // 최신 기록 시점의 또래 비교 (percentile)
        // standard는 현재 개월수 기준이므로 동일 standard 사용 (첫 기록 카드와 동일 정책)
        const latestHeightPercentile = latestHeight && standard
          ? calculatePercentile(latestHeight, standard.height)
          : null;
        const latestWeightPercentile = latestWeight && standard
          ? calculatePercentile(latestWeight, standard.weight)
          : null;

        const chartW = Dimensions.get('window').width - SPACING.md * 2 - SPACING.lg * 2;
        const heightPoints = merged.filter((r) => typeof r.height === 'number').map((r) => r.height as number);
        const weightPoints = merged.filter((r) => typeof r.weight === 'number').map((r) => r.weight as number);
        const hasChart = heightPoints.length > 0 || weightPoints.length > 0;

        return (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('growthStats.heightWeightChangeTitle')}</Text>
              {hasChart ? (
                <View style={{ marginTop: SPACING.xs }}>
                  {heightPoints.length > 0 && (
                    <LineChart
                      data={{
                        labels: merged.filter((r) => typeof r.height === 'number').map((r) => {
                          const d = new Date(r.date);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }),
                        datasets: [{ data: heightPoints.length === 1 ? [heightPoints[0], heightPoints[0]] : heightPoints }],
                      }}
                      width={chartW}
                      height={180}
                      yAxisSuffix="cm"
                      chartConfig={{
                        backgroundColor: '#FFFFFF',
                        backgroundGradientFrom: '#FFFFFF',
                        backgroundGradientTo: '#FFFFFF',
                        decimalPlaces: 1,
                        color: (opacity = 1) => `rgba(76, 175, 174, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(60, 60, 60, ${opacity})`,
                        propsForDots: { r: '4', strokeWidth: '2', stroke: String(COLORS.secondary) },
                      }}
                      bezier
                      withInnerLines={false}
                      style={{ borderRadius: RADIUS.md, marginLeft: -SPACING.xs }}
                    />
                  )}
                  {weightPoints.length > 0 && (
                    <LineChart
                      data={{
                        labels: merged.filter((r) => typeof r.weight === 'number').map((r) => {
                          const d = new Date(r.date);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }),
                        datasets: [{ data: weightPoints.length === 1 ? [weightPoints[0], weightPoints[0]] : weightPoints }],
                      }}
                      width={chartW}
                      height={180}
                      yAxisSuffix="kg"
                      chartConfig={{
                        backgroundColor: '#FFFFFF',
                        backgroundGradientFrom: '#FFFFFF',
                        backgroundGradientTo: '#FFFFFF',
                        decimalPlaces: 1,
                        color: (opacity = 1) => `rgba(255, 140, 90, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(60, 60, 60, ${opacity})`,
                        propsForDots: { r: '4', strokeWidth: '2', stroke: String(COLORS.primary) },
                      }}
                      bezier
                      withInnerLines={false}
                      style={{ marginTop: SPACING.sm, borderRadius: RADIUS.md, marginLeft: -SPACING.xs }}
                    />
                  )}
                </View>
              ) : (
                <View style={styles.chartPlaceholder}>
                  <Image source={IC_REPORT} style={styles.chartIconImg} resizeMode="contain" />
                  <Text style={styles.chartPlaceholderText}>
                    {t('growthStats.chartPlaceholder')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {latest?.date
                  ? t('growthStats.latestRecordTitleWithDate', { date: latest.date })
                  : t('growthStats.latestRecordTitle')}
              </Text>
              <View style={styles.statsRow}>
                <StatBox
                  label={t('growthStats.heightLabel')}
                  value={latestHeight ? `${latestHeight}cm` : '-- cm'}
                  color={COLORS.secondary}
                />
                <StatBox
                  label={t('growthStats.weightLabel')}
                  value={latestWeight ? `${latestWeight}kg` : '-- kg'}
                  color={COLORS.primary}
                />
                <StatBox label={t('growthStats.recordCountLabel')} value={String(merged.length)} color={COLORS.info} />
              </View>

              {/* Percentile display — 최신 기록 시점의 또래 비교 */}
              {(latestHeightPercentile !== null || latestWeightPercentile !== null) ? (
                <View style={pStyles.percentileWrap}>
                  <Text style={pStyles.percentileHeader}>
                    {t('growthStats.percentileHeader', { genderLabel })}
                  </Text>
                  {latestHeightPercentile !== null && latestHeight ? (
                    <View style={pStyles.percentileRow}>
                      <View style={pStyles.percentileTop}>
                        <Text style={pStyles.percentileLabel}>{t('growthStats.heightLabel')}</Text>
                        <Text style={pStyles.percentileValue}>
                          {getPercentileLabel(latestHeightPercentile, t)}
                        </Text>
                      </View>
                      <View style={pStyles.barBg}>
                        <View
                          style={[
                            pStyles.barFill,
                            { width: `${Math.max(5, 100 - latestHeightPercentile)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  ) : null}
                  {latestWeightPercentile !== null && latestWeight ? (
                    <View style={pStyles.percentileRow}>
                      <View style={pStyles.percentileTop}>
                        <Text style={pStyles.percentileLabel}>{t('growthStats.weightLabel')}</Text>
                        <Text style={pStyles.percentileValue}>
                          {getPercentileLabel(latestWeightPercentile, t)}
                        </Text>
                      </View>
                      <View style={pStyles.barBg}>
                        <View
                          style={[
                            pStyles.barFill,
                            { width: `${Math.max(5, 100 - latestWeightPercentile)}%`, backgroundColor: COLORS.primary },
                          ]}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        );
      })()}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('growthStats.recordInputTitle')}</Text>
        {/* 날짜 입력 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('growthStats.measureDateLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textLight}
            value={recordDate}
            onChangeText={setRecordDate}
            maxLength={10}
          />
        </View>
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('growthStats.heightCmLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('growthStats.weightKgLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
            />
          </View>
        </View>
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? t('growthStats.saving') : t('growthStats.saveRecord')}</Text>
        </TouchableOpacity>
      </View>

      {/* 기록 히스토리 */}
      {records.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('growthStats.recordHistoryTitle')}</Text>
          {records.slice().reverse().map((rec) => (
            <View key={rec.date} style={styles.recordRow}>
              <View style={styles.recordInfo}>
                <Text style={styles.recordDate}>{rec.date}</Text>
                <Text style={styles.recordValue}>
                  {rec.height ? `${rec.height}cm` : '--'} / {rec.weight ? `${rec.weight}kg` : '--'}
                </Text>
              </View>
              <View style={styles.recordActions}>
                <TouchableOpacity onPress={() => startEdit(rec)} style={styles.recordActionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.recordEditText}>{t('common.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(rec.date)} style={styles.recordActionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.recordDeleteText}>{t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const pStyles = StyleSheet.create({
  percentileWrap: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  percentileHeader: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  percentileRow: {
    flexDirection: 'column',
    marginBottom: SPACING.sm,
    gap: 6,
  },
  percentileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  percentileLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  barBg: {
    width: '100%',
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: 10,
    backgroundColor: COLORS.secondary,
    borderRadius: 5,
  },
  percentileValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.primary,
    flexShrink: 1,
    textAlign: 'right',
  },
});

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.statBox, { borderTopColor: color }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

interface TraitInsight {
  weekLabel: string;
  insight: string;
  reason: string;
  createdAt: string;
}

// 백엔드 generateTraitInsight 고정 문장 6쌍의 로케일 키 (traitInsightI18n.pairs.*)
const TRAIT_INSIGHT_PAIR_KEYS = ['steady', 'social', 'focus', 'active', 'emotional', 'challenge'] as const;

function TraitTab() {
  const { t, i18n } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const dominantType = selectedChild?.innateData?.dominantType ?? '--';
  const [insights, setInsights] = useState<TraitInsight[]>([]);
  const [loadingTraits, setLoadingTraits] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  const [traitAnswer, setTraitAnswer] = useState('');
  const [savingTrait, setSavingTrait] = useState(false);

  const dailyQuestion = useMemo(() => {
    if (!selectedChild) return null;
    return getQuestionByProgress(t, selectedChild.ageInfo.group, responseCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.ageInfo.group, responseCount, t]);

  const totalQuestions = selectedChild
    ? getQuestionCount(selectedChild.ageInfo.group)
    : 7;
  const progressToInsight = Math.min(responseCount, 7);

  // 백엔드가 한국어 고정 문장으로 저장한 인사이트를 표시 시점에 번역
  // (milestonesChecklist의 koLabelToId 역참조 패턴, 미등록 문장은 원문 유지)
  const traitKoToKey = useMemo(() => {
    const tKo = i18n.getFixedT('ko');
    const map: Record<string, string> = {};
    TRAIT_INSIGHT_PAIR_KEYS.forEach((key) => {
      map[tKo(`traitInsightI18n.pairs.${key}.insight`)] = `traitInsightI18n.pairs.${key}.insight`;
      map[tKo(`traitInsightI18n.pairs.${key}.reason`)] = `traitInsightI18n.pairs.${key}.reason`;
    });
    return map;
  }, [i18n]);

  function translateInsightText(raw: string): string {
    const key = traitKoToKey[raw];
    return key ? t(key) : raw;
  }

  function translateWeekLabel(raw: string): string {
    const match = raw.match(/^(\d+)월 (\d+)주차$/);
    return match
      ? t('traitInsightI18n.weekLabel', { month: match[1], week: match[2] })
      : raw;
  }

  useEffect(() => {
    if (!selectedChild) return;
    setLoadingTraits(true);
    childApi
      .getDailyTraits(selectedChild.id)
      .then((res) => {
        const data = res.data.data;
        setInsights(data.insights ?? []);
        setResponseCount(data.responses?.length ?? 0);
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => setLoadingTraits(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id]);

  const handleSaveTrait = async () => {
    if (!traitAnswer.trim() || !selectedChild || !dailyQuestion) return;
    setSavingTrait(true);
    try {
      await childApi.saveDailyTrait(selectedChild.id, {
        question: dailyQuestion.question,
        answer: traitAnswer.trim(),
        date: new Date().toISOString().split('T')[0],
      });
      setResponseCount((c) => c + 1);
      setTraitAnswer('');
      Alert.alert(t('growthStats.saveCompleteTitle'), t('growthStats.traitSaveCompleteMessage'));
    } catch {
      Alert.alert(t('common.error'), t('growthStats.saveFailMessage'));
    } finally {
      setSavingTrait(false);
    }
  };

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('growthStats.traitChangeRecordTitle')}</Text>
        <View style={styles.traitInfo}>
          <Image source={require('../../assets/trait-analyst-small.png')} style={styles.traitIconImg} resizeMode="contain" />
          <Text style={styles.traitCurrentLabel}>{t('growthStats.currentTraitTypeLabel')}</Text>
          <Text style={styles.traitCurrentValue}>{dominantType === '--' ? dominantType : getTraitTypeName(t, dominantType)}</Text>
        </View>
        <View style={styles.traitNotice}>
          <Text style={styles.traitNoticeText}>
            {t('growthStats.traitResponseProgress', { count: responseCount, progress: progressToInsight })}
          </Text>
          <View style={{ height: 6, backgroundColor: '#EFEFF4', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
            <View
              style={{
                width: `${(progressToInsight / 7) * 100}%`,
                height: '100%',
                backgroundColor: COLORS.primary,
              }}
            />
          </View>
        </View>
      </View>

      {/* Daily question input */}
      {dailyQuestion && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('growthStats.dailyQuestionTitle', { current: (responseCount % totalQuestions) + 1, total: totalQuestions })}
          </Text>
          <View style={styles.traitNotice}>
            <Text style={styles.traitNoticeText}>{dailyQuestion.question}</Text>
          </View>
          <Text style={styles.traitHintText}>{dailyQuestion.hint}</Text>
          <TextInput
            style={styles.traitInput}
            placeholder={t('growthStats.observationPlaceholder')}
            placeholderTextColor={COLORS.textLight}
            value={traitAnswer}
            onChangeText={setTraitAnswer}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.saveBtn, (!traitAnswer.trim() || savingTrait) && styles.saveBtnDisabled]}
            onPress={handleSaveTrait}
            disabled={!traitAnswer.trim() || savingTrait}
          >
            <Text style={styles.saveBtnText}>
              {savingTrait ? t('growthStats.saving') : t('growthStats.saveTraitObservation')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('growthStats.traitTimelineTitle')}</Text>
        {loadingTraits ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : insights.length === 0 ? (
          <View style={styles.emptyState}>
            <Image source={IC_DIARY} style={styles.emptyIconImg} resizeMode="contain" />
            <Text style={styles.emptyText}>
              {t('growthStats.traitInsightEmptyHint')}
            </Text>
          </View>
        ) : (
          <View>
            {insights.map((item, idx) => (
              <View key={idx} style={traitInsightStyles.row}>
                <View style={traitInsightStyles.dot} />
                {idx < insights.length - 1 && <View style={traitInsightStyles.line} />}
                <View style={traitInsightStyles.content}>
                  <Text style={traitInsightStyles.week}>{translateWeekLabel(item.weekLabel)}</Text>
                  <Text style={traitInsightStyles.insight}>{translateInsightText(item.insight)}</Text>
                  <Text style={traitInsightStyles.reason}>{translateInsightText(item.reason)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Milestone Defaults                                                  */
/* ------------------------------------------------------------------ */

function getAgeLabel(months: number, t: TFunction): string {
  if (months <= 6) return t('growthStats.age0to6m');
  if (months <= 12) return t('growthStats.age7to12m');
  if (months <= 18) return t('growthStats.age13to18m');
  if (months <= 24) return t('growthStats.age19to24m');
  if (months <= 36) return t('growthStats.age25to36m');
  if (months <= 48) return t('growthStats.age3to4y');
  if (months <= 60) return t('growthStats.age4to5y');
  if (months <= 72) return t('growthStats.age5to6y');
  if (months <= 96) return t('growthStats.ageElementaryLower');
  return t('growthStats.ageElementaryUpper');
}

// 도메인 한국어 원문(백엔드/카탈로그 canonical) → 로케일 키 매핑
const MILESTONE_DOMAIN_KEY: Record<string, string> = {
  '대근육': 'grossMotor',
  '소근육': 'fineMotor',
  '언어': 'language',
  '인지': 'cognitive',
  '사회성': 'social',
  '정서': 'emotional',
  '자조': 'selfCare',
};

// 기본 체크리스트 카탈로그: id + 도메인(한국어 canonical)만 코드에 두고,
// 라벨/설명 표시 텍스트는 로케일 JSON(milestonesChecklist.items.<id>)에서 t()로 조회한다.
const MILESTONE_CATALOG: { maxMonths: number; items: [string, string][] }[] = [
  { maxMonths: 6, items: [
    ['d0-1', '대근육'], ['d0-2', '대근육'], ['d0-3', '소근육'], ['d0-4', '언어'], ['d0-5', '인지'],
    ['d0-6', '사회성'], ['d0-7', '소근육'], ['d0-8', '사회성'], ['d0-9', '소근육'], ['d0-10', '대근육'],
  ] },
  { maxMonths: 12, items: [
    ['d1-1', '대근육'], ['d1-2', '대근육'], ['d1-3', '대근육'], ['d1-4', '소근육'], ['d1-5', '언어'],
    ['d1-6', '인지'], ['d1-7', '사회성'], ['d1-8', '언어'], ['d1-9', '자조'], ['d1-10', '인지'],
  ] },
  { maxMonths: 18, items: [
    ['d2-1', '대근육'], ['d2-2', '소근육'], ['d2-3', '자조'], ['d2-4', '언어'], ['d2-5', '인지'],
    ['d2-6', '사회성'], ['d2-7', '대근육'], ['d2-8', '소근육'], ['d2-9', '자조'], ['d2-10', '인지'],
  ] },
  { maxMonths: 24, items: [
    ['d3-1', '대근육'], ['d3-2', '대근육'], ['d3-3', '언어'], ['d3-4', '소근육'], ['d3-5', '인지'],
    ['d3-6', '사회성'], ['d3-7', '소근육'], ['d3-8', '자조'], ['d3-9', '언어'], ['d3-10', '정서'],
  ] },
  { maxMonths: 36, items: [
    ['d4-1', '대근육'], ['d4-2', '대근육'], ['d4-3', '소근육'], ['d4-4', '소근육'], ['d4-5', '언어'],
    ['d4-6', '인지'], ['d4-7', '사회성'], ['d4-8', '자조'], ['d4-9', '사회성'], ['d4-10', '인지'],
  ] },
  { maxMonths: 48, items: [
    ['d5-1', '대근육'], ['d5-2', '대근육'], ['d5-3', '소근육'], ['d5-4', '자조'], ['d5-5', '언어'],
    ['d5-6', '인지'], ['d5-7', '사회성'], ['d5-8', '자조'], ['d5-9', '인지'], ['d5-10', '사회성'],
  ] },
  { maxMonths: 72, items: [
    ['d6-1', '대근육'], ['d6-2', '소근육'], ['d6-3', '언어'], ['d6-4', '인지'], ['d6-5', '사회성'],
    ['d6-6', '정서'], ['d6-7', '소근육'], ['d6-8', '자조'], ['d6-9', '인지'], ['d6-10', '정서'],
  ] },
  // 초등 이상
  { maxMonths: Infinity, items: [
    ['d7-1', '대근육'], ['d7-2', '소근육'], ['d7-3', '언어'], ['d7-4', '인지'], ['d7-5', '사회성'],
    ['d7-6', '정서'], ['d7-7', '언어'], ['d7-8', '자조'], ['d7-9', '인지'], ['d7-10', '사회성'],
  ] },
];

const MILESTONE_ITEM_IDS: string[] = MILESTONE_CATALOG.flatMap((g) => g.items.map(([id]) => id));
const MILESTONE_ITEM_ID_SET = new Set(MILESTONE_ITEM_IDS);

function getDefaultMilestones(months: number, t: TFunction): MilestoneItem[] {
  const group =
    MILESTONE_CATALOG.find((g) => months <= g.maxMonths) ?? MILESTONE_CATALOG[MILESTONE_CATALOG.length - 1];
  return group.items.map(([id, domain]) => ({
    id,
    label: t(`milestonesChecklist.items.${id}.label`),
    domain,
    description: t(`milestonesChecklist.items.${id}.description`),
    completed: false,
  }));
}

/* ------------------------------------------------------------------ */
/* Milestones Tab                                                      */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MilestonesTab() {
  const { t, i18n } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [loading, setLoading] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneData | null>(null);
  const [error, setError] = useState(false);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 백엔드는 label/domain을 한국어 원문으로 내려주므로 표시 시점에만 번역한다 (albumMilestoneI18n 패턴).
  // 한국어 label → 카탈로그 id 역참조 맵
  const koLabelToId = useMemo(() => {
    const tKo = i18n.getFixedT('ko');
    const map: Record<string, string> = {};
    MILESTONE_ITEM_IDS.forEach((id) => {
      map[tKo(`milestonesChecklist.items.${id}.label`)] = id;
    });
    return map;
  }, [i18n]);

  useEffect(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    setToggled({});

    const months = selectedChild.ageInfo?.months ?? 0;

    coachingApi
      .milestones(selectedChild.id)
      .then((res) => {
        const raw = res.data?.data;
        if (!raw || typeof raw !== 'object') return;
        const rawObj = raw as Record<string, unknown>;
        const items = Array.isArray(rawObj.items)
          ? (rawObj.items as MilestoneItem[])
          : [];
        const parsed: MilestoneData = {
          ageLabel: typeof rawObj.ageLabel === 'string' ? rawObj.ageLabel : '',
          items: items.length > 0 ? items : getDefaultMilestones(months, t),
          nextMilestone: typeof rawObj.nextMilestone === 'string' ? rawObj.nextMilestone : '',
          daysUntilNext: typeof rawObj.daysUntilNext === 'number' ? rawObj.daysUntilNext : 0,
        };
        if (!parsed.ageLabel) parsed.ageLabel = getAgeLabel(months, t);
        setMilestones(parsed);
        const initial: Record<string, boolean> = {};
        parsed.items.forEach((item) => { initial[item.id] = item.completed; });
        setToggled(initial);
      })
      .catch(() => {
        // API 실패 시 기본 체크리스트 표시
        const fallback = getDefaultMilestones(months, t);
        setMilestones({
          ageLabel: getAgeLabel(months, t),
          items: fallback,
          nextMilestone: '',
          daysUntilNext: 0,
        });
        const initial: Record<string, boolean> = {};
        fallback.forEach((item) => { initial[item.id] = false; });
        setToggled(initial);
        setError(false);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id]);

  // saveTimerRef unmount cleanup (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // 토글 후 1초 뒤 자동 저장 (디바운스)
  const saveToServer = useCallback((checks: Record<string, boolean>) => {
    if (!selectedChild) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      coachingApi.saveMilestoneChecks(selectedChild.id, checks).catch(() => {});
    }, 1000);
  }, [selectedChild]);

  const handleToggle = (id: string) => {
    setToggled((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveToServer(next);
      return next;
    });
  };

  if (loading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !milestones) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'📋'}</Text>
          <Text style={styles.emptyText}>
            {t('growthStats.milestoneLoadFail')}
          </Text>
        </View>
      </View>
    );
  }

  const items = milestones.items ?? [];
  const completedCount = items.filter((item) => toggled[item.id]).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  // 서버에서 domain이 한국어 원문으로 내려오므로 한국어 키로 직접 매핑
  const DOMAIN_STYLE: Record<string, { emoji: string; color: string }> = {
    '대근육': { emoji: '🏃', color: '#FF8C5A' },
    '소근육': { emoji: '✋', color: '#E91E63' },
    '언어': { emoji: '💬', color: '#4285F4' },
    '인지': { emoji: '🧠', color: '#9B59B6' },
    '사회성': { emoji: '🤝', color: '#2BA89E' },
    '정서': { emoji: '💛', color: '#F5A623' },
    '자조': { emoji: '🧹', color: '#78909C' },
  };

  function getDomainTag(item: MilestoneItem) {
    const domainKey = MILESTONE_DOMAIN_KEY[item.domain];
    const label = domainKey
      ? t(`milestonesChecklist.domains.${domainKey}`)
      : item.domain || t('growthStats.domainFallbackLabel');
    const style = DOMAIN_STYLE[item.domain];
    if (style) return { ...style, label };
    return { emoji: '📋', label, color: '#636366' };
  }

  // 체크 항목 표시 텍스트: 카탈로그 항목이면 번역, 모르는 항목은 원문 유지
  function getItemText(item: MilestoneItem): { label: string; description: string } {
    const catalogId = koLabelToId[item.label] ?? (MILESTONE_ITEM_ID_SET.has(item.id) ? item.id : undefined);
    if (!catalogId) return { label: item.label, description: item.description };
    return {
      label: t(`milestonesChecklist.items.${catalogId}.label`),
      description: t(`milestonesChecklist.items.${catalogId}.description`),
    };
  }

  // 발달 진행 요약 통계 (집계 키는 도메인 원문, 표시 라벨은 번역값)
  const domainCounts: Record<string, { label: string; emoji: string; color: string; total: number; done: number }> = {};
  items.forEach((item) => {
    const tag = getDomainTag(item);
    const key = item.domain || tag.label;
    if (!domainCounts[key]) {
      domainCounts[key] = { label: tag.label, emoji: tag.emoji, color: tag.color, total: 0, done: 0 };
    }
    domainCounts[key].total += 1;
    if (toggled[item.id]) domainCounts[key].done += 1;
  });

  const domainSummary = Object.values(domainCounts);

  // 다음 목표: 백엔드가 한국어 문장으로 내려줌 — 카탈로그 항목이면 번역, 아니면 한국어에서만 원문 표시
  const nextMilestoneId = milestones.nextMilestone ? koLabelToId[milestones.nextMilestone] : undefined;
  const nextMilestoneText = nextMilestoneId
    ? t(`milestonesChecklist.items.${nextMilestoneId}.label`)
    : i18n.language === 'ko'
      ? milestones.nextMilestone
      : '';

  return (
    <View>
      {/* Current Milestone Card */}
      <View style={[msStyles.gradientCard, { backgroundColor: '#F4A98C' }]}>
        <Text style={msStyles.gradientTitle}>
          {t('growthStats.milestoneCheckTitle', { ageLabel: milestones.ageLabel })}
        </Text>
        <View style={msStyles.progressRow}>
          <View style={msStyles.progressBarBg}>
            <View
              style={[msStyles.progressBarFill, { width: `${progress * 100}%` }]}
            />
          </View>
          <Text style={msStyles.progressText}>
            {completedCount}/{totalCount}
          </Text>
        </View>
        <Text style={msStyles.progressHint}>
          {progress >= 1
            ? t('growthStats.milestoneAllComplete')
            : progress >= 0.7
            ? t('growthStats.milestoneGoodProgress')
            : t('growthStats.milestoneSlowPace')}
        </Text>
      </View>

      {/* 영역별 발달 현황 */}
      {domainSummary.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('growthStats.domainSummaryTitle')}</Text>
          <View style={msStyles.domainGrid}>
            {domainSummary.map((d) => {
              const domainProgress = d.total > 0 ? d.done / d.total : 0;
              return (
                <View key={d.label} style={msStyles.domainItem}>
                  <Text style={msStyles.domainEmoji}>{d.emoji}</Text>
                  <Text style={msStyles.domainLabel}>{d.label}</Text>
                  <View style={msStyles.domainBarBg}>
                    <View
                      style={[
                        msStyles.domainBarFill,
                        { width: `${domainProgress * 100}%`, backgroundColor: d.color },
                      ]}
                    />
                  </View>
                  <Text style={[msStyles.domainCount, { color: d.color }]}>
                    {d.done}/{d.total}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Checklist */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('growthStats.checklistTitle')}</Text>
        <Text style={msStyles.checkHint}>{t('growthStats.checklistHint')}</Text>
        {items.map((item) => {
          const tag = getDomainTag(item);
          const text = getItemText(item);
          const done = toggled[item.id] ?? false;
          const isExpanded = expandedId === item.id;
          return (
            <View key={item.id}>
              <TouchableOpacity
                style={msStyles.checkRow}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                activeOpacity={0.7}
              >
                <TouchableOpacity onPress={() => handleToggle(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={msStyles.checkIcon}>
                    {done ? '✓' : '○'}
                  </Text>
                </TouchableOpacity>
                <View style={msStyles.checkContent}>
                  <Text
                    style={[
                      msStyles.checkLabel,
                      done && msStyles.checkLabelDone,
                    ]}
                  >
                    {text.label}
                  </Text>
                  <View style={[msStyles.domainBadge, { backgroundColor: tag.color + '18' }]}>
                    <Text style={[msStyles.domainBadgeText, { color: tag.color }]}>
                      {tag.emoji} {tag.label}
                    </Text>
                  </View>
                </View>
                <Text style={msStyles.expandArrow}>{isExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {isExpanded && (
                <View style={msStyles.descBox}>
                  <Image source={IC_THINKING} style={msStyles.descIconImg} resizeMode="contain" />
                  <Text style={msStyles.descText}>{text.description}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* 발달 팁 카드 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('growthStats.devTipCardTitle')}</Text>
        <View style={msStyles.tipCard}>
          <Text style={msStyles.tipTitle}>{t('growthStats.devTipImportantTitle')}</Text>
          <Text style={msStyles.tipBody}>
            {progress < 0.5
              ? t('growthStats.devTipImportantLow')
              : t('growthStats.devTipImportantHigh')}
          </Text>
        </View>
        <View style={msStyles.tipCard}>
          <Text style={msStyles.tipTitle}>{t('growthStats.devTipParentTitle')}</Text>
          <Text style={msStyles.tipBody}>
            {completedCount < totalCount
              ? t('growthStats.devTipParentIncomplete')
              : t('growthStats.devTipParentComplete')}
          </Text>
        </View>
      </View>

      {/* Next Milestone */}
      <View style={[msStyles.nextCard, { backgroundColor: '#7DD3B8' }]}>
        <Text style={msStyles.nextLabel}>{t('growthStats.nextGoalLabel')}</Text>
        <Text style={msStyles.nextTitle}>{nextMilestoneText}</Text>
        <View style={msStyles.ddayBadge}>
          <Text style={msStyles.ddayText}>
            D-{milestones.daysUntilNext}
          </Text>
        </View>
      </View>
    </View>
  );
}

const msStyles = StyleSheet.create({
  gradientCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  gradientTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressHint: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: SPACING.xs,
    fontWeight: '500',
  },
  domainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  domainItem: {
    width: '47%' as unknown as number,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    alignItems: 'center',
  },
  domainEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  domainLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  domainBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#EEE',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  domainBarFill: {
    height: 6,
    borderRadius: 3,
  },
  domainCount: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  checkHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  checkIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  checkContent: {
    flex: 1,
  },
  checkLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    flex: 1,
    lineHeight: 22,
  },
  checkLabelDone: {
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  domainBadge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  domainBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  expandArrow: {
    fontSize: 10,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  descBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8F0',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginLeft: 36,
    gap: 8,
  },
  descIcon: {
    fontSize: 16,
  },
  descIconImg: { width: 18, height: 18 },
  descText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  tipCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  tipTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  tipBody: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  nextCard: {
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  nextLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  nextTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  ddayBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  ddayText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

const traitInsightStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginTop: 4,
    marginRight: SPACING.md,
    zIndex: 1,
  },
  line: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: -SPACING.md,
    width: 2,
    backgroundColor: COLORS.primaryLight,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  week: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  insight: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  reason: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
    paddingRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 24,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  cardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  chartPlaceholder: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
  },
  chartIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  chartIconImg: { width: 48, height: 48, marginBottom: SPACING.sm },
  chartPlaceholderText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  recordDate: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  recordValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  recordInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  recordActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  recordActionBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  recordEditText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  recordDeleteText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.error,
  },
  traitInfo: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  traitIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  traitIconImg: {
    width: 44,
    height: 44,
    marginBottom: SPACING.sm,
  },
  traitCurrentLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  traitCurrentValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  traitNotice: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  traitNoticeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  traitHintText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  traitInput: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
    marginBottom: SPACING.md,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  emptyIconImg: { width: 48, height: 48, marginBottom: SPACING.sm },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

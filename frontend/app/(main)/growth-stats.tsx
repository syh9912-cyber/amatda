import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Animated, LayoutChangeEvent, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Stack, router } from 'expo-router';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { GuideButton } from '../../components/common/GuideButton';
import { GROWTH_GUIDE } from '../../features/guide/growthGuide';
import { WEEKLY_DEV_GUIDE } from '../../features/guide/weeklyDevGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';
import { useChildStore } from '../../stores/childStore';
import { canDo } from '../../features/coparenting/permissions';
import { childApi, coachingApi, growthApi, pregnancyApi } from '../../services/api';
import { getQuestionByProgress, getQuestionCount } from '../../constants/dailyQuestions';
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

const TABS: { key: TabKey; label: string }[] = [
  { key: 'physical', label: '키/몸무게/성장' },
];

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
}

interface GrowthAnalysisResult {
  ageLabel: string;
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

function getLevelLabel(level: string): string {
  switch (level) {
    case 'very_low': return '매우 낮음';
    case 'low': return '낮음';
    case 'normal': return '정상';
    case 'high': return '높음';
    case 'very_high': return '매우 높음';
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

function getPercentileLabel(percentile: number): string {
  if (percentile <= 10) return `상위 ${percentile}%`;
  if (percentile <= 25) return `상위 ${percentile}%`;
  if (percentile <= 50) return `상위 ${percentile}%`;
  return `상위 ${percentile}%`;
}

export default function GrowthStatsScreen() {
  // 기질 탭 제거됨: 키/몸무게/성장 단일 뷰
  const selectedChild = useChildStore((s) => s.selectedChild);
  const isPregnant = selectedChild?.isPregnant === true;

  // 모드별 가이드: 임신(주수별 발달) / 육아(성장 기록)
  const guideKey = isPregnant ? 'weekly_dev' : 'growth';
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
          <ScreenHeader title="주수별 발달" right={<GuideButton onPress={() => setGuideVisible(true)} />} />
          <PregnancyWeeklyDevelopment />
        </ScrollView>
        <AdSlot />
        <GuideCarousel visible={guideVisible} pages={WEEKLY_DEV_GUIDE} onClose={closeGuide} onComplete={closeGuide} accent="#F0976C" />
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

        <PhysicalTab childName={selectedChild?.name ?? '아이'} />
      </ScrollView>
      <AdSlot />
      <GuideCarousel visible={guideVisible} pages={GROWTH_GUIDE} onClose={closeGuide} onComplete={closeGuide} accent="#7CA46E" />
    </KeyboardAvoidingView>
  );
}

function GrowthHeader({ onGuide }: { onGuide?: () => void }) {
  return (
    <ScreenHeader title="성장 기록 & 변화" right={onGuide ? <GuideButton onPress={onGuide} /> : undefined} />
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

const WEEKLY_TASKS: WeeklyTask[] = [
  { minWeek: 1, maxWeek: 12, emoji: '💊', title: '엽산 매일 복용 (400~800mcg)', type: 'todo' },
  { minWeek: 6, maxWeek: 10, emoji: '🏥', title: '첫 산부인과 방문 + 심장소리 확인', type: 'exam' },
  { minWeek: 11, maxWeek: 14, emoji: '🔬', title: '1차 기형아 검사 (NT, 목투명대)', type: 'exam' },
  { minWeek: 14, maxWeek: 16, emoji: '🥬', title: '철분 섭취 시작 (시금치/붉은 고기)', type: 'todo' },
  { minWeek: 15, maxWeek: 20, emoji: '🧪', title: '2차 기형아 검사 (쿼드/트리플)', type: 'exam' },
  { minWeek: 18, maxWeek: 22, emoji: '📋', title: '정밀 초음파 (레벨 2)', type: 'exam' },
  { minWeek: 20, maxWeek: 24, emoji: '🎀', title: '성별 확인 가능 시기', type: 'todo' },
  { minWeek: 24, maxWeek: 28, emoji: '🩸', title: '임신성 당뇨 검사 (GCT)', type: 'exam' },
  { minWeek: 28, maxWeek: 32, emoji: '📚', title: '출산 준비 교실 수강', type: 'todo' },
  { minWeek: 28, maxWeek: 36, emoji: '🦶', title: '태동 카운터 매일 체크', type: 'todo' },
  { minWeek: 32, maxWeek: 36, emoji: '🏥', title: 'NST (비수축검사)', type: 'exam' },
  { minWeek: 35, maxWeek: 37, emoji: '🔬', title: 'GBS 검사 (B군 연쇄상구균)', type: 'exam' },
  { minWeek: 32, maxWeek: 40, emoji: '🧳', title: '출산가방 준비', type: 'todo' },
  { minWeek: 36, maxWeek: 40, emoji: '⏱️', title: '진통 간격 타이머 준비', type: 'todo' },
];

function getTasksForWeek(week: number): WeeklyTask[] {
  return WEEKLY_TASKS.filter((t) => week >= t.minWeek && week <= t.maxWeek);
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

function getTrimesterInfo(week: number) {
  if (week <= 13) return { label: '1분기 (초기)', color: '#E8F5E9', textColor: '#2E7D32' };
  if (week <= 27) return { label: '2분기 (안정기)', color: '#E3F2FD', textColor: '#1565C0' };
  return { label: '3분기 (후기)', color: '#FCE4EC', textColor: '#C62828' };
}

function PregnancyWeeklyDevelopment() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const weeks = WEEKLY_DEVELOPMENT;
  const [imagesByWeek, setImagesByWeek] = useState<Record<number, TimelineItem[]>>({});
  const [, setLoading] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const weekPositions = useRef<Record<number, number>>({});

  const currentWeek = selectedChild?.pregnancyWeeks ?? 0;
  const dDay = calculateDDay(selectedChild?.dueDate);
  const weeklyTasks = getTasksForWeek(currentWeek);

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
        ?? '검색에 실패했어요. 잠시 후 다시 시도해주세요.';
      Alert.alert('알림', msg);
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
    const tri = getTrimesterInfo(dev.week);
    const prevTri = idx > 0 ? getTrimesterInfo(visibleWeeks[idx - 1].week) : null;
    return { dev, showTrimester: !prevTri || prevTri.label !== tri.label, trimester: tri };
  });

  return (
    <View>
      {/* 의료 disclaimer — 약물·증상·응급 신호 안내 시 의료기기성 위험 회피 (App Store/Play Store 심사) */}
      <View style={pwStyles.disclaimerCard}>
        <Text style={pwStyles.disclaimerText}>
          ⓘ 이 정보는 일반 참고용이며 의료 진단·처방을 대체하지 않습니다. 약물·식이·증상에 관한 결정은 반드시 산부인과 전문의와 상담해주세요. 응급 신호(심한 출혈·복통·태동 급감·시야 이상·심한 부종 등)가 있으면 즉시 병원에 가세요.
        </Text>
      </View>

      {/* Current Week Summary Card */}
      {currentWeek > 0 && currentDev && (
        <View style={[pwStyles.currentCard, { backgroundColor: '#FF8C94' }]}>
          <Text style={pwStyles.currentLabel}>현재 임신</Text>
          <Text style={pwStyles.currentWeekText}>{currentWeek}주차</Text>
          <Text style={pwStyles.currentSize}>
            {SIZE_EMOJI[currentDev.size] ?? '🤰'} {currentDev.size} 크기
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
            <Text style={pwStyles.dDayLabel}>출산예정일까지</Text>
            <Text style={pwStyles.dDayValue}>
              {dDay > 0 ? `D-${dDay}` : dDay === 0 ? 'D-Day!' : `D+${Math.abs(dDay)}`}
            </Text>
            <Text style={pwStyles.dDayHint}>📅 주요 검사·출산일 알림이 자동 등록돼요</Text>
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
          <Text style={pwStyles.tasksTitle}>📋 이번 주 할 일 · 검사</Text>
          {weeklyTasks.map((t, i) => (
            <View key={`${t.type}-${i}`} style={pwStyles.taskRow}>
              <Text style={pwStyles.taskEmoji}>{t.emoji}</Text>
              <Text style={pwStyles.taskText}>{t.title}</Text>
              <View style={[
                pwStyles.taskBadge,
                t.type === 'exam' ? { backgroundColor: '#FCE4EC' } : { backgroundColor: '#E3F2FD' },
              ]}>
                <Text style={[
                  pwStyles.taskBadgeText,
                  t.type === 'exam' ? { color: '#C2185B' } : { color: '#1565C0' },
                ]}>
                  {t.type === 'exam' ? '검사' : '할 일'}
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
          <Text style={pwStyles.safetyBtnTitle}>임산부 금기 검색</Text>
          <Text style={pwStyles.safetyBtnSub}>음식·약물·카페인 안전성 확인</Text>
        </View>
        <Text style={pwStyles.safetyBtnArrow}>{'>'}</Text>
      </TouchableOpacity>

      {/* Week Cards */}
      {weekItems.map(({ dev, showTrimester, trimester }) => {
        const isCurrent = dev.week === currentDev?.week;
        const isFuture = dev.week > currentWeek;
        const isExpanded = expandedWeek === dev.week;
        const emoji = SIZE_EMOJI[dev.size] ?? '🤰';
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
                      {dev.week}주
                    </Text>
                    {isCurrent && (
                      <View style={pwStyles.nowBadge}>
                        <Text style={pwStyles.nowBadgeText}>NOW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={pwStyles.weekSizeText}>{dev.size} 크기</Text>
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
                    <Text style={pwStyles.featTitle}>👶 이번 주 아기 발달</Text>
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
                      <Text style={pwStyles.subSectionTitle}>🤰 엄마 몸 변화</Text>
                      <Text style={pwStyles.subSectionText}>{dev.momChange}</Text>
                    </View>
                  )}

                  {/* 추천 음식·영양 */}
                  {dev.foodTip && (
                    <View style={pwStyles.foodTipBox}>
                      <Text style={pwStyles.subSectionTitle}>🍎 추천 음식·영양</Text>
                      <Text style={pwStyles.subSectionText}>{dev.foodTip}</Text>
                    </View>
                  )}

                  {/* 주의사항 */}
                  {dev.caution && (
                    <View style={pwStyles.cautionBox}>
                      <Text style={pwStyles.cautionTitle}>⚠️ 주의</Text>
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
                        <Text style={pwStyles.imgTitle}>{' 이 주의 기록 사진'}</Text>
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
          임신앨범에서 사진을 올리면 해당 주수에 자동으로 표시돼요
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
                  <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.md, fontWeight: '600' }}>{'< 닫기'}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text }}>금기 검색</Text>
                <View style={{ width: 50 }} />
              </View>

              <View style={pwStyles.safetyInputRow}>
                <TextInput
                  style={pwStyles.safetyInput}
                  placeholder="예: 커피, 회, 타이레놀, 홍삼..."
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
                  <Text style={{ color: '#fff', fontWeight: '700' }}>검색</Text>
                </TouchableOpacity>
              </View>

              {safetyLoading && (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={{ marginTop: SPACING.md, color: COLORS.textSecondary }}>AI가 분석 중이에요...</Text>
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
                      {safetyResult.level === 'safe' ? '안전' : safetyResult.level === 'caution' ? '주의' : '피하세요'}
                    </Text>
                    <Text style={pwStyles.safetyResultTitle}>{safetyResult.title}</Text>
                    <Text style={pwStyles.safetyResultSummary}>{safetyResult.summary}</Text>
                  </View>

                  {safetyResult.dos.length > 0 && (
                    <View style={pwStyles.safetyListCard}>
                      <Text style={[pwStyles.safetyListTitle, { color: '#2E7D32' }]}>✓ 이렇게 드세요</Text>
                      {safetyResult.dos.map((d, i) => (
                        <Text key={i} style={pwStyles.safetyListItem}>• {d}</Text>
                      ))}
                    </View>
                  )}

                  {safetyResult.donts.length > 0 && (
                    <View style={pwStyles.safetyListCard}>
                      <Text style={[pwStyles.safetyListTitle, { color: '#C62828' }]}>✗ 주의사항</Text>
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
  return (
    <View style={styles.tabsRow}>
      {TABS.map((tab) => {
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
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<GrowthAnalysisResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const startLoadingAnimation = useCallback(() => {
    setProgress(0);
    progressAnim.setValue(0);

    // Spin animation loop
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    spin.start();

    // Progress bar animation: 0 -> 0.85 over 3 seconds (simulated feel)
    Animated.timing(progressAnim, {
      toValue: 0.85,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(interval);
          return 85;
        }
        return prev + Math.random() * 8 + 2;
      });
    }, 300);

    return () => {
      spin.stop();
      clearInterval(interval);
    };
  }, [spinAnim, progressAnim]);

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
        setError('분석 결과를 처리할 수 없습니다.');
        return;
      }

      // Complete the progress bar
      setProgress(100);
      progressAnim.setValue(1);
      setResult(parsed);
    } catch {
      setError('성장 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      cleanup();
      setLoading(false);
    }
  };

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
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
          <Text style={gaStyles.analyzeBtnText}>성장 분석하기</Text>
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
              accessibilityLabel="닫기"
            >
              <Text style={[gaStyles.modalClose, loading && { opacity: 0.3 }]}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={gaStyles.modalTitle}>성장 분석</Text>
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
                  아이의 성장 데이터를 분석하고 있어요...
                </Text>
                <Text style={gaStyles.loadingSubtitle}>
                  AI가 성장 패턴을 꼼꼼히 살펴보고 있어요
                </Text>
                {/* Progress Bar */}
                <View style={gaStyles.progressBarBg}>
                  <Animated.View
                    style={[gaStyles.progressBarFill, { width: progressWidth as Animated.AnimatedInterpolation<string> }]}
                  />
                </View>
                <Text style={gaStyles.progressText}>
                  {Math.min(Math.round(progress), 100)}%
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
                  <Text style={gaStyles.retryBtnText}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Result State */}
            {!loading && !error && result && (
              <View>
                {/* Overall Summary */}
                <View style={[gaStyles.summaryCard, { backgroundColor: '#F4A98C' }]}>
                  {result.ageLabel ? (
                    <Text style={gaStyles.summaryAge}>{result.ageLabel}</Text>
                  ) : null}
                  <Text style={gaStyles.summaryTitle}>종합 분석</Text>
                  <Text style={gaStyles.summaryText}>{result.overallSummary}</Text>
                </View>

                {/* Metrics */}
                {allMetrics.length > 0 && (
                  <View>
                    <Text style={gaStyles.sectionTitle}>상세 항목</Text>
                    {allMetrics.map((item, idx) => {
                      const levelColor = getLevelColor(item.level);
                      return (
                        <View key={`${item.metric}-${idx}`} style={gaStyles.metricCard}>
                          {/* Metric Header */}
                          <View style={gaStyles.metricHeader}>
                            <Text style={gaStyles.metricEmoji}>{item.emoji}</Text>
                            <View style={gaStyles.metricTitleWrap}>
                              <Text style={gaStyles.metricTitle}>{item.title}</Text>
                              {item.percentileLabel ? (
                                <Text style={gaStyles.metricPercentile}>
                                  {item.percentileLabel}
                                </Text>
                              ) : null}
                            </View>
                            <View style={[gaStyles.levelBadge, { backgroundColor: levelColor.bg }]}>
                              <Text style={[gaStyles.levelBadgeText, { color: levelColor.text }]}>
                                {getLevelLabel(item.level)}
                              </Text>
                            </View>
                          </View>
                          {/* Comment */}
                          <Text style={gaStyles.metricComment}>{item.comment}</Text>
                          {/* Advice */}
                          <View style={gaStyles.adviceBox}>
                            <Image source={IC_THINKING} style={gaStyles.adviceIconImg} resizeMode="contain" />
                            <Text style={gaStyles.adviceText}>{item.advice}</Text>
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

function PhysicalTab({ childName }: { childName: string }) {
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

  const initialHeight = selectedChild?.height ?? null;
  const initialWeight = selectedChild?.weight ?? null;
  const ageMonths = selectedChild?.ageInfo.months ?? 0;
  const rawGender = selectedChild?.gender ?? 'M';
  const gender = rawGender === 'U' ? 'M' : rawGender;
  const ageLabel = selectedChild?.ageInfo.label ?? '';

  // 로컬 기록 로드
  useEffect(() => {
    if (!selectedChild) return;
    const loadRecords = async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const key = `growth_records_${selectedChild.id}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) setRecords(JSON.parse(stored) as typeof records);
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

  const genderLabel = gender === 'M' ? '남아' : '여아';

  const handleSave = async () => {
    if (!height && !weight) {
      Alert.alert('알림', '키 또는 몸무게를 입력해주세요');
      return;
    }
    if (!selectedChild) return;
    // 공동육아: 성장 기록 저장은 editProfile 권한 필요 (열람 전용 멤버 차단)
    if (!(await canDo(selectedChild.id, 'editProfile'))) {
      Alert.alert('열람 전용', '성장 기록 저장 권한이 없어요.\n보호자에게 "아이 프로필 수정" 권한을 요청해주세요.');
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
      const updated = [...records.filter((r) => r.date !== recordDate), newRecord].sort(
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
      Alert.alert('저장 완료', `${recordDate} 성장 기록이 저장되었습니다`);
      setHeight('');
      setWeight('');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      {/* Initial record from onboarding */}
      {(initialHeight || initialWeight) ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>첫 기록 ({ageLabel})</Text>
          <View style={styles.statsRow}>
            <StatBox
              label="키"
              value={initialHeight ? `${initialHeight}cm` : '-- cm'}
              color={COLORS.secondary}
            />
            <StatBox
              label="몸무게"
              value={initialWeight ? `${initialWeight}kg` : '-- kg'}
              color={COLORS.primary}
            />
          </View>

          {/* Percentile display */}
          {(heightPercentile !== null || weightPercentile !== null) ? (
            <View style={pStyles.percentileWrap}>
              <Text style={pStyles.percentileHeader}>
                동 개월 {genderLabel} 대비
              </Text>
              {heightPercentile !== null && initialHeight ? (
                <View style={pStyles.percentileRow}>
                  <Text style={pStyles.percentileLabel}>키</Text>
                  <View style={pStyles.barBg}>
                    <View
                      style={[
                        pStyles.barFill,
                        { width: `${Math.max(5, 100 - heightPercentile)}%` },
                      ]}
                    />
                  </View>
                  <Text style={pStyles.percentileValue}>
                    {getPercentileLabel(heightPercentile)}
                  </Text>
                </View>
              ) : null}
              {weightPercentile !== null && initialWeight ? (
                <View style={pStyles.percentileRow}>
                  <Text style={pStyles.percentileLabel}>몸무게</Text>
                  <View style={pStyles.barBg}>
                    <View
                      style={[
                        pStyles.barFill,
                        { width: `${Math.max(5, 100 - weightPercentile)}%`, backgroundColor: COLORS.primary },
                      ]}
                    />
                  </View>
                  <Text style={pStyles.percentileValue}>
                    {getPercentileLabel(weightPercentile)}
                  </Text>
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
        // 첫 기록(onboarding)을 records 앞에 합쳐 차트/최신값 기준으로 사용
        const merged: { date: string; height?: number; weight?: number }[] = [...records];
        if ((initialHeight || initialWeight) && !records.some((r) => r.height === initialHeight && r.weight === initialWeight)) {
          const birth = selectedChild?.birthDate ? String(selectedChild.birthDate).slice(0, 10) : '';
          if (birth && !merged.some((r) => r.date === birth)) {
            merged.unshift({ date: birth, height: initialHeight ?? undefined, weight: initialWeight ?? undefined });
          }
        }
        merged.sort((a, b) => a.date.localeCompare(b.date));
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
              <Text style={styles.cardTitle}>키 & 몸무게 변화</Text>
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
                    키 또는 몸무게를 기록하면 차트가 표시됩니다
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>최신 기록{latest?.date ? ` (${latest.date})` : ''}</Text>
              <View style={styles.statsRow}>
                <StatBox
                  label="키"
                  value={latestHeight ? `${latestHeight}cm` : '-- cm'}
                  color={COLORS.secondary}
                />
                <StatBox
                  label="몸무게"
                  value={latestWeight ? `${latestWeight}kg` : '-- kg'}
                  color={COLORS.primary}
                />
                <StatBox label="기록 수" value={String(merged.length)} color={COLORS.info} />
              </View>

              {/* Percentile display — 최신 기록 시점의 또래 비교 */}
              {(latestHeightPercentile !== null || latestWeightPercentile !== null) ? (
                <View style={pStyles.percentileWrap}>
                  <Text style={pStyles.percentileHeader}>
                    동 개월 {genderLabel} 대비
                  </Text>
                  {latestHeightPercentile !== null && latestHeight ? (
                    <View style={pStyles.percentileRow}>
                      <Text style={pStyles.percentileLabel}>키</Text>
                      <View style={pStyles.barBg}>
                        <View
                          style={[
                            pStyles.barFill,
                            { width: `${Math.max(5, 100 - latestHeightPercentile)}%` },
                          ]}
                        />
                      </View>
                      <Text style={pStyles.percentileValue}>
                        {getPercentileLabel(latestHeightPercentile)}
                      </Text>
                    </View>
                  ) : null}
                  {latestWeightPercentile !== null && latestWeight ? (
                    <View style={pStyles.percentileRow}>
                      <Text style={pStyles.percentileLabel}>몸무게</Text>
                      <View style={pStyles.barBg}>
                        <View
                          style={[
                            pStyles.barFill,
                            { width: `${Math.max(5, 100 - latestWeightPercentile)}%`, backgroundColor: COLORS.primary },
                          ]}
                        />
                      </View>
                      <Text style={pStyles.percentileValue}>
                        {getPercentileLabel(latestWeightPercentile)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        );
      })()}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>기록 입력</Text>
        {/* 날짜 입력 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>측정 날짜</Text>
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
            <Text style={styles.inputLabel}>키 (cm)</Text>
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
            <Text style={styles.inputLabel}>몸무게 (kg)</Text>
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
          <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '기록 저장'}</Text>
        </TouchableOpacity>
      </View>

      {/* 기록 히스토리 */}
      {records.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>성장 기록 내역</Text>
          {records.slice().reverse().map((rec) => (
            <View key={rec.date} style={styles.recordRow}>
              <Text style={styles.recordDate}>{rec.date}</Text>
              <Text style={styles.recordValue}>
                {rec.height ? `${rec.height}cm` : '--'} / {rec.weight ? `${rec.weight}kg` : '--'}
              </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  percentileLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    width: 44,
  },
  barBg: {
    flex: 1,
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
    width: 72,
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

function TraitTab() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const dominantType = selectedChild?.innateData?.dominantType ?? '--';
  const [insights, setInsights] = useState<TraitInsight[]>([]);
  const [loadingTraits, setLoadingTraits] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  const [traitAnswer, setTraitAnswer] = useState('');
  const [savingTrait, setSavingTrait] = useState(false);

  const dailyQuestion = useMemo(() => {
    if (!selectedChild) return null;
    return getQuestionByProgress(selectedChild.ageInfo.group, responseCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.ageInfo.group, responseCount]);

  const totalQuestions = selectedChild
    ? getQuestionCount(selectedChild.ageInfo.group)
    : 7;
  const progressToInsight = Math.min(responseCount, 7);

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
      Alert.alert('저장 완료', '오늘의 기질 관찰이 기록되었습니다');
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSavingTrait(false);
    }
  };

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>기질 변화 기록</Text>
        <View style={styles.traitInfo}>
          <Image source={require('../../assets/trait-analyst-small.png')} style={styles.traitIconImg} resizeMode="contain" />
          <Text style={styles.traitCurrentLabel}>현재 기질 유형</Text>
          <Text style={styles.traitCurrentValue}>{dominantType}</Text>
        </View>
        <View style={styles.traitNotice}>
          <Text style={styles.traitNoticeText}>
            응답 누적 {responseCount}개 · 첫 인사이트까지 {progressToInsight}/7
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
            오늘의 질문 ({((responseCount % totalQuestions) + 1)}/{totalQuestions})
          </Text>
          <View style={styles.traitNotice}>
            <Text style={styles.traitNoticeText}>{dailyQuestion.question}</Text>
          </View>
          <Text style={styles.traitHintText}>{dailyQuestion.hint}</Text>
          <TextInput
            style={styles.traitInput}
            placeholder="관찰 내용을 입력하세요..."
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
              {savingTrait ? '저장 중...' : '기질 관찰 저장'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>기질 변화 타임라인</Text>
        {loadingTraits ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : insights.length === 0 ? (
          <View style={styles.emptyState}>
            <Image source={IC_DIARY} style={styles.emptyIconImg} resizeMode="contain" />
            <Text style={styles.emptyText}>
              7개 응답이 쌓이면 첫 기질 변화 인사이트가 생성됩니다
            </Text>
          </View>
        ) : (
          <View>
            {insights.map((item, idx) => (
              <View key={idx} style={traitInsightStyles.row}>
                <View style={traitInsightStyles.dot} />
                {idx < insights.length - 1 && <View style={traitInsightStyles.line} />}
                <View style={traitInsightStyles.content}>
                  <Text style={traitInsightStyles.week}>{item.weekLabel}</Text>
                  <Text style={traitInsightStyles.insight}>{item.insight}</Text>
                  <Text style={traitInsightStyles.reason}>{item.reason}</Text>
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

function getAgeLabel(months: number): string {
  if (months <= 6) return '0~6개월';
  if (months <= 12) return '7~12개월';
  if (months <= 18) return '13~18개월';
  if (months <= 24) return '19~24개월';
  if (months <= 36) return '25~36개월';
  if (months <= 48) return '3~4세';
  if (months <= 60) return '4~5세';
  if (months <= 72) return '5~6세';
  if (months <= 96) return '초등 저학년';
  return '초등 고학년';
}

function getDefaultMilestones(months: number): MilestoneItem[] {
  const m = (id: string, label: string, domain: string, description: string): MilestoneItem =>
    ({ id, label, domain, description, completed: false });

  if (months <= 6) return [
    m('d0-1', '목을 가눌 수 있어요', '대근육', '엎드린 자세에서 머리를 들고 유지할 수 있는지 확인해보세요'),
    m('d0-2', '뒤집기를 해요', '대근육', '등에서 배로 또는 배에서 등으로 뒤집는 동작을 해요'),
    m('d0-3', '물건을 손으로 잡아요', '소근육', '장난감이나 손가락을 움켜쥘 수 있어요'),
    m('d0-4', '옹알이를 해요', '언어', '"아~", "우~" 같은 모음 소리를 내요'),
    m('d0-5', '소리 나는 쪽을 바라봐요', '인지', '소리가 나면 고개를 돌려 찾아봐요'),
    m('d0-6', '눈을 맞추고 미소 지어요', '사회성', '얼굴을 보고 사회적 미소를 보여요'),
    m('d0-7', '손을 입으로 가져가요', '소근육', '자신의 손을 탐색하며 입에 넣어요'),
    m('d0-8', '익숙한 사람을 알아봐요', '사회성', '엄마 아빠를 보면 반가워해요'),
    m('d0-9', '딸랑이를 흔들어요', '소근육', '손에 쥔 물건을 흔드는 동작을 해요'),
    m('d0-10', '배밀이를 시도해요', '대근육', '엎드린 자세에서 팔다리를 움직여 이동하려 해요'),
  ];
  if (months <= 12) return [
    m('d1-1', '혼자 앉을 수 있어요', '대근육', '도움 없이 앉은 자세를 유지해요'),
    m('d1-2', '기어다녀요', '대근육', '네발로 기어서 이동할 수 있어요'),
    m('d1-3', '잡고 서기를 해요', '대근육', '가구를 잡고 일어설 수 있어요'),
    m('d1-4', '집게 손가락으로 잡아요', '소근육', '엄지와 검지로 작은 물건을 집어요'),
    m('d1-5', '"맘마", "다다" 말해요', '언어', '의미 있는 첫 단어를 말하기 시작해요'),
    m('d1-6', '까꿍 놀이를 이해해요', '인지', '숨었다 나타나면 웃으며 반응해요'),
    m('d1-7', '낯가림을 해요', '사회성', '낯선 사람을 보면 불안해하거나 울어요'),
    m('d1-8', '"안돼"를 이해해요', '언어', '"안돼"라고 하면 동작을 멈추거나 반응해요'),
    m('d1-9', '컵으로 마실 수 있어요', '자조', '도움을 받아 컵으로 물을 마셔요'),
    m('d1-10', '손가락으로 가리켜요', '인지', '원하는 것을 손가락으로 가리켜 표현해요'),
  ];
  if (months <= 18) return [
    m('d2-1', '혼자 걸어요', '대근육', '도움 없이 여러 걸음을 걸을 수 있어요'),
    m('d2-2', '블록 2~3개를 쌓아요', '소근육', '작은 블록을 위로 쌓을 수 있어요'),
    m('d2-3', '숟가락을 사용해요', '자조', '숟가락으로 음식을 떠서 입에 넣으려 시도해요'),
    m('d2-4', '단어를 3개 이상 말해요', '언어', '"엄마", "아빠", "맘마" 등 의미 있는 단어를 사용해요'),
    m('d2-5', '간단한 지시를 따라요', '인지', '"공 가져와", "여기 앉아" 등을 이해하고 따라요'),
    m('d2-6', '모방 놀이를 해요', '사회성', '전화 받는 흉내, 청소하는 흉내를 내요'),
    m('d2-7', '계단을 기어 올라가요', '대근육', '네발로 기어서 계단을 올라갈 수 있어요'),
    m('d2-8', '끼적이기를 해요', '소근육', '크레용이나 연필로 종이에 자유롭게 그어요'),
    m('d2-9', '신발을 벗으려 시도해요', '자조', '신발이나 양말을 벗으려는 시도를 해요'),
    m('d2-10', '거울 속 자기를 알아봐요', '인지', '거울을 보고 자기 모습을 인식해요'),
  ];
  if (months <= 24) return [
    m('d3-1', '뛰기를 시작해요', '대근육', '두 발로 뛰거나 빠르게 걸어요'),
    m('d3-2', '공을 발로 차요', '대근육', '서 있는 자세에서 공을 발로 찰 수 있어요'),
    m('d3-3', '두 단어를 조합해요', '언어', '"엄마 줘", "물 줘" 같은 두 단어 문장을 만들어요'),
    m('d3-4', '뚜껑을 열고 닫아요', '소근육', '병뚜껑이나 상자 뚜껑을 돌려 열어요'),
    m('d3-5', '색깔 1~2개를 구분해요', '인지', '"빨간색 줘"라고 하면 맞는 색을 고를 수 있어요'),
    m('d3-6', '또래에 관심을 보여요', '사회성', '다른 아이를 관찰하거나 옆에서 놀아요'),
    m('d3-7', '세로선을 따라 그어요', '소근육', '위에서 아래로 선을 그을 수 있어요'),
    m('d3-8', '혼자 손을 씻으려 해요', '자조', '수도꼭지를 틀고 손을 비비는 시도를 해요'),
    m('d3-9', '자기 이름에 반응해요', '언어', '이름을 부르면 "네" 하고 반응해요'),
    m('d3-10', '감정 표현이 다양해요', '정서', '기쁨, 슬픔, 화남 등을 표정과 몸짓으로 표현해요'),
  ];
  if (months <= 36) return [
    m('d4-1', '한 발로 잠깐 서요', '대근육', '한 발로 1~2초 균형을 잡을 수 있어요'),
    m('d4-2', '세발자전거를 타요', '대근육', '페달을 밟아 세발자전거를 움직일 수 있어요'),
    m('d4-3', '가위질을 시도해요', '소근육', '안전 가위로 종이를 자르려 시도해요'),
    m('d4-4', '원을 그릴 수 있어요', '소근육', '동그라미 모양을 그릴 수 있어요'),
    m('d4-5', '3~4단어 문장을 말해요', '언어', '"나 과자 먹고 싶어"처럼 긴 문장을 사용해요'),
    m('d4-6', '1~5까지 세어요', '인지', '물건을 하나씩 가리키며 숫자를 세요'),
    m('d4-7', '차례를 지킬 수 있어요', '사회성', '놀이에서 순서를 기다릴 수 있어요'),
    m('d4-8', '혼자 옷을 입으려 해요', '자조', '간단한 옷을 혼자 입거나 벗으려 시도해요'),
    m('d4-9', '친구 이름을 기억해요', '사회성', '함께 노는 친구의 이름을 말할 수 있어요'),
    m('d4-10', '왜? 질문을 자주 해요', '인지', '"왜?" "뭐야?"라는 질문을 반복해요'),
  ];
  if (months <= 48) return [
    m('d5-1', '한 발로 뛸 수 있어요', '대근육', '한 발로 여러 번 점프할 수 있어요'),
    m('d5-2', '공을 던지고 받아요', '대근육', '두 손으로 공을 받을 수 있어요'),
    m('d5-3', '사각형을 그려요', '소근육', '네모 모양을 그릴 수 있어요'),
    m('d5-4', '단추를 끼울 수 있어요', '자조', '큰 단추를 스스로 끼울 수 있어요'),
    m('d5-5', '이야기를 만들어요', '언어', '간단한 이야기를 순서대로 말할 수 있어요'),
    m('d5-6', '기본 도형을 구분해요', '인지', '동그라미, 세모, 네모를 구분해요'),
    m('d5-7', '규칙 있는 놀이를 해요', '사회성', '숨바꼭질, 보드게임 등 규칙을 따라요'),
    m('d5-8', '혼자 화장실을 가요', '자조', '도움 없이 화장실을 사용할 수 있어요'),
    m('d5-9', '과거 경험을 이야기해요', '인지', '"어제 공원 갔었어"처럼 과거를 말해요'),
    m('d5-10', '친구와 협력 놀이를 해요', '사회성', '역할을 나눠서 함께 놀 수 있어요'),
  ];
  if (months <= 72) return [
    m('d6-1', '줄넘기를 할 수 있어요', '대근육', '줄넘기를 연속으로 여러 번 넘을 수 있어요'),
    m('d6-2', '자기 이름을 ��요', '소근육', '한글로 자기 이름을 쓸 수 있어요'),
    m('d6-3', '긴 문장으로 설명해요', '언어', '경험이나 느낌을 여러 문장으로 설명해요'),
    m('d6-4', '10까지 세고 더해요', '인지', '간단한 덧셈과 뺄셈을 할 수 있어요'),
    m('d6-5', '친구와 갈등을 해결해요', '사회성', '말로 문제를 해결하려 시도해요'),
    m('d6-6', '자기감정을 말로 표현해요', '정서', '"화가 나", "슬퍼"라고 말할 수 있어요'),
    m('d6-7', '가위로 모양을 오려요', '소근육', '선을 따라 정확하게 오릴 수 있어요'),
    m('d6-8', '혼자 세수하고 양치해요', '자조', '아침저녁 위생 습관을 스스로 해요'),
    m('d6-9', '시계 개념을 이해해요', '인지', '"3시", "점심시간" 같은 시간 개념을 알아요'),
    m('d6-10', '상대 감정을 이해해요', '정서', '친구가 울면 위로하려는 행동을 해요'),
  ];
  // 초등 이상
  return [
    m('d7-1', '복잡한 운동을 해요', '대근육', '수영, 자전거, 구기 운동 등을 할 수 있어요'),
    m('d7-2', '글씨를 정교하게 써요', '소근육', '알아보기 쉽게 또박또박 글을 써요'),
    m('d7-3', '독서를 즐겨요', '언어', '혼자서 책을 읽고 내용을 이해해요'),
    m('d7-4', '문제 해결 능력이 있어요', '인지', '스스로 방법을 찾아 문제를 해결해요'),
    m('d7-5', '또래 관계를 잘 맺어요', '사회성', '친구를 사귀고 우정을 유지해요'),
    m('d7-6', '감정 조절을 해요', '정서', '화가 나도 참고 적절히 표현해요'),
    m('d7-7', '일기나 편지를 써요', '언어', '자기 생각을 글로 표현할 수 있어요'),
    m('d7-8', '스스로 준비물을 챙겨요', '자조', '학교 가방을 스스로 정리해요'),
    m('d7-9', '시간 관리를 시도해요', '인지', '숙제 시간, 놀이 시간을 스스로 계획해요'),
    m('d7-10', '단체 활동에 참여해요', '사회성', '학교 활동이나 동아리에 적극 참여해요'),
  ];
}

/* ------------------------------------------------------------------ */
/* Milestones Tab                                                      */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MilestonesTab() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [loading, setLoading] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneData | null>(null);
  const [error, setError] = useState(false);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          items: items.length > 0 ? items : getDefaultMilestones(months),
          nextMilestone: typeof rawObj.nextMilestone === 'string' ? rawObj.nextMilestone : '',
          daysUntilNext: typeof rawObj.daysUntilNext === 'number' ? rawObj.daysUntilNext : 0,
        };
        if (!parsed.ageLabel) parsed.ageLabel = getAgeLabel(months);
        setMilestones(parsed);
        const initial: Record<string, boolean> = {};
        parsed.items.forEach((item) => { initial[item.id] = item.completed; });
        setToggled(initial);
      })
      .catch(() => {
        // API 실패 시 기본 체크리스트 표시
        const fallback = getDefaultMilestones(months);
        setMilestones({
          ageLabel: getAgeLabel(months),
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
            발달 체크리스트를 불러올 수 없습니다
          </Text>
        </View>
      </View>
    );
  }

  const items = milestones.items ?? [];
  const completedCount = items.filter((item) => toggled[item.id]).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  // 서버에서 domain이 내려오므로 직접 매핑
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
    const style = DOMAIN_STYLE[item.domain];
    if (style) return { ...style, label: item.domain };
    return { emoji: '📋', label: item.domain || '발달', color: '#636366' };
  }

  // 발달 진행 요약 통계
  const domainCounts: Record<string, { total: number; done: number }> = {};
  items.forEach((item) => {
    const tag = getDomainTag(item);
    if (!domainCounts[tag.label]) domainCounts[tag.label] = { total: 0, done: 0 };
    domainCounts[tag.label].total += 1;
    if (toggled[item.id]) domainCounts[tag.label].done += 1;
  });

  const domainSummary = Object.entries(domainCounts).map(([label, counts]) => ({
    label,
    ...counts,
    emoji: DOMAIN_STYLE[label]?.emoji ?? '📋',
    color: DOMAIN_STYLE[label]?.color ?? '#636366',
  }));

  return (
    <View>
      {/* Current Milestone Card */}
      <View style={[msStyles.gradientCard, { backgroundColor: '#F4A98C' }]}>
        <Text style={msStyles.gradientTitle}>
          {milestones.ageLabel} 발달 체크
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
            ? '모든 발달 항목을 달성했어요!'
            : progress >= 0.7
            ? '순조롭게 발달하고 있어요!'
            : '천천히 아이 속도에 맞춰주세요'}
        </Text>
      </View>

      {/* 영역별 발달 현황 */}
      {domainSummary.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>영역별 발달 현황</Text>
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
        <Text style={styles.cardTitle}>발달 체크리스트</Text>
        <Text style={msStyles.checkHint}>항목을 눌러 체크하고, 다시 눌러 확인 방법을 보세요</Text>
        {items.map((item) => {
          const tag = getDomainTag(item);
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
                    {item.label}
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
                  <Text style={msStyles.descText}>{item.description}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* 발달 팁 카드 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{'발달 촉진 팁'}</Text>
        <View style={msStyles.tipCard}>
          <Text style={msStyles.tipTitle}>{'이 시기에 중요한 것'}</Text>
          <Text style={msStyles.tipBody}>
            {progress < 0.5
              ? '아직 달성하지 못한 항목이 있어도 걱정하지 마세요. 아이마다 발달 속도가 달라요. 충분한 놀이와 상호작용이 가장 좋은 자극이에요.'
              : '많은 항목을 달성했네요! 이 시기에는 다양한 경험을 제공해주는 것이 중요해요. 새로운 장난감, 바깥 활동, 또래 놀이를 시도해보세요.'}
          </Text>
        </View>
        <View style={msStyles.tipCard}>
          <Text style={msStyles.tipTitle}>{'부모가 도와줄 수 있는 것'}</Text>
          <Text style={msStyles.tipBody}>
            {completedCount < totalCount
              ? '미달성 항목은 아이와 함께 놀이하면서 자연스럽게 연습해보세요. 강요하지 않고, 아이가 흥미를 보일 때 격려해주는 것이 효과적이에요.'
              : '모든 항목을 달성했다면 다음 단계의 발달을 준비해보세요. 조금 더 도전적인 활동으로 자연스럽게 이어가면 좋아요.'}
          </Text>
        </View>
      </View>

      {/* Next Milestone */}
      <View style={[msStyles.nextCard, { backgroundColor: '#7DD3B8' }]}>
        <Text style={msStyles.nextLabel}>다음 목표</Text>
        <Text style={msStyles.nextTitle}>{milestones.nextMilestone}</Text>
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

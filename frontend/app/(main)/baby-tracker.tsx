import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Animated,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';  // 임시 — 커스텀 라벨용
 
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
// useTrackerStore는 storage.ts의 saveRecords에서 자동 호출 — 여기 import 불필요
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { getDailyReference, calcFeedIntervalProgress } from '../../constants/dailyReference';
import { getTrackerTabs, getFeedingTypes } from '../../constants/ageFeatures';
import type { AgeGroupKey } from '../../constants/ageGroups';
import PregnancyScreen from './pregnancy';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';
import type {
  BreastSession,
  BreastSide,
  DayStat,
  DaySummary,
  DiaperSubType,
  FeedingSubType,
  RecordType,
  SleepSession,
  SleepSubType,
  TrackerRecord,
} from '../../features/baby-tracker/types';
import {
  generateId,
  formatDate,
  formatDateKorean,
  isToday,
  nowTime,
  getRelativeTime,
  calcDurationMinutes,
  formatMinutes,
} from '../../features/baby-tracker/utils/time';
import { computeSummary, getBreastMlPerMin, estimateBreastMl } from '../../features/baby-tracker/utils/summary';
import { PhotoLogReview } from '../../components/baby-tracker/PhotoLogReview';
import { BabyTrackerGuide } from '../../components/baby-tracker/BabyTrackerGuide';
import { DayClock } from '../../components/baby-tracker/DayClock';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestPinVoiceShortcut } from '../../modules/shortcut-pin/src';
import {
  loadRecords,
  saveRecords,
  loadSleepSession,
  saveSleepSession,
  loadBreastSession,
  saveBreastSession,
  loadRangeStats,
  loadHintRemaining,
  decrementHint,
  loadFormulaDefault,
  saveFormulaDefault,
  syncRangeFromServer,
  syncSessionsFromServer,
} from '../../features/baby-tracker/storage';
import { resolveAuthorMeta, resolveCanEditRecords, stampAuthor, type AuthorMeta } from '../../features/baby-tracker/author';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

 
const IC_POOP = require('../../assets/cat-poop.png') as number;
const IC_FEED = require('../../assets/cat-eating.png') as number;
const IC_SLEEP = require('../../assets/cat-sleep.png') as number;
const IC_SUNNY = require('../../assets/weather-sunny.png') as number;
const IC_NIGHT = require('../../assets/weather-night.png') as number;
const IC_EMPTY = require('../../assets/empty-diary.png') as number;
const IC_MASCOT_EAT = require('../../assets/mascot-eating.png') as number;
const IC_MIC = require('../../assets/icon-mic.png') as number;
const IC_MEDICATION = require('../../assets/icon-hospital.png') as number;
const IC_CUSTOM = require('../../assets/icon-mic.png') as number;

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 아기시간 첫 진입 가이드 표시 여부 플래그
const BABY_GUIDE_SHOWN_KEY = 'amatda_baby_tracker_guide_shown';
// 홈 화면 음성입력 아이콘 추가 프롬프트 1회 표시 플래그
const VOICE_PIN_PROMPTED_KEY = 'amatda_voice_pin_prompted';

/**
 * 첫 실행(아기시간 가이드 완료) 직후 1회만:
 * 홈 화면에 "음성 기록" 단축 아이콘을 추가할지 동의 프롬프트.
 * - 안드로이드 전용 (iOS는 애플 정책상 홈 아이콘 추가 불가)
 * - 지원 안 하는 런처/OS는 조용히 패스 (플래그는 세팅해 재차 묻지 않음)
 */
async function promptVoicePinOnce(t: TFunction, force = false): Promise<void> {
  try {
    if (Platform.OS !== 'android') return;
    const already = await AsyncStorage.getItem(VOICE_PIN_PROMPTED_KEY);
    if (already && !force) return; // force(가이드 '?' 재열람 완료)면 다시 물어봄
    Alert.alert(
      t('babyTracker.voicePin.title'),
      t('babyTracker.voicePin.desc'),
      [
        {
          text: t('babyTracker.voicePin.later'),
          style: 'cancel',
          onPress: () => { AsyncStorage.setItem(VOICE_PIN_PROMPTED_KEY, '1').catch(() => {}); },
        },
        {
          text: t('babyTracker.voicePin.add'),
          onPress: async () => {
            AsyncStorage.setItem(VOICE_PIN_PROMPTED_KEY, '1').catch(() => {});
            const result = await requestPinVoiceShortcut();
            // 자동 핀을 막는 런처(One UI 일부/Nova 등) → 수동 방법 안내
            if (!result.ok) {
              Alert.alert(
                t('babyTracker.voicePin.manualTitle'),
                t('babyTracker.voicePin.manualDesc'),
              );
            }
          },
        },
      ],
    );
  } catch { /* ignore */ }
}

const TRACKER_COLORS = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  accent: '#FF8C5A',
  accentLight: '#FFF0E6',
  diaper: '#A0D2DB',
  diaperLight: '#E8F5F7',
  diaperDark: '#6AAFBB',
  feeding: '#FFD76E',
  feedingLight: '#FFF8E1',
  feedingDark: '#E6B84D',
  sleep: '#B8A0D2',
  sleepLight: '#F0EBF7',
  sleepDark: '#8F73B5',
  medication: '#7CB342',          // 투약: 초록 (보건/안전 톤)
  medicationLight: '#E8F5E1',
  medicationDark: '#558B2F',
  custom: '#9575CD',              // 커스텀: 라일락 보라
  customLight: '#EDE7F6',
  customDark: '#5E35B1',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#ABABAB',
  border: '#E5E5EA',
  danger: '#FF6B6B',
  white: '#FFFFFF',
};

// label 필드는 i18n 키 접미사를 담는다 (표시 시 t(`babyTracker.tabs.${label}`) 등으로 조회).
const TAB_CONFIG: { key: RecordType; icon: number; label: string; color: string }[] = [
  { key: 'diaper', icon: IC_POOP, label: 'diaper', color: TRACKER_COLORS.diaper },
  { key: 'feeding', icon: IC_FEED, label: 'feeding', color: TRACKER_COLORS.feeding },
  { key: 'sleep', icon: IC_SLEEP, label: 'sleep', color: TRACKER_COLORS.sleep },
  { key: 'medication', icon: IC_MEDICATION, label: 'medication', color: TRACKER_COLORS.medication },
];

const DIAPER_OPTIONS: { key: DiaperSubType; label: string; icon: number }[] = [
  { key: 'pee', label: 'pee', icon: IC_POOP },
  { key: 'poop', label: 'poop', icon: IC_POOP },
  { key: 'both', label: 'both', icon: IC_POOP },
];

// FEEDING_OPTIONS — 미사용(dead code, 실제로는 ageFeatures.getFeedingTypes prop 사용). 번역 대상 아님.
const FEEDING_OPTIONS: { key: FeedingSubType; label: string; icon: number }[] = [
  { key: 'breast', label: '모유', icon: IC_MASCOT_EAT },
  { key: 'formula', label: '분유', icon: IC_FEED },
  { key: 'baby_food', label: '이유식', icon: IC_FEED },
  { key: 'snack', label: '간식', icon: IC_FEED },
];

const SLEEP_OPTIONS: { key: SleepSubType; label: string; icon: number }[] = [
  { key: 'nap', label: 'nap', icon: IC_SUNNY },
  { key: 'night', label: 'night', icon: IC_NIGHT },
];

// 값은 i18n 키 접미사(babyTracker.subtypes.*) — SUBTYPE_LABELS[x] 직접 렌더 금지,
// 반드시 getSubtypeLabel(x, t) 을 통해 표시 문구로 변환할 것.
const SUBTYPE_LABELS: Record<string, string> = {
  pee: 'pee',
  poop: 'poop',
  both: 'both',
  breast: 'breast',
  formula: 'formula',
  baby_food: 'babyFood',
  snack: 'snack',
  nap: 'nap',
  night: 'night',
  sleep: 'sleep',
  sleep_start: 'sleep',     // '수면 시작' → '수면' (사용자 요청, 화면 간결화)
  sleep_end: 'wake',
  // 투약 (Phase 4-A)
  fever: 'fever',
  antibiotic: 'antibiotic',
  vitamin: 'vitamin',
  other: 'otherMed',
};

function getSubtypeLabel(subType: string, t: TFunction): string {
  const key = SUBTYPE_LABELS[subType];
  return key ? t(`babyTracker.subtypes.${key}`) : subType;
}

const SUBTYPE_ICONS: Record<string, number> = {
  pee: IC_POOP,
  poop: IC_POOP,
  both: IC_POOP,
  breast: IC_MASCOT_EAT,
  formula: IC_FEED,
  baby_food: IC_FEED,
  snack: IC_FEED,
  nap: IC_SUNNY,
  night: IC_NIGHT,
  sleep: IC_SLEEP,
  sleep_start: IC_SLEEP,
  sleep_end: IC_SUNNY,
  // 투약 (Phase 4-A) — 임시로 IC_BADGE_DB 사용 (별도 약 아이콘 없음)
  fever: IC_MEDICATION,
  antibiotic: IC_MEDICATION,
  vitamin: IC_MEDICATION,
  other: IC_MEDICATION,
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

/* ================================================================== */
/*  Helpers / Types / Storage                                          */
/*  Moved to frontend/features/baby-tracker/* (see top-of-file imports) */
/* ================================================================== */

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

/* ---- Time Picker ---- */

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  label: string;
}

function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [h, m] = value.split(':');
  const selectedHour = h || '00';
  const selectedMinute = m || '00';

  const roundedMinute = useMemo(() => {
    const mn = parseInt(selectedMinute, 10);
    const rounded = Math.round(mn / 5) * 5;
    return String(rounded >= 60 ? 55 : rounded).padStart(2, '0');
  }, [selectedMinute]);

  return (
    <View style={tpStyles.container}>
      <Text style={tpStyles.label}>{label}</Text>
      <View style={tpStyles.pickerRow}>
        <ScrollView
          style={tpStyles.column}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {HOURS.map((hr) => (
            <TouchableOpacity
              key={hr}
              style={[tpStyles.cell, selectedHour === hr && tpStyles.cellActive]}
              onPress={() => onChange(`${hr}:${roundedMinute}`)}
            >
              <Text style={[tpStyles.cellText, selectedHour === hr && tpStyles.cellTextActive]}>
                {hr}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={tpStyles.separator}>:</Text>
        <ScrollView
          style={tpStyles.column}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {MINUTES.map((mn) => (
            <TouchableOpacity
              key={mn}
              style={[tpStyles.cell, roundedMinute === mn && tpStyles.cellActive]}
              onPress={() => onChange(`${selectedHour}:${mn}`)}
            >
              <Text style={[tpStyles.cellText, roundedMinute === mn && tpStyles.cellTextActive]}>
                {mn}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const tpStyles = StyleSheet.create({
  container: { marginBottom: SPACING.md },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
    marginBottom: SPACING.xs,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TRACKER_COLORS.bg,
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    height: 120,
  },
  column: { flex: 1 },
  separator: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginHorizontal: SPACING.sm,
  },
  cell: {
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 1,
  },
  cellActive: { backgroundColor: TRACKER_COLORS.accent },
  cellText: { fontSize: FONT_SIZE.md, color: TRACKER_COLORS.textSub },
  cellTextActive: { color: TRACKER_COLORS.white, fontWeight: '700' },
});

/* ---- Summary Badge ---- */

interface SummaryBadgeProps {
  icon: number;
  value: string;
  label: string;
  color: string;
  bgColor: string;
  active?: boolean;
  onPress?: () => void;
  subValue?: string;
}

function SummaryBadge({ icon, value, label, color, bgColor, active, onPress, subValue }: SummaryBadgeProps) {
  const Wrapper: React.ComponentType<any> = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[
        badgeStyles.container,
        { backgroundColor: bgColor },
        active && { borderWidth: 2, borderColor: color },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[badgeStyles.circle, { borderColor: color }]}>
        <Image source={icon} style={badgeStyles.iconImg} resizeMode="contain" />
        <Text style={[badgeStyles.value, { color }]}>{value}</Text>
        {subValue ? (
          <Text style={[badgeStyles.subValue, { color }]}>{subValue}</Text>
        ) : null}
      </View>
      <Text style={badgeStyles.label}>{label}</Text>
    </Wrapper>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginHorizontal: 4,
  },
  circle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TRACKER_COLORS.white,
    marginBottom: SPACING.xs,
  },
  iconImg: { width: 24, height: 24, marginBottom: 2, borderRadius: 6 },
  value: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  subValue: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
    marginTop: 2,
  },
});

/* ---- Record Card (timeline item) ---- */

interface RecordCardProps {
  record: TrackerRecord;
  onDelete: (id: string) => void;
}

function RecordCard({ record, onDelete }: RecordCardProps) {
  const typeColor =
    record.type === 'diaper'
      ? TRACKER_COLORS.diaper
      : record.type === 'feeding'
        ? TRACKER_COLORS.feeding
        : TRACKER_COLORS.sleep;

  const typeBg =
    record.type === 'diaper'
      ? TRACKER_COLORS.diaperLight
      : record.type === 'feeding'
        ? TRACKER_COLORS.feedingLight
        : TRACKER_COLORS.sleepLight;

  const subIcon = SUBTYPE_ICONS[record.subType] ?? IC_POOP;
  const subLabel = SUBTYPE_LABELS[record.subType] ?? record.subType;

  let detail = '';
  if (record.type === 'feeding' && record.amount) {
    detail = `${record.amount}ml`;
  }
  if (record.type === 'feeding' && record.duration) {
    detail = detail ? `${detail} / ${formatMinutes(record.duration)}` : formatMinutes(record.duration);
  }
  if (record.type === 'sleep' && record.endTime) {
    const dur = record.duration ?? calcDurationMinutes(record.time, record.endTime);
    detail = `${record.time} ~ ${record.endTime} (${formatMinutes(dur)})`;
  } else if (record.type === 'sleep' && record.duration) {
    detail = formatMinutes(record.duration);
  }

  return (
    <View style={rcStyles.container}>
      <View style={rcStyles.timeCol}>
        <Text style={rcStyles.time}>{record.time}</Text>
        <View style={[rcStyles.dot, { backgroundColor: typeColor }]} />
        <View style={[rcStyles.line, { backgroundColor: typeColor }]} />
      </View>
      <View style={[rcStyles.card, { borderLeftColor: typeColor, borderLeftWidth: 3 }]}>
        <View style={rcStyles.cardHeader}>
          <View style={[rcStyles.typeBadge, { backgroundColor: typeBg }]}>
            <Image source={subIcon} style={rcStyles.subIcon} resizeMode="contain" />
            <Text style={rcStyles.typeBadgeText}>
              {subLabel}
            </Text>
          </View>
          <TouchableOpacity
            style={rcStyles.deleteBtn}
            onPress={() => onDelete(record.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={rcStyles.deleteText}>{'\u{2715}'}</Text>
          </TouchableOpacity>
        </View>
        {detail ? <Text style={rcStyles.detail}>{detail}</Text> : null}
        {record.note ? <Text style={rcStyles.note}>{record.note}</Text> : null}
      </View>
    </View>
  );
}

const rcStyles = StyleSheet.create({
  container: { flexDirection: 'row', marginBottom: 4 },
  timeCol: { width: 56, alignItems: 'center', paddingTop: 14 },
  time: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: TRACKER_COLORS.textSub, marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, flex: 1, marginTop: 2, opacity: 0.3 },
  card: {
    flex: 1,
    backgroundColor: TRACKER_COLORS.card,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  subIcon: { width: 16, height: 16, borderRadius: 4 },
  typeBadgeText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: TRACKER_COLORS.text },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { fontSize: 12, color: TRACKER_COLORS.danger, fontWeight: '700' },
  detail: {
    fontSize: FONT_SIZE.sm,
    color: TRACKER_COLORS.text,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
  note: {
    fontSize: FONT_SIZE.xs,
    color: TRACKER_COLORS.textLight,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

/* ---- Empty State ---- */

function EmptyTimeline({ tab }: { tab: RecordType }) {
  const { t } = useTranslation();
  const cfg = TAB_CONFIG.find((tc) => tc.key === tab);
  const label = cfg ? t(`babyTracker.tabs.${cfg.label}`) : '';
  return (
    <View style={emptyStyles.container}>
      <Image source={cfg?.icon ?? IC_EMPTY} style={emptyStyles.iconImg} resizeMode="contain" />
      <Text style={emptyStyles.title}>{t('babyTracker.noRecordsYet')}</Text>
      <Text style={emptyStyles.sub}>
        {t('babyTracker.emptyTimelineHint', { label })}
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  iconImg: { width: 56, height: 56, marginBottom: SPACING.md, borderRadius: 12 },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginBottom: SPACING.sm,
  },
  sub: {
    fontSize: FONT_SIZE.sm,
    color: TRACKER_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
});

/* ---- Weekly Summary Table (그래프 대신 표 요약 — 모든 타입 한번에) ---- */

function getPeriodLabel(days: number, t: TFunction): string {
  if (days === 7) return t('babyTracker.period.week');
  if (days === 14) return t('babyTracker.period.twoWeeks');
  if (days === 31) return t('babyTracker.period.month');
  return t('babyTracker.period.days', { count: days });
}

function WeeklySummaryTable({
  stats,
  periodDays = 7,
}: {
  stats: DayStat[];
  activeTab?: RecordType;
  periodDays?: number;
}) {
  const { t } = useTranslation();
  // 최근이 뒤(배열 끝) → 상단에 표시되도록 역순
  const rows = [...stats].reverse();

  // 컬럼별 최대값 — 셀 배경 강도 계산용
  const maxDiaper = Math.max(...stats.map((s) => s.diaper), 1);
  // 수유는 분유 / 모유 각각 별도 컬럼 표시
  const maxFormula = Math.max(...stats.map((s) => s.formulaMl), 1);
  const maxBreast = Math.max(...stats.map((s) => s.breastMl), 1);
  const maxSleep = Math.max(...stats.map((s) => s.sleepMin), 1);

  const intensity = (v: number, max: number): string => {
    if (v <= 0) return 'transparent';
    const ratio = Math.min(1, v / max);
    // 연한 배경으로 강도만 표현 (막대 대신)
    const alpha = 0.08 + ratio * 0.22; // 0.08 ~ 0.30
    return `rgba(255, 140, 90, ${alpha})`;
  };

  return (
    <View style={summaryStyles.container}>
      <Text style={summaryStyles.title}>
        {t('babyTracker.weeklyTable.title', { period: getPeriodLabel(periodDays, t) })}
      </Text>

      {/* 헤더 — 분유/모유 별도 표시 */}
      <View style={summaryStyles.headerRow}>
        <Text style={[summaryStyles.cellDate, summaryStyles.headerCell]}>{t('babyTracker.weeklyTable.date')}</Text>
        <Text style={[summaryStyles.cellVal, summaryStyles.headerCell]}>{t('babyTracker.tabs.diaper')}</Text>
        <Text style={[summaryStyles.cellVal, summaryStyles.headerCell]}>{t('babyTracker.subtypes.formula')}</Text>
        <Text style={[summaryStyles.cellVal, summaryStyles.headerCell]}>{t('babyTracker.subtypes.breast')}</Text>
        <Text style={[summaryStyles.cellVal, summaryStyles.headerCell]}>{t('babyTracker.subtypes.sleep')}</Text>
      </View>

      {rows.map((s, i) => {
        const isToday = i === 0;
        const sleepH = s.sleepMin / 60;
        return (
          <View
            key={s.dateStr}
            style={[
              summaryStyles.dataRow,
              isToday && summaryStyles.todayRow,
            ]}
          >
            <Text style={[summaryStyles.cellDate, isToday && summaryStyles.todayText]}>
              {isToday ? t('babyTracker.today') : s.dateLabel}
            </Text>
            <View style={[summaryStyles.cellValWrap, { backgroundColor: intensity(s.diaper, maxDiaper) }]}>
              <Text style={[summaryStyles.cellVal, isToday && summaryStyles.todayText]}>
                {s.diaper > 0 ? `${s.diaper}` : '-'}
              </Text>
            </View>
            <View style={[summaryStyles.cellValWrap, { backgroundColor: intensity(s.formulaMl, maxFormula) }]}>
              <Text style={[summaryStyles.cellVal, isToday && summaryStyles.todayText]}>
                {s.formulaMl > 0 ? `${s.formulaMl}ml` : '-'}
              </Text>
            </View>
            <View style={[summaryStyles.cellValWrap, { backgroundColor: intensity(s.breastMl, maxBreast) }]}>
              <Text style={[summaryStyles.cellVal, isToday && summaryStyles.todayText]}>
                {s.breastMl > 0 ? `${s.breastMl}ml` : '-'}
              </Text>
            </View>
            <View style={[summaryStyles.cellValWrap, { backgroundColor: intensity(s.sleepMin, maxSleep) }]}>
              <Text style={[summaryStyles.cellVal, isToday && summaryStyles.todayText]}>
                {sleepH > 0 ? `${sleepH >= 10 ? Math.round(sleepH) : sleepH.toFixed(1)}h` : '-'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  container: {
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    ...SHADOWS.soft,
  },
  title: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    paddingVertical: 4,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F4',
  },
  todayRow: {
    backgroundColor: '#FFF5EC',
  },
  cellDate: {
    width: 50,
    fontSize: 11,
    color: TRACKER_COLORS.textSub,
    textAlign: 'left',
    paddingLeft: 4,
  },
  cellValWrap: {
    flex: 1,
    marginHorizontal: 2,
    borderRadius: 4,
    paddingVertical: 2,
  },
  cellVal: {
    flex: 1,
    fontSize: 11,
    color: TRACKER_COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerCell: {
    fontSize: 10,
    color: TRACKER_COLORS.textLight,
    fontWeight: '700',
  },
  todayText: {
    color: '#FF8C5A',
    fontWeight: '600',
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    backgroundColor: TRACKER_COLORS.border,
  },
  periodBtnActive: {
    backgroundColor: TRACKER_COLORS.accent,
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
  },
  periodBtnTextActive: {
    color: TRACKER_COLORS.white,
  },
  voiceBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#EFEBFE',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9C8FE3',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  voiceBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6E5BC4',
  },
  // 인앱 음성입력 진입 버튼 (액센트 — 가장 눈에 띄게, iOS 포함 모든 기기 동작)
  voiceInputBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: TRACKER_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  voiceInputText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

// 이전 막대 차트는 제거됨 (대체: WeeklySummaryTable)
const WeeklyChart = WeeklySummaryTable;

/* ---- Day Summary Card ---- */
function DaySummaryCard({ summary }: { summary: DaySummary }) {
  const { t } = useTranslation();
  const { totalSleepMinutes, feedingCount, peeCount, poopCount } = summary;
  const sleepH = Math.floor(totalSleepMinutes / 60);
  const sleepM = totalSleepMinutes % 60;
  const sleepText = totalSleepMinutes > 0
    ? (sleepH > 0 && sleepM > 0 ? t('babyTracker.unit.hoursMinutes', { h: sleepH, m: sleepM })
        : sleepH > 0 ? t('babyTracker.unit.hoursOnly', { h: sleepH })
        : t('babyTracker.unit.minutesOnly', { m: sleepM }))
    : '0';
  const diaperTotal = peeCount + poopCount;
  // 변 부가 설명 (소/대 분리)
  const diaperSub = diaperTotal > 0
    ? (poopCount > 0 && peeCount > 0 ? t('babyTracker.daySummary.diaperBoth', { pee: peeCount, poop: poopCount })
        : poopCount > 0 ? t('babyTracker.daySummary.diaperPoopOnly', { poop: poopCount })
        : t('babyTracker.daySummary.diaperPeeOnly', { pee: peeCount }))
    : '';

  return (
    <View style={daySumStyles.row}>
      <View style={[daySumStyles.cell, { backgroundColor: TRACKER_COLORS.feedingLight }]}>
        <Text style={[daySumStyles.cellLabel, { color: TRACKER_COLORS.feedingDark }]}>{t('babyTracker.daySummary.feeding')}</Text>
        <Text style={[daySumStyles.cellValue, { color: TRACKER_COLORS.feedingDark }]}>
          {t('babyTracker.unit.times', { count: feedingCount })}
        </Text>
      </View>
      <View style={[daySumStyles.cell, { backgroundColor: TRACKER_COLORS.sleepLight }]}>
        <Text style={[daySumStyles.cellLabel, { color: TRACKER_COLORS.sleepDark }]}>{t('babyTracker.daySummary.sleep')}</Text>
        <Text style={[daySumStyles.cellValue, { color: TRACKER_COLORS.sleepDark }]}>
          {sleepText}
        </Text>
      </View>
      <View style={[daySumStyles.cell, { backgroundColor: TRACKER_COLORS.diaperLight }]}>
        <Text style={[daySumStyles.cellLabel, { color: TRACKER_COLORS.diaperDark }]}>{t('babyTracker.daySummary.diaper')}</Text>
        <Text style={[daySumStyles.cellValue, { color: TRACKER_COLORS.diaperDark }]}>
          {t('babyTracker.unit.times', { count: diaperTotal })}
        </Text>
        {diaperSub ? (
          <Text style={[daySumStyles.cellSub, { color: TRACKER_COLORS.diaperDark }]}>{diaperSub}</Text>
        ) : null}
      </View>
    </View>
  );
}

const daySumStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  cellValue: { fontSize: 13, fontWeight: '700' },
  cellLabel: { fontSize: 11, fontWeight: '700', opacity: 0.85 },
  cellSub: { fontSize: 10, fontWeight: '600', opacity: 0.7 },
});

/* ---- Daily Reference Card (권장량 진행 막대) ----
 *
 * 사용자 요청 (2026-04-28):
 *   '개월수별 표준 수면 시간 및 수유량을 표시'
 *   '식사량은 몸무게 기준'
 *   '수유텀'도 표시
 *
 * 표시 항목 (모두 진행 막대):
 *   1) 마지막 수유 후 경과 시간 / 권장 텀 → 다음 수유 카운트다운
 *   2) 분유량 / 권장 분유량 (몸무게 × 계수) → 일일 누적
 *   3) 수면 / 권장 수면 (개월수 기준) → 일일 누적
 */
interface DailyReferenceCardProps {
  ageMonths: number;
  weightKg: number | null | undefined;
  formulaMlToday: number;
  totalSleepMinutesToday: number;
  /** 마지막 수유 시각으로부터 경과 분 (-1이면 오늘 수유 없음) */
  minutesSinceLastFeed: number;
}

function DailyReferenceCard({
  ageMonths,
  weightKg,
  formulaMlToday,
  totalSleepMinutesToday,
  minutesSinceLastFeed,
}: DailyReferenceCardProps) {
  const { t } = useTranslation();
  const ref = useMemo(() => getDailyReference(ageMonths, weightKg), [ageMonths, weightKg]);

  // 분유 진행률 (목표 = max 권장량)
  const formulaPct = ref.formulaMlMax > 0
    ? Math.min(1.5, formulaMlToday / ref.formulaMlMax)
    : 0;

  // 수면 진행률 (목표 = max 권장 시간 × 60분)
  const sleepTargetMin = ref.sleepHrMax * 60;
  const sleepPct = sleepTargetMin > 0
    ? Math.min(1.5, totalSleepMinutesToday / sleepTargetMin)
    : 0;

  // 수유 텀 진행률
  const feedPct = minutesSinceLastFeed >= 0
    ? calcFeedIntervalProgress(minutesSinceLastFeed, ref.feedIntervalHrMax)
    : 0;

  const showFeedRow = ref.feedIntervalHrMax > 0;
  const showFormulaRow = ref.formulaMlMax > 0;

  // 모두 비활성이면(예: 36개월+ 일반식) 카드 자체 숨김
  if (!showFeedRow && !showFormulaRow && sleepTargetMin === 0) {
    return null;
  }

  // 컴팩트 시간 포맷 (좁은 컬럼에 한 줄로 들어가도록)
  const compactMin = (m: number): string => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h === 0) return `${mm}m`;
    if (mm === 0) return `${h}h`;
    return `${h}h ${mm}m`;
  };

  // 텀 텍스트 — 짧게
  // 라벨: "수유 텀" → "식사 텀" — 모유/분유/이유식/간식 모두 포함됨을 명확히 (사용자 피드백)
  const feedText = minutesSinceLastFeed < 0
    ? t('babyTracker.dailyRef.firstMeal')
    : compactMin(minutesSinceLastFeed);

  return (
    <View>
    <View style={dailyRefStyles.card}>
      {showFeedRow && (
        <View style={dailyRefStyles.col}>
          <Text style={dailyRefStyles.colLabel}>{t('babyTracker.dailyRef.mealInterval')}</Text>
          <Text
            style={dailyRefStyles.colValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {feedText}
          </Text>
          <Text style={dailyRefStyles.colHint} numberOfLines={1}>
            {t('babyTracker.dailyRef.mealIntervalHint', { hours: ref.feedIntervalHrMax })}
          </Text>
          <View style={dailyRefStyles.barTrack}>
            <View
              style={[
                dailyRefStyles.barFill,
                {
                  width: `${Math.min(100, feedPct * 100)}%`,
                  backgroundColor: feedPct >= 0.9 ? '#FF8C5A' : '#7CB342',
                },
              ]}
            />
          </View>
        </View>
      )}

      {showFormulaRow && (
        <View style={dailyRefStyles.col}>
          <Text style={dailyRefStyles.colLabel}>{t('babyTracker.dailyRef.dailyFormula')}</Text>
          <Text
            style={dailyRefStyles.colValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formulaMlToday}/{ref.formulaMlMax}ml
          </Text>
          <Text style={dailyRefStyles.colHint} numberOfLines={1}>
            {t('babyTracker.dailyRef.byWeightHint')}
          </Text>
          <View style={dailyRefStyles.barTrack}>
            <View
              style={[
                dailyRefStyles.barFill,
                {
                  width: `${Math.min(100, formulaPct * 100)}%`,
                  backgroundColor: formulaPct >= 1
                    ? '#7CB342'
                    : formulaPct >= 0.6 ? '#FFB74D' : '#FF8C5A',
                },
              ]}
            />
          </View>
        </View>
      )}

      {sleepTargetMin > 0 && (
        <View style={dailyRefStyles.col}>
          <Text style={dailyRefStyles.colLabel}>{t('babyTracker.dailyRef.dailySleep')}</Text>
          <Text
            style={dailyRefStyles.colValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {compactMin(totalSleepMinutesToday)}/{ref.sleepHrMax}h
          </Text>
          <Text style={dailyRefStyles.colHint} numberOfLines={1}>
            {t('babyTracker.dailyRef.byAgeHint')}
          </Text>
          <View style={dailyRefStyles.barTrack}>
            <View
              style={[
                dailyRefStyles.barFill,
                {
                  width: `${Math.min(100, sleepPct * 100)}%`,
                  backgroundColor: sleepPct >= 1
                    ? '#7CB342'
                    : sleepPct >= 0.6 ? '#FFB74D' : '#FF8C5A',
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
    <Text style={{ fontSize: 11, color: '#9A9AA0', textAlign: 'center', marginTop: 6, fontWeight: '600' }}>
      {t('babyTracker.dailyRef.autoCalcNote')}
    </Text>
    </View>
  );
}

// Phase 4-B (2026-04-28): 사용자 정의 라벨 입력 모달 스타일
const customModalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  sub: {
    fontSize: 12,
    color: '#636366',
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  recentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  recentLabel: {
    fontSize: 11,
    color: '#636366',
    fontWeight: '600',
    marginRight: 2,
  },
  recentChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: TRACKER_COLORS.customLight,
    borderWidth: 1,
    borderColor: '#D1C4E9',
  },
  recentChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: TRACKER_COLORS.customDark,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnCancel: { backgroundColor: '#F2F2F7' },
  btnSave: { backgroundColor: TRACKER_COLORS.customDark },
  btnCancelText: { fontSize: 14, fontWeight: '700', color: '#636366' },
  btnSaveText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});

// Phase 3 (2026-04-28): 기간 요약 접기/펴기 토글 스타일
const periodToggleStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.md,
    marginVertical: SPACING.sm,
    ...SHADOWS.soft,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
  },
  headerArrow: {
    fontSize: 12,
    color: TRACKER_COLORS.textSub,
    fontWeight: '700',
  },
});

const dailyRefStyles = StyleSheet.create({
  // 한 줄 3열 컴팩트 카드 (수유텀 / 일일분유 / 일일수면)
  card: {
    flexDirection: 'row',
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: SPACING.sm,
    gap: 6,
    ...SHADOWS.soft,
  },
  col: {
    flex: 1,
    paddingHorizontal: 6,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TRACKER_COLORS.textSub,
    marginBottom: 2,
  },
  colValue: {
    fontSize: 13,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
  },
  colHint: {
    fontSize: 9,
    fontWeight: '600',
    color: TRACKER_COLORS.textLight,
    marginTop: 1,
  },
  barTrack: {
    height: 4,
    backgroundColor: '#F0F0F2',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});

/* ================================================================== */
/*  Add Record Modal                                                   */
/* ================================================================== */

interface AddModalProps {
  visible: boolean;
  initialTab: RecordType;
  initialSubType?: string;
  onClose: () => void;
  onSave: (record: TrackerRecord) => void;
  availableTabs: typeof TAB_CONFIG;
  feedingOptions: { key: string; label: string; icon: number }[];
  // 단일 항목만 입력하도록 잠금 (예: 분유 전용 다이얼로그)
  lockSubType?: boolean;
  lockTitle?: string;
  // 분유량을 기본값으로 저장 (childId는 부모가 보유 → 콜백 위임)
  onSetDefaultFormula?: (ml: number) => void;
  // 현재 기본 분유량 (표시·프리필·해제용)
  defaultFormulaAmount?: number;
}

function AddRecordModal({ visible, initialTab, initialSubType, onClose, onSave, availableTabs, feedingOptions, lockSubType, lockTitle, onSetDefaultFormula, defaultFormulaAmount = 0 }: AddModalProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<RecordType>(initialTab);
  const [subType, setSubType] = useState<string>('');
  const [time, setTime] = useState(nowTime());
  const [endTime, setEndTime] = useState('');
  const [amount, setAmount] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [note, setNote] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setTab(initialTab);
      resetForm(initialTab, initialSubType);
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, initialTab, initialSubType, slideAnim]);

  // 분유 선택 시 기본 분유량 프리필 (값이 비어있을 때만 — 수정/해제 쉽게)
  useEffect(() => {
    if (visible && subType === 'formula' && defaultFormulaAmount > 0) {
      setAmount((cur) => (cur === '' ? String(defaultFormulaAmount) : cur));
    }
  }, [visible, subType, defaultFormulaAmount]);

  function resetForm(tabType: RecordType, sub?: string) {
    setTime(nowTime());
    setEndTime('');
    setAmount('');
    setDurationMin('');
    setNote('');
    setSaveAsDefault(false);
    if (sub) {
      setSubType(sub);
      return;
    }
    if (tabType === 'diaper') setSubType('pee');
    else if (tabType === 'feeding') setSubType('breast');
    else setSubType('nap');
  }

  function handleTabChange(newTab: RecordType) {
    setTab(newTab);
    resetForm(newTab);
  }

  function handleSave() {
    if (!subType) {
      Alert.alert('', t('babyTracker.selectTypeRequired'));
      return;
    }

    const record: TrackerRecord = {
      id: generateId(),
      type: tab,
      subType,
      time,
      createdAt: new Date().toISOString(),
    };

    if (tab === 'feeding') {
      const ml = parseInt(amount, 10);
      if (subType === 'formula' && ml > 0) {
        record.amount = ml;
        if (saveAsDefault) onSetDefaultFormula?.(ml);
      }
      const dur = parseInt(durationMin, 10);
      if (subType === 'breast' && dur > 0) record.duration = dur;
    }

    if (tab === 'sleep') {
      if (endTime) {
        record.endTime = endTime;
        record.duration = calcDurationMinutes(time, endTime);
      } else {
        const dur = parseInt(durationMin, 10);
        if (dur > 0) record.duration = dur;
      }
    }

    if (note.trim()) record.note = note.trim();

    onSave(record);
    onClose();
  }

  const options =
    tab === 'diaper'
      ? DIAPER_OPTIONS
      : tab === 'feeding'
        ? feedingOptions
        : SLEEP_OPTIONS;

  const currentColor =
    tab === 'diaper'
      ? TRACKER_COLORS.diaper
      : tab === 'feeding'
        ? TRACKER_COLORS.feeding
        : TRACKER_COLORS.sleep;

  const currentDarkColor =
    tab === 'diaper'
      ? TRACKER_COLORS.diaperDark
      : tab === 'feeding'
        ? TRACKER_COLORS.feedingDark
        : TRACKER_COLORS.sleepDark;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={modalStyles.overlay}
      >
        <TouchableOpacity style={modalStyles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[modalStyles.sheet, { transform: [{ translateY }] }]}>
          {/* Handle bar */}
          <View style={modalStyles.handleBar} />

          {/* 잠금 모드: 헤더 타이틀 표시 */}
          {lockSubType && lockTitle ? (
            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#1C1C1E' }}>
                {lockTitle}
              </Text>
            </View>
          ) : null}

          {/* Tab switcher (연령별 필터) */}
          {!lockSubType && (
          <View style={modalStyles.tabRow}>
            {availableTabs.map((tabItem) => (
              <TouchableOpacity
                key={tabItem.key}
                style={[
                  modalStyles.tabBtn,
                  tab === tabItem.key && { backgroundColor: tabItem.color },
                ]}
                onPress={() => handleTabChange(tabItem.key)}
              >
                <View style={modalStyles.tabBtnInner}>
                  <Image source={tabItem.icon} style={modalStyles.tabIcon} resizeMode="contain" />
                  <Text
                    style={[
                      modalStyles.tabBtnText,
                      tab === tabItem.key && modalStyles.tabBtnTextActive,
                    ]}
                  >
                    {t(`babyTracker.tabs.${tabItem.label}`)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          )}

          <ScrollView
            style={modalStyles.scrollBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Sub-type selector (잠금 모드에선 숨김) */}
            {!lockSubType && (
              <>
            <Text style={modalStyles.sectionTitle}>{t('babyTracker.selectType')}</Text>
            <View style={modalStyles.optionGrid}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    modalStyles.optionBtn,
                    subType === opt.key && { backgroundColor: currentColor, borderColor: currentColor },
                  ]}
                  onPress={() => setSubType(opt.key)}
                >
                  <Image source={opt.icon} style={modalStyles.optionIcon} resizeMode="contain" />
                  <Text
                    style={[
                      modalStyles.optionLabel,
                      subType === opt.key && { color: TRACKER_COLORS.white },
                    ]}
                  >
                    {tab === 'feeding' ? t(`babyTracker.feedingTypes.${opt.label}`) : t(`babyTracker.subtypes.${opt.label}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
              </>
            )}

            {/* Time picker */}
            <TimePicker value={time} onChange={setTime} label={t('babyTracker.time')} />

            {/* Sleep end time */}
            {tab === 'sleep' && (
              <TimePicker
                value={endTime || nowTime()}
                onChange={setEndTime}
                label={t('babyTracker.endTime')}
              />
            )}

            {/* Formula amount */}
            {tab === 'feeding' && subType === 'formula' && (
              <View style={modalStyles.inputRow}>
                <Text style={modalStyles.inputLabel}>{t('babyTracker.formulaAmountMl')}</Text>
                <TextInput
                  style={modalStyles.input}
                  keyboardType="number-pad"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder={t('babyTracker.exampleAmount120')}
                  placeholderTextColor={TRACKER_COLORS.textLight}
                  maxLength={4}
                />
              </View>
            )}

            {/* 기본 분유량 설정 체크박스 (분유일 때만) */}
            {tab === 'feeding' && subType === 'formula' && (
              <TouchableOpacity
                onPress={() => setSaveAsDefault((v) => !v)}
                onLongPress={() => {
                  if (defaultFormulaAmount > 0) {
                    Alert.alert(
                      t('babyTracker.defaultFormula.titleWithAmount', { amount: defaultFormulaAmount }),
                      t('babyTracker.defaultFormula.changeHint'),
                      [
                        { text: t('babyTracker.defaultFormula.unset'), style: 'destructive', onPress: () => { onSetDefaultFormula?.(0); setSaveAsDefault(false); setAmount(''); } },
                        { text: t('common.cancel'), style: 'cancel' },
                      ],
                    );
                  }
                }}
                delayLongPress={400}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 6, paddingHorizontal: 2 }}
              >
                <View style={{
                  width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, marginRight: 10,
                  borderColor: saveAsDefault ? '#FF8C5A' : '#C7C7CC',
                  backgroundColor: saveAsDefault ? '#FF8C5A' : '#FFFFFF',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {saveAsDefault ? <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>✓</Text> : null}
                </View>
                <Text style={{ fontSize: 13.5, color: '#555555', fontWeight: '600' }}>
                  {defaultFormulaAmount > 0
                    ? t('babyTracker.defaultFormula.currentWithHint', { amount: defaultFormulaAmount })
                    : t('babyTracker.defaultFormula.autoSaveHint')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Breast duration */}
            {tab === 'feeding' && subType === 'breast' && (
              <View style={modalStyles.inputRow}>
                <Text style={modalStyles.inputLabel}>{t('babyTracker.breastDurationMin')}</Text>
                <TextInput
                  style={modalStyles.input}
                  keyboardType="number-pad"
                  value={durationMin}
                  onChangeText={setDurationMin}
                  placeholder={t('babyTracker.exampleAmount15')}
                  placeholderTextColor={TRACKER_COLORS.textLight}
                  maxLength={3}
                />
              </View>
            )}

            {/* Note */}
            <View style={modalStyles.inputRow}>
              <Text style={modalStyles.inputLabel}>{t('babyTracker.noteOptional')}</Text>
              <TextInput
                style={[modalStyles.input, modalStyles.inputMultiline]}
                value={note}
                onChangeText={setNote}
                placeholder={
                  tab === 'diaper'
                    ? t('babyTracker.notePlaceholder.diaper')
                    : tab === 'feeding'
                      ? t('babyTracker.notePlaceholder.feeding')
                      : t('babyTracker.notePlaceholder.sleep')
                }
                placeholderTextColor={TRACKER_COLORS.textLight}
                multiline
                maxLength={200}
              />
            </View>
          </ScrollView>

          {/* Save button */}
          <TouchableOpacity
            style={[modalStyles.saveBtn, { backgroundColor: currentDarkColor }]}
            onPress={handleSave}
          >
            <Text style={modalStyles.saveBtnText}>{t('babyTracker.saveRecord')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: TRACKER_COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : SPACING.lg,
    maxHeight: '85%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: TRACKER_COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: '#F5F0EB',
    alignItems: 'center',
  },
  tabBtnInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  tabIcon: { width: 16, height: 16, borderRadius: 4 },
  tabBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
  },
  tabBtnTextActive: { color: TRACKER_COLORS.white },
  // flexShrink: 1 필수 — sheet(maxHeight 85%)보다 내용이 길 때 ScrollView가 줄어들어야
  // 실제 스크롤이 생긴다. 없으면 내용 높이 그대로 시트 밖으로 잘려 스크롤 불가(심사 거절 G4).
  scrollBody: { flexGrow: 0, flexShrink: 1 },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginBottom: SPACING.sm,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  optionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: TRACKER_COLORS.border,
    backgroundColor: TRACKER_COLORS.white,
    alignItems: 'center',
    minWidth: (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.sm * 3) / 4,
    flexGrow: 1,
  },
  optionIcon: { width: 28, height: 28, marginBottom: 4, borderRadius: 6 },
  optionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: TRACKER_COLORS.text,
  },
  inputRow: { marginBottom: SPACING.md },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: TRACKER_COLORS.bg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: FONT_SIZE.md,
    color: TRACKER_COLORS.text,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.border,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveBtn: {
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  saveBtnText: {
    color: TRACKER_COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});

/* ================================================================== */
/*  Main Screen                                                        */
/* ================================================================== */

export default function BabyTrackerScreen() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  if (selectedChild?.isPregnant) {
    return <PregnancyScreen />;
  }
  return <BabyTrackerInner key={selectedChild?.id ?? 'none'} />;
}

function BabyTrackerInner() {
  const { t } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const ageGroup: AgeGroupKey = selectedChild?.ageInfo?.group ?? 'infant';
  const ageTabs = useMemo(() => {
    const allowed = getTrackerTabs(ageGroup);
    return TAB_CONFIG.filter((tc) => allowed.some((a) => a.key === tc.key));
  }, [ageGroup]);
  const ageFeedingTypes = useMemo(() => getFeedingTypes(ageGroup), [ageGroup]);
  const defaultTab = ageTabs[0]?.key ?? 'feeding';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [records, setRecords] = useState<TrackerRecord[]>([]);
  const [activeTab, setActiveTab] = useState<RecordType>(defaultTab);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weekStats, setWeekStats] = useState<DayStat[]>([]);
  const [chartPeriod, setChartPeriod] = useState<7 | 14 | 31>(7);
  // Phase 3 (2026-04-28): 7/14/31일 요약 접기/펴기 (사용자 요청)
  // 기본은 접힘 상태 — 타임라인을 더 잘 보이게
  const [periodSectionOpen, setPeriodSectionOpen] = useState(false);
  const [clockSectionOpen, setClockSectionOpen] = useState(false);
  const [sleepSession, setSleepSession] = useState<SleepSession | null>(null);
  const [sleepNow, setSleepNow] = useState(Date.now());
  const [breastSession, setBreastSession] = useState<BreastSession | null>(null);
  const [breastNow, setBreastNow] = useState(Date.now());
  const [breastSidePickerVisible, setBreastSidePickerVisible] = useState(false);
  const [analyzerPickerVisible, setAnalyzerPickerVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [modalSubType, setModalSubType] = useState<string>('formula');
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // 하단 안내문 카운터 (10회 표시 후 자동 숨김)
  const [hintRemaining, setHintRemaining] = useState<number>(10);
  // 액션 버튼 길게 누르기 → 시간 지정 입력
  // kind: 'quick'(원터치) / 'sleepStart'(수면시작) / 'sleepWake'(기상) / 'breast'(모유)
  type TimedActionPayload =
    | { kind: 'quick'; type: RecordType; subType: string; label: string }
    | { kind: 'sleepStart'; label: string }
    | { kind: 'sleepWake'; label: string }
    | { kind: 'breast'; label: string };
  const [timedActionVisible, setTimedActionVisible] = useState(false);
  const [timedActionPayload, setTimedActionPayload] = useState<TimedActionPayload | null>(null);
  const [timedActionTime, setTimedActionTime] = useState<string>(nowTime());
  const [timedActionBreastSide, setTimedActionBreastSide] = useState<BreastSide | null>(null);
  const [timedActionNote, setTimedActionNote] = useState<string>('');
  const [timedActionDate, setTimedActionDate] = useState<string>('');
  const [timedActionAmount, setTimedActionAmount] = useState<string>('');
  const [timedSaveAsDefault, setTimedSaveAsDefault] = useState(false);
  const [defaultFormulaAmount, setDefaultFormulaAmount] = useState<number>(0);

  // 첫 진입 1회 기능 가이드 (코드 목업형) — 헤더 '?' 로 언제든 재열람
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(BABY_GUIDE_SHOWN_KEY)
      .then((v) => { if (!v) setGuideVisible(true); })
      .catch(() => {});
  }, []);
  // 건너뛰기/닫기: 그냥 닫기
  const closeGuide = useCallback(() => {
    setGuideVisible(false);
    AsyncStorage.setItem(BABY_GUIDE_SHOWN_KEY, '1').catch(() => {});
  }, []);
  // 마지막 '시작하기': 닫고 홈 음성 아이콘 추가 프롬프트(1회, 모달 닫힘 후 지연)
  const completeGuide = useCallback(() => {
    setGuideVisible(false);
    AsyncStorage.setItem(BABY_GUIDE_SHOWN_KEY, '1').catch(() => {});
    setTimeout(() => { promptVoicePinOnce(t, true); }, 400);
  }, []);
  // 타임라인 entry 길게 누르기 → 액션 시트 + 편집 모달
  const [entryActionId, setEntryActionId] = useState<string | null>(null);
  const [editRecord, setEditRecord] = useState<TrackerRecord | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  // cross-day sleep 의 endTime prefix (예: "5/4 ") — TimePicker 는 HH:MM 만 다룸
  const [editEndDatePrefix, setEditEndDatePrefix] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editSaveAsDefault, setEditSaveAsDefault] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  useEffect(() => {
    loadHintRemaining().then(setHintRemaining).catch(() => {});
  }, []);

  const dateStr = useMemo(() => formatDate(currentDate), [currentDate]);
  const childId = selectedChild?.id ?? 'default';

  useEffect(() => {
    loadFormulaDefault(childId).then(setDefaultFormulaAmount).catch(() => {});
  }, [childId]);

  // 공동육아 작성자 메타 — 초대받은 가족이면 신규 기록에 "엄마/아빠" 라벨 주입.
  // 소유자/비공동육아면 null → 라벨 미표시 (요구사항).
  const [authorMeta, setAuthorMeta] = useState<AuthorMeta | null>(null);
  useEffect(() => {
    let alive = true;
    resolveAuthorMeta(childId).then((m) => { if (alive) setAuthorMeta(m); }).catch(() => {});
    return () => { alive = false; };
  }, [childId]);

  // 공동육아 편집 권한 — 열람 전용 멤버(예: 조부모)는 기록 입력/수정/삭제 차단.
  // 소유자/조회실패는 true(기존 동작). 서버도 editRecords 로 최종 차단하지만,
  // 프론트에서 막아 "로컬엔 저장되는데 공유 안 되는" 혼란을 방지한다.
  const [canEditRecords, setCanEditRecords] = useState(true);
  useEffect(() => {
    let alive = true;
    resolveCanEditRecords(childId).then((c) => { if (alive) setCanEditRecords(c); }).catch(() => {});
    return () => { alive = false; };
  }, [childId]);

  function ensureCanEdit(): boolean {
    if (canEditRecords) return true;
    Alert.alert(t('babyTracker.viewOnly.title'), t('babyTracker.viewOnly.desc'));
    return false;
  }

  /* ---- Load records ---- */
  // Cross-day 수면 가상 기상 엔트리 (어제 시작 → 오늘 새벽 기상)
  // (사용자 보고 2026-04-29: '어제 11시 수면 → 오늘 12시 기상이 오늘에 안 보임')
  const [crossDayWakes, setCrossDayWakes] = useState<TrackerRecord[]>([]);
  const [photoLogVisible, setPhotoLogVisible] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await loadRecords(childId, dateStr);
    setRecords(data);

    // 어제 records에서 endTime이 오늘 날짜로 기록된 수면 찾기 → 가상 '기상' 엔트리
    try {
      const yest = new Date(currentDate);
      yest.setDate(yest.getDate() - 1);
      const yDateStr = formatDate(yest);
      const yData = await loadRecords(childId, yDateStr);
      const todayPrefix = `${currentDate.getMonth() + 1}/${currentDate.getDate()} `;
      const wakes: TrackerRecord[] = [];
      for (const r of yData) {
        if (r.type === 'sleep' && r.endTime && r.endTime.startsWith(todayPrefix)) {
          const wakeHHMM = r.endTime.slice(todayPrefix.length);
          wakes.push({
            ...r,
            id: `${r.id}__crosswake`,
            subType: 'sleep_end',  // 라벨 '기상'
            time: wakeHHMM,
            endTime: undefined,    // expandSleepRecords가 다시 split하지 않도록
            // duration은 유지 (info에 총 수면 시간 표시)
          });
        }
      }
      setCrossDayWakes(wakes);
    } catch {
      setCrossDayWakes([]);
    }

    setLoading(false);
  }, [childId, dateStr, currentDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---- Load range stats for chart ---- */
  const ageMonths = selectedChild?.ageInfo?.months ?? 6;
  useEffect(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - (chartPeriod - 1));
    // 연령별 모유 ml/분 차등 추정에 ageMonths 전달
    loadRangeStats(childId, start, currentDate, ageMonths).then(setWeekStats).catch(() => {});
  }, [childId, dateStr, records.length, chartPeriod, ageMonths]);

  /* ---- Filtered & sorted records ---- */
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => r.type === activeTab)
      .sort((a, b) => {
        if (a.time < b.time) return 1;
        if (a.time > b.time) return -1;
        return 0;
      });
  }, [records, activeTab]);

  const allRecordsSorted = useMemo(() => {
    // 어제 시작 + 오늘 새벽 기상한 cross-day 수면의 가상 '기상' 엔트리도 포함
    return [...records, ...crossDayWakes].sort((a, b) => {
      if (a.time < b.time) return 1;
      if (a.time > b.time) return -1;
      return 0;
    });
  }, [records, crossDayWakes]);

  /* ---- Summary ---- */
  const summary = useMemo(() => computeSummary(records, crossDayWakes), [records, crossDayWakes]);

  /* ---- Actions ---- */
  function goDay(offset: number) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset);
    if (d > new Date()) return;
    setCurrentDate(d);
  }

  function handleAddRecord(record: TrackerRecord) {
    // 공동육아: 초대받은 가족 기록이면 작성자 라벨 주입 (소유자/legacy 는 no-op)
    const stamped = stampAuthor(record, authorMeta);
    // functional setState — 빠르게 연속 누를 때 stale closure 의 records 를 사용하지 않도록.
    // (사용자 보고: 같은 분에 기상+소변 빠르게 누르면 정렬 순서가 뒤바뀜 — race condition fix)
    setRecords((prev) => {
      const updated = [...prev, stamped];
      saveRecords(childId, dateStr, updated);
      return updated;
    });
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToastMessage(''));
  }

  function handleQuickAdd(type: RecordType, subType: string) {
    const record: TrackerRecord = {
      id: generateId(),
      type,
      subType,
      time: nowTime(),
      createdAt: new Date().toISOString(),
    };
    handleAddRecord(record);
    showToast(t('babyTracker.recordedWithLabel', { label: getSubtypeLabel(subType, t) }));
    if (hintRemaining > 0) {
      decrementHint().then(setHintRemaining).catch(() => {});
    }
  }

  // 액션 버튼 길게 누르기 → 시간 피커로 과거 시각 입력 (모든 액션 유형 지원)
  function handleTimedActionRequest(action: BottomAction) {
    if (!ensureCanEdit()) return;
    if (hintRemaining > 0) {
      decrementHint().then(setHintRemaining).catch(() => {});
    }
    if (action.kind === 'quick') {
      const label = getSubtypeLabel(action.subType, t);
      setTimedActionPayload({ kind: 'quick', type: action.type, subType: action.subType, label });
    } else if (action.kind === 'sleepStart') {
      // 이미 진행 중이면 거부
      if (sleepSession) {
        const startDt = new Date(sleepSession.startTime);
        Alert.alert(
          t('babyTracker.sleepInProgress.title'),
          t('babyTracker.sleepInProgress.descPressWake', {
            date: sleepSession.startDate,
            time: `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`,
          }),
        );
        return;
      }
      setTimedActionPayload({ kind: 'sleepStart', label: t('babyTracker.sleepStartLabel') });
    } else if (action.kind === 'sleepWake') {
      // 활성 세션 없으면 거부
      if (!sleepSession) {
        Alert.alert(t('babyTracker.noSleepStartRecord.title'), t('babyTracker.noSleepStartRecord.desc'));
        return;
      }
      setTimedActionPayload({ kind: 'sleepWake', label: t('babyTracker.subtypes.wake') });
    } else if (action.kind === 'breast') {
      // 활성 모유 세션 있으면 거부 (정상 탭으로 종료 후 다시)
      if (breastSession) {
        Alert.alert(t('babyTracker.breastInProgress.title'), t('babyTracker.breastInProgress.desc'));
        return;
      }
      setTimedActionPayload({ kind: 'breast', label: t('babyTracker.subtypes.breast') });
      setTimedActionBreastSide(null);
    } else if (action.kind === 'modal' && action.subType === 'formula') {
      // 분유 길게 누르기 → 시간+양 지정 입력
      setTimedActionPayload({ kind: 'quick', type: 'feeding', subType: 'formula', label: t('babyTracker.subtypes.formula') });
      setTimedActionAmount(defaultFormulaAmount > 0 ? String(defaultFormulaAmount) : '');
    } else {
      return; // custom 등은 미지원
    }
    setTimedActionTime(nowTime());
    setTimedActionDate(formatDate(currentDate));
    setTimedActionNote('');
    setTimedSaveAsDefault(false);
    setTimedActionVisible(true);
  }

  async function handleTimedActionConfirm() {
    const payload = timedActionPayload;
    if (!payload) return;

    const note = timedActionNote.trim();

    if (payload.kind === 'quick') {
      const record: TrackerRecord = {
        id: generateId(),
        type: payload.type,
        subType: payload.subType,
        time: timedActionTime,
        createdAt: new Date().toISOString(),
        ...(note ? { note } : {}),
      };
      // 분유 시간지정 시 양(ml) 처리
      if (payload.subType === 'formula' && timedActionAmount) {
        const amt = parseInt(timedActionAmount, 10);
        if (!Number.isNaN(amt) && amt > 0) {
          record.amount = amt;
          if (timedSaveAsDefault) {
            saveFormulaDefault(childId, amt).catch(() => {});
            setDefaultFormulaAmount(amt);
          }
        }
      }
      handleAddRecord(record);
      const amtSuffix = payload.subType === 'formula' && record.amount ? ` ${record.amount}ml` : '';
      showToast(t('babyTracker.toast.recordedAt', { label: `${payload.label}${amtSuffix}`, time: timedActionTime }));
    } else if (payload.kind === 'sleepStart') {
      // 사용자가 선택한 날짜+시간으로 sleepSession 시작
      const [hh, mm] = timedActionTime.split(':').map((s) => parseInt(s, 10));
      const startDt = new Date((timedActionDate || formatDate(new Date())) + 'T00:00:00');
      startDt.setHours(hh || 0, mm || 0, 0, 0);
      const session: SleepSession = {
        startTime: startDt.toISOString(),
        startDate: formatDate(startDt),
        ...(note ? { note } : {}),
      };
      await saveSleepSession(childId, session);
      setSleepSession(session);
      showToast(t('babyTracker.toast.sleepStartAt', { time: timedActionTime }));
    } else if (payload.kind === 'sleepWake') {
      if (!sleepSession) { setTimedActionVisible(false); return; }
      const start = new Date(sleepSession.startTime);
      const [hh, mm] = timedActionTime.split(':').map((s) => parseInt(s, 10));
      // 사용자가 선택한 날짜+시간으로 기상 처리
      const endDt = new Date((timedActionDate || formatDate(new Date())) + 'T00:00:00');
      endDt.setHours(hh || 0, mm || 0, 0, 0);
      // 기상이 수면 시작보다 이전인 경우 (날짜 지정을 잘못한 것) 보정
      if (endDt.getTime() <= start.getTime()) {
        endDt.setDate(endDt.getDate() + 1);
      }
      let duration = Math.round((endDt.getTime() - start.getTime()) / 60000);
      if (duration < 1) duration = 1;
      const MAX_SLEEP_MIN = 14 * 60;
      if (duration > MAX_SLEEP_MIN) duration = MAX_SLEEP_MIN;
      const startHHMM = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      const crossedMidnight = sleepSession.startDate !== formatDate(endDt);
      const endLabel = crossedMidnight
        ? `${endDt.getMonth() + 1}/${endDt.getDate()} ${timedActionTime}`
        : timedActionTime;
      // 수면 시작 시 메모 + 기상 시 메모 합치기
      const combinedNote = [sleepSession.note, note].filter(Boolean).join(' / ');
      const record: TrackerRecord = stampAuthor({
        id: generateId(),
        type: 'sleep',
        subType: 'sleep_start',
        time: startHHMM,
        endTime: endLabel,
        duration,
        createdAt: sleepSession.startTime,  // 수면 시작 누른 시점 기준 정렬
        ...(combinedNote ? { note: combinedNote } : {}),
      }, authorMeta);
      const existing = await loadRecords(childId, sleepSession.startDate);
      const updated = [...existing, record];
      await saveRecords(childId, sleepSession.startDate, updated);
      if (sleepSession.startDate === dateStr) {
        setRecords(updated);
      } else {
        await loadData();
      }
      await saveSleepSession(childId, null);
      setSleepSession(null);
      showToast(t('babyTracker.toast.wakeAt', { time: timedActionTime }));
    } else if (payload.kind === 'breast') {
      if (!timedActionBreastSide) {
        Alert.alert(t('babyTracker.breastDirection.title'), t('babyTracker.breastDirection.desc'));
        return;
      }
      // 지정 시각으로 모유 세션 시작 (정상 탭으로 종료 시 종료 시간 = now)
      const now = new Date();
      const [hh, mm] = timedActionTime.split(':').map((s) => parseInt(s, 10));
      const startDt = new Date(now);
      startDt.setHours(hh || 0, mm || 0, 0, 0);
      if (startDt.getTime() > now.getTime()) {
        startDt.setDate(startDt.getDate() - 1);
      }
      const session: BreastSession = {
        side: timedActionBreastSide,
        startTime: startDt.toISOString(),
        startDate: formatDate(startDt),
        ...(note ? { note } : {}),
      };
      await saveBreastSession(childId, session);
      setBreastSession(session);
      showToast(t('babyTracker.toast.breastStartAt', {
        side: timedActionBreastSide === 'left' ? t('babyTracker.side.left') : t('babyTracker.side.right'),
        time: timedActionTime,
      }));
    }

    setTimedActionVisible(false);
    setTimedActionPayload(null);
    setTimedActionBreastSide(null);
    setTimedActionNote('');
  }

  // 타임라인 entry 편집 시작
  function openEditModalById(id: string) {
    // 라이브(진행 중) 수면: records 에 없고 sleepSession state 에만 있음. 별도 처리.
    if (id === '__active_sleep__') {
      if (!sleepSession) return;
      const startDt = new Date(sleepSession.startTime);
      const startHHMM = `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`;
      // 가상 record 를 만들어 setEditRecord — handleEditSave 가 id 로 라이브 분기 인식
      setEditRecord({
        id: '__active_sleep__',
        type: 'sleep',
        subType: 'sleep_start',
        time: startHHMM,
        note: sleepSession.note,
      } as TrackerRecord);
      setEditTime(startHHMM);
      setEditEndDatePrefix('');
      setEditEndTime('');  // 진행 중이라 종료 시간 없음
      setEditNote(sleepSession.note ?? '');
      setEditAmount('');
      setEditDate(sleepSession.startDate);  // 실제 수면 시작 날짜
      setEditEndDate(sleepSession.startDate);
      return;
    }

    // 가상 suffix 모두 제거: __start (수면 시작), __wake (수면 종료), __crosswake (어제 sleep 의 오늘 새벽 기상)
    const realId = id.replace(/__start$|__wake$|__crosswake$/, '');
    // 1순위: 오늘 records 에서 찾기
    const record = records.find((r) => r.id === realId);
    // 2순위: cross-day wake — 어제 records 에서 찾은 sleep entry (crossDayWakes 에 가상 entry 보관)
    if (!record) {
      const crossWake = crossDayWakes.find((r) => r.id === id);
      if (crossWake) {
        Alert.alert(
          t('babyTracker.yesterdaySleep.title'),
          t('babyTracker.yesterdaySleep.desc'),
        );
        return;
      }
      return;
    }
    setEditRecord(record);
    setEditTime(record.time);
    // cross-day sleep 의 endTime (예: "5/4 08:30") 은 prefix 분리해서 별도 보관 —
    // TimePicker 는 HH:MM 만 다루고, 저장 시 prefix 다시 합침 (handleEditSave).
    if (record.endTime && record.endTime.includes(' ')) {
      const parts = record.endTime.split(' ');
      setEditEndDatePrefix(parts.slice(0, -1).join(' ') + ' ');
      setEditEndTime(parts[parts.length - 1]);
      // cross-day: prefix "M/D " 파싱 → 연도는 기록 날짜 기준
      const prefixStr = parts.slice(0, -1).join(' ');
      const mDMatch = prefixStr.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (mDMatch) {
        const baseYear = new Date(dateStr).getFullYear();
        const endDateObj = new Date(baseYear, parseInt(mDMatch[1], 10) - 1, parseInt(mDMatch[2], 10));
        setEditEndDate(formatDate(endDateObj));
      } else {
        setEditEndDate(dateStr);
      }
    } else {
      setEditEndDatePrefix('');
      setEditEndTime(record.endTime ?? '');
      setEditEndDate(dateStr);
    }
    setEditNote(record.note ?? '');
    setEditAmount(record.amount != null ? String(record.amount) : '');
    setEditSaveAsDefault(false);
    setEditDate(dateStr);
  }

  function adjustEditDate(offset: number) {
    const d = new Date(editDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d > today) return;
    setEditDate(formatDate(d));
  }

  function adjustEditEndDate(offset: number) {
    const d = new Date(editEndDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d > today) return;
    setEditEndDate(formatDate(d));
  }

  function adjustTimedActionDate(offset: number) {
    const d = new Date(timedActionDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d > today) return;
    setTimedActionDate(formatDate(d));
  }

  async function handleEditSave() {
    if (!ensureCanEdit()) return;
    if (!editRecord) return;
    // 검증: HH:MM 형식
    const timeOk = /^\d{1,2}:\d{2}$/.test(editTime);
    if (!timeOk) {
      Alert.alert(t('babyTracker.timeFormat.title'), t('babyTracker.timeFormat.desc'));
      return;
    }

    // 라이브(진행 중) 수면 — sleepSession 만 갱신 (records 에는 없음). 종료시간/duration 미적용.
    if (editRecord.id === '__active_sleep__') {
      if (!sleepSession) { setEditRecord(null); setEntryActionId(null); return; }
      const [hh, mm] = editTime.split(':').map((s) => parseInt(s, 10));
      const startDateToUse = editDate || sleepSession.startDate;
      const start = new Date(startDateToUse + 'T00:00:00');
      start.setHours(hh, mm, 0, 0);
      const newSession: SleepSession = {
        ...sleepSession,
        startTime: start.toISOString(),
        startDate: formatDate(start),
        ...(editNote.trim() ? { note: editNote.trim() } : {}),
      };
      saveSleepSession(childId, newSession);
      setSleepSession(newSession);
      setEditRecord(null);
      setEntryActionId(null);
      showToast(t('babyTracker.toast.activeSleepTimeUpdated'));
      return;
    }

    let updated: TrackerRecord = { ...editRecord, time: editTime };
    // 메모
    const trimmedNote = editNote.trim();
    if (trimmedNote) updated.note = trimmedNote;
    else delete updated.note;
    // 양 (수유)
    if (editRecord.type === 'feeding') {
      const num = parseInt(editAmount, 10);
      if (!Number.isNaN(num) && num > 0) {
        updated.amount = num;
        if (editSaveAsDefault && editRecord.subType === 'formula') {
          saveFormulaDefault(childId, num).catch(() => {});
          setDefaultFormulaAmount(num);
        }
      } else delete updated.amount;
    }
    // 수면: endTime 함께 수정 → duration 재계산 (editEndDate 기반)
    if (editRecord.type === 'sleep' && editRecord.endTime) {
      const endTimeOk = /^\d{1,2}:\d{2}$/.test(editEndTime);
      if (!endTimeOk) {
        Alert.alert(t('babyTracker.wakeTimeFormat.title'), t('babyTracker.wakeTimeFormat.desc'));
        return;
      }
      const startDateForCalc = editDate || dateStr;
      const endDateForCalc = editEndDate || startDateForCalc;
      const isCrossDay = endDateForCalc !== startDateForCalc;
      if (isCrossDay) {
        const endDateObj = new Date(endDateForCalc + 'T00:00:00');
        updated.endTime = `${endDateObj.getMonth() + 1}/${endDateObj.getDate()} ${editEndTime}`;
        const startMs = new Date(startDateForCalc + 'T' + editTime + ':00').getTime();
        const endMs = new Date(endDateForCalc + 'T' + editEndTime + ':00').getTime();
        const dur = Math.round((endMs - startMs) / 60000);
        updated.duration = dur > 0 ? dur : (editRecord.duration ?? 0);
      } else {
        updated.endTime = editEndTime;
        updated.duration = calcDurationMinutes(editTime, editEndTime);
      }
    }
    // 날짜가 변경된 경우 — 원본 날짜에서 삭제 후 대상 날짜에 추가
    if (editDate && editDate !== dateStr) {
      const sourceRecords = records.filter((r) => r.id !== editRecord.id);
      await saveRecords(childId, dateStr, sourceRecords);
      setRecords(sourceRecords);
      const targetRecords = await loadRecords(childId, editDate);
      await saveRecords(childId, editDate, [...targetRecords, updated]);
      setEditRecord(null);
      setEntryActionId(null);
      const d = new Date(editDate + 'T00:00:00');
      showToast(t('babyTracker.toast.movedTo', { month: d.getMonth() + 1, day: d.getDate() }));
      return;
    }
    const newRecords = records.map((r) => (r.id === editRecord.id ? updated : r));
    setRecords(newRecords);
    saveRecords(childId, dateStr, newRecords);
    setEditRecord(null);
    setEntryActionId(null);
    showToast(t('babyTracker.toast.editComplete'));
  }

  /* ---- 서버 sync (offline-first 복구) ----
   * 2026-05-08: 데이터 삭제 / 재설치 시 baby-tracker 기록이 영구 손실되던 문제 fix.
   * childId 진입 시 1회: 최근 14일 records + 진행 중인 세션을 서버에서 fetch → 로컬 캐시 머지.
   * 끝나면 loadData / 세션 state 갱신.
   */
  useEffect(() => {
    if (!childId || childId === 'default') return;
    let cancelled = false;
    const today = new Date();
    const past = new Date(today);
    past.setDate(today.getDate() - 14);
    const fromStr = formatDate(past);
    const toStr = formatDate(today);

    syncRangeFromServer(childId, fromStr, toStr)
      .then(() => {
        if (cancelled) return;
        loadData();
      })
      .catch(() => {});

    syncSessionsFromServer(childId)
      .then((s) => {
        if (cancelled || !s) return;
        // 로컬에 이미 있는 세션을 서버 값으로 덮어쓰기 (last-write-wins)
        setSleepSession(s.sleepSession);
        setBreastSession(s.breastSession);
      })
      .catch(() => {});

    return () => { cancelled = true; };
    // loadData 는 의도적으로 deps 제외 — childId 진입 시 1회만 sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  /* ---- Sleep session load & tick ---- */
  useEffect(() => {
    loadSleepSession(childId).then((s) => setSleepSession(s));
  }, [childId]);

  useEffect(() => {
    if (!sleepSession) return;
    const id = setInterval(() => setSleepNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [sleepSession]);

  /* ---- Breast session load & tick (every 1s for live timer) ---- */
  useEffect(() => {
    loadBreastSession(childId).then((s) => setBreastSession(s));
  }, [childId]);

  useEffect(() => {
    if (!breastSession) return;
    const id = setInterval(() => setBreastNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [breastSession]);

  async function handleBreastStart(side: BreastSide) {
    const now = new Date();
    const session: BreastSession = {
      side,
      startTime: now.toISOString(),
      startDate: formatDate(now),
    };
    await saveBreastSession(childId, session);
    setBreastSession(session);
    setBreastSidePickerVisible(false);
    showToast(t('babyTracker.toast.breastStart', { side: side === 'left' ? t('babyTracker.side.left') : t('babyTracker.side.right') }));
  }

  async function handleBreastStop() {
    if (!breastSession) return;
    const start = new Date(breastSession.startTime);
    const end = new Date();
    let diff = Math.round((end.getTime() - start.getTime()) / 60000);
    if (diff < 1) diff = 1;

    const startHHMM = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    const endHHMM = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;

    const sideLabel = breastSession.side === 'left' ? t('babyTracker.side.left') : t('babyTracker.side.right');
    const combinedNote = breastSession.note ? `${sideLabel} · ${breastSession.note}` : sideLabel;
    const record: TrackerRecord = stampAuthor({
      id: generateId(),
      type: 'feeding',
      subType: 'breast',
      time: startHHMM,
      endTime: endHHMM,
      duration: diff,
      createdAt: breastSession.startTime,  // 수유 시작 시점 기준 정렬
      note: combinedNote,
    }, authorMeta);
    const existing = await loadRecords(childId, breastSession.startDate);
    const updated = [...existing, record];
    await saveRecords(childId, breastSession.startDate, updated);
    if (breastSession.startDate === dateStr) {
      setRecords(updated);
    } else {
      await loadData();
    }
    await saveBreastSession(childId, null);
    setBreastSession(null);
    showToast(t('babyTracker.toast.breastRecorded', { duration: formatMinutes(diff) }));
  }

  function handleBreastPress() {
    if (breastSession) {
      handleBreastStop();
    } else {
      setBreastSidePickerVisible(true);
    }
  }

  async function handleSleepStart() {
    // 이미 진행 중인 수면 세션이 있으면 안내 (sleepSession은 크로스 데이 영구 저장)
    if (sleepSession) {
      const startDt = new Date(sleepSession.startTime);
      Alert.alert(
        t('babyTracker.sleepInProgress.title'),
        t('babyTracker.sleepInProgress.descPressWakeEnd', {
          date: sleepSession.startDate,
          time: `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`,
        }),
      );
      return;
    }
    const now = new Date();
    const session: SleepSession = {
      startTime: now.toISOString(),
      startDate: formatDate(now),
    };
    await saveSleepSession(childId, session);
    setSleepSession(session);
    showToast(t('babyTracker.toast.sleepStartRecorded'));
  }

  async function handleSleepWake() {
    if (!sleepSession) {
      Alert.alert(
        t('babyTracker.noSleepStartRecord.title'),
        t('babyTracker.noSleepStartRecord.descFull'),
      );
      return;
    }
    const start = new Date(sleepSession.startTime);
    const end = new Date();
    let duration = Math.round((end.getTime() - start.getTime()) / 60000);
    if (duration < 1) duration = 1;
    // 비정상적으로 긴 수면(기상 버튼을 누르지 않고 24h+ 경과)은 14시간으로 제한
    const MAX_SLEEP_MIN = 14 * 60; // 14시간
    if (duration > MAX_SLEEP_MIN) {
      Alert.alert(
        t('babyTracker.sleepTooLong.title'),
        t('babyTracker.sleepTooLong.desc', { hours: Math.round((duration / 60) * 10) / 10 }),
      );
      duration = MAX_SLEEP_MIN;
    }

    const startHHMM = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    const endHHMM = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;

    // 자정을 넘긴 경우 endTime에 날짜 표기 추가
    const crossedMidnight = sleepSession.startDate !== formatDate(end);
    const endLabel = crossedMidnight
      ? `${end.getMonth() + 1}/${end.getDate()} ${endHHMM}`
      : endHHMM;

    const record: TrackerRecord = stampAuthor({
      id: generateId(),
      type: 'sleep',
      subType: 'sleep_start',
      time: startHHMM,
      endTime: endLabel,
      duration,
      // createdAt = sleepSession.startTime — 수면 시작을 누른 시점 기준으로 정렬되도록.
      // (records 배열엔 wake 누른 시점에 추가되지만 사용자는 start 시점을 시작점으로 인식)
      createdAt: sleepSession.startTime,
      ...(sleepSession.note ? { note: sleepSession.note } : {}),
    }, authorMeta);

    // 시작 날짜의 records에 저장.
    // 같은 날 종료: storage(loadRecords)가 아닌 functional setState 의 prev 를 진실의 출처로
    //   사용 — handleSleepWake 진행 중 다른 record (소변 등) 가 추가됐어도 누락 없음.
    //   사용자 보고: 같은 분에 기상+다른 기록 빠르게 누르면 race condition 으로 정렬 깨짐 → fix.
    // cross-day 종료: 어제 storage 에 저장 + 오늘 reload (안전하게 fresh state).
    if (sleepSession.startDate === dateStr) {
      setRecords((prev) => {
        const updated = [...prev, record];
        saveRecords(childId, dateStr, updated);
        return updated;
      });
    } else {
      const existing = await loadRecords(childId, sleepSession.startDate);
      const updated = [...existing, record];
      await saveRecords(childId, sleepSession.startDate, updated);
      await loadData();
    }
    await saveSleepSession(childId, null);
    setSleepSession(null);
    showToast(t('babyTracker.toast.wakeRecorded', { duration: formatMinutes(duration) }));
  }

  function handleDeleteRecord(id: string) {
    if (!ensureCanEdit()) return;
    // 진행중 수면 — record가 아니라 sleepSession 취소
    if (id === '__active_sleep__') {
      Alert.alert(t('babyTracker.cancelActiveSleep.title'), t('babyTracker.cancelActiveSleep.desc'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('babyTracker.cancelActiveSleep.confirm'),
          style: 'destructive',
          onPress: async () => {
            await saveSleepSession(childId, null);
            setSleepSession(null);
          },
        },
      ]);
      return;
    }
    // 수면 record는 __start / __wake 가짜 suffix가 붙어 있음 → 원본 id 복원
    const realId = id.replace(/__start$|__wake$/, '');
    Alert.alert(t('babyTracker.deleteRecord.title'), t('babyTracker.deleteRecord.desc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          const updated = records.filter((r) => r.id !== realId);
          setRecords(updated);
          saveRecords(childId, dateStr, updated);
        },
      },
    ]);
  }

  /* ---- Bottom bar action dispatcher ---- */
  function handleBottomAction(action: BottomAction) {
    if (!ensureCanEdit()) return;
    if (action.kind === 'modal' && action.subType === 'formula' && defaultFormulaAmount > 0) {
      // 기본 분유량 설정 시 원터치 기록
      const record: TrackerRecord = {
        id: generateId(),
        type: 'feeding',
        subType: 'formula',
        time: nowTime(),
        amount: defaultFormulaAmount,
        createdAt: new Date().toISOString(),
      };
      handleAddRecord(record);
      showToast(t('babyTracker.toast.formulaOneTouch', { amount: defaultFormulaAmount }));
      if (hintRemaining > 0) decrementHint().then(setHintRemaining).catch(() => {});
    } else if (action.kind === 'modal') {
      setModalSubType(action.subType);
      setModalVisible(true);
    } else if (action.kind === 'quick') {
      handleQuickAdd(action.type, action.subType);
    } else if (action.kind === 'breast') {
      handleBreastPress();
    } else if (action.kind === 'sleepStart') {
      handleSleepStart();
    } else if (action.kind === 'sleepWake') {
      handleSleepWake();
    } else if (action.kind === 'custom') {
      // Phase 4-B: 사용자 정의 라벨 입력 모달 열기
      setCustomName('');
      setCustomDetail('');
      setCustomModalVisible(true);
    }
  }

  /* ---- Phase 4-B: 사용자 정의(커스텀) 기록 ---- */
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDetail, setCustomDetail] = useState('');

  // 자주 쓰는 이름 (최근 사용 5개) — 기존 records의 type='custom'에서 추출
  const recentCustomNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of [...records].reverse()) {
      if (r.type === 'custom' && r.subType && !seen.has(r.subType)) {
        seen.add(r.subType);
        out.push(r.subType);
        if (out.length >= 5) break;
      }
    }
    return out;
  }, [records]);

  async function handleSaveCustom() {
    const name = customName.trim();
    if (!name) {
      Alert.alert(t('babyTracker.customRecord.nameRequired.title'), t('babyTracker.customRecord.nameRequired.desc'));
      return;
    }
    if (name.length > 20) {
      Alert.alert(t('babyTracker.customRecord.nameLength.title'), t('babyTracker.customRecord.nameLength.desc'));
      return;
    }
    const detail = customDetail.trim();
    if (detail.length > 80) {
      Alert.alert(t('babyTracker.customRecord.detailLength.title'), t('babyTracker.customRecord.detailLength.desc'));
      return;
    }
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newRecord: TrackerRecord = stampAuthor({
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'custom',
      subType: name,           // 라벨로 그대로 사용
      time,
      note: detail || undefined,
    }, authorMeta);
    const updated = [...records, newRecord];
    await saveRecords(childId, dateStr, updated);
    setRecords(updated);
    setCustomModalVisible(false);
    setCustomName('');
    setCustomDetail('');
    showToast(t('babyTracker.toast.customRecorded', { name }));
  }

  /* ---- Breast elapsed display ---- */
  const breastElapsed = useMemo(() => {
    if (!breastSession) return '';
    const startMs = new Date(breastSession.startTime).getTime();
    const sec = Math.max(0, Math.floor((breastNow - startMs) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [breastSession, breastNow]);

  /* ---- Breast 진행 중 ml 추정 (실시간) ---- */
  const breastEstimateInfo = useMemo(() => {
    if (!breastSession) return null;
    const startMs = new Date(breastSession.startTime).getTime();
    const elapsedMin = Math.max(0, (breastNow - startMs) / 60000);
    const mlPerMin = getBreastMlPerMin(ageMonths);
    const estimatedMl = Math.round(elapsedMin * mlPerMin);
    // 연령 라벨
    let ageLabel = t('babyTracker.ageRange.a6to12');
    if (ageMonths <= 1) ageLabel = t('babyTracker.ageRange.a0to1');
    else if (ageMonths <= 3) ageLabel = t('babyTracker.ageRange.a1to3');
    else if (ageMonths <= 6) ageLabel = t('babyTracker.ageRange.a3to6');
    else if (ageMonths <= 12) ageLabel = t('babyTracker.ageRange.a6to12');
    else ageLabel = t('babyTracker.ageRange.a12plus');
    return { estimatedMl, mlPerMin, ageLabel };
  }, [breastSession, breastNow, ageMonths]);

  /* ---- Sleep display helper ---- */
  const sleepDisplay = useMemo(() => {
    const hours = Math.floor(summary.totalSleepMinutes / 60);
    const mins = summary.totalSleepMinutes % 60;
    if (hours === 0 && mins === 0) return t('babyTracker.unit.minutesOnly', { m: 0 });
    if (hours === 0) return t('babyTracker.unit.minutesOnly', { m: mins });
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}m`;
  }, [summary.totalSleepMinutes]);

  /* ---- Render ---- */
  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: '',
          headerShown: true,
          headerTransparent: true,
          headerLeft: () => <BackButton />,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setGuideVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.guideBtn}
            >
              <Text style={styles.guideBtnText}>?</Text>
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
        }}
      />

      <BabyTrackerGuide visible={guideVisible} onClose={closeGuide} onComplete={completeGuide} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ---- Date Navigator ---- */}
        <View style={styles.dateNav}>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => goDay(-1)}
          >
            <Text style={styles.dateArrowText}>{'\u{2039}'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateCenter}
            onPress={() => setCurrentDate(new Date())}
          >
            <Text
              style={[styles.dateText, isToday(currentDate) && styles.dateTextToday]}
              numberOfLines={1}
            >
              {formatDateKorean(currentDate)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateArrow, isToday(currentDate) && styles.dateArrowDisabled]}
            onPress={() => goDay(1)}
            disabled={isToday(currentDate)}
          >
            <Text
              style={[
                styles.dateArrowText,
                isToday(currentDate) && styles.dateArrowTextDisabled,
              ]}
            >
              {'\u{203A}'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 공동육아 열람 전용 안내 — 편집 권한 없는 멤버(예: 조부모) */}
        {!canEditRecords && (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 8,
              paddingVertical: 10,
              paddingHorizontal: 14,
              backgroundColor: 'rgba(255,176,32,0.12)',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,176,32,0.35)',
            }}
          >
            <Text style={{ color: '#9A6B00', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
              {'\u{1F440}'} 열람 전용 — 기록 편집 권한이 없어요. 보호자에게 권한을 요청하세요.
            </Text>
          </View>
        )}

        {/* ---- 액션 칩 (날짜 아래 별도 줄 — 날짜 가림 방지) ---- */}
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={summaryStyles.voiceInputBtn}
            onPress={() => router.push('/voice' as never)}
            activeOpacity={0.85}
          >
            <Text style={summaryStyles.voiceInputText}>🎤 {t('babyTracker.voiceInput')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={summaryStyles.voiceBtn}
            onPress={() => router.push('/(main)/voice-settings' as never)}
            activeOpacity={0.85}
          >
            <Text style={summaryStyles.voiceBtnText}>{t('babyTracker.voiceSettings')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={summaryStyles.voiceBtn}
            onPress={() => setPhotoLogVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={summaryStyles.voiceBtnText}>📷 {t('babyTracker.photoRecord')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={summaryStyles.voiceBtn}
            onPress={() => router.push('/(main)/alarm-settings' as never)}
            activeOpacity={0.85}
          >
            <Text style={summaryStyles.voiceBtnText}>⏰ {t('babyTracker.alarmSettings')}</Text>
          </TouchableOpacity>
        </View>

        <PhotoLogReview
          visible={photoLogVisible}
          childId={childId}
          onClose={() => setPhotoLogVisible(false)}
          onSaved={() => { setPhotoLogVisible(false); loadData(); loadSleepSession(childId).then((s) => setSleepSession(s)); }}
        />

        {/* ---- Breast-feeding timer banner (only when active) ---- */}
        {breastSession && (
          <TouchableOpacity
            style={[breastStyles.card, breastStyles.cardActive]}
            onPress={handleBreastPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('babyTracker.breastActive.accessibilityLabel', {
              side: breastSession.side === 'left' ? t('babyTracker.side.left') : t('babyTracker.side.right'),
              elapsed: breastElapsed,
              amount: breastEstimateInfo?.estimatedMl ?? 0,
            })}
          >
            <View style={breastStyles.iconWrap}>
              <Image source={IC_MASCOT_EAT} style={breastStyles.icon} resizeMode="contain" />
            </View>
            <View style={breastStyles.textCol}>
              <Text style={breastStyles.title}>{t('babyTracker.breastActive.title')}</Text>
              <Text style={breastStyles.sub}>
                {breastSession.side === 'left' ? t('babyTracker.side.left') : t('babyTracker.side.right')} · {t('babyTracker.breastActive.tapToEnd')}
              </Text>
              {breastEstimateInfo && (
                <>
                  <Text style={breastStyles.estimateText}>
                    {t('babyTracker.breastActive.estimatedAmount', { amount: breastEstimateInfo.estimatedMl })}
                  </Text>
                  <Text style={breastStyles.estimateHint}>
                    {t('babyTracker.breastActive.calcHint', { mlPerMin: breastEstimateInfo.mlPerMin, ageLabel: breastEstimateInfo.ageLabel })}
                  </Text>
                  <Text style={breastStyles.estimateNote}>
                    {t('babyTracker.breastActive.estimateNote')}
                  </Text>
                </>
              )}
            </View>
            <View style={breastStyles.rightCol}>
              <Text style={breastStyles.timer}>{breastElapsed}</Text>
              <Text style={breastStyles.stopHint}>{t('babyTracker.tapToStop')}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* SleepSessionCard 제거 (사용자 요청: '수면중 큰 배너 없애줘')
            대신 타임라인의 수면 시작 시각에만 표시. 종료는 하단 액션바 '기상' 버튼 사용. */}

        {/* ─────────────────────────────────────────────
            레이아웃 (사용자 요청 반영):
              1) 하루 요약 (chip 1줄) — 위
              2) 타임라인 (자체 스크롤 박스) — 가운데
              3) 7/14/31일 요약 — 아래
        ───────────────────────────────────────────── */}

        {/* ---- Day Summary Card (위) ---- */}
        <DaySummaryCard summary={summary} />

        {/* ---- Daily Reference (권장 진행 막대) ---- */}
        {(() => {
          // 개월수 계산
          const birthDate = selectedChild?.birthDate;
          const ageMonths = birthDate
            ? Math.max(0, Math.floor(
                (Date.now() - new Date(birthDate).getTime()) /
                (1000 * 60 * 60 * 24 * 30.44),
              ))
            : 0;

          // 마지막 수유 후 경과 시간 (분)
          // allRecordsSorted는 내림차순(최신 [0])이므로 [0] = 가장 최근 수유
          // (이전 버그: [length-1] = 가장 오래된 수유를 잡아서 새로 먹여도 텀이 안 줄어듦)
          const todayFeeds = allRecordsSorted.filter((r) => r.type === 'feeding');
          let minutesSinceLastFeed = -1;
          if (todayFeeds.length > 0 && isToday(currentDate)) {
            const last = todayFeeds[0];
            const [h, m] = last.time.split(':').map((v) => parseInt(v, 10));
            const lastDt = new Date();
            lastDt.setHours(h, m, 0, 0);
            minutesSinceLastFeed = Math.max(0, Math.floor((Date.now() - lastDt.getTime()) / 60000));
          }

          return (
            <DailyReferenceCard
              ageMonths={ageMonths}
              weightKg={selectedChild?.weight}
              formulaMlToday={summary.formulaMl}
              totalSleepMinutesToday={summary.totalSleepMinutes}
              minutesSinceLastFeed={minutesSinceLastFeed}
            />
          );
        })()}

        {/* ---- Full Timeline (자체 스크롤 박스) ---- */}
        <View style={styles.timelineContainer}>
          <View style={styles.timelineTitleRow}>
            <Image source={IC_SLEEP} style={styles.timelineTitleIcon} resizeMode="contain" />
            <Text style={styles.timelineTitle}>
              {t('babyTracker.timeline.title', { count: allRecordsSorted.length })}
            </Text>
          </View>

          {loading ? (
            <View style={emptyStyles.container}>
              <Text style={emptyStyles.sub}>{t('babyTracker.loading')}</Text>
            </View>
          ) : (
            <HourGroupedTimeline
              records={allRecordsSorted}
              dateStr={dateStr}
              isCurrentlyToday={isToday(currentDate)}
              onDelete={handleDeleteRecord}
              onLongAction={(id) => setEntryActionId(id)}
              activeSleepSession={sleepSession}
              ageMonths={ageMonths}
            />
          )}
        </View>

        {/* ---- 기간 분석 (표 — 접기/펴기) ---- */}
        <TouchableOpacity
          style={periodToggleStyles.header}
          onPress={() => setPeriodSectionOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={periodToggleStyles.headerTitle}>
            {t('babyTracker.periodAnalysis', { period: getPeriodLabel(chartPeriod, t) })}
          </Text>
          <Text style={periodToggleStyles.headerArrow}>
            {periodSectionOpen ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {periodSectionOpen && (
          <>
            <View style={summaryStyles.periodRow}>
              {([7, 14, 31] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    summaryStyles.periodBtn,
                    chartPeriod === p && summaryStyles.periodBtnActive,
                  ]}
                  onPress={() => setChartPeriod(p)}
                >
                  <Text
                    style={[
                      summaryStyles.periodBtnText,
                      chartPeriod === p && summaryStyles.periodBtnTextActive,
                    ]}
                  >
                    {getPeriodLabel(p, t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {weekStats.length > 0 && (
              <WeeklySummaryTable stats={weekStats} periodDays={chartPeriod} />
            )}
          </>
        )}

        {/* ---- 하루 패턴 (원형 그래프 — 접기/펴기) ---- */}
        <TouchableOpacity
          style={periodToggleStyles.header}
          onPress={() => setClockSectionOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={periodToggleStyles.headerTitle}>
            {t('babyTracker.dailyPattern')}
          </Text>
          <Text style={periodToggleStyles.headerArrow}>
            {clockSectionOpen ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {clockSectionOpen && (
          <DayClock
            records={allRecordsSorted}
            dateLabel={isToday(currentDate) ? t('babyTracker.today') : formatDateKorean(currentDate)}
            onPrevDay={() => goDay(-1)}
            onNextDay={() => goDay(1)}
            canGoNext={!isToday(currentDate)}
          />
        )}

        {/* 분석 섹션 중 하나라도 열렸을 때만 광고 노출 */}
        {(periodSectionOpen || clockSectionOpen) && <AdSlot />}

        {/* Bottom spacer for bottom action bar */}
        <View style={{ height: 200 }} />
      </ScrollView>

      {/* ---- Bottom Action Bar ---- */}
      <BottomActionBar
        breastActive={!!breastSession}
        onAction={handleBottomAction}
        onLongAction={handleTimedActionRequest}
        hintVisible={hintRemaining > 0}
      />

      {/* ---- Toast ---- */}
      {toastMessage !== '' && (
        <Animated.View pointerEvents="none" style={[toastStyles.container, { opacity: toastOpacity }]}>
          <Text style={toastStyles.text}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* ---- Phase 4-B: 사용자 정의 기록 모달 ---- */}
      <Modal
        visible={customModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={customModalStyles.overlay}
        >
          <TouchableOpacity
            style={customModalStyles.backdrop}
            activeOpacity={1}
            onPress={() => setCustomModalVisible(false)}
          />
          <View style={customModalStyles.card}>
            <Text style={customModalStyles.title}>{t('babyTracker.customRecord.title')}</Text>
            <Text style={customModalStyles.sub}>
              {t('babyTracker.customRecord.sub')}
            </Text>

            <Text style={customModalStyles.label}>{t('babyTracker.customRecord.nameLabel')}</Text>
            <TextInput
              style={customModalStyles.input}
              placeholder={t('babyTracker.customRecord.namePlaceholder')}
              placeholderTextColor="#ABABAB"
              value={customName}
              onChangeText={setCustomName}
              maxLength={20}
              autoFocus
            />

            {recentCustomNames.length > 0 && (
              <View style={customModalStyles.recentRow}>
                <Text style={customModalStyles.recentLabel}>{t('babyTracker.customRecord.recentlyUsed')}</Text>
                {recentCustomNames.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={customModalStyles.recentChip}
                    onPress={() => setCustomName(n)}
                  >
                    <Text style={customModalStyles.recentChipText}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={customModalStyles.label}>{t('babyTracker.customRecord.detailLabel')}</Text>
            <TextInput
              style={customModalStyles.input}
              placeholder={t('babyTracker.customRecord.detailPlaceholder')}
              placeholderTextColor="#ABABAB"
              value={customDetail}
              onChangeText={setCustomDetail}
              maxLength={80}
            />

            <View style={customModalStyles.btnRow}>
              <TouchableOpacity
                style={[customModalStyles.btn, customModalStyles.btnCancel]}
                onPress={() => setCustomModalVisible(false)}
              >
                <Text style={customModalStyles.btnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[customModalStyles.btn, customModalStyles.btnSave]}
                onPress={handleSaveCustom}
              >
                <Text style={customModalStyles.btnSaveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---- Modal ---- */}
      <AddRecordModal
        visible={modalVisible}
        initialTab={
          modalSubType === 'breast' || modalSubType === 'formula' || modalSubType === 'baby_food' || modalSubType === 'snack'
            ? 'feeding'
            : modalSubType === 'pee' || modalSubType === 'poop' || modalSubType === 'both'
              ? 'diaper'
              : 'feeding'
        }
        initialSubType={modalSubType}
        onClose={() => setModalVisible(false)}
        onSave={handleAddRecord}
        onSetDefaultFormula={(ml) => { saveFormulaDefault(childId, ml).catch(() => {}); setDefaultFormulaAmount(ml); }}
        defaultFormulaAmount={defaultFormulaAmount}
        availableTabs={ageTabs}
        feedingOptions={ageFeedingTypes.map((f) => ({
          key: f.key,
          label: f.label,
          icon: f.key === 'breast' ? IC_MASCOT_EAT : IC_FEED,
        }))}
        lockSubType={modalSubType === 'formula'}
        lockTitle={modalSubType === 'formula' ? t('babyTracker.formulaRecordTitle') : undefined}
      />

      {/* ---- Breast Side Picker ---- */}
      <Modal
        visible={breastSidePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBreastSidePickerVisible(false)}
      >
        <TouchableOpacity
          style={pickerStyles.backdrop}
          activeOpacity={1}
          onPress={() => setBreastSidePickerVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={pickerStyles.sheet}>
            <Text style={pickerStyles.title}>{t('babyTracker.breastPicker.title')}</Text>
            <Text style={pickerStyles.subtitle}>{t('babyTracker.breastPicker.subtitle')}</Text>
            <View style={pickerStyles.row}>
              <TouchableOpacity
                style={[pickerStyles.sideBtn, { backgroundColor: TRACKER_COLORS.feedingLight }]}
                onPress={() => handleBreastStart('left')}
                activeOpacity={0.8}
              >
                <Text style={[pickerStyles.sideEmoji, { color: TRACKER_COLORS.feedingDark }]}>{'\u25C0'}</Text>
                <Text style={pickerStyles.sideLabel}>{t('babyTracker.side.left')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pickerStyles.sideBtn, { backgroundColor: TRACKER_COLORS.feedingLight }]}
                onPress={() => handleBreastStart('right')}
                activeOpacity={0.8}
              >
                <Text style={[pickerStyles.sideEmoji, { color: TRACKER_COLORS.feedingDark }]}>{'\u25B6'}</Text>
                <Text style={pickerStyles.sideLabel}>{t('babyTracker.side.right')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={pickerStyles.cancelBtn}
              onPress={() => setBreastSidePickerVisible(false)}
            >
              <Text style={pickerStyles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ---- Analyzer Picker (대변/울음) ---- */}
      <Modal
        visible={analyzerPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAnalyzerPickerVisible(false)}
      >
        <TouchableOpacity
          style={pickerStyles.backdrop}
          activeOpacity={1}
          onPress={() => setAnalyzerPickerVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={pickerStyles.sheet}>
            <Text style={pickerStyles.title}>{t('babyTracker.analyzerPicker.title')}</Text>
            <Text style={pickerStyles.subtitle}>{t('babyTracker.analyzerPicker.subtitle')}</Text>
            <View style={pickerStyles.row}>
              <TouchableOpacity
                style={[pickerStyles.sideBtn, { backgroundColor: TRACKER_COLORS.diaperLight }]}
                onPress={() => {
                  setAnalyzerPickerVisible(false);
                  router.push('/(main)/poop-analyzer');
                }}
                activeOpacity={0.8}
              >
                <Image source={IC_POOP} style={pickerStyles.sideIcon} resizeMode="contain" />
                <Text style={pickerStyles.sideLabel}>{t('babyTracker.analyzerPicker.poopAnalysis')}</Text>
                <Text style={pickerStyles.sideSub}>{t('babyTracker.analyzerPicker.photoUpload')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pickerStyles.sideBtn, { backgroundColor: '#F7E8F0' }]}
                onPress={() => {
                  setAnalyzerPickerVisible(false);
                  router.push('/(main)/cry-analyzer');
                }}
                activeOpacity={0.8}
              >
                <Image source={IC_MIC} style={pickerStyles.sideIcon} resizeMode="contain" />
                <Text style={pickerStyles.sideLabel}>{t('babyTracker.analyzerPicker.cryAnalysis')}</Text>
                <Text style={pickerStyles.sideSub}>{t('babyTracker.analyzerPicker.soundUpload')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={pickerStyles.cancelBtn}
              onPress={() => setAnalyzerPickerVisible(false)}
            >
              <Text style={pickerStyles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ---- Bottom action 길게 누르기 → 시간 지정 입력 ---- */}
      <Modal
        visible={timedActionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimedActionVisible(false)}
      >
        <TouchableOpacity
          style={pickerStyles.backdrop}
          activeOpacity={1}
          onPress={() => setTimedActionVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={pickerStyles.sheet}>
            <Text style={pickerStyles.title}>{timedActionPayload?.label ?? t('babyTracker.record')} — {t('babyTracker.timeSpecify')}</Text>
            <Text style={pickerStyles.subtitle}>
              {timedActionPayload?.kind === 'sleepStart' ? t('babyTracker.timedPrompt.sleepStart')
                : timedActionPayload?.kind === 'sleepWake' ? t('babyTracker.timedPrompt.sleepWake')
                : timedActionPayload?.kind === 'breast' ? t('babyTracker.timedPrompt.breast')
                : t('babyTracker.timedPrompt.general')}
            </Text>

            {/* 모유: 좌/우 선택 */}
            {timedActionPayload?.kind === 'breast' ? (
              <View style={breastSidePickStyles.row}>
                <TouchableOpacity
                  style={[
                    breastSidePickStyles.sideBtn,
                    { backgroundColor: TRACKER_COLORS.feedingLight },
                    timedActionBreastSide === 'left' && breastSidePickStyles.sideBtnActive,
                  ]}
                  onPress={() => setTimedActionBreastSide('left')}
                  activeOpacity={0.85}
                >
                  <Text style={breastSidePickStyles.sideLabel}>{t('babyTracker.side.left')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    breastSidePickStyles.sideBtn,
                    { backgroundColor: TRACKER_COLORS.feedingLight },
                    timedActionBreastSide === 'right' && breastSidePickStyles.sideBtnActive,
                  ]}
                  onPress={() => setTimedActionBreastSide('right')}
                  activeOpacity={0.85}
                >
                  <Text style={breastSidePickStyles.sideLabel}>{t('babyTracker.side.right')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {(timedActionPayload?.kind === 'sleepStart' || timedActionPayload?.kind === 'sleepWake') && timedActionDate !== '' && (
              <View style={editModalStyles.field}>
                <Text style={editModalStyles.fieldLabel}>
                  {timedActionPayload.kind === 'sleepStart' ? t('babyTracker.sleepDate') : t('babyTracker.wakeDate')}
                </Text>
                <View style={editModalStyles.dateRow}>
                  <TouchableOpacity style={editModalStyles.dateArrow} onPress={() => adjustTimedActionDate(-1)}>
                    <Text style={editModalStyles.dateArrowText}>◀</Text>
                  </TouchableOpacity>
                  <Text style={editModalStyles.dateText}>
                    {formatDateKorean(new Date(timedActionDate + 'T00:00:00'))}
                  </Text>
                  <TouchableOpacity
                    style={[editModalStyles.dateArrow, timedActionDate >= formatDate(new Date()) && { opacity: 0.3 }]}
                    onPress={() => adjustTimedActionDate(+1)}
                    disabled={timedActionDate >= formatDate(new Date())}
                  >
                    <Text style={editModalStyles.dateArrowText}>▶</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {/* 분유: 양(ml) 입력 */}
            {timedActionPayload?.kind === 'quick' && timedActionPayload?.subType === 'formula' && (
              <View style={editModalStyles.field}>
                <Text style={editModalStyles.fieldLabel}>{t('babyTracker.formulaAmountMl')}</Text>
                <TextInput
                  style={editModalStyles.input}
                  value={timedActionAmount}
                  onChangeText={setTimedActionAmount}
                  placeholder={t('babyTracker.exampleAmount120b')}
                  placeholderTextColor={TRACKER_COLORS.textLight}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                {/* 기본 분유량 설정/변경/해제 (체크 후 저장 → 기본값, 길게 눌러 해제) */}
                <TouchableOpacity
                  onPress={() => setTimedSaveAsDefault((v) => !v)}
                  onLongPress={() => {
                    if (defaultFormulaAmount > 0) {
                      Alert.alert(
                        t('babyTracker.defaultFormula.titleWithAmount', { amount: defaultFormulaAmount }),
                        t('babyTracker.defaultFormula.changeHint'),
                        [
                          { text: t('babyTracker.defaultFormula.unset'), style: 'destructive', onPress: () => { saveFormulaDefault(childId, 0).catch(() => {}); setDefaultFormulaAmount(0); setTimedSaveAsDefault(false); setTimedActionAmount(''); } },
                          { text: t('common.cancel'), style: 'cancel' },
                        ],
                      );
                    }
                  }}
                  delayLongPress={400}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 2 }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, marginRight: 10,
                    borderColor: timedSaveAsDefault ? '#FF8C5A' : '#C7C7CC',
                    backgroundColor: timedSaveAsDefault ? '#FF8C5A' : '#FFFFFF',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {timedSaveAsDefault ? <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>✓</Text> : null}
                  </View>
                  <Text style={{ fontSize: 13, color: '#555555', fontWeight: '600', flex: 1 }}>
                    {defaultFormulaAmount > 0
                      ? t('babyTracker.defaultFormula.currentWithHint', { amount: defaultFormulaAmount })
                      : t('babyTracker.defaultFormula.autoSaveHint')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TimePicker value={timedActionTime} onChange={setTimedActionTime} label={t('babyTracker.time')} />

            {/* 메모 (선택) — 모든 액션 공통 */}
            <View style={editModalStyles.field}>
              <Text style={editModalStyles.fieldLabel}>{t('babyTracker.noteOptional')}</Text>
              <TextInput
                style={editModalStyles.input}
                value={timedActionNote}
                onChangeText={setTimedActionNote}
                placeholder={
                  timedActionPayload?.kind === 'sleepStart' ? t('babyTracker.notePlaceholder.nap')
                    : timedActionPayload?.kind === 'sleepWake' ? t('babyTracker.notePlaceholder.wake')
                    : timedActionPayload?.kind === 'breast' ? t('babyTracker.notePlaceholder.breast')
                    : t('babyTracker.notePlaceholder.generalFeed')
                }
                placeholderTextColor={TRACKER_COLORS.textLight}
                maxLength={120}
              />
            </View>

            <View style={editModalStyles.btnRow}>
              <TouchableOpacity
                style={editModalStyles.cancelBtn}
                onPress={() => setTimedActionVisible(false)}
              >
                <Text style={editModalStyles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  editModalStyles.saveBtn,
                  timedActionPayload?.kind === 'breast' && !timedActionBreastSide && { opacity: 0.5 },
                ]}
                onPress={handleTimedActionConfirm}
                disabled={timedActionPayload?.kind === 'breast' && !timedActionBreastSide}
              >
                <Text style={editModalStyles.saveText}>{t('babyTracker.recordAtTime', { time: timedActionTime })}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ---- 타임라인 entry 길게 누르기 → 액션 시트 + 편집 (Modal 1개 통합) ----
           정석: visible 을 둘 중 하나라도 set 되어 있으면 true 로 묶고, 내부에서 editRecord
           우선 → 편집 view, 없으면 → action sheet view.
           RN 의 두 Modal 동시 visible 변경 시 두 번째가 안 뜨는 버그를 setTimeout 없이 회피.
           라이브(__active_sleep__) 수면도 openEditModalById 가 sleepSession 으로부터 가상
           record 를 만들어 setEditRecord — 같은 view 흐름. */}
      <Modal
        visible={entryActionId !== null || editRecord !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setEntryActionId(null); setEditRecord(null); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
        <TouchableOpacity
          style={pickerStyles.backdrop}
          activeOpacity={1}
          onPress={() => { setEntryActionId(null); setEditRecord(null); }}
        >
          <TouchableOpacity activeOpacity={1} style={pickerStyles.sheet} onPress={() => Keyboard.dismiss()}>
            {editRecord === null && entryActionId !== null ? (
              <>
                <Text style={pickerStyles.title}>{t('babyTracker.recordOptions')}</Text>
                <TouchableOpacity
                  style={editModalStyles.actionRow}
                  onPress={() => {
                    // entryActionId 는 그대로 유지 — editRecord 가 set 되면 자동으로 편집 view 로 전환
                    if (entryActionId) openEditModalById(entryActionId);
                  }}
                >
                  <Text style={editModalStyles.actionRowText}>{t('babyTracker.editTimeNote')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[editModalStyles.actionRow, editModalStyles.actionRowDanger]}
                  onPress={() => {
                    const id = entryActionId;
                    setEntryActionId(null);
                    if (id) handleDeleteRecord(id);
                  }}
                >
                  <Text style={[editModalStyles.actionRowText, editModalStyles.actionRowTextDanger]}>{t('common.delete')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={editModalStyles.cancelRow}
                  onPress={() => setEntryActionId(null)}
                >
                  <Text style={editModalStyles.cancelRowText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {editRecord !== null ? (
              <Text style={pickerStyles.title}>
                {t('babyTracker.editWithLabel', { label: getSubtypeLabel(editRecord.subType, t) })}
              </Text>
            ) : null}
            {editRecord ? (
              <>
                {editDate !== '' && (
                  <View style={editModalStyles.field}>
                    <Text style={editModalStyles.fieldLabel}>
                      {editRecord.type === 'sleep' && editRecord.endTime ? t('babyTracker.sleepStartDate') : t('babyTracker.date')}
                    </Text>
                    <View style={editModalStyles.dateRow}>
                      <TouchableOpacity style={editModalStyles.dateArrow} onPress={() => adjustEditDate(-1)}>
                        <Text style={editModalStyles.dateArrowText}>◀</Text>
                      </TouchableOpacity>
                      <Text style={editModalStyles.dateText}>
                        {formatDateKorean(new Date(editDate + 'T00:00:00'))}
                        {editDate !== dateStr ? ` (${t('babyTracker.moved')})` : ''}
                      </Text>
                      <TouchableOpacity
                        style={[editModalStyles.dateArrow, editDate >= formatDate(new Date()) && { opacity: 0.3 }]}
                        onPress={() => adjustEditDate(+1)}
                        disabled={editDate >= formatDate(new Date())}
                      >
                        <Text style={editModalStyles.dateArrowText}>▶</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                <TimePicker value={editTime} onChange={setEditTime} label={editRecord.type === 'sleep' && editRecord.endTime ? t('babyTracker.sleepStartTime') : t('babyTracker.time')} />
                {editRecord.type === 'sleep' && editRecord.endTime ? (
                  <>
                    <View style={editModalStyles.field}>
                      <Text style={editModalStyles.fieldLabel}>{t('babyTracker.wakeDate')}</Text>
                      <View style={editModalStyles.dateRow}>
                        <TouchableOpacity style={editModalStyles.dateArrow} onPress={() => adjustEditEndDate(-1)}>
                          <Text style={editModalStyles.dateArrowText}>◀</Text>
                        </TouchableOpacity>
                        <Text style={editModalStyles.dateText}>
                          {editEndDate ? formatDateKorean(new Date(editEndDate + 'T00:00:00')) : '-'}
                        </Text>
                        <TouchableOpacity
                          style={[editModalStyles.dateArrow, (editEndDate >= formatDate(new Date())) && { opacity: 0.3 }]}
                          onPress={() => adjustEditEndDate(+1)}
                          disabled={editEndDate >= formatDate(new Date())}
                        >
                          <Text style={editModalStyles.dateArrowText}>▶</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TimePicker value={editEndTime} onChange={setEditEndTime} label={t('babyTracker.wakeTime')} />
                  </>
                ) : null}
                {editRecord.type === 'feeding' ? (
                  <View style={editModalStyles.field}>
                    <Text style={editModalStyles.fieldLabel}>{t('babyTracker.amountMl')}</Text>
                    <TextInput
                      style={editModalStyles.input}
                      value={editAmount}
                      onChangeText={setEditAmount}
                      placeholder={t('babyTracker.exampleAmount120b')}
                      placeholderTextColor={TRACKER_COLORS.textLight}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                    {editRecord.subType === 'formula' && (
                      <TouchableOpacity
                        onPress={() => setEditSaveAsDefault((v) => !v)}
                        onLongPress={() => {
                          if (defaultFormulaAmount > 0) {
                            Alert.alert(
                              t('babyTracker.defaultFormula.titleWithAmount', { amount: defaultFormulaAmount }),
                              t('babyTracker.defaultFormula.changeHintAmount'),
                              [
                                { text: t('babyTracker.defaultFormula.unset'), style: 'destructive', onPress: () => { saveFormulaDefault(childId, 0).catch(() => {}); setDefaultFormulaAmount(0); setEditSaveAsDefault(false); } },
                                { text: t('common.cancel'), style: 'cancel' },
                              ],
                            );
                          }
                        }}
                        delayLongPress={400}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 2 }}
                      >
                        <View style={{
                          width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, marginRight: 10,
                          borderColor: editSaveAsDefault ? '#FF8C5A' : '#C7C7CC',
                          backgroundColor: editSaveAsDefault ? '#FF8C5A' : '#FFFFFF',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          {editSaveAsDefault ? <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>✓</Text> : null}
                        </View>
                        <Text style={{ fontSize: 13, color: '#555555', fontWeight: '600', flex: 1 }}>
                          {defaultFormulaAmount > 0
                            ? t('babyTracker.defaultFormula.currentWithHint', { amount: defaultFormulaAmount })
                            : t('babyTracker.defaultFormula.autoSaveHint')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
                <View style={editModalStyles.field}>
                  <Text style={editModalStyles.fieldLabel}>{t('babyTracker.note')}</Text>
                  <TextInput
                    style={editModalStyles.input}
                    value={editNote}
                    onChangeText={setEditNote}
                    placeholder={t('babyTracker.noteOptional')}
                    placeholderTextColor={TRACKER_COLORS.textLight}
                    maxLength={120}
                  />
                </View>
                <View style={editModalStyles.btnRow}>
                  <TouchableOpacity
                    style={editModalStyles.cancelBtn}
                    onPress={() => { setEditRecord(null); setEntryActionId(null); }}
                  >
                    <Text style={editModalStyles.cancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={editModalStyles.saveBtn}
                    onPress={handleEditSave}
                  >
                    <Text style={editModalStyles.saveText}>{t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TRACKER_COLORS.bg },
  guideBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: TRACKER_COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  guideBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: TRACKER_COLORS.accent,
    marginTop: -1,
  },
  fixedAd: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
  },
  container: { flex: 1 },
  content: {
    paddingTop: Platform.OS === 'ios' ? 94 : 84,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  /* Header */
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TRACKER_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  headerBackText: { fontSize: 22, color: TRACKER_COLORS.text },
  headerTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginRight: SPACING.sm,
  },

  /* Date navigator */
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: 0,
    paddingVertical: 2,
    gap: 8,
  },
  // 액션 칩 행 (날짜 아래 별도 줄, 가운데 정렬) — 음성입력/분유값설정/음성설정/사진기록
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  dateArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TRACKER_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  dateArrowDisabled: { opacity: 0.3 },
  dateArrowText: { fontSize: 18, fontWeight: '300', color: TRACKER_COLORS.text, marginTop: -1 },
  dateArrowTextDisabled: { color: TRACKER_COLORS.textLight },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
  },
  dateTextToday: {
    color: TRACKER_COLORS.accent,
  },
  todayBadge: {
    backgroundColor: TRACKER_COLORS.accent,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: TRACKER_COLORS.white,
  },

  /* Summary row */
  summaryRow: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },

  /* Tab buttons */
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: TRACKER_COLORS.border,
    backgroundColor: TRACKER_COLORS.white,
    alignItems: 'center',
  },
  tabBtnInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  tabIcon: { width: 18, height: 18, borderRadius: 4 },
  tabBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
  },
  tabBtnTextActive: { color: TRACKER_COLORS.white },

  /* Timeline */
  timelineContainer: {
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.soft,
  },
  timelineTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  timelineTitleIcon: { width: 14, height: 14, borderRadius: 3 },
  timelineTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: TRACKER_COLORS.textSub,
  },

  /* All records mini section */
  allSection: {
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.soft,
  },
  allSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginBottom: SPACING.sm,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: TRACKER_COLORS.bg,
    gap: SPACING.sm,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  miniTime: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: TRACKER_COLORS.textSub,
    width: 42,
  },
  miniIcon: { width: 14, height: 14, borderRadius: 3, marginRight: 4 },
  miniLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: TRACKER_COLORS.text,
    flex: 1,
  },
  miniDetail: {
    fontSize: FONT_SIZE.xs,
    color: TRACKER_COLORS.textSub,
    fontWeight: '600',
  },

  /* FAB */
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: RADIUS.full,
    ...SHADOWS.elevated,
  },
  fabText: {
    color: TRACKER_COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});

/* ---- Sleep Session Card ---- */

interface SleepSessionCardProps {
  session: SleepSession | null;
  now: number;
  onStart: () => void;
  onWake: () => void;
}

function SleepSessionCard({ session, now, onStart, onWake }: SleepSessionCardProps) {
  if (!session) {
    return (
      <TouchableOpacity style={sleepSessionStyles.cardIdle} onPress={onStart} activeOpacity={0.85}>
        <Image source={IC_SLEEP} style={sleepSessionStyles.icon} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={sleepSessionStyles.idleTitle}>수면 시작</Text>
          <Text style={sleepSessionStyles.idleSub}>탭 한 번으로 수면 시간 측정을 시작해요</Text>
        </View>
        <View style={sleepSessionStyles.actionPill}>
          <Text style={sleepSessionStyles.actionPillText}>시작</Text>
        </View>
      </TouchableOpacity>
    );
  }
  const start = new Date(session.startTime);
  const diffMin = Math.max(0, Math.round((now - start.getTime()) / 60000));
  const startLabel = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
  return (
    <View style={sleepSessionStyles.cardActive}>
      <View style={sleepSessionStyles.activeHeader}>
        <Image source={IC_SLEEP} style={sleepSessionStyles.icon} resizeMode="contain" />
        <Text style={sleepSessionStyles.activeTitle}>수면 중</Text>
      </View>
      <Text style={sleepSessionStyles.activeDuration}>{formatMinutes(diffMin)}</Text>
      <Text style={sleepSessionStyles.activeStartedAt}>시작 {startLabel}</Text>
      <TouchableOpacity style={sleepSessionStyles.wakeBtn} onPress={onWake} activeOpacity={0.85}>
        <Text style={sleepSessionStyles.wakeBtnText}>기상</Text>
      </TouchableOpacity>
    </View>
  );
}

const sleepSessionStyles = StyleSheet.create({
  cardIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.md,
    ...SHADOWS.soft,
  },
  cardActive: {
    backgroundColor: TRACKER_COLORS.sleepLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  icon: { width: 32, height: 32, borderRadius: 8 },
  idleTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: TRACKER_COLORS.text },
  idleSub: { fontSize: FONT_SIZE.xs, color: TRACKER_COLORS.textSub, marginTop: 2 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  activeTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: TRACKER_COLORS.sleepDark },
  activeDuration: { fontSize: 32, fontWeight: '600', color: TRACKER_COLORS.text, marginBottom: 2 },
  activeStartedAt: { fontSize: FONT_SIZE.xs, color: TRACKER_COLORS.textSub, marginBottom: SPACING.md },
  wakeBtn: {
    backgroundColor: TRACKER_COLORS.sleepDark,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    alignItems: 'center',
  },
  wakeBtnText: { color: TRACKER_COLORS.white, fontSize: FONT_SIZE.md, fontWeight: '700' },
  actionPill: {
    backgroundColor: TRACKER_COLORS.sleepDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionPillText: { color: TRACKER_COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: '700' },
});

/* ---- Tool Button (AI 도구 섹션) ---- */

interface ToolButtonProps {
  icon: number;
  label: string;
  sub: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
}

function ToolButton({ icon, label, sub, color, onPress, loading }: ToolButtonProps) {
  return (
    <TouchableOpacity
      style={toolsStyles.item}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={loading}
    >
      <View style={[toolsStyles.circle, { backgroundColor: color + '1A', borderColor: color + '44' }]}>
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Image source={icon} style={toolsStyles.iconImg} resizeMode="contain" />
        )}
      </View>
      <Text style={toolsStyles.label} numberOfLines={1}>{label}</Text>
      <Text style={toolsStyles.sub} numberOfLines={1}>{sub}</Text>
    </TouchableOpacity>
  );
}

const toolsStyles = StyleSheet.create({
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: TRACKER_COLORS.textSub,
    marginBottom: SPACING.sm,
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: SPACING.md,
  },
  item: {
    alignItems: 'center',
    width: 84,
  },
  circle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconImg: { width: 30, height: 30 },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginBottom: 1,
  },
  sub: {
    fontSize: 10,
    color: TRACKER_COLORS.textLight,
  },
});

/* ---- Full Timeline ---- */

interface TimelineEntryProps {
  record: TrackerRecord;
  dateStr: string;
  showRelative: boolean;
  onDelete: (id: string) => void;
  onLongAction?: (id: string) => void;
  /** 연령별 모유 ml 추정용 — 없으면 6개월 기준 */
  ageMonths?: number;
}

/**
 * Phase 2 (2026-04-28): 24시간 좌측 사이드바 + 현재 시간 표시
 * (사용자 요청: '왼쪽에 밤 12시부터 24시간을 표시해줘 현재시간도 표시')
 *
 * 구조:
 *   - 0시~23시 24개 row (좌측: 시간 숫자, 우측: 해당 시간대 기록)
 *   - 현재 시간(오늘인 경우): 하이라이트 + 'NOW' 표시
 *   - 활동 있는 시간: 작은 점 마커
 *   - 빈 시간: 숫자만 (작게, scroll 시 시간감 유지)
 */
interface HourGroupedTimelineProps {
  records: TrackerRecord[];
  dateStr: string;
  isCurrentlyToday: boolean;
  onDelete: (id: string) => void;
  onLongAction?: (id: string) => void;
  /** 진행 중인 수면 세션 (사용자가 '수면' 누른 후 '기상' 누르기 전 상태) */
  activeSleepSession?: SleepSession | null;
  /** 연령별 모유 ml 추정용 — TimelineEntry 로 전달 */
  ageMonths?: number;
}

function HourGroupedTimeline({ records, dateStr, isCurrentlyToday, onDelete, onLongAction, activeSleepSession, ageMonths }: HourGroupedTimelineProps) {
  const { t } = useTranslation();
  // 분 단위 'now' 갱신 — LIVE 배지·진행중 표시용
  const [, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isCurrentlyToday) return;
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, [isCurrentlyToday]);

  // 수면 기록 → 시작/종료 분리 + 진행중 수면 가상 엔트리 추가
  const expanded = useMemo(() => {
    const out: TrackerRecord[] = [];
    // 렌더 중인 날짜의 "M/D " 프리픽스 (zero-pad 없음 — endTime 프리픽스와 동일 포맷)
    const [, mmStr, ddStr] = dateStr.split('-');
    const thisDayPrefix = `${parseInt(mmStr, 10)}/${parseInt(ddStr, 10)} `;
    for (const r of records) {
      if (r.type === 'sleep' && r.endTime) {
        // 자정을 넘긴 sleep 의 endTime 은 "M/D HH:MM" 형식 (예: "5/4 08:30").
        // wake 가상 entry 의 time 은 정렬 시 다른 HH:MM 보다 위에 와야 하므로
        // (cross-day wake 는 어제 sleep → 오늘 새벽이라 가장 빠른 기록) HH:MM 만 추출.
        // 사용자 보고 2026-05-04: "기상 누른 후 다른 기록이 기상 위로 올라가는" 버그 fix.
        const hasDatePrefix = r.endTime.includes(' ');
        // ★ 기상이 다른 날(자정 넘김)이면 그 날 타임라인(crossDayWakes)에서만 표시 →
        //   잠든 날에는 기상 엔트리를 만들지 않는다 (사용자 보고 2026-06-07: 기상이 잠든 날·깬 날 양쪽에 중복 표시되고, 한쪽 삭제 시 둘 다 사라지는 버그 fix).
        const wakeOnOtherDay = hasDatePrefix && !r.endTime.startsWith(thisDayPrefix);
        const wakeTime = hasDatePrefix ? (r.endTime.split(' ').pop() ?? r.endTime) : r.endTime;
        out.push({ ...r, id: `${r.id}__start`, subType: 'sleep_start', endTime: undefined, duration: undefined });
        if (!wakeOnOtherDay) {
          out.push({ ...r, id: `${r.id}__wake`, subType: 'sleep_end', time: wakeTime, endTime: undefined, duration: r.duration });
        }
      } else {
        out.push(r);
      }
    }
    // 진행중 수면
    if (activeSleepSession && activeSleepSession.startDate === dateStr) {
      const startDt = new Date(activeSleepSession.startTime);
      const time = `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`;
      out.push({
        id: '__active_sleep__',
        type: 'sleep',
        subType: 'sleep_start',
        time,
        note: t('babyTracker.inProgress'),
      } as TrackerRecord);
    }
    // 시간순 정렬 — 분 단위 숫자 비교 (string localeCompare 는 "9:30" vs "09:35" 같은
    // zero-pad 누락 데이터에서 잘못 정렬되므로).
    const toMin = (t: string): number => {
      // cross-day prefix ("M/D ") 가 있으면 strip
      const hhmm = t.includes(' ') ? t.split(' ').pop() ?? t : t;
      const [h, m] = hhmm.split(':');
      const hi = Number(h);
      const mi = Number(m);
      if (Number.isNaN(hi) || Number.isNaN(mi)) return 0;
      return hi * 60 + mi;
    };
    // 같은 시간 tiebreaker — 누른 순서대로.
    // 1순위: createdAt (record 추가 시점, sleep 은 sleep_start 누른 시점)
    // 2순위 (createdAt 없는 옛 데이터): records 배열 index
    // sleep __wake 는 항상 같은 sleep __start 바로 뒤로 오도록 +1 ms offset.
    const orderMap = new Map<string, number>();
    records.forEach((r, i) => orderMap.set(r.id, i * 10));
    const orderOf = (entry: TrackerRecord): number => {
      if (entry.id === '__active_sleep__') return Number.MAX_SAFE_INTEGER;
      const realId = entry.id.replace(/__start$|__wake$|__crosswake$/, '');
      // 1순위: createdAt
      const orig = records.find((r) => r.id === realId);
      if (orig?.createdAt) {
        const ts = new Date(orig.createdAt).getTime();
        return entry.id.endsWith('__wake') ? ts + 1 : ts;
      }
      // 2순위: records.index
      const base = orderMap.get(realId) ?? orderMap.get(entry.id) ?? Number.MAX_SAFE_INTEGER - 1;
      return entry.id.endsWith('__wake') ? base + 1 : base;
    };
    out.sort((a, b) => {
      const diff = toMin(a.time) - toMin(b.time);
      if (diff !== 0) return diff;
      return orderOf(a) - orderOf(b);
    });
    return out;
  }, [records, activeSleepSession, dateStr]);

  if (expanded.length === 0) {
    return (
      <View style={simpleTlStyles.empty}>
        <Text style={simpleTlStyles.emptyText}>{t('babyTracker.noRecordsYet')}</Text>
        <Text style={simpleTlStyles.emptySub}>{t('babyTracker.noRecordsHint')}</Text>
      </View>
    );
  }

  return (
    <View style={simpleTlStyles.list}>
      {expanded.map((r) => (
        <TimelineEntry
          key={r.id}
          record={r}
          dateStr={dateStr}
          showRelative={isCurrentlyToday}
          onDelete={onDelete}
          onLongAction={onLongAction}
          ageMonths={ageMonths}
        />
      ))}
    </View>
  );
}

const simpleTlStyles = StyleSheet.create({
  list: {
    paddingVertical: 4,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: { fontSize: 15, fontWeight: '700', color: TRACKER_COLORS.textSub },
  emptySub: { fontSize: 12, color: TRACKER_COLORS.textLight, marginTop: 6 },
});

const hourTlStyles = StyleSheet.create({
  // Phase 2: 자체 스크롤 박스
  scrollBox: {
    maxHeight: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  root: { paddingTop: 4 },
  hourBlock: {
    flexDirection: 'row',
    minHeight: 36,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F2',
  },
  currentHourBlock: {
    backgroundColor: '#FFF6EE',
  },
  activeHourBlock: {
    backgroundColor: '#FFFFFF',
  },
  hourLabelCol: {
    width: 44,
    alignItems: 'center',
    paddingTop: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5E5EA',
  },
  hourNum: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ABABAB',
  },
  hourNumActive: {
    color: '#1C1C1E',
  },
  hourNumCurrent: {
    color: '#FF8C5A',
    fontSize: 16,
    fontWeight: '600',
  },
  nowBadge: {
    marginTop: 4,
    backgroundColor: '#FF8C5A',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nowBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activityDot: {
    marginTop: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF8C5A',
  },
  hourContent: {
    flex: 1,
  },
});

function TimelineEntry({ record, dateStr, showRelative, onDelete, onLongAction, ageMonths }: TimelineEntryProps) {
  const { t } = useTranslation();
  const typeColor =
    record.type === 'diaper'
      ? TRACKER_COLORS.diaper
      : record.type === 'feeding'
        ? TRACKER_COLORS.feeding
        : record.type === 'medication'
          ? TRACKER_COLORS.medication
          : record.type === 'custom'
            ? TRACKER_COLORS.custom
            : TRACKER_COLORS.sleep;
  const typeDark =
    record.type === 'diaper'
      ? TRACKER_COLORS.diaperDark
      : record.type === 'feeding'
        ? TRACKER_COLORS.feedingDark
        : record.type === 'medication'
          ? TRACKER_COLORS.medicationDark
          : record.type === 'custom'
            ? TRACKER_COLORS.customDark
            : TRACKER_COLORS.sleepDark;
  const icon = SUBTYPE_ICONS[record.subType] ?? IC_POOP;
  const baseLabel = getSubtypeLabel(record.subType, t);
  // 모유: 왼쪽/오른쪽을 라벨에 병합 → "모유 (왼쪽)"
  const label = record.subType === 'breast' && record.note
    ? `${baseLabel} (${record.note})`
    : baseLabel;
  const relative = showRelative ? getRelativeTime(record.time, dateStr) : '';
  // note를 라벨에 합쳤으면 하단 note는 숨김
  const hideNote = record.subType === 'breast';

  // Amount/duration은 첫 줄 info로
  const infoParts: string[] = [];
  if (record.amount != null && record.amount > 0) infoParts.push(`${record.amount}ml`);
  if (record.duration != null && record.duration > 0) infoParts.push(formatMinutes(record.duration));
  // 모유: duration 있으면 연령별 추정 ml 같이 표시 (요약 표와 동일 계산)
  if (
    record.type === 'feeding' &&
    record.subType === 'breast' &&
    record.duration != null &&
    record.duration > 0
  ) {
    const estMl = estimateBreastMl(record.duration, ageMonths ?? 6);
    if (estMl > 0) infoParts.push(t('babyTracker.estimatedAmount', { amount: estMl }));
  }
  const info = infoParts.join(' · ');
  // note는 별도 두 번째 줄로 (사용자 요청: '메모 적은 거 다 보이게')
  // 분유량(amount)도 두 번째 줄에 메모처럼 합쳐 표시 (좁은 화면에서 첫 줄이 잘리는 문제 해결)
  const userNote = record.note && !hideNote ? record.note : '';
  const detailLineParts: string[] = [];
  if (info !== '') detailLineParts.push(info);
  if (userNote !== '') detailLineParts.push(userNote);
  const detailLine = detailLineParts.join(' · ');

  // 진행중 수면 → LIVE 배지
  const isLive = record.id === '__active_sleep__';
  // 부가 설명 (라벨 아래 표시)
  const subInfo = info || (userNote && isLive ? userNote : '');
  const memoLine = !isLive && userNote ? userNote : '';

  return (
    <TouchableOpacity
      style={timelineRowStyles.outer}
      onLongPress={() => (onLongAction ? onLongAction(record.id) : onDelete(record.id))}
      delayLongPress={500}
      activeOpacity={0.85}
    >
      {/* 시간 컬럼 */}
      <Text style={timelineRowStyles.time}>{record.time}</Text>

      {/* 컬러 vertical bar + dot */}
      <View style={timelineRowStyles.timelineCol}>
        <View style={[timelineRowStyles.dot, { backgroundColor: typeColor }]} />
        <View style={[timelineRowStyles.line, { backgroundColor: typeColor + '33' }]} />
      </View>

      {/* 카드 */}
      <View style={timelineRowStyles.card}>
        <Image source={icon} style={timelineRowStyles.icon} resizeMode="contain" />
        <View style={timelineRowStyles.textCol}>
          <Text style={[timelineRowStyles.label, { color: typeDark }]} numberOfLines={1}>
            {label}
          </Text>
          {/* 공동육아: 초대받은 가족이 남긴 기록이면 작성자 표시 (소유자/옛 기록은 미표시) */}
          {record.authorLabel ? (
            <Text style={timelineRowStyles.author} numberOfLines={1}>
              {t('babyTracker.recordedBy', { author: record.authorLabel })}
            </Text>
          ) : null}
          {subInfo ? (
            <Text style={timelineRowStyles.detail} numberOfLines={1}>
              {subInfo}
            </Text>
          ) : null}
          {memoLine ? (
            <Text style={timelineRowStyles.memo} numberOfLines={3}>
              {memoLine}
            </Text>
          ) : null}
        </View>
        {isLive ? (
          <View style={timelineRowStyles.liveBadge}>
            <Text style={timelineRowStyles.liveText}>LIVE</Text>
          </View>
        ) : relative !== '' ? (
          <Text style={timelineRowStyles.rel} numberOfLines={1}>{relative}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const timelineRowStyles = StyleSheet.create({
  outer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 1,
    paddingHorizontal: 8,
  },
  time: {
    width: 40,
    fontSize: 11,
    fontWeight: '700',
    color: TRACKER_COLORS.textSub,
    paddingTop: 8,
    textAlign: 'center',
  },
  timelineCol: {
    width: 12,
    alignItems: 'center',
    paddingTop: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 2,
    minHeight: 12,
    borderRadius: 1,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 6,
    marginLeft: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 5,
  },
  textCol: { flex: 1 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 0,
  },
  detail: {
    fontSize: 10,
    color: TRACKER_COLORS.textSub,
    fontWeight: '600',
  },
  author: {
    fontSize: 9.5,
    color: TRACKER_COLORS.feedingDark,
    fontWeight: '700',
    marginTop: 1,
  },
  memo: {
    fontSize: 10,
    color: TRACKER_COLORS.text,
    fontWeight: '500',
    marginTop: 1,
    lineHeight: 13,
  },
  rel: {
    fontSize: 11,
    color: TRACKER_COLORS.textLight,
    fontWeight: '600',
    marginLeft: 4,
  },
  liveBadge: {
    backgroundColor: '#9C5CFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

const timelineStyles = StyleSheet.create({
  // Phase 1 (2026-04-28): 글씨 크게, 행 높이 증가, 메모 가독성 ↑
  // 2026-04-28 (추가): 메모를 두 번째 줄로 분리 — 한 줄에 다 안 들어가는 문제 해결
  // (사용자 요청: '메모 적은 거 다 보이게 / 작은 글씨라도 분유에 있는 메모도 보이게')
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECEE',
    borderLeftWidth: 4,
    backgroundColor: TRACKER_COLORS.white,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noteRow: {
    fontSize: 13,
    color: TRACKER_COLORS.textSub,
    lineHeight: 18,
    marginTop: 4,
    paddingLeft: 92, // timeCell(56) + iconCell(26) + gap(10) = 92 → 라벨 시작 위치 정렬
  },
  timeCell: {
    width: 56,                  // 46 → 56 (시간 16:30 안 잘리게)
    fontSize: 16,               // 11 → 16 (시간 ↑↑)
    fontWeight: '600',          // 700 → 800
    color: TRACKER_COLORS.text,
  },
  iconCell: {
    width: 26,                  // 16 → 26
    height: 26,                 // 16 → 26
    borderRadius: 6,
  },
  labelCell: {
    width: 86,                  // 72 → 86
    fontSize: 15,               // 12 → 15 (행위 라벨 ↑)
    fontWeight: '700',
  },
  infoCell: {
    flex: 1,
    fontSize: 14,               // 11 → 14 (메모 + 양/시간 한 줄 표시)
    color: TRACKER_COLORS.text, // textSub → text (선명한 색)
    lineHeight: 19,
  },
  relCell: {
    fontSize: 12,               // 10 → 12
    color: TRACKER_COLORS.textLight,
    textAlign: 'right',
    fontWeight: '600',
  },
});

/* ---- Bottom Action Bar ---- */

type BottomAction =
  | { kind: 'modal'; subType: string }
  | { kind: 'quick'; type: RecordType; subType: string }
  | { kind: 'breast' }
  | { kind: 'sleepStart' }
  | { kind: 'sleepWake' }
  | { kind: 'custom' };  // Phase 4-B: 사용자 정의 라벨 + 특징 입력

interface BottomBarItem {
  icon: number;
  label: string;
  action: BottomAction;
  color: string;
}

// label 필드는 i18n 키 접미사(babyTracker.subtypes.*) — 표시 시 getSubtypeLabel 대신
// 직접 t(`babyTracker.subtypes.${label}`) 로 조회한다 (아래 render 참고).
const BAR_ITEMS: BottomBarItem[] = [
  { icon: IC_FEED, label: 'formula', action: { kind: 'modal', subType: 'formula' }, color: TRACKER_COLORS.feedingDark },
  { icon: IC_FEED, label: 'babyFood', action: { kind: 'quick', type: 'feeding', subType: 'baby_food' }, color: TRACKER_COLORS.feedingDark },
  { icon: IC_MASCOT_EAT, label: 'breast', action: { kind: 'breast' }, color: TRACKER_COLORS.feedingDark },
  { icon: IC_SLEEP, label: 'sleep', action: { kind: 'sleepStart' }, color: TRACKER_COLORS.sleepDark },
  { icon: IC_SUNNY, label: 'wake', action: { kind: 'sleepWake' }, color: TRACKER_COLORS.sleepDark },
  { icon: IC_POOP, label: 'pee', action: { kind: 'quick', type: 'diaper', subType: 'pee' }, color: TRACKER_COLORS.diaperDark },
  { icon: IC_POOP, label: 'poop', action: { kind: 'quick', type: 'diaper', subType: 'poop' }, color: TRACKER_COLORS.diaperDark },
  // Phase 4-A (2026-04-28): 투약 — 빠른 기록 4종
  { icon: IC_MEDICATION, label: 'fever', action: { kind: 'quick', type: 'medication', subType: 'fever' }, color: TRACKER_COLORS.medicationDark },
  { icon: IC_MEDICATION, label: 'antibiotic', action: { kind: 'quick', type: 'medication', subType: 'antibiotic' }, color: TRACKER_COLORS.medicationDark },
  { icon: IC_MEDICATION, label: 'vitamin', action: { kind: 'quick', type: 'medication', subType: 'vitamin' }, color: TRACKER_COLORS.medicationDark },
  // Phase 4-B (2026-04-28): 사용자 정의 라벨 — '직접 입력'
  { icon: IC_CUSTOM, label: 'customInput', action: { kind: 'custom' }, color: TRACKER_COLORS.customDark },
];

interface BottomActionBarProps {
  breastActive: boolean;
  onAction: (action: BottomAction) => void;
  onLongAction?: (action: BottomAction) => void;
  hintVisible?: boolean;
}

function BottomActionBar({ breastActive, onAction, onLongAction, hintVisible }: BottomActionBarProps) {
  const { t } = useTranslation();
  return (
    <View style={barStyles.wrapper}>
      {hintVisible ? (
        <Text style={barStyles.hint}>{t('babyTracker.bottomBarHint')}</Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={barStyles.container}
      >
        {BAR_ITEMS.map((item) => {
          const isBreast = item.action.kind === 'breast';
          const active = isBreast && breastActive;
          // 시간 지정 입력 지원: quick / sleepStart / sleepWake / breast / 분유(modal+formula)
          // 미지원: custom(자유 입력)
          const supportsTimed =
            item.action.kind === 'quick' ||
            item.action.kind === 'sleepStart' ||
            item.action.kind === 'sleepWake' ||
            item.action.kind === 'breast' ||
            (item.action.kind === 'modal' && item.action.subType === 'formula');
          return (
            <TouchableOpacity
              key={item.label}
              style={[
                barStyles.item,
                active && { backgroundColor: item.color + '22' },
              ]}
              onPress={() => onAction(item.action)}
              onLongPress={supportsTimed && onLongAction ? () => onLongAction(item.action) : undefined}
              delayLongPress={400}
              activeOpacity={0.7}
            >
              <View style={[barStyles.iconWrap, { backgroundColor: item.color + '1A' }]}>
                <Image source={item.icon} style={barStyles.icon} resizeMode="contain" />
              </View>
              <Text style={[barStyles.itemLabel, active && { color: item.color }]}>
                {isBreast && breastActive ? t('babyTracker.breastFeeding') : t(`babyTracker.subtypes.${item.label}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: TRACKER_COLORS.white,
    borderTopWidth: 1,
    borderTopColor: TRACKER_COLORS.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    ...SHADOWS.elevated,
  },
  hint: {
    fontSize: 10,
    fontWeight: '600',
    color: TRACKER_COLORS.textLight,
    textAlign: 'center',
    paddingBottom: 4,
  },
  container: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    minWidth: 58,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: { width: 28, height: 28 },
  itemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
    textAlign: 'center',
  },
});

/* ---- Quick Links ---- */

const quickLinkStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    ...SHADOWS.soft,
  },
  emoji: { fontSize: 18 },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
  },
});

/* ---- Toast ---- */

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 110 : 100,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: 'rgba(28,28,30,0.92)',
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  text: {
    color: TRACKER_COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
});

/* ---- Analysis Styles ---- */

const analysisStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TRACKER_COLORS.accent,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  buttonIcon: {
    width: 20,
    height: 20,
    marginRight: SPACING.sm,
    borderRadius: 4,
  },
  buttonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: TRACKER_COLORS.white,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFF0F0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: TRACKER_COLORS.danger,
    textAlign: 'center',
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
    overflow: 'hidden',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: TRACKER_COLORS.accentLight,
  },
  resultTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
  },
  collapseIcon: {
    fontSize: FONT_SIZE.sm,
    color: TRACKER_COLORS.textSub,
  },
  resultBody: {
    padding: SPACING.lg,
  },
  metricCard: {
    backgroundColor: TRACKER_COLORS.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  resultTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  sectionIcon: { width: 18, height: 18, borderRadius: 4 },
  metricIcon: {
    width: 22,
    height: 22,
    marginRight: SPACING.sm,
    borderRadius: 6,
  },
  metricTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    flex: 1,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  levelBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: TRACKER_COLORS.white,
  },
  metricRange: {
    fontSize: FONT_SIZE.xs,
    color: TRACKER_COLORS.textSub,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  metricComment: {
    fontSize: FONT_SIZE.sm,
    color: TRACKER_COLORS.text,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  adviceBox: {
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  adviceLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: TRACKER_COLORS.accent,
    marginBottom: SPACING.xs,
  },
  adviceText: {
    fontSize: FONT_SIZE.sm,
    color: TRACKER_COLORS.text,
    lineHeight: 20,
  },
  summaryBox: {
    backgroundColor: TRACKER_COLORS.accentLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.xs,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: TRACKER_COLORS.accent,
    marginBottom: SPACING.xs,
  },
  summaryText: {
    fontSize: FONT_SIZE.sm,
    color: TRACKER_COLORS.text,
    lineHeight: 22,
  },
});

/* ---- Breast-feeding card styles ---- */
const breastStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: TRACKER_COLORS.border,
    ...SHADOWS.soft,
  },
  cardActive: {
    backgroundColor: TRACKER_COLORS.feedingLight,
    borderColor: TRACKER_COLORS.feedingDark,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: TRACKER_COLORS.feedingLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  icon: { width: 36, height: 36 },
  textCol: { flex: 1 },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginBottom: 2,
  },
  sub: {
    fontSize: FONT_SIZE.xs,
    color: TRACKER_COLORS.textSub,
  },
  rightCol: { alignItems: 'flex-end', minWidth: 72 },
  timer: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: TRACKER_COLORS.feedingDark,
    fontVariant: ['tabular-nums'],
  },
  stopHint: {
    fontSize: 10,
    color: TRACKER_COLORS.textLight,
    marginTop: 2,
  },
  estimateText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: TRACKER_COLORS.feedingDark,
    marginTop: 4,
  },
  estimateHint: {
    fontSize: 11,
    color: TRACKER_COLORS.textSub,
    marginTop: 2,
  },
  estimateNote: {
    fontSize: 10,
    color: TRACKER_COLORS.textLight,
    marginTop: 4,
    lineHeight: 14,
  },
  startIcon: {
    fontSize: 22,
    color: TRACKER_COLORS.feedingDark,
  },
});

/* ---- 모유 좌/우 피커 (시간 지정 모달 내부) ---- */
const breastSidePickStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sideBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sideBtnActive: {
    borderColor: TRACKER_COLORS.feeding,
    backgroundColor: '#FFF0E6',
  },
  sideLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
  },
});

/* ---- Edit / Action-sheet modal styles ---- */
const editModalStyles = StyleSheet.create({
  field: { marginTop: SPACING.sm, marginBottom: 4 },
  fieldLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
    marginBottom: 4,
  },
  input: {
    backgroundColor: TRACKER_COLORS.bg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: FONT_SIZE.sm,
    color: TRACKER_COLORS.text,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.border,
  },
  btnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: TRACKER_COLORS.bg,
    alignItems: 'center',
  },
  cancelText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: TRACKER_COLORS.textSub },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: TRACKER_COLORS.feeding,
    alignItems: 'center',
  },
  saveText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: '#FFFFFF' },
  actionRow: {
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    backgroundColor: TRACKER_COLORS.bg,
    marginTop: 6,
    alignItems: 'center',
  },
  actionRowDanger: {
    backgroundColor: '#FFF0F0',
  },
  actionRowText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
  },
  actionRowTextDanger: {
    color: TRACKER_COLORS.danger,
  },
  cancelRow: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelRowText: {
    fontSize: FONT_SIZE.sm,
    color: TRACKER_COLORS.textLight,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TRACKER_COLORS.bg,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
  },
  dateArrow: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  dateArrowText: {
    fontSize: FONT_SIZE.md,
    color: TRACKER_COLORS.accent,
    fontWeight: '700',
  },
  dateText: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: TRACKER_COLORS.text,
  },
});

/* ---- Picker modal (breast side / analyzer) ---- */
const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  sheet: {
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONT_SIZE.xs,
    color: TRACKER_COLORS.textSub,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  sideBtn: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  sideEmoji: {
    fontSize: 28,
    marginBottom: 4,
    fontWeight: '700',
  },
  sideIcon: {
    width: 36,
    height: 36,
    marginBottom: 6,
  },
  sideLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
  },
  sideSub: {
    fontSize: 10,
    color: TRACKER_COLORS.textSub,
    marginTop: 2,
  },
  cancelBtn: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FONT_SIZE.sm,
    color: TRACKER_COLORS.textSub,
    fontWeight: '600',
  },
});


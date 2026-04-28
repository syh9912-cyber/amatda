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
  ActivityIndicator,
} from 'react-native';

/* eslint-disable @typescript-eslint/no-require-imports */
const IC_POOP = require('../../assets/cat-poop.png') as number;
const IC_FEED = require('../../assets/cat-eating.png') as number;
const IC_SLEEP = require('../../assets/cat-sleep.png') as number;
const IC_SUNNY = require('../../assets/weather-sunny.png') as number;
const IC_NIGHT = require('../../assets/weather-night.png') as number;
const IC_EMPTY = require('../../assets/empty-diary.png') as number;
const IC_MASCOT_EAT = require('../../assets/mascot-eating.png') as number;
const IC_MIC = require('../../assets/icon-mic.png') as number;
const IC_ANALYZING = require('../../assets/analyzing.png') as number;
const IC_BADGE_AI = require('../../assets/badge-ai.png') as number;
const IC_MEDICATION = require('../../assets/icon-hospital.png') as number;
const IC_CUSTOM = require('../../assets/icon-mic.png') as number;  // 임시 — 커스텀 라벨용
/* eslint-enable @typescript-eslint/no-require-imports */
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { getDailyReference, calcFeedIntervalProgress } from '../../constants/dailyReference';
import { growthApi, childApi } from '../../services/api';
import { getTrackerTabs, getFeedingTypes } from '../../constants/ageFeatures';
import type { AgeGroupKey } from '../../constants/ageGroups';
import PregnancyScreen from './pregnancy';
import { AdSlot } from '../../components/ads/AdSlot';
import { saveAnalysisHistory } from '../../utils/analysisHistory';
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
  TrackerAnalysisResult,
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
import { computeSummary } from '../../features/baby-tracker/utils/summary';
import {
  loadRecords,
  saveRecords,
  loadSleepSession,
  saveSleepSession,
  loadBreastSession,
  saveBreastSession,
  loadRangeStats,
} from '../../features/baby-tracker/storage';

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const TAB_CONFIG: { key: RecordType; icon: number; label: string; color: string }[] = [
  { key: 'diaper', icon: IC_POOP, label: '배변', color: TRACKER_COLORS.diaper },
  { key: 'feeding', icon: IC_FEED, label: '수유/식사', color: TRACKER_COLORS.feeding },
  { key: 'sleep', icon: IC_SLEEP, label: '수면', color: TRACKER_COLORS.sleep },
  { key: 'medication', icon: IC_MEDICATION, label: '투약', color: TRACKER_COLORS.medication },
];

const DIAPER_OPTIONS: { key: DiaperSubType; label: string; icon: number }[] = [
  { key: 'pee', label: '소변', icon: IC_POOP },
  { key: 'poop', label: '대변', icon: IC_POOP },
  { key: 'both', label: '소변+대변', icon: IC_POOP },
];

const FEEDING_OPTIONS: { key: FeedingSubType; label: string; icon: number }[] = [
  { key: 'breast', label: '모유', icon: IC_MASCOT_EAT },
  { key: 'formula', label: '분유', icon: IC_FEED },
  { key: 'baby_food', label: '이유식', icon: IC_FEED },
  { key: 'snack', label: '간식', icon: IC_FEED },
];

const SLEEP_OPTIONS: { key: SleepSubType; label: string; icon: number }[] = [
  { key: 'nap', label: '낮잠', icon: IC_SUNNY },
  { key: 'night', label: '밤잠', icon: IC_NIGHT },
];

const SUBTYPE_LABELS: Record<string, string> = {
  pee: '소변',
  poop: '대변',
  both: '소변+대변',
  breast: '모유',
  formula: '분유',
  baby_food: '이유식',
  snack: '간식',
  nap: '낮잠',
  night: '밤잠',
  sleep: '수면',
  sleep_start: '수면',     // '수면 시작' → '수면' (사용자 요청, 화면 간결화)
  sleep_end: '기상',
  // 투약 (Phase 4-A)
  fever: '해열제',
  antibiotic: '항생제',
  vitamin: '비타민',
  other: '기타 약',
};

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
        <AdSlot />
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
  value: { fontSize: FONT_SIZE.md, fontWeight: '800' },
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
  const cfg = TAB_CONFIG.find((t) => t.key === tab);
  return (
    <View style={emptyStyles.container}>
      <Image source={cfg?.icon ?? IC_EMPTY} style={emptyStyles.iconImg} resizeMode="contain" />
      <Text style={emptyStyles.title}>아직 기록이 없어요</Text>
      <Text style={emptyStyles.sub}>
        아래 + 버튼을 눌러{'\n'}오늘의 {cfg?.label ?? ''} 기록을 추가해보세요
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

const PERIOD_LABELS: Record<number, string> = { 7: '7일', 14: '14일', 31: '1달' };

function WeeklySummaryTable({
  stats,
  periodDays = 7,
}: {
  stats: DayStat[];
  activeTab?: RecordType;
  periodDays?: number;
}) {
  // 최근이 뒤(배열 끝) → 상단에 표시되도록 역순
  const rows = [...stats].reverse();

  // 컬럼별 최대값 — 셀 배경 강도 계산용
  const maxDiaper = Math.max(...stats.map((s) => s.diaper), 1);
  const maxFeeding = Math.max(...stats.map((s) => s.feeding), 1);
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
        최근 {PERIOD_LABELS[periodDays] ?? `${periodDays}일`} 요약
      </Text>

      {/* 헤더 */}
      <View style={summaryStyles.headerRow}>
        <Text style={[summaryStyles.cellDate, summaryStyles.headerCell]}>날짜</Text>
        <Text style={[summaryStyles.cellVal, summaryStyles.headerCell]}>💩 배변</Text>
        <Text style={[summaryStyles.cellVal, summaryStyles.headerCell]}>🍼 수유</Text>
        <Text style={[summaryStyles.cellVal, summaryStyles.headerCell]}>💤 수면</Text>
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
              {isToday ? '오늘' : s.dateLabel}
            </Text>
            <View style={[summaryStyles.cellValWrap, { backgroundColor: intensity(s.diaper, maxDiaper) }]}>
              <Text style={[summaryStyles.cellVal, isToday && summaryStyles.todayText]}>
                {s.diaper > 0 ? `${s.diaper}` : '-'}
              </Text>
            </View>
            <View style={[summaryStyles.cellValWrap, { backgroundColor: intensity(s.feeding, maxFeeding) }]}>
              <Text style={[summaryStyles.cellVal, isToday && summaryStyles.todayText]}>
                {s.feeding > 0 ? `${s.feeding}` : '-'}
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
    fontWeight: '800',
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
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
    backgroundColor: '#EFEBFE',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9C8FE3',
  },
  voiceBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6E5BC4',
  },
});

// 이전 막대 차트는 제거됨 (대체: WeeklySummaryTable)
const WeeklyChart = WeeklySummaryTable;

/* ---- Day Summary Card ---- */
function DaySummaryCard({ summary }: { summary: DaySummary }) {
  const { peeCount, poopCount, formulaMl, breastMin, breastLeftMin, breastRightMin, breastCount, solidCount, totalSleepMinutes, diaperCount, feedingCount } = summary;

  // 수유 요약 조합: "분유 540ml · 모유 20분(좌10/우10) · 이유식 1"
  const feedingParts: string[] = [];
  if (formulaMl > 0) feedingParts.push(`분유 ${formulaMl}ml`);
  if (breastMin > 0) {
    const sides: string[] = [];
    if (breastLeftMin > 0) sides.push(`좌${breastLeftMin}`);
    if (breastRightMin > 0) sides.push(`우${breastRightMin}`);
    const sideLabel = sides.length > 0 ? ` (${sides.join('/')})` : '';
    feedingParts.push(`모유 ${breastMin}분${sideLabel}`);
  } else if (breastCount > 0) {
    feedingParts.push(`모유 ${breastCount}회`);
  }
  if (solidCount > 0) feedingParts.push(`이유식 ${solidCount}회`);
  const feedingSummary = feedingParts.length > 0 ? feedingParts.join(' · ') : '-';

  // 배변 요약: "소변 3 · 대변 1"
  const diaperParts: string[] = [];
  if (peeCount > 0) diaperParts.push(`소변 ${peeCount}`);
  if (poopCount > 0) diaperParts.push(`대변 ${poopCount}`);
  const diaperSummary = diaperParts.length > 0 ? diaperParts.join(' · ') : '-';

  // 수면: 시간 표기
  const sleepH = Math.floor(totalSleepMinutes / 60);
  const sleepM = totalSleepMinutes % 60;
  const sleepSummary = totalSleepMinutes > 0
    ? (sleepH > 0 ? `${sleepH}시간 ${sleepM}분` : `${sleepM}분`)
    : '-';

  // Phase 1 (2026-04-28): 3줄 → 1줄 chip 가로 스크롤로 압축
  // (사용자 요청: '요약은 최대한 작게, 시간 부분을 최대한 길게')
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={daySumStyles.scrollWrap}
    >
      {diaperCount > 0 && (
        <View style={[daySumStyles.chip, { backgroundColor: TRACKER_COLORS.diaperLight }]}>
          <Text style={[daySumStyles.chipLabel, { color: TRACKER_COLORS.diaperDark }]}>{'💩'}</Text>
          <Text style={[daySumStyles.chipValue, { color: TRACKER_COLORS.diaperDark }]}>
            {diaperCount}회
            {diaperSummary !== '-' ? ` · ${diaperSummary}` : ''}
          </Text>
        </View>
      )}
      {feedingCount > 0 && (
        <View style={[daySumStyles.chip, { backgroundColor: TRACKER_COLORS.feedingLight }]}>
          <Text style={[daySumStyles.chipLabel, { color: TRACKER_COLORS.feedingDark }]}>{'🍼'}</Text>
          <Text style={[daySumStyles.chipValue, { color: TRACKER_COLORS.feedingDark }]}>
            {feedingCount}회
            {feedingSummary !== '-' ? ` · ${feedingSummary}` : ''}
          </Text>
        </View>
      )}
      {totalSleepMinutes > 0 && (
        <View style={[daySumStyles.chip, { backgroundColor: TRACKER_COLORS.sleepLight }]}>
          <Text style={[daySumStyles.chipLabel, { color: TRACKER_COLORS.sleepDark }]}>{'💤'}</Text>
          <Text style={[daySumStyles.chipValue, { color: TRACKER_COLORS.sleepDark }]}>
            {sleepSummary}
          </Text>
        </View>
      )}
      {/* 모두 0건일 때 placeholder */}
      {diaperCount === 0 && feedingCount === 0 && totalSleepMinutes === 0 && (
        <View style={[daySumStyles.chip, { backgroundColor: TRACKER_COLORS.bg }]}>
          <Text style={[daySumStyles.chipValue, { color: TRACKER_COLORS.textLight }]}>
            오늘은 아직 기록이 없어요
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const daySumStyles = StyleSheet.create({
  // Phase 1: 가로 스크롤 1줄 chip
  scrollWrap: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  chipLabel: {
    fontSize: 14,
  },
  chipValue: {
    fontSize: 13,
    fontWeight: '700',
  },
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

  return (
    <View style={dailyRefStyles.card}>
      {/* 수유 텀 (Row 1) */}
      {showFeedRow && (
        <View style={dailyRefStyles.row}>
          <Text style={dailyRefStyles.rowLabel}>{'🍼 수유 텀'}</Text>
          <Text style={dailyRefStyles.rowValue}>
            {minutesSinceLastFeed < 0
              ? '오늘 첫 수유'
              : feedPct >= 1
                ? `${formatMinutes(minutesSinceLastFeed)} 경과 · 권장 텀 도달`
                : `${formatMinutes(minutesSinceLastFeed)} 경과`}
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
          <Text style={dailyRefStyles.rowSub}>
            권장 {ref.feedIntervalHrMin}~{ref.feedIntervalHrMax}시간
          </Text>
        </View>
      )}

      {/* 분유량 (Row 2) */}
      {showFormulaRow && (
        <View style={dailyRefStyles.row}>
          <Text style={dailyRefStyles.rowLabel}>{'🍼 일일 분유량'}</Text>
          <Text style={dailyRefStyles.rowValue}>
            {formulaMlToday}ml / {ref.formulaMlMin}~{ref.formulaMlMax}ml
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
          <Text style={dailyRefStyles.rowSub}>
            기준 체중 {ref.weightKg.toFixed(1)}kg{ref.weightIsEstimated ? ' (추정)' : ''}
          </Text>
        </View>
      )}

      {/* 수면 (Row 3) */}
      {sleepTargetMin > 0 && (
        <View style={[dailyRefStyles.row, { borderBottomWidth: 0 }]}>
          <Text style={dailyRefStyles.rowLabel}>{'💤 일일 수면'}</Text>
          <Text style={dailyRefStyles.rowValue}>
            {formatMinutes(totalSleepMinutesToday)} / {ref.sleepHrMin}~{ref.sleepHrMax}시간
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
          <Text style={dailyRefStyles.rowSub}>
            {ref.ageMonths}개월 권장
          </Text>
        </View>
      )}
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
    fontWeight: '800',
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
  btnSaveText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
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
  card: {
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.sm,
    ...SHADOWS.soft,
  },
  row: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F2',
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TRACKER_COLORS.textSub,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginTop: 2,
  },
  barTrack: {
    height: 8,
    backgroundColor: '#F0F0F2',
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  rowSub: {
    fontSize: 11,
    color: TRACKER_COLORS.textLight,
    marginTop: 4,
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
}

function AddRecordModal({ visible, initialTab, initialSubType, onClose, onSave, availableTabs, feedingOptions, lockSubType, lockTitle }: AddModalProps) {
  const [tab, setTab] = useState<RecordType>(initialTab);
  const [subType, setSubType] = useState<string>('');
  const [time, setTime] = useState(nowTime());
  const [endTime, setEndTime] = useState('');
  const [amount, setAmount] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [note, setNote] = useState('');
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

  function resetForm(t: RecordType, sub?: string) {
    setTime(nowTime());
    setEndTime('');
    setAmount('');
    setDurationMin('');
    setNote('');
    if (sub) {
      setSubType(sub);
      return;
    }
    if (t === 'diaper') setSubType('pee');
    else if (t === 'feeding') setSubType('breast');
    else setSubType('nap');
  }

  function handleTabChange(t: RecordType) {
    setTab(t);
    resetForm(t);
  }

  function handleSave() {
    if (!subType) {
      Alert.alert('', '유형을 선택해주세요.');
      return;
    }

    const record: TrackerRecord = {
      id: generateId(),
      type: tab,
      subType,
      time,
    };

    if (tab === 'feeding') {
      const ml = parseInt(amount, 10);
      if (subType === 'formula' && ml > 0) record.amount = ml;
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
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1C1C1E' }}>
                {lockTitle}
              </Text>
            </View>
          ) : null}

          {/* Tab switcher (연령별 필터) */}
          {!lockSubType && (
          <View style={modalStyles.tabRow}>
            {availableTabs.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  modalStyles.tabBtn,
                  tab === t.key && { backgroundColor: t.color },
                ]}
                onPress={() => handleTabChange(t.key)}
              >
                <View style={modalStyles.tabBtnInner}>
                  <Image source={t.icon} style={modalStyles.tabIcon} resizeMode="contain" />
                  <Text
                    style={[
                      modalStyles.tabBtnText,
                      tab === t.key && modalStyles.tabBtnTextActive,
                    ]}
                  >
                    {t.label}
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
            <Text style={modalStyles.sectionTitle}>유형 선택</Text>
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
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
              </>
            )}

            {/* Time picker */}
            <TimePicker value={time} onChange={setTime} label="시간" />

            {/* Sleep end time */}
            {tab === 'sleep' && (
              <TimePicker
                value={endTime || nowTime()}
                onChange={setEndTime}
                label="종료 시간"
              />
            )}

            {/* Formula amount */}
            {tab === 'feeding' && subType === 'formula' && (
              <View style={modalStyles.inputRow}>
                <Text style={modalStyles.inputLabel}>분유량 (ml)</Text>
                <TextInput
                  style={modalStyles.input}
                  keyboardType="number-pad"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="예: 120"
                  placeholderTextColor={TRACKER_COLORS.textLight}
                  maxLength={4}
                />
              </View>
            )}

            {/* Breast duration */}
            {tab === 'feeding' && subType === 'breast' && (
              <View style={modalStyles.inputRow}>
                <Text style={modalStyles.inputLabel}>수유 시간 (분)</Text>
                <TextInput
                  style={modalStyles.input}
                  keyboardType="number-pad"
                  value={durationMin}
                  onChangeText={setDurationMin}
                  placeholder="예: 15"
                  placeholderTextColor={TRACKER_COLORS.textLight}
                  maxLength={3}
                />
              </View>
            )}

            {/* Note */}
            <View style={modalStyles.inputRow}>
              <Text style={modalStyles.inputLabel}>메모 (선택)</Text>
              <TextInput
                style={[modalStyles.input, modalStyles.inputMultiline]}
                value={note}
                onChangeText={setNote}
                placeholder={
                  tab === 'diaper'
                    ? '색상, 상태 등'
                    : tab === 'feeding'
                      ? '특이사항'
                      : '수면 품질 등'
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
            <Text style={modalStyles.saveBtnText}>기록 저장</Text>
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
  scrollBody: { flexGrow: 0 },
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
  const selectedChild = useChildStore((s) => s.selectedChild);
  const ageGroup: AgeGroupKey = selectedChild?.ageInfo?.group ?? 'infant';
  const ageTabs = useMemo(() => {
    const allowed = getTrackerTabs(ageGroup);
    return TAB_CONFIG.filter((t) => allowed.some((a) => a.key === t.key));
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
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TrackerAnalysisResult | null>(null);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  const [analysisError, setAnalysisError] = useState('');
  const [sleepSession, setSleepSession] = useState<SleepSession | null>(null);
  const [sleepNow, setSleepNow] = useState(Date.now());
  const [breastSession, setBreastSession] = useState<BreastSession | null>(null);
  const [breastNow, setBreastNow] = useState(Date.now());
  const [breastSidePickerVisible, setBreastSidePickerVisible] = useState(false);
  const [analyzerPickerVisible, setAnalyzerPickerVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [modalSubType, setModalSubType] = useState<string>('formula');
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const dateStr = useMemo(() => formatDate(currentDate), [currentDate]);
  const childId = selectedChild?.id ?? 'default';

  /* ---- Load records ---- */
  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await loadRecords(childId, dateStr);
    setRecords(data);
    setLoading(false);
  }, [childId, dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ---- Load range stats for chart ---- */
  useEffect(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - (chartPeriod - 1));
    loadRangeStats(childId, start, currentDate).then(setWeekStats).catch(() => {});
  }, [childId, dateStr, records.length, chartPeriod]);

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
    return [...records].sort((a, b) => {
      if (a.time < b.time) return 1;
      if (a.time > b.time) return -1;
      return 0;
    });
  }, [records]);

  /* ---- Summary ---- */
  const summary = useMemo(() => computeSummary(records), [records]);

  /* ---- Actions ---- */
  function goDay(offset: number) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset);
    if (d > new Date()) return;
    setCurrentDate(d);
  }

  function handleAddRecord(record: TrackerRecord) {
    const updated = [...records, record];
    setRecords(updated);
    saveRecords(childId, dateStr, updated);
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
    };
    handleAddRecord(record);
    showToast(`${SUBTYPE_LABELS[subType] ?? subType} 기록 완료`);
  }

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
    showToast(`${side === 'left' ? '왼쪽' : '오른쪽'} 수유 시작`);
  }

  async function handleBreastStop() {
    if (!breastSession) return;
    const start = new Date(breastSession.startTime);
    const end = new Date();
    let diff = Math.round((end.getTime() - start.getTime()) / 60000);
    if (diff < 1) diff = 1;

    const startHHMM = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    const endHHMM = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;

    const record: TrackerRecord = {
      id: generateId(),
      type: 'feeding',
      subType: 'breast',
      time: startHHMM,
      endTime: endHHMM,
      duration: diff,
      note: breastSession.side === 'left' ? '왼쪽' : '오른쪽',
    };
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
    showToast(`모유 ${formatMinutes(diff)} 기록됨`);
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
        '수면 기록 진행 중',
        `${sleepSession.startDate} ${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}에 시작한 수면이 진행 중이에요. 기상 버튼을 눌러 종료해주세요.`,
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
    showToast('수면 시작 기록');
  }

  async function handleSleepWake() {
    if (!sleepSession) {
      Alert.alert(
        '수면 시작 기록 없음',
        '수면 시작 기록이 없어요. "수면 시작"을 먼저 눌러주세요.',
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
        '수면 시간이 너무 길어요',
        `${Math.round((duration / 60) * 10) / 10}시간으로 계산되어 14시간으로 제한했어요. 기상 시간을 잊으신 것 같으면 직접 수정해주세요.`,
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

    const record: TrackerRecord = {
      id: generateId(),
      type: 'sleep',
      subType: 'sleep_start',
      time: startHHMM,
      endTime: endLabel,
      duration,
    };

    // 시작 날짜의 records에 저장 (BreastSession과 동일 패턴)
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
    showToast(`기상 기록 (${formatMinutes(duration)})`);
  }

  function handleDeleteRecord(id: string) {
    Alert.alert('기록 삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          const updated = records.filter((r) => r.id !== id);
          setRecords(updated);
          saveRecords(childId, dateStr, updated);
        },
      },
    ]);
  }

  /* ---- Bottom bar action dispatcher ---- */
  function handleBottomAction(action: BottomAction) {
    if (action.kind === 'modal') {
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
      Alert.alert('이름 필요', '기록할 이름을 입력해주세요. (예: 과일먹음)');
      return;
    }
    if (name.length > 20) {
      Alert.alert('이름 길이', '이름은 20자 이내로 입력해주세요.');
      return;
    }
    const detail = customDetail.trim();
    if (detail.length > 80) {
      Alert.alert('특징 길이', '특징은 80자 이내로 입력해주세요.');
      return;
    }
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newRecord: TrackerRecord = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'custom',
      subType: name,           // 라벨로 그대로 사용
      time,
      note: detail || undefined,
    };
    const updated = [...records, newRecord];
    await saveRecords(childId, dateStr, updated);
    setRecords(updated);
    setCustomModalVisible(false);
    setCustomName('');
    setCustomDetail('');
    showToast(`'${name}' 기록 완료`);
  }

  /* ---- Pattern Analysis ---- */
  async function handlePatternAnalysis() {
    if (analysisLoading) return;
    setAnalysisLoading(true);
    setAnalysisResult(null);
    setAnalysisError('');
    setAnalysisExpanded(true);

    const diaperCount = records.filter((r) => r.type === 'diaper').length;
    const feedingCount = records.filter((r) => r.type === 'feeding').length;
    const sleepMinutes = records
      .filter((r) => r.type === 'sleep' && r.duration != null)
      .reduce((sum, r) => sum + (r.duration ?? 0), 0);
    const sleepHours = Math.round((sleepMinutes / 60) * 10) / 10;

    // Show loading for at least 3 seconds for UX
    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 3000));

    try {
      const [, res] = await Promise.all([
        minDelay,
        growthApi.analysis(childId, {
          diaper: diaperCount,
          feeding: feedingCount,
          sleep: sleepHours,
        }),
      ]);
      const data = res.data?.data as TrackerAnalysisResult | undefined;
      if (data?.trackerMetrics) {
        setAnalysisResult(data);
        void saveAnalysisHistory({
          type: 'pattern',
          summary: data.overallSummary?.slice(0, 80) ?? '육아패턴 분석 완료',
          details: data.trackerMetrics
            .slice(0, 3)
            .map((m) => `${m.title}: ${m.value}`)
            .join(' · '),
          childId: selectedChild?.id,
          childName: selectedChild?.name,
        });
      } else {
        setAnalysisError('분석 결과를 불러올 수 없습니다.');
      }
    } catch {
      setAnalysisError('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setAnalysisLoading(false);
    }
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

  /* ---- Sleep display helper ---- */
  const sleepDisplay = useMemo(() => {
    const hours = Math.floor(summary.totalSleepMinutes / 60);
    const mins = summary.totalSleepMinutes % 60;
    if (hours === 0 && mins === 0) return '0분';
    if (hours === 0) return `${mins}분`;
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
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.headerBackText}>{'\u{2190}'}</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <Text style={styles.headerTitle}>
              {selectedChild?.name ?? '아기'} 기록
            </Text>
          ),
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
            <Text style={styles.dateText}>
              {formatDateKorean(currentDate)}
            </Text>
            {isToday(currentDate) && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>오늘</Text>
              </View>
            )}
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

        {/* ---- Breast-feeding timer banner (only when active) ---- */}
        {breastSession && (
          <TouchableOpacity
            style={[breastStyles.card, breastStyles.cardActive]}
            onPress={handleBreastPress}
            activeOpacity={0.85}
          >
            <View style={breastStyles.iconWrap}>
              <Image source={IC_MASCOT_EAT} style={breastStyles.icon} resizeMode="contain" />
            </View>
            <View style={breastStyles.textCol}>
              <Text style={breastStyles.title}>모유 수유 진행 중</Text>
              <Text style={breastStyles.sub}>
                {breastSession.side === 'left' ? '왼쪽' : '오른쪽'} · 탭하여 종료
              </Text>
            </View>
            <View style={breastStyles.rightCol}>
              <Text style={breastStyles.timer}>{breastElapsed}</Text>
              <Text style={breastStyles.stopHint}>탭하여 중지</Text>
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
          // feeding 타입의 가장 최근 record에서 계산 (오늘만)
          const todayFeeds = allRecordsSorted.filter((r) => r.type === 'feeding');
          let minutesSinceLastFeed = -1;
          if (todayFeeds.length > 0 && isToday(currentDate)) {
            const last = todayFeeds[todayFeeds.length - 1];
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
              오늘의 타임라인 ({allRecordsSorted.length}건)
            </Text>
          </View>

          {loading ? (
            <View style={emptyStyles.container}>
              <Text style={emptyStyles.sub}>불러오는 중...</Text>
            </View>
          ) : (
            <HourGroupedTimeline
              records={allRecordsSorted}
              dateStr={dateStr}
              isCurrentlyToday={isToday(currentDate)}
              onDelete={handleDeleteRecord}
              activeSleepSession={sleepSession}
            />
          )}
        </View>

        {/* ---- Period Selector + Weekly Summary (접기/펴기) ---- */}
        <TouchableOpacity
          style={periodToggleStyles.header}
          onPress={() => setPeriodSectionOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={periodToggleStyles.headerTitle}>
            {'📊 기간 요약 ('}{PERIOD_LABELS[chartPeriod]}{')'}
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
                    {PERIOD_LABELS[p]}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={summaryStyles.voiceBtn}
                onPress={() => router.push('/(main)/voice-settings' as never)}
                activeOpacity={0.85}
              >
                <Text style={summaryStyles.voiceBtnText}>🎙 음성</Text>
              </TouchableOpacity>
            </View>
            {weekStats.length > 0 && (
              <WeeklySummaryTable stats={weekStats} periodDays={chartPeriod} />
            )}
          </>
        )}

        {/* Bottom spacer for bottom action bar + fixed ad */}
        <View style={{ height: 200 }} />
      </ScrollView>

      {/* ---- Fixed Ad (above bottom action bar) ---- */}
      <View style={styles.fixedAd} pointerEvents="box-none">
        <AdSlot />
      </View>

      {/* ---- Bottom Action Bar ---- */}
      <BottomActionBar
        breastActive={!!breastSession}
        onAction={handleBottomAction}
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
            <Text style={customModalStyles.title}>{'✏️ 직접 입력 기록'}</Text>
            <Text style={customModalStyles.sub}>
              지금 시간으로 기록됩니다. 이름과 특징을 입력해주세요.
            </Text>

            <Text style={customModalStyles.label}>이름 (필수)</Text>
            <TextInput
              style={customModalStyles.input}
              placeholder="예: 과일먹음, 산책, 양치"
              placeholderTextColor="#ABABAB"
              value={customName}
              onChangeText={setCustomName}
              maxLength={20}
              autoFocus
            />

            {recentCustomNames.length > 0 && (
              <View style={customModalStyles.recentRow}>
                <Text style={customModalStyles.recentLabel}>{'최근 사용:'}</Text>
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

            <Text style={customModalStyles.label}>특징 (선택)</Text>
            <TextInput
              style={customModalStyles.input}
              placeholder="예: 딸기 2개, 공원 30분"
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
                <Text style={customModalStyles.btnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[customModalStyles.btn, customModalStyles.btnSave]}
                onPress={handleSaveCustom}
              >
                <Text style={customModalStyles.btnSaveText}>저장</Text>
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
        availableTabs={ageTabs}
        feedingOptions={ageFeedingTypes.map((f) => ({
          key: f.key,
          label: f.label,
          icon: f.key === 'breast' ? IC_MASCOT_EAT : IC_FEED,
        }))}
        lockSubType={modalSubType === 'formula'}
        lockTitle={modalSubType === 'formula' ? '🍼 분유 기록' : undefined}
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
            <Text style={pickerStyles.title}>모유 수유 · 어느 쪽부터?</Text>
            <Text style={pickerStyles.subtitle}>선택 후 타이머가 시작됩니다. 다시 누르면 중지돼요.</Text>
            <View style={pickerStyles.row}>
              <TouchableOpacity
                style={[pickerStyles.sideBtn, { backgroundColor: TRACKER_COLORS.feedingLight }]}
                onPress={() => handleBreastStart('left')}
                activeOpacity={0.8}
              >
                <Text style={[pickerStyles.sideEmoji, { color: TRACKER_COLORS.feedingDark }]}>{'\u25C0'}</Text>
                <Text style={pickerStyles.sideLabel}>왼쪽</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pickerStyles.sideBtn, { backgroundColor: TRACKER_COLORS.feedingLight }]}
                onPress={() => handleBreastStart('right')}
                activeOpacity={0.8}
              >
                <Text style={[pickerStyles.sideEmoji, { color: TRACKER_COLORS.feedingDark }]}>{'\u25B6'}</Text>
                <Text style={pickerStyles.sideLabel}>오른쪽</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={pickerStyles.cancelBtn}
              onPress={() => setBreastSidePickerVisible(false)}
            >
              <Text style={pickerStyles.cancelText}>취소</Text>
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
            <Text style={pickerStyles.title}>아기 분석</Text>
            <Text style={pickerStyles.subtitle}>무엇을 분석할까요?</Text>
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
                <Text style={pickerStyles.sideLabel}>대변 분석</Text>
                <Text style={pickerStyles.sideSub}>사진 업로드</Text>
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
                <Text style={pickerStyles.sideLabel}>울음 분석</Text>
                <Text style={pickerStyles.sideSub}>소리 업로드</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={pickerStyles.cancelBtn}
              onPress={() => setAnalyzerPickerVisible(false)}
            >
              <Text style={pickerStyles.cancelText}>취소</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TRACKER_COLORS.bg },
  fixedAd: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
  },
  container: { flex: 1 },
  content: {
    paddingTop: Platform.OS === 'ios' ? 90 : 72,
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
    paddingVertical: 2,
  },
  dateArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TRACKER_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  dateArrowDisabled: { opacity: 0.3 },
  dateArrowText: { fontSize: 28, fontWeight: '300', color: TRACKER_COLORS.text, marginTop: -2 },
  dateArrowTextDisabled: { color: TRACKER_COLORS.textLight },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  dateText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
  },
  todayBadge: {
    backgroundColor: TRACKER_COLORS.accent,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
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
    gap: 6,
    marginBottom: SPACING.sm,
  },
  timelineTitleIcon: { width: 20, height: 20, borderRadius: 4 },
  timelineTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
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
  activeDuration: { fontSize: 32, fontWeight: '800', color: TRACKER_COLORS.text, marginBottom: 2 },
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
  /** 진행 중인 수면 세션 (사용자가 '수면' 누른 후 '기상' 누르기 전 상태) */
  activeSleepSession?: SleepSession | null;
}

function HourGroupedTimeline({ records, dateStr, isCurrentlyToday, onDelete, activeSleepSession }: HourGroupedTimelineProps) {
  // 현재 시각 (분단위 갱신 — 실시간 'now' 표시용)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isCurrentlyToday) return;
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, [isCurrentlyToday]);

  const currentHour = isCurrentlyToday ? now.getHours() : -1;
  const currentMin = now.getMinutes();

  // 사용자 요청: 수면 기록을 '수면(시작)' + '기상(종료)' 두 항목으로 분리 표시
  // 기상 항목에는 총 수면 시간을 info로 표시
  // 추가 (사용자 요청 2026-04-28): 진행 중 수면 세션도 즉시 표시
  //   '수면 누르면 바로 수면이 시간표에 나오게 해줘 기상 누르기 전에도'
  const expandedRecords = useMemo(() => {
    const out: TrackerRecord[] = [];
    for (const r of records) {
      if (r.type === 'sleep' && r.endTime) {
        // 수면 시작 (duration/endTime 숨김)
        out.push({
          ...r,
          id: `${r.id}__start`,
          subType: 'sleep_start',
          endTime: undefined,
          duration: undefined,
        });
        // 기상 (총 수면 시간 표시)
        out.push({
          ...r,
          id: `${r.id}__wake`,
          subType: 'sleep_end',
          time: r.endTime,
          endTime: undefined,
          duration: r.duration,
        });
      } else {
        out.push(r);
      }
    }

    // 진행 중 수면 세션이 이 날짜에 시작됐다면 가상 엔트리 1개 추가
    if (activeSleepSession && activeSleepSession.startDate === dateStr) {
      const startDt = new Date(activeSleepSession.startTime);
      const time = `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`;
      out.push({
        id: '__active_sleep__',
        type: 'sleep',
        subType: 'sleep_start',
        time,
        note: '진행 중 (기상 버튼으로 종료)',
      } as TrackerRecord);
    }

    return out;
  }, [records, activeSleepSession, dateStr]);

  // 시간별 그룹핑
  const byHour = useMemo(() => {
    const map = new Map<number, TrackerRecord[]>();
    for (const r of expandedRecords) {
      const parts = r.time.split(':');
      const h = parseInt(parts[0] ?? '', 10);
      if (!isNaN(h) && h >= 0 && h <= 23) {
        if (!map.has(h)) map.set(h, []);
        map.get(h)!.push(r);
      }
    }
    // 시간 내에서 분 단위 정렬
    for (const [, list] of map) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [expandedRecords]);

  // Phase 2 (2026-04-28): 타임라인을 자체 스크롤 박스로 wrap
  // (사용자 요청: '타임라인창을 탭안에 만들어서 창을 스크롤해서 위아래로 내릴수 있게')
  // - maxHeight로 제한 → 24시간 전체 보이지 않으면 내부 스크롤
  // - nestedScrollEnabled: Android에서 외부 ScrollView와 충돌 방지
  // - 마운트 시 현재 시간(또는 활동 시간)으로 자동 스크롤
  const innerScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    // 한 번만, 현재 시간 또는 첫 활동 시간으로 스크롤
    let targetHour = currentHour;
    if (targetHour < 0) {
      // 과거 날짜: 가장 이른 활동 시간
      const firstActiveHour = Array.from(byHour.keys()).sort((a, b) => a - b)[0];
      targetHour = firstActiveHour ?? 0;
    }
    const HOUR_HEIGHT = 36;
    const BUFFER = 60;
    const offset = Math.max(0, targetHour * HOUR_HEIGHT - BUFFER);
    const id = setTimeout(() => {
      innerScrollRef.current?.scrollTo({ y: offset, animated: false });
    }, 100);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView
      ref={innerScrollRef}
      style={hourTlStyles.scrollBox}
      contentContainerStyle={hourTlStyles.scrollContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {Array.from({ length: 24 }, (_, h) => {
        const items = byHour.get(h) ?? [];
        const isCur = h === currentHour;
        const hasActivity = items.length > 0;
        return (
          <View
            key={h}
            style={[
              hourTlStyles.hourBlock,
              isCur && hourTlStyles.currentHourBlock,
              hasActivity && !isCur && hourTlStyles.activeHourBlock,
            ]}
          >
            <View style={hourTlStyles.hourLabelCol}>
              <Text
                style={[
                  hourTlStyles.hourNum,
                  isCur && hourTlStyles.hourNumCurrent,
                  hasActivity && !isCur && hourTlStyles.hourNumActive,
                ]}
              >
                {String(h).padStart(2, '0')}
              </Text>
              {isCur ? (
                <View style={hourTlStyles.nowBadge}>
                  <Text style={hourTlStyles.nowBadgeText}>{currentMin < 10 ? `:0${currentMin}` : `:${currentMin}`}</Text>
                </View>
              ) : hasActivity ? (
                <View style={hourTlStyles.activityDot} />
              ) : null}
            </View>
            <View style={hourTlStyles.hourContent}>
              {items.map((r) => (
                <TimelineEntry
                  key={r.id}
                  record={r}
                  dateStr={dateStr}
                  showRelative={isCurrentlyToday}
                  onDelete={onDelete}
                />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

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
    fontWeight: '800',
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
    fontWeight: '800',
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

function TimelineEntry({ record, dateStr, showRelative, onDelete }: TimelineEntryProps) {
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
  const baseLabel = SUBTYPE_LABELS[record.subType] ?? record.subType;
  // 모유: 왼쪽/오른쪽을 라벨에 병합 → "모유 (왼쪽)"
  const label = record.subType === 'breast' && record.note
    ? `${baseLabel} (${record.note})`
    : baseLabel;
  const relative = showRelative ? getRelativeTime(record.time, dateStr) : '';
  // note를 라벨에 합쳤으면 하단 note는 숨김
  const hideNote = record.subType === 'breast';

  // Amount/duration을 한 줄 info로 통합
  const infoParts: string[] = [];
  if (record.amount != null && record.amount > 0) infoParts.push(`${record.amount}ml`);
  if (record.duration != null && record.duration > 0) infoParts.push(formatMinutes(record.duration));
  if (record.note && !hideNote) infoParts.push(record.note);
  const info = infoParts.join(' · ');

  return (
    <TouchableOpacity
      style={[timelineStyles.row, { borderLeftColor: typeColor }]}
      onLongPress={() => onDelete(record.id)}
      delayLongPress={500}
      activeOpacity={0.7}
    >
      <Text style={timelineStyles.timeCell}>{record.time}</Text>
      <Image source={icon} style={timelineStyles.iconCell} resizeMode="contain" />
      <Text style={[timelineStyles.labelCell, { color: typeDark }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={timelineStyles.infoCell} numberOfLines={1}>
        {info}
      </Text>
      {relative !== '' && (
        <Text style={timelineStyles.relCell} numberOfLines={1}>{relative}</Text>
      )}
    </TouchableOpacity>
  );
}

const timelineStyles = StyleSheet.create({
  // Phase 1 (2026-04-28): 글씨 크게, 행 높이 증가, 메모 가독성 ↑
  // (사용자 요청: '시간도 잘 안 보이고 어떤 행위를 했는지도 잘 안 보여')
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,        // 6 → 12 (높이 ↑)
    paddingHorizontal: 12,      // 8 → 12
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECEE',
    borderLeftWidth: 4,         // 3 → 4 (좌측 컬러 막대 강조)
    backgroundColor: TRACKER_COLORS.white,
    gap: 10,                    // 6 → 10
  },
  timeCell: {
    width: 56,                  // 46 → 56 (시간 16:30 안 잘리게)
    fontSize: 16,               // 11 → 16 (시간 ↑↑)
    fontWeight: '800',          // 700 → 800
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

const BAR_ITEMS: BottomBarItem[] = [
  { icon: IC_FEED, label: '분유', action: { kind: 'modal', subType: 'formula' }, color: TRACKER_COLORS.feedingDark },
  { icon: IC_FEED, label: '이유식', action: { kind: 'quick', type: 'feeding', subType: 'baby_food' }, color: TRACKER_COLORS.feedingDark },
  { icon: IC_MASCOT_EAT, label: '모유', action: { kind: 'breast' }, color: TRACKER_COLORS.feedingDark },
  { icon: IC_SLEEP, label: '수면', action: { kind: 'sleepStart' }, color: TRACKER_COLORS.sleepDark },
  { icon: IC_SUNNY, label: '기상', action: { kind: 'sleepWake' }, color: TRACKER_COLORS.sleepDark },
  { icon: IC_POOP, label: '소변', action: { kind: 'quick', type: 'diaper', subType: 'pee' }, color: TRACKER_COLORS.diaperDark },
  { icon: IC_POOP, label: '대변', action: { kind: 'quick', type: 'diaper', subType: 'poop' }, color: TRACKER_COLORS.diaperDark },
  // Phase 4-A (2026-04-28): 투약 — 빠른 기록 4종
  { icon: IC_MEDICATION, label: '해열제', action: { kind: 'quick', type: 'medication', subType: 'fever' }, color: TRACKER_COLORS.medicationDark },
  { icon: IC_MEDICATION, label: '항생제', action: { kind: 'quick', type: 'medication', subType: 'antibiotic' }, color: TRACKER_COLORS.medicationDark },
  { icon: IC_MEDICATION, label: '비타민', action: { kind: 'quick', type: 'medication', subType: 'vitamin' }, color: TRACKER_COLORS.medicationDark },
  // Phase 4-B (2026-04-28): 사용자 정의 라벨 — '직접 입력'
  { icon: IC_CUSTOM, label: '직접 입력', action: { kind: 'custom' }, color: TRACKER_COLORS.customDark },
];

interface BottomActionBarProps {
  breastActive: boolean;
  onAction: (action: BottomAction) => void;
}

function BottomActionBar({ breastActive, onAction }: BottomActionBarProps) {
  return (
    <View style={barStyles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={barStyles.container}
      >
        {BAR_ITEMS.map((item) => {
          const isBreast = item.action.kind === 'breast';
          const active = isBreast && breastActive;
          return (
            <TouchableOpacity
              key={item.label}
              style={[
                barStyles.item,
                active && { backgroundColor: item.color + '22' },
              ]}
              onPress={() => onAction(item.action)}
              activeOpacity={0.7}
            >
              <View style={[barStyles.iconWrap, { backgroundColor: item.color + '1A' }]}>
                <Image source={item.icon} style={barStyles.icon} resizeMode="contain" />
              </View>
              <Text style={[barStyles.itemLabel, active && { color: item.color }]}>
                {isBreast && breastActive ? '모유중' : item.label}
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
    fontWeight: '800',
    color: TRACKER_COLORS.feedingDark,
    fontVariant: ['tabular-nums'],
  },
  stopHint: {
    fontSize: 10,
    color: TRACKER_COLORS.textLight,
    marginTop: 2,
  },
  startIcon: {
    fontSize: 22,
    color: TRACKER_COLORS.feedingDark,
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


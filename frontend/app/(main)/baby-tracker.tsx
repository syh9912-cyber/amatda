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
/* eslint-enable @typescript-eslint/no-require-imports */
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { growthApi } from '../../services/api';
import { getTrackerTabs, getFeedingTypes } from '../../constants/ageFeatures';
import type { AgeGroupKey } from '../../constants/ageGroups';
import PregnancyScreen from './pregnancy';
import { AdSlot } from '../../components/ads/AdSlot';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type RecordType = 'diaper' | 'feeding' | 'sleep';

type DiaperSubType = 'pee' | 'poop' | 'both';
type FeedingSubType = 'breast' | 'formula' | 'baby_food' | 'snack';
type SleepSubType = 'nap' | 'night';

interface TrackerRecord {
  id: string;
  type: RecordType;
  subType: string;
  time: string;
  endTime?: string;
  amount?: number;
  duration?: number;
  note?: string;
}

interface DaySummary {
  diaperCount: number;
  feedingCount: number;
  totalMl: number;
  totalSleepMinutes: number;
}

interface TrackerMetric {
  metric: string;
  value: number;
  level: string;
  title: string;
  emoji: string;
  comment: string;
  advice: string;
  standardRange?: string;
  standardDetail?: string;
}

interface TrackerAnalysisResult {
  trackerMetrics: TrackerMetric[];
  overallSummary: string;
}

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
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateKorean(date: Date): string {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = dayNames[date.getDay()];
  return `${m}월 ${d}일 (${day})`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return formatDate(date) === formatDate(now);
}

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function calcDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function formatMinutes(m: number): string {
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function computeSummary(records: TrackerRecord[]): DaySummary {
  let diaperCount = 0;
  let feedingCount = 0;
  let totalMl = 0;
  let totalSleepMinutes = 0;

  for (const r of records) {
    if (r.type === 'diaper') diaperCount += 1;
    if (r.type === 'feeding') {
      feedingCount += 1;
      if (r.amount) totalMl += r.amount;
    }
    if (r.type === 'sleep' && r.duration) {
      totalSleepMinutes += r.duration;
    }
  }

  return { diaperCount, feedingCount, totalMl, totalSleepMinutes };
}

function getStorageKey(childId: string, dateStr: string): string {
  return `baby_tracker_${childId}_${dateStr}`;
}

/* ================================================================== */
/*  AsyncStorage wrapper (dynamic import + fallback)                   */
/* ================================================================== */

let _storage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
} | null = null;

async function getStorage(): Promise<typeof _storage> {
  if (_storage) return _storage;
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    _storage = mod.default;
    return _storage;
  } catch {
    // fallback: in-memory storage
    const mem: Record<string, string> = {};
    _storage = {
      getItem: async (k: string) => mem[k] ?? null,
      setItem: async (k: string, v: string) => { mem[k] = v; },
    };
    return _storage;
  }
}

async function loadRecords(childId: string, dateStr: string): Promise<TrackerRecord[]> {
  const storage = await getStorage();
  if (!storage) return [];
  const raw = await storage.getItem(getStorageKey(childId, dateStr));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as TrackerRecord[];
    return [];
  } catch {
    return [];
  }
}

async function saveRecords(childId: string, dateStr: string, records: TrackerRecord[]): Promise<void> {
  const storage = await getStorage();
  if (!storage) return;
  await storage.setItem(getStorageKey(childId, dateStr), JSON.stringify(records));
}

/* ================================================================== */
/*  Multi-day data loader for chart                                    */
/* ================================================================== */

interface DayStat {
  dateLabel: string; // "월", "화", etc.
  dateStr: string;
  diaper: number;
  feeding: number;
  feedingMl: number;
  sleepMin: number;
}

async function loadRangeStats(childId: string, startDate: Date, endDate: Date): Promise<DayStat[]> {
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const stats: DayStat[] = [];
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const maxDays = Math.min(diffDays, 31); // 최대 1달
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const ds = formatDate(d);
    const recs = await loadRecords(childId, ds);
    const sum = computeSummary(recs);
    stats.push({
      dateLabel: maxDays <= 7 ? dayNames[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}`,
      dateStr: ds,
      diaper: sum.diaperCount,
      feeding: sum.feedingCount,
      feedingMl: sum.totalMl,
      sleepMin: sum.totalSleepMinutes,
    });
  }
  return stats;
}

// 하위 호환용
async function loadWeekStats(childId: string, endDate: Date): Promise<DayStat[]> {
  const start = new Date(endDate);
  start.setDate(start.getDate() - 6);
  return loadRangeStats(childId, start, endDate);
}

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
}

function SummaryBadge({ icon, value, label, color, bgColor }: SummaryBadgeProps) {
  return (
    <View style={[badgeStyles.container, { backgroundColor: bgColor }]}>
      <View style={[badgeStyles.circle, { borderColor: color }]}>
        <Image source={icon} style={badgeStyles.iconImg} resizeMode="contain" />
        <Text style={[badgeStyles.value, { color }]}>{value}</Text>
      </View>
      <Text style={badgeStyles.label}>{label}</Text>
    </View>
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

/* ---- Weekly Chart ---- */

const CHART_HEIGHT = 100;

const PERIOD_LABELS: Record<number, string> = { 7: '7일', 14: '14일', 31: '1달' };

function WeeklyChart({
  stats,
  activeTab,
  periodDays = 7,
}: {
  stats: DayStat[];
  activeTab: RecordType;
  periodDays?: number;
}) {
  const values = stats.map((s) => {
    if (activeTab === 'diaper') return s.diaper;
    if (activeTab === 'feeding') return s.feeding;
    return Math.round(s.sleepMin / 60 * 10) / 10; // hours
  });

  const maxVal = Math.max(...values, 1);
  const color = activeTab === 'diaper' ? TRACKER_COLORS.diaper
    : activeTab === 'feeding' ? TRACKER_COLORS.feeding
    : TRACKER_COLORS.sleep;
  const darkColor = activeTab === 'diaper' ? TRACKER_COLORS.diaperDark
    : activeTab === 'feeding' ? TRACKER_COLORS.feedingDark
    : TRACKER_COLORS.sleepDark;

  const unitLabel = activeTab === 'diaper' ? '회'
    : activeTab === 'feeding' ? '회'
    : '시간';

  const typeLabel = activeTab === 'diaper' ? '배변'
    : activeTab === 'feeding' ? '수유/식사'
    : '수면';

  // 7일: flex, 14/31일: 고정 너비 + 스크롤
  const needsScroll = periodDays > 7;
  const barWidth = periodDays <= 7 ? 20 : periodDays <= 14 ? 16 : 10;
  const colWidth = periodDays <= 7 ? undefined : periodDays <= 14 ? 36 : 28;
  const chartContentWidth = colWidth ? colWidth * stats.length : undefined;

  const renderBars = () => (
    <View style={[
      chartStyles.chartRow,
      needsScroll && { width: chartContentWidth, justifyContent: 'flex-start' },
    ]}>
      {stats.map((s, i) => {
        const val = values[i];
        const barH = maxVal > 0 ? (val / maxVal) * CHART_HEIGHT : 0;
        const isCurrent = i === stats.length - 1;
        return (
          <View
            key={s.dateStr}
            style={[
              chartStyles.barCol,
              needsScroll ? { width: colWidth } : { flex: 1 },
            ]}
          >
            <Text style={[chartStyles.barValue, periodDays > 14 && { fontSize: 8 }]}>
              {val > 0 ? (Number.isInteger(val) ? val : val.toFixed(1)) : ''}
            </Text>
            <View style={chartStyles.barTrack}>
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: Math.max(barH, val > 0 ? 4 : 0),
                    backgroundColor: isCurrent ? darkColor : color,
                    width: barWidth,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                chartStyles.barLabel,
                isCurrent && { color: darkColor, fontWeight: '700' },
                periodDays > 14 && { fontSize: 8 },
              ]}
            >
              {s.dateLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>
        {typeLabel} {PERIOD_LABELS[periodDays] ?? `${periodDays}일`} 추이
      </Text>
      {needsScroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderBars()}
        </ScrollView>
      ) : (
        renderBars()
      )}
      <Text style={chartStyles.unit}>({unitLabel})</Text>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    backgroundColor: TRACKER_COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  title: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginBottom: SPACING.md,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 40,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
    marginBottom: 4,
    height: 14,
  },
  barTrack: {
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  bar: {
    width: 20,
    borderRadius: 4,
    minWidth: 12,
  },
  barLabel: {
    fontSize: 11,
    color: TRACKER_COLORS.textLight,
    marginTop: 6,
    fontWeight: '500',
  },
  unit: {
    fontSize: 10,
    color: TRACKER_COLORS.textLight,
    textAlign: 'right',
    marginTop: 4,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  periodBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: TRACKER_COLORS.border,
  },
  periodBtnActive: {
    backgroundColor: TRACKER_COLORS.accent,
  },
  periodBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: TRACKER_COLORS.textSub,
  },
  periodBtnTextActive: {
    color: TRACKER_COLORS.white,
  },
});

/* ================================================================== */
/*  Add Record Modal                                                   */
/* ================================================================== */

interface AddModalProps {
  visible: boolean;
  initialTab: RecordType;
  onClose: () => void;
  onSave: (record: TrackerRecord) => void;
  availableTabs: typeof TAB_CONFIG;
  feedingOptions: { key: string; label: string; icon: number }[];
}

function AddRecordModal({ visible, initialTab, onClose, onSave, availableTabs, feedingOptions }: AddModalProps) {
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
      resetForm(initialTab);
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, initialTab, slideAnim]);

  function resetForm(t: RecordType) {
    setTime(nowTime());
    setEndTime('');
    setAmount('');
    setDurationMin('');
    setNote('');
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

          {/* Tab switcher (연령별 필터) */}
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

          <ScrollView
            style={modalStyles.scrollBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Sub-type selector */}
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

  // 임신 아이면 임신기록 화면 렌더
  if (selectedChild?.isPregnant) {
    return <PregnancyScreen />;
  }

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
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TrackerAnalysisResult | null>(null);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  const [analysisError, setAnalysisError] = useState('');
  const fabScale = useRef(new Animated.Value(1)).current;

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

  function handleFabPress() {
    Animated.sequence([
      Animated.timing(fabScale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(fabScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    setModalVisible(true);
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
      } else {
        setAnalysisError('분석 결과를 불러올 수 없습니다.');
      }
    } catch {
      setAnalysisError('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setAnalysisLoading(false);
    }
  }

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

        {/* ---- Summary Badges ---- */}
        <View style={styles.summaryRow}>
          <SummaryBadge
            icon={IC_POOP}
            value={`${summary.diaperCount}회`}
            label="배변"
            color={TRACKER_COLORS.diaperDark}
            bgColor={TRACKER_COLORS.diaperLight}
          />
          <SummaryBadge
            icon={IC_FEED}
            value={summary.totalMl > 0 ? `${summary.feedingCount}회/${summary.totalMl}ml` : `${summary.feedingCount}회`}
            label="수유/식사"
            color={TRACKER_COLORS.feedingDark}
            bgColor={TRACKER_COLORS.feedingLight}
          />
          <SummaryBadge
            icon={IC_SLEEP}
            value={sleepDisplay}
            label="수면"
            color={TRACKER_COLORS.sleepDark}
            bgColor={TRACKER_COLORS.sleepLight}
          />
        </View>

        {/* ---- Period Selector + Chart ---- */}
        <View style={chartStyles.periodRow}>
          {([7, 14, 31] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                chartStyles.periodBtn,
                chartPeriod === p && chartStyles.periodBtnActive,
              ]}
              onPress={() => setChartPeriod(p)}
            >
              <Text
                style={[
                  chartStyles.periodBtnText,
                  chartPeriod === p && chartStyles.periodBtnTextActive,
                ]}
              >
                {PERIOD_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {weekStats.length > 0 && (
          <WeeklyChart stats={weekStats} activeTab={activeTab} periodDays={chartPeriod} />
        )}

        {/* ---- Pattern Analysis Button + Results ---- */}
        <TouchableOpacity
          style={analysisStyles.button}
          onPress={handlePatternAnalysis}
          disabled={analysisLoading}
          activeOpacity={0.8}
        >
          <Image source={require('../../assets/quick-report.png')} style={analysisStyles.buttonIcon} resizeMode="contain" />
          <Text style={analysisStyles.buttonText}>
            {analysisLoading ? '분석 중...' : '육아 패턴 분석'}
          </Text>
        </TouchableOpacity>

        {analysisLoading && (
          <View style={analysisStyles.loadingContainer}>
            <ActivityIndicator size="large" color={TRACKER_COLORS.accent} />
            <Text style={analysisStyles.loadingText}>
              배변, 수유, 수면 패턴을 분석하고 있어요...
            </Text>
          </View>
        )}

        {analysisError !== '' && !analysisLoading && (
          <View style={analysisStyles.errorContainer}>
            <Text style={analysisStyles.errorText}>{analysisError}</Text>
          </View>
        )}

        {analysisResult && !analysisLoading && (
          <View style={analysisStyles.resultContainer}>
            <TouchableOpacity
              style={analysisStyles.resultHeader}
              onPress={() => setAnalysisExpanded((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={analysisStyles.resultTitleRow}>
                <Image source={require('../../assets/quick-report.png')} style={analysisStyles.sectionIcon} resizeMode="contain" />
                <Text style={analysisStyles.resultTitle}>패턴 분석 결과</Text>
              </View>
              <Text style={analysisStyles.collapseIcon}>
                {analysisExpanded ? '\u{25B2}' : '\u{25BC}'}
              </Text>
            </TouchableOpacity>

            {analysisExpanded && (
              <View style={analysisStyles.resultBody}>
                {analysisResult.trackerMetrics.map((m) => {
                  const levelColor =
                    m.level === 'very_low' || m.level === 'very_high'
                      ? '#FF4444'
                      : m.level === 'low' || m.level === 'high'
                        ? '#FF9800'
                        : '#4CAF50';
                  const levelLabel =
                    m.level === 'very_low' ? '매우 부족'
                    : m.level === 'low' ? '부족'
                    : m.level === 'normal' ? '정상'
                    : m.level === 'high' ? '많음'
                    : m.level === 'very_high' ? '매우 많음'
                    : m.level;

                  return (
                    <View key={m.metric} style={analysisStyles.metricCard}>
                      <View style={analysisStyles.metricHeader}>
                        <Image source={require('../../assets/growth-physical.png')} style={analysisStyles.metricIcon} resizeMode="contain" />
                        <Text style={analysisStyles.metricTitle}>{m.title}</Text>
                        <View style={[analysisStyles.levelBadge, { backgroundColor: levelColor }]}>
                          <Text style={analysisStyles.levelBadgeText}>{levelLabel}</Text>
                        </View>
                      </View>
                      {m.standardRange ? (
                        <Text style={analysisStyles.metricRange}>
                          기준 범위: {m.standardRange}
                        </Text>
                      ) : null}
                      <Text style={analysisStyles.metricComment}>{m.comment}</Text>
                      <View style={analysisStyles.adviceBox}>
                        <Text style={analysisStyles.adviceLabel}>조언</Text>
                        <Text style={analysisStyles.adviceText}>{m.advice}</Text>
                      </View>
                    </View>
                  );
                })}

                {analysisResult.overallSummary ? (
                  <View style={analysisStyles.summaryBox}>
                    <Text style={analysisStyles.summaryLabel}>종합 요약</Text>
                    <Text style={analysisStyles.summaryText}>
                      {analysisResult.overallSummary}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* ---- Tab Buttons (연령별 필터) ---- */}
        <View style={styles.tabRow}>
          {ageTabs.map((t) => {
            const isActive = activeTab === t.key;
            const count = records.filter((r) => r.type === t.key).length;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tabBtn,
                  isActive && { backgroundColor: t.color, borderColor: t.color },
                ]}
                onPress={() => setActiveTab(t.key)}
              >
                <View style={styles.tabBtnInner}>
                  <Image source={t.icon} style={styles.tabIcon} resizeMode="contain" />
                  <Text
                    style={[
                      styles.tabBtnText,
                      isActive && styles.tabBtnTextActive,
                    ]}
                  >
                    {t.label}
                    {count > 0 ? ` (${count})` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ---- Timeline ---- */}
        <View style={styles.timelineContainer}>
          <View style={styles.timelineTitleRow}>
            <Image
              source={TAB_CONFIG.find((t) => t.key === activeTab)?.icon ?? IC_POOP}
              style={styles.timelineTitleIcon}
              resizeMode="contain"
            />
            <Text style={styles.timelineTitle}>
            {TAB_CONFIG.find((t) => t.key === activeTab)?.label ?? ''} 타임라인
          </Text>
          </View>

          {loading ? (
            <View style={emptyStyles.container}>
              <Text style={emptyStyles.sub}>불러오는 중...</Text>
            </View>
          ) : filteredRecords.length === 0 ? (
            <EmptyTimeline tab={activeTab} />
          ) : (
            filteredRecords.map((r) => (
              <RecordCard key={r.id} record={r} onDelete={handleDeleteRecord} />
            ))
          )}
        </View>

        {/* ---- All records (mini timeline) ---- */}
        {allRecordsSorted.length > 0 && (
          <View style={styles.allSection}>
            <Text style={styles.allSectionTitle}>
              오늘의 전체 기록 ({allRecordsSorted.length}건)
            </Text>
            {allRecordsSorted.map((r) => {
              const subIcon = SUBTYPE_ICONS[r.subType] ?? IC_POOP;
              const label = SUBTYPE_LABELS[r.subType] ?? r.subType;
              const typeColor =
                r.type === 'diaper'
                  ? TRACKER_COLORS.diaper
                  : r.type === 'feeding'
                    ? TRACKER_COLORS.feeding
                    : TRACKER_COLORS.sleep;

              return (
                <View key={r.id} style={styles.miniRow}>
                  <View style={[styles.miniDot, { backgroundColor: typeColor }]} />
                  <Text style={styles.miniTime}>{r.time}</Text>
                  <Image source={subIcon} style={styles.miniIcon} resizeMode="contain" />
                  <Text style={styles.miniLabel}>
                    {label}
                  </Text>
                  {r.amount ? (
                    <Text style={styles.miniDetail}>{r.amount}ml</Text>
                  ) : null}
                  {r.duration && r.type === 'sleep' ? (
                    <Text style={styles.miniDetail}>{formatMinutes(r.duration)}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Bottom spacer for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ---- FAB ---- */}
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={[
            styles.fab,
            {
              backgroundColor:
                activeTab === 'diaper'
                  ? TRACKER_COLORS.diaperDark
                  : activeTab === 'feeding'
                    ? TRACKER_COLORS.feedingDark
                    : TRACKER_COLORS.sleepDark,
            },
          ]}
          onPress={handleFabPress}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+ 기록하기</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ---- Modal ---- */}
      <AddRecordModal
        visible={modalVisible}
        initialTab={activeTab}
        onClose={() => setModalVisible(false)}
        onSave={handleAddRecord}
        availableTabs={ageTabs}
        feedingOptions={ageFeedingTypes.map((f) => ({
          key: f.key,
          label: f.label,
          icon: f.key === 'breast' ? IC_MASCOT_EAT : IC_FEED,
        }))}
      />
    </View>
  );
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TRACKER_COLORS.bg },
  container: { flex: 1 },
  content: {
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    paddingHorizontal: SPACING.lg,
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
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.sm,
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
    marginBottom: SPACING.lg,
  },

  /* Tab buttons */
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
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
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  timelineTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: SPACING.md,
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
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  allSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: TRACKER_COLORS.text,
    marginBottom: SPACING.md,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
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

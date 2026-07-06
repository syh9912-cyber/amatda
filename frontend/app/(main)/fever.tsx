import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
  KeyboardAvoidingView,
  Animated,
  Image,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceRegionCode } from '../../i18n';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
// DateTimePicker는 FastTimeInput 도입(숫자 키패드)으로 미사용 — import 제거
import { sosApi } from '../../services/api';
import {
  scheduleFeverRecheckReminder,
  cancelFeverRecheckReminder,
} from '../../services/pushNotifications';
import { useChildStore } from '../../stores/childStore';
import { useFeverStore } from '../../stores/feverStore';
import { BackButton } from '../../components/common/BackButton';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { GuideButton } from '../../components/common/GuideButton';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import { getFeverGuide } from '../../features/guide/feverGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';
// 열 관리는 긴급 관련 페이지 — 광고 없음 (VIP 여부 무관)

const IC_THERMOMETER = require('../../assets/quick-thermometer.png') as ImageSourcePropType;
const IC_PILL = require('../../assets/quick-pill.png') as ImageSourcePropType;
const IC_SYRINGE = require('../../assets/quick-syringe.png') as ImageSourcePropType;
const IC_DIARY = require('../../assets/child-diary.png') as ImageSourcePropType;
const IC_BELL = require('../../assets/icon-bell.png') as ImageSourcePropType;
const IC_HOSPITAL = require('../../assets/icon-hospital.png') as ImageSourcePropType;
const IC_REDFLAG = require('../../assets/icon-redflag.png') as ImageSourcePropType;
const IC_HAPPY = require('../../assets/mascot-happy.png') as ImageSourcePropType;
const IC_WORRIED = require('../../assets/mascot-worried.png') as ImageSourcePropType;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type MeasureMethod = 'ear' | 'forehead' | 'armpit';

type FeverLevel = 'normal' | 'mild' | 'moderate' | 'high' | 'danger' | 'emergency';

interface DoseInfo {
  doseMg: string;
  syrupMl: string;
  interval: string;
  maxDaily: string;
  ageRestriction?: string;
}

interface MedicineDose {
  childWeight: number;
  acetaminophen: DoseInfo;
  ibuprofen: DoseInfo;
  alternatingSchedule: string[];
  warning: string;
}

interface HistoryEntry {
  timestamp: number;
  temperature: number;
  method: MeasureMethod;
  adjustedTemp: number;
  level: FeverLevel;
}

/* 해열제 복용 기록 (열나요 앱 스타일)
 *
 * 소아과 표준 간격:
 *  - 아세트아미노펜 (타이레놀/챔프): 최소 4시간, 권장 4~6시간
 *  - 이부프로펜 (부루펜/맥시부펜): 최소 6시간, 권장 6~8시간
 *  - 교차 복용 (한쪽 → 다른 쪽): 최소 2~3시간
 *
 * 아기시간 탭과는 별개로 fever 화면에 기록 (사용자 지시: '아기시간이랑은 별도로')
 */
type MedicineType = 'acetaminophen' | 'ibuprofen' | 'other';

interface MedLogEntry {
  id: string;
  timestamp: number;
  type: MedicineType;
  brandName: string;     // '타이레놀', '부루펜', '챔프', '기타' 등 표시용
  doseMl: number;
  note?: string;
}

interface MedicineBrand {
  brandName: string;
  type: MedicineType;
  icon: ImageSourcePropType;
}

/*
 * brandName은 내부 안정 식별자(저장값·React key·동등비교용)로 한국어 원문을 그대로 유지한다.
 * AsyncStorage에 이미 이 문자열로 저장된 기존 복용 기록과의 호환을 위함 (스키마 변경 없음).
 * 실제 화면 표시는 getBrandDisplayName(t, brandName)을 통해 로캘별 문자열로 렌더링한다.
 */
const MEDICINE_BRANDS: MedicineBrand[] = [
  { brandName: '타이레놀',   type: 'acetaminophen', icon: IC_PILL },
  { brandName: '챔프',       type: 'acetaminophen', icon: IC_PILL },
  { brandName: '부루펜',     type: 'ibuprofen',     icon: IC_SYRINGE },
  { brandName: '맥시부펜',   type: 'ibuprofen',     icon: IC_SYRINGE },
  { brandName: '기타',       type: 'other',         icon: IC_PILL },
];

function getBrandDisplayName(t: TFunction, brandName: string): string {
  switch (brandName) {
    case '타이레놀': return t('fever.brand.tylenol');
    case '챔프': return t('fever.brand.champ');
    case '부루펜': return t('fever.brand.brufen');
    case '맥시부펜': return t('fever.brand.maxibupen');
    case '기타': return t('fever.brand.other');
    default: return brandName;
  }
}

const MED_INTERVAL_HR: Record<MedicineType, { min: number; recommended: number }> = {
  acetaminophen: { min: 4, recommended: 4 },
  ibuprofen:     { min: 6, recommended: 6 },
  other:         { min: 4, recommended: 4 },
};

const ALTERNATING_INTERVAL_HR = 2; // 다른 종류 약을 먹을 때 최소 간격

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const COLOR = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#ABABAB',
  border: '#E5E5EA',
  accent: '#FF8C5A',
};

interface FeverLevelConfig {
  color: string;
  bgColor: string;
  label: string;
  icon: ImageSourcePropType;
  advice: string;
}

function getFeverLevel(t: TFunction, tel: string): Record<FeverLevel, FeverLevelConfig> {
  return {
    normal: {
      color: '#34C759',
      bgColor: '#F0FFF4',
      label: t('fever.level.normal.label'),
      icon: IC_HAPPY,
      advice: t('fever.level.normal.advice'),
    },
    mild: {
      color: '#FFD76E',
      bgColor: '#FFFDF0',
      label: t('fever.level.mild.label'),
      icon: IC_WORRIED,
      advice: t('fever.level.mild.advice'),
    },
    moderate: {
      color: '#FF9500',
      bgColor: '#FFF8F0',
      label: t('fever.level.moderate.label'),
      icon: IC_WORRIED,
      advice: t('fever.level.moderate.advice'),
    },
    high: {
      color: '#FF3B30',
      bgColor: '#FFF0F0',
      label: t('fever.level.high.label'),
      icon: IC_THERMOMETER,
      advice: t('fever.level.high.advice'),
    },
    danger: {
      color: '#D32F2F',
      bgColor: '#FFEBEE',
      label: t('fever.level.danger.label'),
      icon: IC_HOSPITAL,
      advice: t('fever.level.danger.advice', { tel }),
    },
    emergency: {
      color: '#B71C1C',
      bgColor: '#FFCDD2',
      label: t('fever.level.emergency.label', { tel }),
      icon: IC_REDFLAG,
      advice: t('fever.level.emergency.advice', { tel }),
    },
  };
}

function getMethodLabels(t: TFunction): Record<MeasureMethod, string> {
  return {
    ear: t('fever.method.ear'),
    forehead: t('fever.method.forehead'),
    armpit: t('fever.method.armpit'),
  };
}

const TYLENOL_COLOR = '#1565C0';
const BRUFEN_COLOR = '#E65100';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function adjustTemperature(raw: number, method: MeasureMethod): number {
  if (method === 'ear') return raw;
  // forehead and armpit: +0.5 for interpretation
  return raw + 0.5;
}

function classifyFever(adjustedTemp: number): FeverLevel {
  if (adjustedTemp < 37.5) return 'normal';
  if (adjustedTemp < 38.0) return 'mild';
  if (adjustedTemp < 39.0) return 'moderate';
  if (adjustedTemp < 40.0) return 'high';
  if (adjustedTemp < 41.0) return 'danger';
  return 'emergency';
}

/**
 * 행동 가이드 빌더 — 결과 + 이력(체온 변화) + 마지막 해열제 복용으로 종합 판단
 * "지금 엄마가 해야 할 행동"을 큰 헤드라인으로 제시
 */
interface ActionGuide {
  label: string;          // 상단 작은 라벨 (정상/미열/고열 등)
  headline: string;       // 큰 행동 멘트
  emotion: string;        // 감성 멘트
  bgColor: string;
  borderColor: string;
  accentColor: string;
  nextCheckMin: number;   // 0이면 다음 측정 안내 X
  nextCheckLabel: string;
  dangerLevel: boolean;   // 119 버튼 노출 여부
}

interface ActionGuideInput {
  raw: number;
  adjusted: number;
  level: FeverLevel;
}

function buildActionGuide(
  current: ActionGuideInput,
  history: HistoryEntry[],
  medLog: MedLogEntry[],
  t: TFunction,
  tel: string,
): ActionGuide {
  const adj = current.adjusted;
  // 1) 회복 추세 감지 (직전 기록 vs 현재)
  // history[0]은 방금 입력한 현재 측정값이므로, 비교 대상인 직전 기록은 history[1]
  const prev = history.length > 1 ? history[1] : undefined;
  const recovering = !!prev && prev.adjustedTemp - adj >= 0.4 && adj < 38.0;

  // 2) 마지막 해열제 복용 시간
  const lastMed = medLog[0]; // medLog는 최신순
  const minutesSinceMed = lastMed ? Math.round((Date.now() - lastMed.timestamp) / 60000) : -1;
  // 마지막 복용 약 종류별 최소 재복용 간격 (아세트아미노펜 4h, 이부프로펜 6h)
  const requiredIntervalMin = lastMed ? MED_INTERVAL_HR[lastMed.type].min * 60 : 0;

  // 3) 분류별 행동 가이드
  if (current.level === 'emergency') {
    return {
      label: t('fever.actionGuide.emergency.label'),
      headline: t('fever.actionGuide.emergency.headline', { tel }),
      emotion: t('fever.actionGuide.emergency.emotion'),
      bgColor: '#FFEBEE',
      borderColor: '#C62828',
      accentColor: '#C62828',
      nextCheckMin: 0,
      nextCheckLabel: '',
      dangerLevel: true,
    };
  }

  if (current.level === 'danger') {
    return {
      label: t('fever.actionGuide.danger.label'),
      headline: t('fever.actionGuide.danger.headline'),
      emotion: t('fever.actionGuide.danger.emotion'),
      bgColor: '#FFEBEE',
      borderColor: '#D84315',
      accentColor: '#D84315',
      nextCheckMin: 0,
      nextCheckLabel: '',
      dangerLevel: true,
    };
  }

  // 회복 중 (열이 내리고 있음)
  if (recovering) {
    return {
      label: t('fever.actionGuide.recovering.label'),
      headline: t('fever.actionGuide.recovering.headline'),
      emotion: t('fever.actionGuide.recovering.emotion'),
      bgColor: '#E8F5E9',
      borderColor: '#43A047',
      accentColor: '#2E7D32',
      nextCheckMin: 60,
      nextCheckLabel: formatRelativeFuture(60, t),
      dangerLevel: false,
    };
  }

  if (current.level === 'high') {
    // 고열 — 해열제 가능 여부 체크
    if (lastMed && minutesSinceMed < requiredIntervalMin) {
      const remain = requiredIntervalMin - minutesSinceMed;
      return {
        label: t('fever.actionGuide.highWaiting.label'),
        headline: t('fever.actionGuide.highWaiting.headline', { remain }),
        emotion: t('fever.actionGuide.highWaiting.emotion'),
        bgColor: '#FFEBEE',
        borderColor: '#E53935',
        accentColor: '#C62828',
        nextCheckMin: 30,
        nextCheckLabel: formatRelativeFuture(30, t),
        dangerLevel: false,
      };
    }
    return {
      label: t('fever.actionGuide.high.label'),
      headline: t('fever.actionGuide.high.headline'),
      emotion: t('fever.actionGuide.high.emotion'),
      bgColor: '#FFEBEE',
      borderColor: '#E53935',
      accentColor: '#C62828',
      nextCheckMin: 30,
      nextCheckLabel: formatRelativeFuture(30, t),
      dangerLevel: false,
    };
  }

  if (current.level === 'moderate') {
    if (lastMed && minutesSinceMed < requiredIntervalMin) {
      return {
        label: t('fever.actionGuide.moderateWaiting.label'),
        headline: t('fever.actionGuide.moderateWaiting.headline'),
        emotion: t('fever.actionGuide.moderateWaiting.emotion'),
        bgColor: '#FFF3E0',
        borderColor: '#FB8C00',
        accentColor: '#E65100',
        nextCheckMin: 30,
        nextCheckLabel: formatRelativeFuture(30, t),
        dangerLevel: false,
      };
    }
    return {
      label: t('fever.actionGuide.moderate.label'),
      headline: t('fever.actionGuide.moderate.headline'),
      emotion: t('fever.actionGuide.moderate.emotion'),
      bgColor: '#FFF3E0',
      borderColor: '#FB8C00',
      accentColor: '#E65100',
      nextCheckMin: 30,
      nextCheckLabel: formatRelativeFuture(30, t),
      dangerLevel: false,
    };
  }

  if (current.level === 'mild') {
    return {
      label: t('fever.actionGuide.mild.label'),
      headline: t('fever.actionGuide.mild.headline'),
      emotion: t('fever.actionGuide.mild.emotion'),
      bgColor: '#FFF8E1',
      borderColor: '#FFA000',
      accentColor: '#F57C00',
      nextCheckMin: 60,
      nextCheckLabel: formatRelativeFuture(60, t),
      dangerLevel: false,
    };
  }

  // normal
  return {
    label: t('fever.actionGuide.normal.label'),
    headline: t('fever.actionGuide.normal.headline'),
    emotion: t('fever.actionGuide.normal.emotion'),
    bgColor: '#E8F5E9',
    borderColor: '#66BB6A',
    accentColor: '#2E7D32',
    nextCheckMin: 0,
    nextCheckLabel: '',
    dangerLevel: false,
  };
}

function formatMeasureTime(d: Date, t: TFunction): string {
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) {
    const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 2) return t('fever.time.justNowAt', { time: `${hh}:${mm}` });
    if (diffMin < 60) return t('fever.time.minutesAgoAt', { diffMin, time: `${hh}:${mm}` });
    return t('fever.time.todayAt', { time: `${hh}:${mm}` });
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

function formatRelativeFuture(minutes: number, t: TFunction): string {
  const target = new Date(Date.now() + minutes * 60 * 1000);
  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');
  const durationLabel = minutes >= 60
    ? t('fever.time.hoursUnit', { hours: Math.round(minutes / 60) })
    : t('fever.time.minutesUnit', { minutes });
  return t('fever.time.atTimeIn', { time: `${hh}:${mm}`, duration: durationLabel });
}

function historyStorageKey(childId: string): string {
  return `fever_history_${childId}`;
}

function medLogStorageKey(childId: string): string {
  return `fever_medlog_${childId}`;
}

function isMedLogEntry(v: unknown): v is MedLogEntry {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.timestamp === 'number' &&
    typeof obj.type === 'string' &&
    typeof obj.brandName === 'string' &&
    typeof obj.doseMl === 'number'
  );
}

/** 마지막 복용으로부터 다음 복용 가능 시각 계산 (ms timestamp).
 *
 * 같은 종류 약 → MED_INTERVAL_HR[type].min 시간 후
 * 다른 종류 약 (교차) → ALTERNATING_INTERVAL_HR 시간 후
 *
 * 가장 최근 복용 + 가장 최근 다른 종류 복용 둘 다 봐서 더 늦은 시각 반환.
 */
function calcNextDoseAt(
  log: MedLogEntry[],
  targetType: MedicineType,
  t: TFunction,
): { nextAt: number; reason: string } | null {
  if (log.length === 0) return null;
  const sorted = [...log].sort((a, b) => b.timestamp - a.timestamp);
  // 같은 종류 마지막 복용
  const sameLast = sorted.find((e) => e.type === targetType);
  // 다른 종류 마지막 복용 (교차 검사용)
  const diffLast = sorted.find((e) => e.type !== targetType && e.type !== 'other');

  let nextAt = 0;
  let reason = '';

  if (sameLast) {
    const sameNext = sameLast.timestamp + MED_INTERVAL_HR[targetType].min * 60 * 60 * 1000;
    if (sameNext > nextAt) {
      nextAt = sameNext;
      reason = t('fever.nextDose.reasonSame', {
        brandName: getBrandDisplayName(t, sameLast.brandName),
        hours: MED_INTERVAL_HR[targetType].min,
      });
    }
  }
  if (diffLast) {
    const altNext = diffLast.timestamp + ALTERNATING_INTERVAL_HR * 60 * 60 * 1000;
    if (altNext > nextAt) {
      nextAt = altNext;
      reason = t('fever.nextDose.reasonAlternating', {
        brandName: getBrandDisplayName(t, diffLast.brandName),
        hours: ALTERNATING_INTERVAL_HR,
      });
    }
  }

  if (nextAt === 0) return null;
  return { nextAt, reason };
}

function formatRelative(ms: number, t: TFunction): string {
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / (60 * 1000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const future = ms > 0;
  if (h <= 0 && m <= 0) return future ? t('fever.time.soon') : t('fever.time.justNow');
  const label = h > 0
    ? (m > 0 ? t('fever.time.hoursMinutes', { hours: h, minutes: m }) : t('fever.time.hoursUnit', { hours: h }))
    : t('fever.time.minutesUnit', { minutes: m });
  return future ? t('fever.time.in', { label }) : t('fever.time.agoLabel', { label });
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${h}:${m}`;
}

function isHistoryEntry(v: unknown): v is HistoryEntry {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.timestamp === 'number' &&
    typeof obj.temperature === 'number' &&
    typeof obj.method === 'string' &&
    typeof obj.adjustedTemp === 'number' &&
    typeof obj.level === 'string'
  );
}

/* ------------------------------------------------------------------ */
/* FastTimeInput — 숫자 키패드 기반 측정 시각 입력                      */
/* 오전/오후 토글 + 시(1-12) + 분(00-59) + '지금' 버튼                  */
/* DateTimePicker(다이얼) 대비 새벽 입력시 압도적으로 빠름               */
/* ------------------------------------------------------------------ */

function FastTimeInput({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const { t } = useTranslation();
  const h24 = value.getHours();
  const min = value.getMinutes();
  const isPM = h24 >= 12;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;

  const [hourText, setHourText] = useState(String(h12));
  const [minText, setMinText] = useState(String(min).padStart(2, '0'));
  const [pm, setPm] = useState(isPM);

  // 외부 value가 바뀌면 입력 동기화 ('지금' 버튼 등)
  useEffect(() => {
    const _h24 = value.getHours();
    const _min = value.getMinutes();
    const _isPM = _h24 >= 12;
    const _h12 = _h24 === 0 ? 12 : _h24 > 12 ? _h24 - 12 : _h24;
    setHourText(String(_h12));
    setMinText(String(_min).padStart(2, '0'));
    setPm(_isPM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.getTime()]);

  const commit = (newHourText: string, newMinText: string, newPm: boolean) => {
    const hh = Math.max(1, Math.min(12, parseInt(newHourText, 10) || 12));
    const mm = Math.max(0, Math.min(59, parseInt(newMinText, 10) || 0));
    const h24New = newPm ? (hh === 12 ? 12 : hh + 12) : (hh === 12 ? 0 : hh);
    const d = new Date(value);
    d.setHours(h24New, mm, 0, 0);
    // 미래 시각은 거부 (현재 이후 측정은 의미 없음)
    if (d.getTime() > Date.now()) {
      const now = new Date();
      onChange(now);
      return;
    }
    onChange(d);
  };

  return (
    <View style={styles.fastTimeRow}>
      <Text style={styles.fastTimeLabel}>{'📅 ' + t('fever.measureTime.label')}</Text>
      <View style={styles.fastTimeInputs}>
        {/* 오전/오후 토글 */}
        <View style={styles.ampmGroup}>
          <TouchableOpacity
            style={[styles.ampmBtn, !pm && styles.ampmBtnActive]}
            onPress={() => { setPm(false); commit(hourText, minText, false); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.ampmText, !pm && styles.ampmTextActive]}>{t('fever.measureTime.am')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ampmBtn, pm && styles.ampmBtnActive]}
            onPress={() => { setPm(true); commit(hourText, minText, true); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.ampmText, pm && styles.ampmTextActive]}>{t('fever.measureTime.pm')}</Text>
          </TouchableOpacity>
        </View>

        {/* 시 입력 */}
        <TextInput
          style={styles.timeField}
          value={hourText}
          onChangeText={(txt) => {
            const cleaned = txt.replace(/[^0-9]/g, '').slice(0, 2);
            setHourText(cleaned);
          }}
          onEndEditing={() => commit(hourText, minText, pm)}
          keyboardType="number-pad"
          maxLength={2}
          placeholder={t('fever.measureTime.hourPlaceholder')}
          placeholderTextColor={COLOR.textLight}
          returnKeyType="done"
        />
        <Text style={styles.timeColon}>:</Text>
        {/* 분 입력 */}
        <TextInput
          style={styles.timeField}
          value={minText}
          onChangeText={(txt) => {
            const cleaned = txt.replace(/[^0-9]/g, '').slice(0, 2);
            setMinText(cleaned);
          }}
          onEndEditing={() => commit(hourText, minText, pm)}
          keyboardType="number-pad"
          maxLength={2}
          placeholder={t('fever.measureTime.minutePlaceholder')}
          placeholderTextColor={COLOR.textLight}
          returnKeyType="done"
        />

        {/* '지금' 버튼 */}
        <TouchableOpacity
          style={styles.nowBtn}
          onPress={() => onChange(new Date())}
          activeOpacity={0.7}
        >
          <Text style={styles.nowBtnText}>{t('fever.measureTime.now')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Main Screen                                                         */
/* ------------------------------------------------------------------ */

export default function FeverScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { selectedChild } = useChildStore();

  // zh-Hant 대만/홍콩 지역 — 응급번호와 해열제 농도가 일관되도록 상위에서 단일 관리.
  // 기기 지역코드로 자동 추정 후, 계산기 토글로 재정의(AsyncStorage 저장).
  const [zhRegion, setZhRegion] = useState<ZhRegion>(detectZhRegion);
  useEffect(() => {
    if (i18n.language !== 'zh-Hant') return;
    AsyncStorage.getItem(ZH_REGION_STORAGE_KEY).then((v) => {
      if (v === 'TW' || v === 'HK') setZhRegion(v);
    }).catch(() => { /* 저장값 없으면 자동 추정값 유지 */ });
  }, [i18n.language]);
  const changeZhRegion = useCallback((r: ZhRegion) => {
    setZhRegion(r);
    AsyncStorage.setItem(ZH_REGION_STORAGE_KEY, r).catch(() => { /* 저장 실패 무시 */ });
  }, []);
  // 응급번호는 로케일/지역 기반 (홍콩 999, 그 외 119) — 하드코딩 119 대체, 사용자 선택 반영
  const emergencyTel = getEmergencyTel(i18n.language, zhRegion);

  /* -- State -- */
  const [temperature, setTemperature] = useState('');
  const [method, setMethod] = useState<MeasureMethod>('ear');
  const [checkedResult, setCheckedResult] = useState<{
    raw: number;
    adjusted: number;
    level: FeverLevel;
  } | null>(null);

  const [medicineLoading, setMedicineLoading] = useState(false);
  const [medicineDose, setMedicineDose] = useState<MedicineDose | null>(null);
  // 안내 페이지에서만 사용하는 입력 몸무게 (DB 수정하지 않음)
  const [inputWeight, setInputWeight] = useState('');
  // 측정 시각 (기본 = 현재, 과거 시점도 기록 가능)
  const [measureTime, setMeasureTime] = useState<Date>(new Date());
  // showTimePicker: FastTimeInput 도입으로 더 이상 모달 픽커 미사용 — 상태 제거

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllMedLog, setShowAllMedLog] = useState(false);

  /* ---- 해열제 복용 기록 (열나요 스타일) ---- */
  const [medLog, setMedLog] = useState<MedLogEntry[]>([]);
  const [medModalVisible, setMedModalVisible] = useState(false);
  const [medModalBrand, setMedModalBrand] = useState<MedicineBrand | null>(null);
  const [medModalDose, setMedModalDose] = useState<string>('');
  const [medModalNote, setMedModalNote] = useState<string>('');
  // 사용 가이드 (첫 진입 1회 자동표시 + ? 버튼 재열람)
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    shouldAutoShowGuide('fever').then((sh) => { if (sh) setGuideVisible(true); });
  }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('fever'); };
  // 1분마다 갱신하는 'now' (다음 복용 카운트다운용)
  const [medNow, setMedNow] = useState<number>(Date.now());
  useEffect(() => {
    const id = setInterval(() => setMedNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const tempInputRef = useRef<TextInput>(null);

  /* -- Load history on mount -- */
  useEffect(() => {
    if (!selectedChild) return;
    loadHistory(selectedChild.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id]);

  const loadHistory = useCallback(async (childId: string) => {
    try {
      const raw = await AsyncStorage.getItem(historyStorageKey(childId));
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isHistoryEntry);
          setHistory(valid);
        }
      }
    } catch {
      // silently fail
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  const saveHistory = useCallback(async (childId: string, entries: HistoryEntry[]) => {
    try {
      await AsyncStorage.setItem(historyStorageKey(childId), JSON.stringify(entries));
    } catch {
      // silently fail
    }
  }, []);

  /* ---- 해열제 복용 기록 load/save ---- */
  useEffect(() => {
    if (!selectedChild) return;
    AsyncStorage.getItem(medLogStorageKey(selectedChild.id))
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) setMedLog(parsed.filter(isMedLogEntry));
        } catch { /* silent */ }
      })
      .catch(() => { /* silent */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id]);

  const saveMedLog = useCallback(async (childId: string, entries: MedLogEntry[]) => {
    try {
      await AsyncStorage.setItem(medLogStorageKey(childId), JSON.stringify(entries));
    } catch { /* silent */ }
  }, []);

  const handleAddMedLog = useCallback(() => {
    if (!selectedChild) {
      Alert.alert(t('fever.alert.selectChildTitle'), t('fever.alert.selectChildMessage'));
      return;
    }
    if (!medModalBrand) return;
    const dose = parseFloat(medModalDose);
    if (isNaN(dose) || dose <= 0 || dose > 50) {
      Alert.alert(t('fever.alert.doseInputTitle'), t('fever.alert.doseInputMessage'));
      return;
    }
    const entry: MedLogEntry = {
      id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      type: medModalBrand.type,
      brandName: medModalBrand.brandName,
      doseMl: dose,
      note: medModalNote.trim() || undefined,
    };
    const next = [entry, ...medLog].slice(0, 100); // 최대 100건
    setMedLog(next);
    saveMedLog(selectedChild.id, next);
    setMedModalVisible(false);
    setMedModalBrand(null);
    setMedModalDose('');
    setMedModalNote('');
  }, [selectedChild, medModalBrand, medModalDose, medModalNote, medLog, saveMedLog, t]);

  const handleDeleteMedEntry = useCallback((id: string) => {
    if (!selectedChild) return;
    Alert.alert(t('fever.alert.deleteMedLogTitle'), t('fever.alert.deleteMedLogMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        const next = medLog.filter((e) => e.id !== id);
        setMedLog(next);
        saveMedLog(selectedChild.id, next);
      }},
    ]);
  }, [selectedChild, medLog, saveMedLog, t]);

  /* -- Check temperature -- */
  const handleCheck = useCallback(() => {
    const raw = parseFloat(temperature);
    if (isNaN(raw) || raw < 34.0 || raw > 43.0) {
      Alert.alert(t('fever.alert.tempInputErrorTitle'), t('fever.alert.tempInputErrorMessage'));
      return;
    }
    if (!selectedChild) {
      Alert.alert(t('fever.alert.selectChildTitle'), t('fever.alert.selectChildMessage'));
      return;
    }

    const adjusted = adjustTemperature(raw, method);
    const level = classifyFever(adjusted);

    setCheckedResult({ raw, adjusted, level });

    // Save to history (사용자가 측정 시각 변경한 경우 그 시각으로 저장)
    const entry: HistoryEntry = {
      timestamp: measureTime.getTime(),
      temperature: raw,
      method,
      adjustedTemp: adjusted,
      level,
    };
    const updated = [entry, ...history].slice(0, 10);
    setHistory(updated);
    saveHistory(selectedChild.id, updated);

    // home의 useFeverAlert 재실행 유도 (스택 keep으로 useEffect 자동 재실행 안 됨)
    useFeverStore.getState().bump();

    // Auto-load medicine info if fever detected
    if (level !== 'normal') {
      loadMedicine(raw);
    } else {
      setMedicineDose(null);
    }

    // 고열(38°C 이상) 시 1시간 뒤 재측정 알림 예약 (이전 예약은 자동 취소)
    // 해열제 교차 복용 타이머와는 완전 별개의 독립 알림.
    if (adjusted >= 38.0) {
      scheduleFeverRecheckReminder(selectedChild.id, selectedChild.name).then(() => {
        Alert.alert(
          t('fever.alert.recheckReminderTitle'),
          t('fever.alert.recheckReminderMessage'),
        );
      }).catch(() => {});
    } else {
      // 정상 체온이면 기존 재측정 예약 취소
      cancelFeverRecheckReminder(selectedChild.id).catch(() => {});
    }

    // 측정 시각을 다시 현재로 리셋 (다음 측정 대비)
    setMeasureTime(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temperature, method, measureTime, selectedChild, history, saveHistory, t]);

  /* -- Load medicine dosage -- */
  const loadMedicine = useCallback(async (temp?: number) => {
    if (!selectedChild) return;
    setMedicineLoading(true);
    try {
      const res = await sosApi.feverCalculator(selectedChild.id, temp);
      const data = (res.data as Record<string, unknown> | undefined)?.data as unknown;
      if (data && typeof data === 'object') {
        setMedicineDose(data as MedicineDose);
      }
    } catch {
      Alert.alert(t('common.error'), t('fever.alert.medicineLoadError'));
    } finally {
      setMedicineLoading(false);
    }
  }, [selectedChild, t]);

  /* -- Schedule notification -- */
  const scheduleNotification = useCallback(async (minutes: number, label: string) => {
    try {
      const Notifications = await import('expo-notifications');
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('fever.alert.permissionRequiredTitle'), t('fever.alert.permissionRequiredMessage'));
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('fever.notification.doseTimeTitle'),
          body: t('fever.notification.doseTimeBody', { label }),
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: minutes * 60,
          repeats: false,
        },
      });
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeLabel = hours > 0
        ? (mins > 0 ? t('fever.time.hoursMinutes', { hours, minutes: mins }) : t('fever.time.hoursUnit', { hours }))
        : t('fever.time.minutesUnit', { minutes: mins });
      Alert.alert(t('fever.alert.notificationSetTitle'), t('fever.alert.notificationSetMessage', { timeLabel }));
    } catch {
      Alert.alert(t('fever.alert.notificationErrorTitle'), t('fever.alert.notificationErrorMessage'));
    }
  }, [t]);

  /* -- Clear history -- */
  const clearHistory = useCallback(() => {
    if (!selectedChild) return;
    Alert.alert(
      t('fever.alert.clearHistoryTitle'),
      t('fever.alert.clearHistoryMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setHistory([]);
            try {
              await AsyncStorage.removeItem(historyStorageKey(selectedChild.id));
            } catch {
              // silently fail
            }
            // home의 펄스 알림 즉시 해제 (저장된 fever_history 0 → useFeverAlert false)
            useFeverStore.getState().bump();
            // 재측정 알림도 함께 취소
            cancelFeverRecheckReminder(selectedChild.id).catch(() => {});
          },
        },
      ],
    );
  }, [selectedChild, t]);

  /* -- Render -- */
  const feverLevel = getFeverLevel(t, emergencyTel);
  const methodLabels = getMethodLabels(t);
  const levelConfig = checkedResult ? feverLevel[checkedResult.level] : null;
  const showMedicine = checkedResult && checkedResult.level !== 'normal';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={t('fever.screenTitle')} right={<GuideButton onPress={() => setGuideVisible(true)} />} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* == Subtitle (제목은 ScreenHeader로 이동) == */}
        {selectedChild && (
          <View style={[styles.titleBar, { justifyContent: 'center' }]}>
            <Text style={styles.screenSubtitle}>{t('fever.subtitle', { name: selectedChild.name })}</Text>
          </View>
        )}

        {/* ============================================ */}
        {/* 행동 가이드 카드 (체온 입력 후 노출 — 결과보다 위) */}
        {/* ============================================ */}
        {checkedResult && (() => {
          const guide = buildActionGuide(checkedResult, history, medLog, t, emergencyTel);
          return (
            <View style={[styles.actionCard, { backgroundColor: guide.bgColor, borderColor: guide.borderColor }]}>
              <Text style={[styles.actionLabel, { color: guide.accentColor }]}>{guide.label}</Text>
              <Text style={styles.actionHeadline}>{guide.headline}</Text>
              <Text style={styles.actionEmotion}>{guide.emotion}</Text>
              {guide.nextCheckMin > 0 && (
                <View style={styles.actionMetaRow}>
                  <Text style={styles.actionMeta}>{'⏰ ' + t('fever.actionGuide.nextCheck', { time: guide.nextCheckLabel })}</Text>
                </View>
              )}
              {guide.dangerLevel && (
                <TouchableOpacity
                  style={styles.actionEmergency}
                  activeOpacity={0.85}
                  onPress={() => {
                    Linking.openURL(`tel:${emergencyTel}`).catch(() => {
                      Alert.alert(t('fever.alert.callFailedTitle'), t('fever.alert.callFailedMessage', { tel: emergencyTel }));
                    });
                  }}
                >
                  <Text style={styles.actionEmergencyText}>{t('fever.emergencyCallShort', { tel: emergencyTel })}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* ============================================ */}
        {/* Section 1: Temperature Input                 */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('fever.tempInput.title')}</Text>
          <Text style={styles.sectionDesc}>
            {t('fever.tempInput.desc')}
          </Text>

          {/* 측정 시각 — 숫자 키패드 + 오전/오후 토글 + '지금' 버튼 */}
          <FastTimeInput value={measureTime} onChange={setMeasureTime} />

          {/* Big temperature input */}
          <TouchableOpacity
            style={styles.bigTempContainer}
            activeOpacity={1}
            onPress={() => tempInputRef.current?.focus()}
          >
            <TextInput
              ref={tempInputRef}
              style={styles.bigTempInput}
              placeholder="37.0"
              placeholderTextColor={COLOR.textLight}
              keyboardType="decimal-pad"
              value={temperature}
              onChangeText={setTemperature}
              maxLength={5}
              returnKeyType="done"
            />
            <Text style={styles.bigTempUnit}>{'°C'}</Text>
          </TouchableOpacity>

          {/* Measurement method buttons */}
          <View style={styles.methodRow}>
            {(['ear', 'forehead', 'armpit'] as const).map((m) => {
              const isSelected = method === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.methodButton,
                    isSelected && styles.methodButtonSelected,
                  ]}
                  onPress={() => setMethod(m)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.methodLabel,
                      isSelected && styles.methodLabelSelected,
                    ]}
                  >
                    {methodLabels[m]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {method !== 'ear' && (
            <Text style={styles.adjustNote}>
              {t('fever.tempInput.adjustNote', { method: methodLabels[method] })}
            </Text>
          )}

          {/* Check button */}
          <TouchableOpacity
            style={[
              styles.checkButton,
              !temperature && styles.checkButtonDisabled,
            ]}
            onPress={handleCheck}
            activeOpacity={0.8}
            disabled={!temperature}
          >
            <Text style={styles.checkButtonText}>{t('fever.tempInput.checkButton')}</Text>
          </TouchableOpacity>
        </View>

        {/* ============================================ */}
        {/* Section 2: Fever Level Result                */}
        {/* ============================================ */}
        {checkedResult && levelConfig && (
          <View
            style={[
              styles.levelCard,
              {
                backgroundColor: levelConfig.bgColor,
                borderColor: levelConfig.color,
              },
            ]}
          >
            <Image source={levelConfig.icon} style={styles.levelIconImg} resizeMode="contain" />
            <Text style={[styles.levelLabel, { color: levelConfig.color }]}>
              {levelConfig.label}
            </Text>
            <Text style={styles.levelTemp}>
              {checkedResult.raw.toFixed(1)}{'°C'}
              {method !== 'ear' && (
                ` ${t('fever.levelResult.adjustedTemp', { temp: checkedResult.adjusted.toFixed(1) })}`
              )}
            </Text>
            <Text style={styles.levelAdvice}>{levelConfig.advice}</Text>
            {(checkedResult.level === 'danger' || checkedResult.level === 'emergency') && (
              <TouchableOpacity
                style={styles.emergencyCallButton}
                activeOpacity={0.85}
                onPress={() => {
                  Linking.openURL(`tel:${emergencyTel}`).catch(() => {
                    Alert.alert(t('fever.alert.callFailedTitle'), t('fever.alert.callFailedDeviceMessage', { tel: emergencyTel }));
                  });
                }}
              >
                <Text style={styles.emergencyCallButtonText}>{t('fever.emergencyCallFull', { tel: emergencyTel })}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ============================================ */}
        {/* Section 3: Medicine Calculator               */}
        {/* ============================================ */}
        {showMedicine && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Image source={IC_PILL} style={styles.sectionTitleIconImg} resizeMode="contain" />
              <Text style={styles.sectionTitle}>{t('fever.medicine.sectionTitle')}</Text>
            </View>
            <Text style={styles.sectionDesc}>
              {t('fever.medicine.sectionDesc')}
            </Text>

            {/* 의료 disclaimer — 진단·치료 목적 아님 명시 (App Store 1.4.1 + 안전성) */}
            <View style={styles.medDisclaimer}>
              <Text style={styles.medDisclaimerText}>
                {t('fever.medicine.disclaimer')}
              </Text>
            </View>

            {medicineLoading ? (
              <ActivityIndicator
                color={COLOR.accent}
                size="large"
                style={styles.loadingIndicator}
              />
            ) : medicineDose ? (
              <MedicineSection
                dose={medicineDose}
                onSchedule={scheduleNotification}
                inputWeight={inputWeight}
                onChangeWeight={setInputWeight}
                medLog={medLog}
                medNow={medNow}
                zhRegion={zhRegion}
                onChangeZhRegion={changeZhRegion}
              />
            ) : (
              <Text style={styles.noDataText}>
                {t('fever.medicine.loadError')}
              </Text>
            )}
          </View>
        )}

        {/* ============================================ */}
        {/* Section 3.5: 해열제 복용 기록 (열나요 스타일)   */}
        {/* ============================================ */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Image source={IC_DIARY} style={styles.sectionTitleIconImg} resizeMode="contain" />
            <Text style={styles.sectionTitle}>{t('fever.medLog.sectionTitle')}</Text>
          </View>
          <Text style={styles.sectionDesc}>
            {t('fever.medLog.sectionDesc')}
          </Text>

          {/* 빠른 기록 버튼 */}
          <View style={medLogStyles.brandRow}>
            {MEDICINE_BRANDS.map((b) => (
              <TouchableOpacity
                key={b.brandName}
                style={medLogStyles.brandBtn}
                onPress={() => {
                  setMedModalBrand(b);
                  setMedModalDose('');
                  setMedModalNote('');
                  setMedModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Image source={b.icon} style={medLogStyles.brandIconImg} resizeMode="contain" />
                <Text style={medLogStyles.brandLabel}>{getBrandDisplayName(t, b.brandName)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 다음 행동 카드 — 가장 빠른 다음 복용 1건만 큰 글씨로 */}
          {medLog.length > 0 && (() => {
            const last = medLog[0];
            const nextSame = calcNextDoseAt(medLog, last.type, t);
            const otherType: MedicineType = last.type === 'acetaminophen' ? 'ibuprofen' : 'acetaminophen';
            const nextOther = last.type !== 'other' ? calcNextDoseAt(medLog, otherType, t) : null;

            // 가장 빠른 (= 가장 작은 nextAt) 다음 복용을 1건만 선택
            const candidates: { at: number; type: MedicineType; isAlt: boolean }[] = [];
            if (nextSame) candidates.push({ at: nextSame.nextAt, type: last.type, isAlt: false });
            if (nextOther) candidates.push({ at: nextOther.nextAt, type: otherType, isAlt: true });
            if (candidates.length === 0) return null;
            candidates.sort((a, b) => a.at - b.at);
            const next = candidates[0];

            const deltaMs = next.at - medNow;
            const ok = deltaMs <= 0;
            const target = new Date(next.at);
            const hh = String(target.getHours()).padStart(2, '0');
            const mm = String(target.getMinutes()).padStart(2, '0');
            const typeLabel =
              next.type === 'acetaminophen' ? t('fever.medType.acetaminophenGroup') :
              next.type === 'ibuprofen' ? t('fever.medType.ibuprofenGroup') : t('fever.medType.antipyretic');

            return (
              <View style={medLogStyles.nextDoseCard}>
                <Text style={medLogStyles.nextDoseLabel}>
                  {ok ? t('fever.medLog.availableNow') : t('fever.medLog.nextDose')}
                </Text>
                <Text style={medLogStyles.nextDoseHeadline}>
                  {ok
                    ? t('fever.medLog.nowOk', { typeLabel, altSuffix: next.isAlt ? t('fever.medLog.altSuffix') : '' })
                    : t('fever.medLog.atTimeType', { time: `${hh}:${mm}`, typeLabel, altSuffix: next.isAlt ? t('fever.medLog.altSuffix') : '' })}
                </Text>
                <Text style={medLogStyles.nextDoseSub}>
                  {ok
                    ? t('fever.medLog.lastDoseInfo', {
                        brandName: getBrandDisplayName(t, last.brandName),
                        doseMl: last.doseMl,
                        relative: formatRelative(medNow - last.timestamp, t),
                      })
                    : t('fever.medLog.inAbout', { relative: formatRelative(deltaMs, t) })}
                </Text>
              </View>
            );
          })()}

          {/* 복용 이력 — 최근 1건 + 전체 보기 토글 */}
          {medLog.length > 0 && (
            <View style={medLogStyles.logList}>
              <Text style={medLogStyles.logListTitle}>{t('fever.medLog.historyTitle')}</Text>
              {(showAllMedLog ? medLog.slice(0, 5) : medLog.slice(0, 1)).map((entry) => (
                <View key={entry.id} style={medLogStyles.logRow}>
                  <Text style={medLogStyles.logTime}>
                    {formatTime(entry.timestamp)}
                  </Text>
                  <Text style={medLogStyles.logBrand}>{getBrandDisplayName(t, entry.brandName)}</Text>
                  <Text style={medLogStyles.logDose}>{entry.doseMl}ml</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteMedEntry(entry.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={medLogStyles.logDelete}>{'×'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {medLog.length > 1 && (
                <TouchableOpacity
                  onPress={() => setShowAllMedLog((v) => !v)}
                  style={medLogStyles.toggleBtn}
                  hitSlop={6}
                >
                  <Text style={medLogStyles.toggleBtnText}>
                    {showAllMedLog
                      ? t('common.collapse')
                      : t('fever.medLog.viewAll', { count: Math.min(medLog.length, 5) })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {medLog.length === 0 && (
            <Text style={medLogStyles.empty}>
              {t('fever.medLog.empty')}
            </Text>
          )}
        </View>

        {/* ============================================ */}
        {/* Section 4: Temperature History               */}
        {/* ============================================ */}
        {historyLoaded && history.length > 0 && (
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <View style={styles.sectionTitleRow}>
                <Image source={IC_DIARY} style={styles.sectionTitleIconImg} resizeMode="contain" />
                <Text style={styles.sectionTitle}>{t('fever.history.sectionTitle')}</Text>
              </View>
              <TouchableOpacity
                onPress={clearHistory}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearButton}>{t('fever.history.clearButton')}</Text>
              </TouchableOpacity>
            </View>

            {(showAllHistory ? history : history.slice(0, 1)).map((entry, idx, arr) => {
              const cfg = feverLevel[entry.level];
              return (
                <View
                  key={`hist-${entry.timestamp}-${idx}`}
                  style={[
                    styles.historyRow,
                    idx < arr.length - 1 && styles.historyRowBorder,
                  ]}
                >
                  <View
                    style={[
                      styles.historyDot,
                      { backgroundColor: cfg.color },
                    ]}
                  />
                  <Text style={styles.historyTime}>
                    {formatTime(entry.timestamp)}
                  </Text>
                  <Text style={styles.historyTemp}>
                    {entry.temperature.toFixed(1)}{'°C'}
                  </Text>
                  <Text style={styles.historyMethod}>
                    {methodLabels[entry.method]}
                  </Text>
                  <Text
                    style={[styles.historyLevel, { color: cfg.color }]}
                  >
                    {cfg.label}
                  </Text>
                </View>
              );
            })}
            {history.length > 1 && (
              <TouchableOpacity
                onPress={() => setShowAllHistory((v) => !v)}
                style={styles.historyToggleBtn}
                hitSlop={6}
              >
                <Text style={styles.historyToggleBtnText}>
                  {showAllHistory ? t('common.collapse') : t('fever.history.viewAll', { count: history.length })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <MedicalCitation
          note={t('fever.citation.note')}
          sources={[
            { label: t('fever.citation.source1'), url: 'https://www.pediatrics.or.kr' },
            { label: t('fever.citation.source2'), url: 'https://health.kdca.go.kr' },
          ]}
        />
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ============================================ */}
      {/*  해열제 복용 기록 입력 모달                   */}
      {/* ============================================ */}
      <Modal
        visible={medModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMedModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={medLogStyles.modalOverlay}
        >
          <TouchableOpacity
            style={medLogStyles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setMedModalVisible(false)}
          />
          <View style={medLogStyles.modalCard}>
            <View style={medLogStyles.modalTitleRow}>
              {medModalBrand?.icon ? (
                <Image source={medModalBrand.icon} style={medLogStyles.modalTitleIconImg} resizeMode="contain" />
              ) : null}
              <Text style={medLogStyles.modalTitle}>
                {t('fever.medModal.title', {
                  brandName: medModalBrand ? getBrandDisplayName(t, medModalBrand.brandName) : t('fever.medModal.defaultBrand'),
                })}
              </Text>
            </View>
            <Text style={medLogStyles.modalSub}>
              {t('fever.medModal.subLabel', { time: formatTime(medNow) })}
            </Text>

            {/* 약 종류 변경 (chip) */}
            <Text style={medLogStyles.modalLabel}>{t('fever.medModal.selectMed')}</Text>
            <View style={medLogStyles.modalChipRow}>
              {MEDICINE_BRANDS.map((b) => (
                <TouchableOpacity
                  key={b.brandName}
                  style={[
                    medLogStyles.modalChip,
                    medModalBrand?.brandName === b.brandName && medLogStyles.modalChipActive,
                  ]}
                  onPress={() => setMedModalBrand(b)}
                >
                  <View style={medLogStyles.modalChipInner}>
                    <Image source={b.icon} style={medLogStyles.modalChipIconImg} resizeMode="contain" />
                    <Text style={[
                      medLogStyles.modalChipText,
                      medModalBrand?.brandName === b.brandName && medLogStyles.modalChipTextActive,
                    ]}>
                      {getBrandDisplayName(t, b.brandName)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* 용량 입력 */}
            <Text style={medLogStyles.modalLabel}>{t('fever.medModal.doseLabel')}</Text>
            <TextInput
              style={medLogStyles.modalInput}
              keyboardType="numeric"
              placeholder={t('fever.medModal.dosePlaceholder')}
              placeholderTextColor="#ABABAB"
              value={medModalDose}
              onChangeText={setMedModalDose}
              maxLength={5}
              autoFocus
            />

            {/* 메모 (옵션) */}
            <Text style={medLogStyles.modalLabel}>{t('fever.medModal.noteLabel')}</Text>
            <TextInput
              style={medLogStyles.modalInput}
              placeholder={t('fever.medModal.notePlaceholder')}
              placeholderTextColor="#ABABAB"
              value={medModalNote}
              onChangeText={setMedModalNote}
              maxLength={50}
            />

            <View style={medLogStyles.modalBtnRow}>
              <TouchableOpacity
                style={[medLogStyles.modalBtn, medLogStyles.modalBtnCancel]}
                onPress={() => setMedModalVisible(false)}
              >
                <Text style={medLogStyles.modalBtnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[medLogStyles.modalBtn, medLogStyles.modalBtnSave]}
                onPress={handleAddMedLog}
              >
                <Text style={medLogStyles.modalBtnSaveText}>{t('fever.medModal.saveButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <GuideCarousel visible={guideVisible} pages={getFeverGuide(t)} onClose={closeGuide} onComplete={closeGuide} accent="#DB6A5F" />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

/**
 * 입력 몸무게 기준 시럽 용량 재계산 (실시간 표시 전용)
 *
 * 보수적(최소) 용량 적용 — 2026-05-15 사용자 요청
 *   · 아세트아미노펜: 권장 10~15mg/kg → 보수값 **10mg/kg**
 *   · 이부프로펜: 권장 5~10mg/kg → 보수값 **5mg/kg**
 *
 * 시럽 농도 (한국 시판약 라벨 기준):
 *   · 타이레놀/챔프(빨강): 32mg/ml (160mg/5ml)
 *   · 챔프 ER (고농도): 48mg/ml (240mg/5ml)
 *   · 부루펜/맥시부펜/챔프(파랑): 20mg/ml (100mg/5ml)
 *   · 이지엔6 등 고농도 이부프로펜: 40mg/ml (200mg/5ml)
 *
 * 참고: 본 계산은 일반 가이드용이며, 실제 처방 용량은 약사·소아과의 안내를 우선해주세요.
 */
const ACET_MG_PER_KG = 10; // 보수값 (10~15 권장 중 최저) — mg/kg 기준 자체는 국가 무관 동일(WHO/각국 소아과 공통)
const IBU_MG_PER_KG = 5;   // 보수값 (5~10 권장 중 최저)

/**
 * 비한국어 로케일 시럽 농도 (추가형) — 한국 시판약(32/20mg/ml) 로직은 무변경.
 * 실제 시판 제품 농도는 국가별로 크게 다르므로(농도가 다르면 계산 ml도 달라짐), 반드시
 * 실제 제품 라벨과 대조 후 투약하도록 안내 문구를 함께 노출한다.
 *
 * 일본: 아세트아미노펜 소아용 시럽 2%(w/v 표기 — 약학 표준 관례상 2% = 20mg/ml,
 *   1mg/ml이 아님에 주의) — 이부프로펜은 시판약 기준 만 15세 미만 금기라 미제공
 *   근거: 東和薬品「アセトアミノフェンシロップ小児用2%」체중별 早見表(5kg→2.5~3.75ml,
 *   10kg→5.0~7.5ml — 10~15mg/kg 기준 역산 시 20mg/ml로 일치 확인), PMDA 환자용 가이드
 * 대만: 安佳熱糖漿(Anti-Phen) 아세트 24mg/ml, 依普芬(Ibuprofen) 20mg/ml
 *   근거: 奇美醫院/童綜合醫院/台大醫院 약품 정보
 * 홍콩: 必理痛(Panadol) 撲熱息痛 250mg/5ml = 아세트 50mg/ml, Infacalm 이부 20mg/ml
 *   근거: Panadol HK 공식페이지, 醫護行社區藥房(HK-55059)
 *   → zh-Hant 단일 로케일이지만 대만·홍콩 아세트 농도가 2배 차이나므로 반드시 분리 계산.
 */
type ZhRegion = 'TW' | 'HK';
const CONCENTRATION_BY_REGION: Record<'ja' | 'zh-Hant-TW' | 'zh-Hant-HK', { acet: number; ibu: number | null }> = {
  ja: { acet: 20, ibu: null },
  'zh-Hant-TW': { acet: 24, ibu: 20 },
  'zh-Hant-HK': { acet: 50, ibu: 20 },
};

/** 기기 지역코드로 zh-Hant 사용자의 대만/홍콩 자동 추정 (기본 TW). 사용자가 토글로 재정의 가능. */
function detectZhRegion(): ZhRegion {
  try {
    const region = (getDeviceRegionCode() ?? '').toUpperCase();
    return region === 'HK' || region === 'MO' ? 'HK' : 'TW';
  } catch {
    return 'TW';
  }
}

/** 응급 전화번호 — 한국/일본/대만은 119, 홍콩(및 마카오)은 999. zhRegion(사용자 선택)이 있으면 우선. */
function getEmergencyTel(lang: string, zhRegion?: ZhRegion): string {
  if (lang === 'zh-Hant' && (zhRegion ?? detectZhRegion()) === 'HK') return '999';
  return '119';
}

const ZH_REGION_STORAGE_KEY = 'fever_zh_region';

function recalcSyrup(weight: number, t: TFunction, acetConcMgPerMl = 32, ibuConcMgPerMl = 20) {
  const acetaminophenMg = +(weight * ACET_MG_PER_KG).toFixed(0);
  const acetaminophenMl = +(weight * ACET_MG_PER_KG / acetConcMgPerMl).toFixed(1);
  const ibuprofenMg = +(weight * IBU_MG_PER_KG).toFixed(0);
  const ibuprofenMl = +(weight * IBU_MG_PER_KG / ibuConcMgPerMl).toFixed(1);
  return {
    acetaminophen: { doseMg: `${acetaminophenMg}mg`, syrupMl: t('fever.syrupApprox', { ml: acetaminophenMl }) },
    ibuprofen: { doseMg: `${ibuprofenMg}mg`, syrupMl: t('fever.syrupApprox', { ml: ibuprofenMl }) },
  };
}

function MedicineSection({
  dose,
  onSchedule,
  inputWeight,
  onChangeWeight,
  medLog,
  medNow,
  zhRegion,
  onChangeZhRegion,
}: {
  dose: MedicineDose;
  onSchedule: (minutes: number, label: string) => void;
  inputWeight: string;
  onChangeWeight: (v: string) => void;
  medLog: MedLogEntry[];
  medNow: number;
  // zh-Hant 대만/홍콩 지역 — 응급번호와 일관되게 하려고 상위(FeverScreen)에서 관리해 내려받음
  zhRegion: ZhRegion;
  onChangeZhRegion: (r: ZhRegion) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ja' || i18n.language === 'zh-Hant' ? i18n.language : undefined;
  const parsedWeight = parseFloat(inputWeight);
  const useInput = !isNaN(parsedWeight) && parsedWeight > 0 && parsedWeight < 100;

  const changeZhRegion = onChangeZhRegion;

  // 농도 결정 — 챔프 ER 선택 시 48mg/ml, 그 외 32mg/ml. 이부는 고정 20mg/ml. (한국 로직 무변경)
  // 비한국어는 CONCENTRATION_BY_REGION 값 사용(추가형) — 일본은 이부프로펜 미제공(acet만),
  // zh-Hant는 대만/홍콩 지역별 분리.
  const concKey: 'ja' | 'zh-Hant-TW' | 'zh-Hant-HK' | undefined =
    locale === 'ja' ? 'ja'
    : locale === 'zh-Hant' ? (zhRegion === 'HK' ? 'zh-Hant-HK' : 'zh-Hant-TW')
    : undefined;
  const localeConc = concKey ? CONCENTRATION_BY_REGION[concKey] : undefined;
  const recalc = useInput
    ? recalcSyrup(parsedWeight, t, localeConc?.acet ?? 32, localeConc?.ibu ?? 20)
    : null;

  // 부드러운 fade 애니메이션 (수치 변화 시 깜빡임 → 인지)
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!useInput) return;
    Animated.sequence([
      Animated.timing(fade, { toValue: 0.4, duration: 80, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [parsedWeight, useInput, fade]);

  const acetaminophenDoseMg = recalc?.acetaminophen.doseMg ?? dose.acetaminophen.doseMg;
  const acetaminophenSyrup = recalc?.acetaminophen.syrupMl ?? dose.acetaminophen.syrupMl;
  const ibuprofenDoseMg = recalc?.ibuprofen.doseMg ?? dose.ibuprofen.doseMg;
  const ibuprofenSyrup = recalc?.ibuprofen.syrupMl ?? dose.ibuprofen.syrupMl;

  // 추천 약 결정: 가장 빠르게 복용 가능한 종류 (없으면 아세트아미노펜 디폴트)
  const recommendation = (() => {
    if (medLog.length === 0) {
      return { type: 'acetaminophen' as MedicineType, available: true, deltaMs: 0 };
    }
    const last = medLog[0];
    const sameNext = calcNextDoseAt(medLog, last.type, t);
    const otherType: MedicineType = last.type === 'acetaminophen' ? 'ibuprofen' : 'acetaminophen';
    const otherNext = last.type !== 'other' ? calcNextDoseAt(medLog, otherType, t) : null;
    const sameAt = sameNext ? sameNext.nextAt : Infinity;
    const otherAt = otherNext ? otherNext.nextAt : Infinity;
    if (sameAt === Infinity && otherAt === Infinity) {
      return { type: 'acetaminophen' as MedicineType, available: true, deltaMs: 0 };
    }
    const pickType = sameAt <= otherAt ? last.type : otherType;
    const pickAt = Math.min(sameAt, otherAt);
    const delta = pickAt - medNow;
    return { type: pickType, available: delta <= 0, deltaMs: Math.max(0, delta) };
  })();

  // 4-약 그리드 — 사용자가 직접 브랜드 선택
  // - 타이레놀, 챔프(빨강) → acetaminophen (32mg/ml)
  // - 챔프 ER (빨강 고농도) → acetaminophen (48mg/ml)
  // - 부루펜, 맥시부펜, 챔프(파랑) → ibuprofen (20mg/ml)
  // 비한국어(추가형): 일본은 성분명 아세트아미노펜만(시판 이부프로펜은 만 15세 미만 금기),
  // 대만/홍콩(zh-Hant)은 성분명 아세트아미노펜·이부프로펜 2종 — 실제 제품 브랜드/농도가
  // 국가마다 달라 브랜드명 대신 "성분명 + 농도 확인 필요" 형태로 노출.
  type BrandKey = 'tylenol' | 'champ' | 'brufen' | 'maxibupen' | 'acet_generic' | 'ibu_generic';
  type ChampType = 'red' | 'blue' | 'red_er'; // 빨강=아세트 32, 빨강ER=아세트 48, 파랑=이부 20

  const isNonKoLocale = locale === 'ja' || locale === 'zh-Hant';

  // 추천 약(아세트/이부)에 따라 디폴트 브랜드 결정
  // 일본은 이부프로펜을 아예 제공하지 않으므로(만 15세 미만 시판약 금기) 항상 아세트아미노펜으로 고정
  const defaultBrand: BrandKey = locale === 'ja'
    ? 'acet_generic'
    : locale === 'zh-Hant'
      ? (recommendation.type === 'ibuprofen' ? 'ibu_generic' : 'acet_generic')
      : (recommendation.type === 'ibuprofen' ? 'brufen' : 'tylenol');
  const [selectedBrand, setSelectedBrand] = useState<BrandKey>(defaultBrand);
  const [champType, setChampType] = useState<ChampType>('red');
  const recommendationTypeRef = useRef(recommendation.type);
  useEffect(() => {
    if (recommendation.type !== recommendationTypeRef.current) {
      recommendationTypeRef.current = recommendation.type;
      if (locale === 'ja') {
        setSelectedBrand('acet_generic');
      } else if (locale === 'zh-Hant') {
        setSelectedBrand(recommendation.type === 'ibuprofen' ? 'ibu_generic' : 'acet_generic');
      } else {
        setSelectedBrand(recommendation.type === 'ibuprofen' ? 'brufen' : 'tylenol');
      }
    }
  }, [recommendation.type, locale]);

  // 선택된 브랜드 → 약 종류(acetaminophen/ibuprofen) 매핑
  // 챔프 빨강·빨강ER 모두 아세트아미노펜 / 파랑만 이부프로펜
  const selectedType: MedicineType =
    selectedBrand === 'tylenol' ? 'acetaminophen'
    : selectedBrand === 'brufen' ? 'ibuprofen'
    : selectedBrand === 'maxibupen' ? 'ibuprofen'
    : selectedBrand === 'acet_generic' ? 'acetaminophen'
    : selectedBrand === 'ibu_generic' ? 'ibuprofen'
    : champType === 'blue' ? 'ibuprofen' : 'acetaminophen';

  const isAcet = selectedType === 'acetaminophen';
  const selectedDoseMg = isAcet ? acetaminophenDoseMg : ibuprofenDoseMg;
  // 챔프 ER (48mg/ml 고농도) — selectedSyrupText 의 ml 재계산
  const isChampER = selectedBrand === 'champ' && champType === 'red_er';
  let selectedSyrupText = isAcet ? acetaminophenSyrup : ibuprofenSyrup;
  if (isChampER && useInput) {
    const acetMl = +(parsedWeight * ACET_MG_PER_KG / 48).toFixed(1);
    selectedSyrupText = t('fever.syrupApprox', { ml: acetMl });
  }
  const mlMatch = selectedSyrupText.match(/(\d+(?:\.\d+)?)\s*ml/);
  const mlNumber = mlMatch ? mlMatch[1] : selectedSyrupText;
  // mg 값(체중×mg/kg)은 제품 농도와 무관하게 항상 정확 → 비한국어 대표 표시로 사용(오투약 방지)
  const mgMatch = selectedDoseMg.match(/(\d+(?:\.\d+)?)/);
  const mgNumber = mgMatch ? mgMatch[1] : selectedDoseMg;
  // 비한국어 참고 mL 계산에 쓰인 가정 농도(mg/ml) — mL은 "이 농도 기준 참고값"으로만 부차 표시
  const refConc = locale && localeConc
    ? (isAcet ? localeConc.acet : (localeConc.ibu ?? 20))
    : null;
  const brandLabel = (() => {
    if (selectedBrand === 'tylenol') return t('fever.brand.tylenol');
    if (selectedBrand === 'brufen') return t('fever.brand.brufen');
    if (selectedBrand === 'maxibupen') return t('fever.brand.maxibupen');
    if (selectedBrand === 'acet_generic') return t('fever.brand.acetGeneric');
    if (selectedBrand === 'ibu_generic') return t('fever.brand.ibuGeneric');
    if (champType === 'red_er') return t('fever.brand.champER');
    return champType === 'red' ? t('fever.brand.champRed') : t('fever.brand.champBlue');
  })();
  const drugColor = isAcet ? TYLENOL_COLOR : BRUFEN_COLOR;
  // 복용 간격·1일 최대 횟수: 값 자체는 각국 공통(공식 자료 교차검증). 비한국어는 백엔드 한국어
  // 문자열 대신 로케일 문자열로 표시(추가형). 한국어는 기존 백엔드 값 그대로.
  const interval = isNonKoLocale
    ? (isAcet ? t('fever.doseSchedule.acetInterval') : t('fever.doseSchedule.ibuInterval'))
    : (isAcet ? dose.acetaminophen.interval : dose.ibuprofen.interval);
  const maxDaily = isNonKoLocale
    ? (isAcet ? t('fever.doseSchedule.acetMaxDaily') : t('fever.doseSchedule.ibuMaxDaily'))
    : (isAcet ? dose.acetaminophen.maxDaily : dose.ibuprofen.maxDaily);

  // 동적 감성 헤드라인 — 선택한 약·용량 실시간 연동 (단일 행동 강조)
  // 비한국어는 농도 무관 정확값인 mg을 헤드라인에 사용(제품 농도가 국가마다 달라 mL은 부차 표시).
  // 한국어 키는 "약 {{mlNumber}}ml"로 ml 단위가 고정되어 있어, 비한국어는 단위 포함 {{dose}} 별도 키 사용.
  const headline = isNonKoLocale
    ? (recommendation.available
      ? t('fever.medGuide.headlineAvailableGeneric', { brandLabel, dose: `${mgNumber}mg` })
      : t('fever.medGuide.headlineWaitingGeneric', { relative: formatRelative(recommendation.deltaMs, t), brandLabel, dose: `${mgNumber}mg` }))
    : (recommendation.available
      ? t('fever.medGuide.headlineAvailable', { brandLabel, mlNumber })
      : t('fever.medGuide.headlineWaiting', { relative: formatRelative(recommendation.deltaMs, t), brandLabel, mlNumber }));

  // 브랜드 그리드 항목 — 일본은 아세트아미노펜 1종(이부프로펜 미제공), 대만/홍콩은 성분명 2종, 한국은 기존 4브랜드
  const grid: { key: BrandKey; label: string; icon: ImageSourcePropType; color: string }[] =
    locale === 'ja'
      ? [{ key: 'acet_generic', label: t('fever.brand.acetGeneric'), icon: IC_PILL, color: TYLENOL_COLOR }]
      : locale === 'zh-Hant'
        ? [
          { key: 'acet_generic', label: t('fever.brand.acetGeneric'), icon: IC_PILL, color: TYLENOL_COLOR },
          { key: 'ibu_generic', label: t('fever.brand.ibuGeneric'), icon: IC_SYRINGE, color: BRUFEN_COLOR },
        ]
        : [
          { key: 'tylenol', label: t('fever.brand.tylenol'), icon: IC_PILL, color: TYLENOL_COLOR },
          { key: 'champ', label: t('fever.brand.champ'), icon: IC_PILL, color: champType === 'red' ? TYLENOL_COLOR : BRUFEN_COLOR },
          { key: 'brufen', label: t('fever.brand.brufen'), icon: IC_SYRINGE, color: BRUFEN_COLOR },
          { key: 'maxibupen', label: t('fever.brand.maxibupen'), icon: IC_SYRINGE, color: BRUFEN_COLOR },
        ];

  return (
    <View style={styles.medicineContainer}>
      {/* 몸무게 입력 (실시간 계산용) */}
      <View style={styles.weightInputCard}>
        <Text style={styles.weightInputLabel}>{t('fever.weightInput.label')}</Text>
        <View style={styles.weightInputRow}>
          <TextInput
            style={styles.weightInputField}
            value={inputWeight}
            onChangeText={onChangeWeight}
            placeholder={String(dose.childWeight)}
            placeholderTextColor="#BBB"
            keyboardType="decimal-pad"
            maxLength={5}
          />
          <Text style={styles.weightInputUnit}>kg</Text>
        </View>
        <Text style={styles.weightInputHint}>
          {useInput
            ? t('fever.weightInput.liveCalc', { weight: parsedWeight })
            : t('fever.weightInput.defaultCalc', { weight: dose.childWeight })}
        </Text>
      </View>

      {/* === 단일 행동 카드 — 가장 강하게 인지되는 화면 === */}
      <View style={[styles.medGuideCard, { borderColor: drugColor }]}>
        <Text style={[styles.medGuideStatus, { color: drugColor }]}>
          {recommendation.available ? t('fever.medGuide.referenceLabel') : t('fever.medGuide.untilNext', { relative: formatRelative(recommendation.deltaMs, t) })}
        </Text>
        <Text style={styles.medGuideHeadline}>{headline}</Text>
      </View>

      {/* === 거대 용량 디스플레이 (새벽 인지 가능 — 폰트 압도적 크게) ===
          한국어: mL을 대표 표시(국내 시판 농도 표준화됨).
          비한국어: 농도 무관 정확값인 mg을 대표 표시하고, mL은 "가정 농도 기준 참고값 — 라벨 확인"
          으로 부차 표시(대만 24 vs 홍콩 파나돌 50mg/ml 등 제품 농도 차이로 인한 오투약 방지). */}
      <Animated.View style={[styles.bigDoseCard, { opacity: fade }]}>
        <Text style={[styles.bigDoseDrug, { color: drugColor }]}>{brandLabel}</Text>
        {isNonKoLocale ? (
          <>
            <View style={styles.bigDoseRow}>
              <Text style={[styles.bigDoseNumber, { color: drugColor }]}>{mgNumber}</Text>
              <Text style={styles.bigDoseUnit}>mg</Text>
            </View>
            {useInput && refConc ? (
              <Text style={styles.bigDoseRefMl}>
                {t('fever.refMlNote', { conc: refConc, ml: mlNumber })}
              </Text>
            ) : null}
            <Text style={styles.bigDoseSub}>{interval} · {maxDaily}</Text>
          </>
        ) : (
          <>
            <View style={styles.bigDoseRow}>
              <Text style={[styles.bigDoseNumber, { color: drugColor }]}>{mlNumber}</Text>
              <Text style={styles.bigDoseUnit}>ml</Text>
            </View>
            <Text style={styles.bigDoseSub}>{selectedDoseMg} · {interval} · {maxDaily}</Text>
          </>
        )}
      </Animated.View>

      {/* === 추천 카드 슬롯 (Native Ad placeholder — 향후 확장용. 현재는 미노출) === */}
      {/*
        디자인 컨셉: '엄마를 위한 팁' / '맞춤 추천 아이템'처럼 보이는 인포메이션 카드.
        조건이 정해지면 isPremium && adsEnabled && hasMatchingTip 로 게이트링.
        주석 해제 시 styles.tipSlot 사용.
      */}
      {/* <View style={styles.tipSlot}>...</View> */}

      {/* === 4-약 그리드 (2x2) === */}
      <View style={styles.medGrid}>
        {grid.map((b) => {
          const isSelected = selectedBrand === b.key;
          return (
            <TouchableOpacity
              key={b.key}
              style={[
                styles.medGridBtn,
                isSelected && { backgroundColor: b.color + '20', borderColor: b.color },
              ]}
              onPress={() => setSelectedBrand(b.key)}
              activeOpacity={0.7}
            >
              <Image source={b.icon} style={styles.medGridIconImg} resizeMode="contain" />
              <Text style={[styles.medGridLabel, isSelected && { color: b.color, fontWeight: '700' }]}>
                {b.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* === 챔프 종류 토글 — 농도별 (오복용 방지) === */}
      {selectedBrand === 'champ' && (
        <View style={styles.champRow}>
          <Text style={styles.champLabel}>{t('fever.champToggle.label')}</Text>
          <View style={styles.champToggle}>
            <TouchableOpacity
              style={[
                styles.champBtn,
                champType === 'red' && { backgroundColor: TYLENOL_COLOR + '20', borderColor: TYLENOL_COLOR },
              ]}
              onPress={() => setChampType('red')}
              activeOpacity={0.7}
            >
              <View style={[styles.champDot, { backgroundColor: '#E53935' }]} />
              <Text style={[styles.champBtnText, champType === 'red' && { color: TYLENOL_COLOR, fontWeight: '700' }]}>
                {t('fever.champToggle.red')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.champBtn,
                champType === 'red_er' && { backgroundColor: TYLENOL_COLOR + '20', borderColor: TYLENOL_COLOR },
              ]}
              onPress={() => setChampType('red_er')}
              activeOpacity={0.7}
            >
              <View style={[styles.champDot, { backgroundColor: '#B71C1C' }]} />
              <Text style={[styles.champBtnText, champType === 'red_er' && { color: TYLENOL_COLOR, fontWeight: '700' }]}>
                {t('fever.champToggle.redEr')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.champBtn,
                champType === 'blue' && { backgroundColor: BRUFEN_COLOR + '20', borderColor: BRUFEN_COLOR },
              ]}
              onPress={() => setChampType('blue')}
              activeOpacity={0.7}
            >
              <View style={[styles.champDot, { backgroundColor: '#1E88E5' }]} />
              <Text style={[styles.champBtnText, champType === 'blue' && { color: BRUFEN_COLOR, fontWeight: '700' }]}>
                {t('fever.champToggle.blue')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* === 대만/홍콩 지역 선택 (zh-Hant 전용) — 아세트 농도가 2배 달라 분리 계산 필수 === */}
      {locale === 'zh-Hant' && (
        <View style={styles.champRow}>
          <Text style={styles.champLabel}>{t('fever.zhRegion.label')}</Text>
          <View style={styles.champToggle}>
            <TouchableOpacity
              style={[
                styles.champBtn,
                zhRegion === 'TW' && { backgroundColor: TYLENOL_COLOR + '20', borderColor: TYLENOL_COLOR },
              ]}
              onPress={() => changeZhRegion('TW')}
              activeOpacity={0.7}
            >
              <Text style={[styles.champBtnText, zhRegion === 'TW' && { color: TYLENOL_COLOR, fontWeight: '700' }]}>
                {t('fever.zhRegion.tw')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.champBtn,
                zhRegion === 'HK' && { backgroundColor: TYLENOL_COLOR + '20', borderColor: TYLENOL_COLOR },
              ]}
              onPress={() => changeZhRegion('HK')}
              activeOpacity={0.7}
            >
              <Text style={[styles.champBtnText, zhRegion === 'HK' && { color: TYLENOL_COLOR, fontWeight: '700' }]}>
                {t('fever.zhRegion.hk')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* === 비한국어 로케일 — 실제 제품 농도 확인 안내 (국가별 시판 농도가 달라 자동 판단 불가) === */}
      {isNonKoLocale && (
        <View style={styles.champRow}>
          <Text style={styles.medConcentrationNote}>
            {locale === 'ja'
              ? t('fever.concentrationNote.ja')
              : zhRegion === 'HK'
                ? t('fever.concentrationNote.hk')
                : t('fever.concentrationNote.tw')}
          </Text>
        </View>
      )}

      {/* === 알림 버튼 (선택 약 기준) === */}
      <TouchableOpacity
        style={[styles.recPrimaryNotify, { backgroundColor: drugColor }]}
        onPress={() => onSchedule(isAcet ? 240 : 360, brandLabel)}
        activeOpacity={0.85}
      >
        <Image source={IC_BELL} style={styles.recPrimaryNotifyIconImg} resizeMode="contain" />
        <Text style={styles.recPrimaryNotifyText}>
          {isAcet ? t('fever.notifyButton.in4h') : t('fever.notifyButton.in6h')}
        </Text>
      </TouchableOpacity>

      {/* Age restriction (이부프로펜계) — 비한국어는 로케일 문자열, 한국어는 백엔드 값 */}
      {!isAcet && dose.ibuprofen.ageRestriction && (
        <View style={styles.warningBox}>
          <Image source={IC_REDFLAG} style={styles.warningIconImg} resizeMode="contain" />
          <Text style={styles.warningText}>
            {isNonKoLocale ? t('fever.doseSchedule.ibuAgeRestriction') : dose.ibuprofen.ageRestriction}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

/* ---- 해열제 복용 기록 스타일 (열나요 스타일) ---- */
const medLogStyles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  brandBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 70,
    backgroundColor: '#F8F8FA',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  brandEmoji: { fontSize: 16, marginBottom: 1 },
  brandIconImg: { width: 22, height: 22, marginBottom: 1 },
  brandLabel: { fontSize: 11, fontWeight: '700', color: '#1C1C1E' },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  modalTitleIconImg: { width: 22, height: 22 },
  modalChipInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalChipIconImg: { width: 16, height: 16 },
  statusCard: {
    backgroundColor: '#FFF8EC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#FFE5B5',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  statusLabel: {
    fontSize: 12,
    color: '#636366',
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  nextDoseCard: {
    backgroundColor: '#FFF8EC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#FFD8A8',
    marginBottom: 10,
  },
  nextDoseLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#FF8C5A',
    marginBottom: 4,
  },
  nextDoseHeadline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  nextDoseSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636366',
  },
  logList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  logListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#636366',
    marginBottom: 6,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F2',
  },
  logTime: { fontSize: 12, color: '#636366', minWidth: 80 },
  logBrand: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', flex: 1 },
  logDose: { fontSize: 13, color: '#1C1C1E', fontWeight: '600' },
  logDelete: { fontSize: 18, color: '#FF6B6B', fontWeight: '700', paddingHorizontal: 4 },
  toggleBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF8C5A',
  },
  empty: {
    fontSize: 12,
    color: '#ABABAB',
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  /* 모달 */
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#636366',
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 10,
    marginBottom: 6,
  },
  modalChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  modalChipActive: {
    backgroundColor: '#FFF0E6',
    borderColor: '#FF8C5A',
  },
  modalChipText: { fontSize: 12, fontWeight: '600', color: '#636366' },
  modalChipTextActive: { color: '#FF8C5A', fontWeight: '600' },
  modalInput: {
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: { backgroundColor: '#F2F2F7' },
  modalBtnSave: { backgroundColor: '#FF8C5A' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '700', color: '#636366' },
  modalBtnSaveText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  /* Back button */
  backButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  backArrow: {
    fontSize: 24,
    fontWeight: '600',
    color: COLOR.text,
  },

  /* Title Bar */
  titleBar: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLOR.text,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleIconImg: {
    width: 24,
    height: 24,
  },
  screenSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.textSub,
  },

  /* Section common */
  section: {
    backgroundColor: COLOR.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitleIconImg: {
    width: 20,
    height: 20,
  },
  sectionDesc: {
    fontSize: 12,
    color: COLOR.textSub,
    marginBottom: 10,
  },

  /* 의료 disclaimer (해열제 섹션) */
  medDisclaimer: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 3,
    borderLeftColor: '#F57C00',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  medDisclaimerText: {
    fontSize: 11,
    color: '#5D4037',
    lineHeight: 16,
  },

  /* Big temperature input */
  bigTempContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9F4',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLOR.border,
  },
  bigTempInput: {
    fontSize: 34,
    fontWeight: '700',
    color: COLOR.text,
    textAlign: 'center',
    minWidth: 120,
    paddingVertical: Platform.OS === 'ios' ? 0 : 2,
  },
  bigTempUnit: {
    fontSize: 20,
    fontWeight: '600',
    color: COLOR.textSub,
    marginLeft: 4,
  },

  /* Measurement method */
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F8F5F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 36,
  },
  methodButtonSelected: {
    backgroundColor: '#FFF0E6',
    borderColor: COLOR.accent,
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.textSub,
  },
  methodLabelSelected: {
    color: COLOR.accent,
    fontWeight: '700',
  },
  adjustNote: {
    fontSize: 11,
    color: COLOR.textSub,
    marginBottom: 10,
    fontStyle: 'italic',
  },

  /* Check button */
  checkButton: {
    backgroundColor: COLOR.accent,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  checkButtonDisabled: {
    backgroundColor: '#D4C8BC',
  },
  checkButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* 측정 시각 selector */
  measureTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 8,
  },
  measureTimeLabel: { fontSize: 12, fontWeight: '700', color: '#444' },
  measureTimeValue: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1A1A1A', textAlign: 'right' },
  measureTimeArrow: { fontSize: 14, color: '#9E9E9E', fontWeight: '700' },

  /* === Action Guide Card (행동 중심 — 결과 박스보다 위) === */
  actionCard: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  actionHeadline: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 24,
    marginBottom: 6,
  },
  actionEmotion: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#444',
    lineHeight: 18,
  },
  actionMetaRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  actionMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
  },
  actionEmergency: {
    marginTop: 10,
    backgroundColor: '#D32F2F',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionEmergencyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Fever level card */
  levelCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  levelEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  levelIconImg: {
    width: 48,
    height: 48,
    marginBottom: 6,
  },
  levelLabel: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  levelTemp: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.text,
    marginBottom: 8,
  },
  levelAdvice: {
    fontSize: 12.5,
    color: COLOR.text,
    lineHeight: 18,
    textAlign: 'center',
  },
  emergencyCallButton: {
    marginTop: 10,
    backgroundColor: '#D32F2F',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignSelf: 'stretch',
  },
  emergencyCallButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* Medicine */
  medicineContainer: {
    marginTop: 2,
  },
  /* 입력 몸무게 카드 (안내 페이지 전용 — 실시간 계산 트리거) */
  weightInputCard: {
    backgroundColor: '#FFF8F3',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFE0CC',
  },
  weightInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6F00',
    marginBottom: 4,
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weightInputField: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#FF8C5A',
  },
  weightInputUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6F00',
  },
  weightInputHint: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },

  weightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  weightLabel: {
    fontSize: 12,
    color: COLOR.textSub,
  },
  weightValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLOR.text,
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  medicineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  medicineBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  medicineDoseWrap: {
    flex: 1,
    paddingTop: 1,
  },
  medicineDoseText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.text,
  },
  medicineSyrup: {
    fontSize: 12,
    color: COLOR.textSub,
    marginTop: 1,
  },
  medicineInterval: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },

  /* Notification button */
  notifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1.5,
    backgroundColor: COLOR.card,
    minHeight: 36,
  },
  notifyBtnIcon: {
    fontSize: 13,
  },
  notifyBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* === 동적 가이드 헤드라인 (감성 멘트) === */
  medGuideCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  medGuideStatus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  medGuideHeadline: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 27,
  },

  /* === 거대 용량 디스플레이 (새벽에도 즉시 인지 가능) === */
  bigDoseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEE',
  },
  bigDoseDrug: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  bigDoseRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  bigDoseNumber: {
    // 새벽에도 즉시 인지: 56pt → 110pt 약 2배
    fontSize: 110,
    fontWeight: '700',
    lineHeight: 116,
    letterSpacing: -3,
  },
  bigDoseUnit: {
    fontSize: 36,
    fontWeight: '600',
    color: '#636366',
  },
  bigDoseSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9E9E9E',
    marginTop: 8,
  },
  bigDoseRefMl: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 17,
  },

  /* === Native Ad / 정보성 추천 카드 슬롯 (현재 미노출, 향후 확장용) === */
  tipSlot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // 디자인 톤: 광고 느낌보단 '엄마를 위한 팁' 인포메이션 카드.
    // 노출 시 컨텐츠: 아이콘 + 제목 + 짧은 설명 + (선택) CTA 텍스트 링크.
    display: 'none', // 현재 미노출
  },
  tipSlotIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipSlotIconText: {
    fontSize: 20,
  },
  tipSlotBody: {
    flex: 1,
  },
  tipSlotTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  tipSlotDesc: {
    fontSize: 11,
    color: '#636366',
    lineHeight: 15,
  },

  /* === 4-약 그리드 (2x2) === */
  medGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  medGridBtn: {
    width: '48%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medGridEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  medGridIconImg: {
    width: 32,
    height: 32,
    marginBottom: 4,
  },
  medGridLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#636366',
  },

  /* === 챔프 빨강/파랑 토글 === */
  champRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFE5D6',
  },
  champLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#636366',
    marginBottom: 8,
  },
  medConcentrationNote: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D32F2F',
    lineHeight: 18,
  },
  champToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  champBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  champDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  champBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#636366',
  },

  /* === 시간 입력 (숫자 키패드 기반) === */
  fastTimeRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  fastTimeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#636366',
    marginBottom: 8,
  },
  fastTimeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ampmGroup: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 4,
  },
  ampmBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  ampmBtnActive: {
    backgroundColor: '#FF8C5A20',
    borderColor: '#FF8C5A',
  },
  ampmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#636366',
  },
  ampmTextActive: {
    color: '#FF8C5A',
    fontWeight: '700',
  },
  timeField: {
    width: 50,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  timeColon: {
    fontSize: 18,
    fontWeight: '600',
    color: '#636366',
  },
  nowBtn: {
    marginLeft: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#FF8C5A',
  },
  nowBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Recommended primary medicine card */
  recPrimaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    marginTop: 8,
  },
  recPrimaryHeader: {
    marginBottom: 4,
  },
  recPrimaryBadge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  recPrimaryName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  recPrimaryDose: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  recPrimarySyrup: {
    fontSize: 13,
    color: '#636366',
    marginTop: 2,
  },
  recPrimaryInterval: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  recPrimaryNotify: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 10,
  },
  recPrimaryNotifyIcon: { fontSize: 13 },
  recPrimaryNotifyIconImg: { width: 18, height: 18, marginRight: 4 },
  recPrimaryNotifyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* Other-option (작은) */
  recSecondaryCard: {
    backgroundColor: '#F8F8FA',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  recSecondaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9E9E9E',
    marginBottom: 2,
  },
  recSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recSecondaryName: {
    fontSize: 12,
    fontWeight: '600',
  },
  recSecondaryDose: {
    fontSize: 11,
    color: '#636366',
  },
  recSecondaryInterval: {
    fontSize: 11,
    color: '#9E9E9E',
    marginLeft: 'auto',
  },

  /* Schedule */
  scheduleSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
  },
  scheduleTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: 6,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  scheduleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scheduleText: {
    fontSize: 12,
    color: COLOR.text,
    flex: 1,
    lineHeight: 16,
  },

  /* Warning box */
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBF0',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    gap: 6,
  },
  warningIcon: {
    fontSize: 13,
    marginTop: 1,
  },
  warningIconImg: { width: 16, height: 16, marginTop: 1 },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: COLOR.text,
    lineHeight: 17,
  },

  /* History */
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clearButton: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 8,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyTime: {
    fontSize: 12,
    color: COLOR.textSub,
    width: 70,
  },
  historyTemp: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.text,
    width: 50,
  },
  historyMethod: {
    fontSize: 11,
    color: COLOR.textSub,
    width: 40,
  },
  historyLevel: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  historyToggleBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  historyToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF8C5A',
  },

  /* Misc */
  loadingIndicator: {
    paddingVertical: 30,
  },
  noDataText: {
    fontSize: 14,
    color: COLOR.textSub,
    textAlign: 'center',
    paddingVertical: 20,
  },
});

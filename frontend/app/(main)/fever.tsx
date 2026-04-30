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
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sosApi } from '../../services/api';
import {
  scheduleFeverRecheckReminder,
  cancelFeverRecheckReminder,
} from '../../services/pushNotifications';
import { useChildStore } from '../../stores/childStore';
import { AdSlot } from '../../components/ads/AdSlot';

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
  emoji: string;
}

const MEDICINE_BRANDS: MedicineBrand[] = [
  { brandName: '타이레놀',   type: 'acetaminophen', emoji: '💊' },
  { brandName: '챔프',       type: 'acetaminophen', emoji: '💊' },
  { brandName: '부루펜',     type: 'ibuprofen',     emoji: '💉' },
  { brandName: '맥시부펜',   type: 'ibuprofen',     emoji: '💉' },
  { brandName: '기타',       type: 'other',         emoji: '🧴' },
];

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

const FEVER_LEVEL: Record<FeverLevel, {
  color: string;
  bgColor: string;
  label: string;
  emoji: string;
  advice: string;
}> = {
  normal: {
    color: '#34C759',
    bgColor: '#F0FFF4',
    label: '정상',
    emoji: '😊',
    advice: '아이의 체온이 정상 범위입니다. 편안하게 지켜봐주세요.',
  },
  mild: {
    color: '#FFD76E',
    bgColor: '#FFFDF0',
    label: '미열',
    emoji: '🤒',
    advice: '미열이 있어요. 옷을 가볍게 입히고 수분 섭취를 해주세요. 미지근한 물수건으로 닦아주세요.',
  },
  moderate: {
    color: '#FF9500',
    bgColor: '#FFF8F0',
    label: '중등도 발열',
    emoji: '😰',
    advice: '체온이 높아요. 해열제 복용을 고려하세요. 30분 후 다시 체온을 확인해주세요.',
  },
  high: {
    color: '#FF3B30',
    bgColor: '#FFF0F0',
    label: '고열',
    emoji: '🥵',
    advice: '고열입니다. 해열제를 복용시키고, 30분 후에도 열이 내리지 않으면 소아과를 방문하세요.',
  },
  danger: {
    color: '#D32F2F',
    bgColor: '#FFEBEE',
    label: '즉시 병원 진료',
    emoji: '🏥',
    advice: '위험한 고열 수준입니다. 해열제 효과를 기다리지 말고 지금 바로 소아과·응급실로 가세요. 경련·의식 저하가 있으면 즉시 119에 전화하세요.',
  },
  emergency: {
    color: '#B71C1C',
    bgColor: '#FFCDD2',
    label: '응급 — 119 전화',
    emoji: '🚨',
    advice: '생명을 위협할 수 있는 초고열입니다. 지금 바로 119에 전화하거나 응급실로 가세요. 이동 중에도 옷을 얇게 하고 미지근한 물로 몸을 닦아 체온을 낮춰주세요.',
  },
};

const METHOD_LABELS: Record<MeasureMethod, string> = {
  ear: '귀',
  forehead: '이마',
  armpit: '겨드랑이',
};

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
      reason = `${sameLast.brandName} 복용 ${MED_INTERVAL_HR[targetType].min}시간 후`;
    }
  }
  if (diffLast) {
    const altNext = diffLast.timestamp + ALTERNATING_INTERVAL_HR * 60 * 60 * 1000;
    if (altNext > nextAt) {
      nextAt = altNext;
      reason = `${diffLast.brandName}(교차) 복용 ${ALTERNATING_INTERVAL_HR}시간 후`;
    }
  }

  if (nextAt === 0) return null;
  return { nextAt, reason };
}

function formatRelative(ms: number): string {
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / (60 * 1000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const future = ms > 0;
  if (h <= 0 && m <= 0) return future ? '곧' : '방금';
  const label = h > 0 ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
  return future ? `${label} 후` : `${label} 전`;
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
/* Main Screen                                                         */
/* ------------------------------------------------------------------ */

export default function FeverScreen() {
  const insets = useSafeAreaInsets();
  const { selectedChild } = useChildStore();

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

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  /* ---- 해열제 복용 기록 (열나요 스타일) ---- */
  const [medLog, setMedLog] = useState<MedLogEntry[]>([]);
  const [medModalVisible, setMedModalVisible] = useState(false);
  const [medModalBrand, setMedModalBrand] = useState<MedicineBrand | null>(null);
  const [medModalDose, setMedModalDose] = useState<string>('');
  const [medModalNote, setMedModalNote] = useState<string>('');
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
      Alert.alert('아이 선택', '먼저 아이를 선택해주세요.');
      return;
    }
    if (!medModalBrand) return;
    const dose = parseFloat(medModalDose);
    if (isNaN(dose) || dose <= 0 || dose > 50) {
      Alert.alert('용량 입력', '올바른 ml 용량을 입력해주세요 (0~50).');
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
  }, [selectedChild, medModalBrand, medModalDose, medModalNote, medLog, saveMedLog]);

  const handleDeleteMedEntry = useCallback((id: string) => {
    if (!selectedChild) return;
    Alert.alert('기록 삭제', '이 복용 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => {
        const next = medLog.filter((e) => e.id !== id);
        setMedLog(next);
        saveMedLog(selectedChild.id, next);
      }},
    ]);
  }, [selectedChild, medLog, saveMedLog]);

  /* -- Check temperature -- */
  const handleCheck = useCallback(() => {
    const raw = parseFloat(temperature);
    if (isNaN(raw) || raw < 34.0 || raw > 43.0) {
      Alert.alert('체온 입력 오류', '34.0 ~ 43.0 사이의 체온을 입력해주세요.');
      return;
    }
    if (!selectedChild) {
      Alert.alert('아이 선택', '먼저 아이를 선택해주세요.');
      return;
    }

    const adjusted = adjustTemperature(raw, method);
    const level = classifyFever(adjusted);

    setCheckedResult({ raw, adjusted, level });

    // Save to history
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      temperature: raw,
      method,
      adjustedTemp: adjusted,
      level,
    };
    const updated = [entry, ...history].slice(0, 10);
    setHistory(updated);
    saveHistory(selectedChild.id, updated);

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
          '🌡 1시간 뒤 재측정 알림 설정',
          '고열이 감지되었습니다. 1시간 뒤에 다시 재실 수 있도록 알림을 맞춰드렸어요. 걱정 마세요!',
        );
      }).catch(() => {});
    } else {
      // 정상 체온이면 기존 재측정 예약 취소
      cancelFeverRecheckReminder(selectedChild.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temperature, method, selectedChild, history, saveHistory]);

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
      Alert.alert('오류', '해열제 정보를 불러올 수 없습니다.');
    } finally {
      setMedicineLoading(false);
    }
  }, [selectedChild]);

  /* -- Schedule notification -- */
  const scheduleNotification = useCallback(async (minutes: number, label: string) => {
    try {
      const Notifications = await import('expo-notifications');
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '알림 권한을 허용해주세요.');
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '해열제 복용 시간',
          body: `${label} 복용 시간입니다. 체온을 다시 확인해주세요.`,
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
        ? (mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`)
        : `${mins}분`;
      Alert.alert('알림 설정 완료', `${timeLabel} 후 알림이 울립니다.`);
    } catch {
      Alert.alert('알림 오류', '알림을 설정할 수 없습니다.');
    }
  }, []);

  /* -- Clear history -- */
  const clearHistory = useCallback(() => {
    if (!selectedChild) return;
    Alert.alert(
      '기록 삭제',
      '모든 체온 기록을 삭제할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setHistory([]);
            try {
              await AsyncStorage.removeItem(historyStorageKey(selectedChild.id));
            } catch {
              // silently fail
            }
          },
        },
      ],
    );
  }, [selectedChild]);

  /* -- Render -- */
  const levelConfig = checkedResult ? FEVER_LEVEL[checkedResult.level] : null;
  const showMedicine = checkedResult && checkedResult.level !== 'normal';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerStyle: { backgroundColor: COLOR.bg },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="뒤로"
            >
              <Text style={styles.backArrow}>{'<'}</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* == Title Bar == */}
        <View style={styles.titleBar}>
          <Text style={styles.screenTitle}>{'🌡️'} 열나요</Text>
          {selectedChild && (
            <Text style={styles.screenSubtitle}>{selectedChild.name}</Text>
          )}
        </View>

        {/* ============================================ */}
        {/* Section 1: Temperature Input                 */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>체온 입력</Text>
          <Text style={styles.sectionDesc}>
            체온을 입력하고 측정 부위를 선택해주세요
          </Text>

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
                    {METHOD_LABELS[m]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {method !== 'ear' && (
            <Text style={styles.adjustNote}>
              * {METHOD_LABELS[method]} 측정 시 +0.5{'°C'} 보정하여 판단합니다
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
            <Text style={styles.checkButtonText}>확인</Text>
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
            <Text style={styles.levelEmoji}>{levelConfig.emoji}</Text>
            <Text style={[styles.levelLabel, { color: levelConfig.color }]}>
              {levelConfig.label}
            </Text>
            <Text style={styles.levelTemp}>
              {checkedResult.raw.toFixed(1)}{'°C'}
              {method !== 'ear' && (
                ` (보정 ${checkedResult.adjusted.toFixed(1)}${'°C'})`
              )}
            </Text>
            <Text style={styles.levelAdvice}>{levelConfig.advice}</Text>
            {(checkedResult.level === 'danger' || checkedResult.level === 'emergency') && (
              <TouchableOpacity
                style={styles.emergencyCallButton}
                activeOpacity={0.85}
                onPress={() => {
                  Linking.openURL('tel:119').catch(() => {
                    Alert.alert('전화 연결 실패', '기기에서 전화 앱을 열 수 없습니다. 직접 119로 전화해주세요.');
                  });
                }}
              >
                <Text style={styles.emergencyCallButtonText}>🚨 119에 전화하기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ============================================ */}
        {/* Section 3: Medicine Calculator               */}
        {/* ============================================ */}
        {showMedicine && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{'💊'} 해열제 복용량</Text>
            <Text style={styles.sectionDesc}>
              아이 체중 기준 계산된 복용량입니다
            </Text>

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
              />
            ) : (
              <Text style={styles.noDataText}>
                해열제 정보를 불러올 수 없습니다.
              </Text>
            )}
          </View>
        )}

        {/* ============================================ */}
        {/* Section 3.5: 해열제 복용 기록 (열나요 스타일)   */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{'📝'} 해열제 복용 기록</Text>
          <Text style={styles.sectionDesc}>
            먹인 해열제와 용량을 기록하면 다음 복용 가능 시간을 자동으로 알려드려요
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
                <Text style={medLogStyles.brandEmoji}>{b.emoji}</Text>
                <Text style={medLogStyles.brandLabel}>{b.brandName}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 다음 복용 가능 시간 안내 */}
          {medLog.length > 0 && (() => {
            const last = medLog[0];
            // 같은 종류 약을 다시 먹을 때 가능 시각
            const nextSame = calcNextDoseAt(medLog, last.type);
            // 교차 (다른 종류) 가능 시각
            const otherType: MedicineType = last.type === 'acetaminophen' ? 'ibuprofen' : 'acetaminophen';
            const nextOther = calcNextDoseAt(medLog, otherType);

            const sameDeltaMs = nextSame ? nextSame.nextAt - medNow : 0;
            const otherDeltaMs = nextOther ? nextOther.nextAt - medNow : 0;
            const sameOk = sameDeltaMs <= 0;
            const otherOk = otherDeltaMs <= 0;

            return (
              <View style={medLogStyles.statusCard}>
                <View style={medLogStyles.statusRow}>
                  <Text style={medLogStyles.statusLabel}>
                    {'마지막 복용'}
                  </Text>
                  <Text style={medLogStyles.statusValue}>
                    {last.brandName} {last.doseMl}ml · {formatRelative(medNow - last.timestamp)}
                  </Text>
                </View>

                {/* 같은 종류 약 다음 복용 가능 */}
                {nextSame && (
                  <View style={medLogStyles.statusRow}>
                    <Text style={medLogStyles.statusLabel}>
                      {last.brandName} 다음 복용
                    </Text>
                    <Text style={[
                      medLogStyles.statusValue,
                      { color: sameOk ? '#2E7D32' : COLOR.accent, fontWeight: '800' },
                    ]}>
                      {sameOk ? '지금 복용 가능' : formatRelative(sameDeltaMs)}
                    </Text>
                  </View>
                )}

                {/* 교차 복용 가능 */}
                {nextOther && last.type !== 'other' && (
                  <View style={medLogStyles.statusRow}>
                    <Text style={medLogStyles.statusLabel}>
                      {`${otherType === 'acetaminophen' ? '타이레놀류' : '부루펜류'} 교차`}
                    </Text>
                    <Text style={[
                      medLogStyles.statusValue,
                      { color: otherOk ? '#2E7D32' : COLOR.accent, fontWeight: '800' },
                    ]}>
                      {otherOk ? '지금 교차 복용 가능' : formatRelative(otherDeltaMs)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* 복용 이력 (최근 5건) */}
          {medLog.length > 0 && (
            <View style={medLogStyles.logList}>
              <Text style={medLogStyles.logListTitle}>{'복용 이력 (최근 5건)'}</Text>
              {medLog.slice(0, 5).map((entry) => (
                <View key={entry.id} style={medLogStyles.logRow}>
                  <Text style={medLogStyles.logTime}>
                    {formatTime(entry.timestamp)}
                  </Text>
                  <Text style={medLogStyles.logBrand}>{entry.brandName}</Text>
                  <Text style={medLogStyles.logDose}>{entry.doseMl}ml</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteMedEntry(entry.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={medLogStyles.logDelete}>{'×'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {medLog.length === 0 && (
            <Text style={medLogStyles.empty}>
              아직 기록이 없어요. 위 버튼으로 복용을 기록하면 다음 복용 시간을 자동 계산해드려요.
            </Text>
          )}
        </View>

        {/* ============================================ */}
        {/* Section 4: Temperature History               */}
        {/* ============================================ */}
        {historyLoaded && history.length > 0 && (
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>{'📋'} 체온 기록</Text>
              <TouchableOpacity
                onPress={clearHistory}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearButton}>기록 삭제</Text>
              </TouchableOpacity>
            </View>

            {history.map((entry, idx) => {
              const cfg = FEVER_LEVEL[entry.level];
              return (
                <View
                  key={`hist-${entry.timestamp}-${idx}`}
                  style={[
                    styles.historyRow,
                    idx < history.length - 1 && styles.historyRowBorder,
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
                    {METHOD_LABELS[entry.method]}
                  </Text>
                  <Text
                    style={[styles.historyLevel, { color: cfg.color }]}
                  >
                    {cfg.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

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
            <Text style={medLogStyles.modalTitle}>
              {medModalBrand?.emoji} {medModalBrand?.brandName ?? '해열제'} 기록
            </Text>
            <Text style={medLogStyles.modalSub}>
              지금 ({formatTime(medNow)}) 복용으로 기록됩니다
            </Text>

            {/* 약 종류 변경 (chip) */}
            <Text style={medLogStyles.modalLabel}>약 선택</Text>
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
                  <Text style={[
                    medLogStyles.modalChipText,
                    medModalBrand?.brandName === b.brandName && medLogStyles.modalChipTextActive,
                  ]}>
                    {b.emoji} {b.brandName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 용량 입력 */}
            <Text style={medLogStyles.modalLabel}>용량 (ml)</Text>
            <TextInput
              style={medLogStyles.modalInput}
              keyboardType="numeric"
              placeholder="예: 5"
              placeholderTextColor="#ABABAB"
              value={medModalDose}
              onChangeText={setMedModalDose}
              maxLength={5}
              autoFocus
            />

            {/* 메모 (옵션) */}
            <Text style={medLogStyles.modalLabel}>메모 (선택)</Text>
            <TextInput
              style={medLogStyles.modalInput}
              placeholder="예: 38.5도 / 식후"
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
                <Text style={medLogStyles.modalBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[medLogStyles.modalBtn, medLogStyles.modalBtnSave]}
                onPress={handleAddMedLog}
              >
                <Text style={medLogStyles.modalBtnSaveText}>기록 저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AdSlot />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

/**
 * 입력 몸무게 기준 시럽 용량 재계산 (실시간 표시 전용)
 * - 표준 공식 (소아과 가이드):
 *   · 타이레놀 시럽(32mg/ml): 10~15mg/kg → 평균 12.5mg/kg → ml = w * 12.5 / 32
 *   · 부루펜 시럽(20mg/ml): 5~10mg/kg → 평균 7.5mg/kg → ml = w * 7.5 / 20
 * - 기존 dose 객체의 interval / maxDaily / ageRestriction은 그대로 유지
 */
function recalcSyrup(weight: number) {
  const acetaminophenMg = +(weight * 12.5).toFixed(0);
  const acetaminophenMl = +(weight * 12.5 / 32).toFixed(1);
  const ibuprofenMg = +(weight * 7.5).toFixed(0);
  const ibuprofenMl = +(weight * 7.5 / 20).toFixed(1);
  return {
    acetaminophen: { doseMg: `${acetaminophenMg}mg`, syrupMl: `시럽 약 ${acetaminophenMl}ml` },
    ibuprofen: { doseMg: `${ibuprofenMg}mg`, syrupMl: `시럽 약 ${ibuprofenMl}ml` },
  };
}

function MedicineSection({
  dose,
  onSchedule,
  inputWeight,
  onChangeWeight,
}: {
  dose: MedicineDose;
  onSchedule: (minutes: number, label: string) => void;
  inputWeight: string;
  onChangeWeight: (v: string) => void;
}) {
  const parsedWeight = parseFloat(inputWeight);
  const useInput = !isNaN(parsedWeight) && parsedWeight > 0 && parsedWeight < 100;
  const recalc = useInput ? recalcSyrup(parsedWeight) : null;

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

  return (
    <View style={styles.medicineContainer}>
      {/* 몸무게 입력 (실시간 계산용) */}
      <View style={styles.weightInputCard}>
        <Text style={styles.weightInputLabel}>현재 몸무게</Text>
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
            ? `입력값 ${parsedWeight}kg 기준으로 실시간 계산`
            : `프로필 등록 ${dose.childWeight}kg 기준 (입력 시 즉시 변경)`}
        </Text>
      </View>

      {/* Weight basis (기존 표시는 유지) */}
      <View style={styles.weightRow}>
        <Text style={styles.weightLabel}>체중 기준</Text>
        <Text style={styles.weightValue}>{useInput ? `${parsedWeight}kg (입력)` : `${dose.childWeight}kg`}</Text>
      </View>

      {/* Tylenol (acetaminophen) */}
      <View style={styles.medicineRow}>
        <View style={[styles.medicineBadge, { backgroundColor: '#E3F2FD' }]}>
          <Text style={[styles.medicineBadgeText, { color: TYLENOL_COLOR }]}>
            타이레놀
          </Text>
        </View>
        <Animated.View style={[styles.medicineDoseWrap, { opacity: fade }]}>
          <Text style={styles.medicineDoseText}>
            {acetaminophenDoseMg}
          </Text>
          <Text style={styles.medicineSyrup}>
            {acetaminophenSyrup}
          </Text>
          <Text style={[styles.medicineInterval, { color: TYLENOL_COLOR }]}>
            {dose.acetaminophen.interval} / {dose.acetaminophen.maxDaily}
          </Text>
        </Animated.View>
      </View>

      {/* Notification for Tylenol */}
      <TouchableOpacity
        style={[styles.notifyBtn, { borderColor: TYLENOL_COLOR }]}
        onPress={() => onSchedule(240, '타이레놀')}
        activeOpacity={0.7}
      >
        <Text style={styles.notifyBtnIcon}>{'🔔'}</Text>
        <Text style={[styles.notifyBtnText, { color: TYLENOL_COLOR }]}>
          4시간 후 타이레놀 알림
        </Text>
      </TouchableOpacity>

      {/* Ibuprofen */}
      <View style={[styles.medicineRow, { marginTop: 16 }]}>
        <View style={[styles.medicineBadge, { backgroundColor: '#FFF3E0' }]}>
          <Text style={[styles.medicineBadgeText, { color: BRUFEN_COLOR }]}>
            부루펜
          </Text>
        </View>
        <Animated.View style={[styles.medicineDoseWrap, { opacity: fade }]}>
          <Text style={styles.medicineDoseText}>
            {ibuprofenDoseMg}
          </Text>
          <Text style={styles.medicineSyrup}>
            {ibuprofenSyrup}
          </Text>
          <Text style={[styles.medicineInterval, { color: BRUFEN_COLOR }]}>
            {dose.ibuprofen.interval} / {dose.ibuprofen.maxDaily}
          </Text>
        </Animated.View>
      </View>

      {/* Age restriction */}
      {dose.ibuprofen.ageRestriction && (
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>{'⚠️'}</Text>
          <Text style={styles.warningText}>
            {dose.ibuprofen.ageRestriction}
          </Text>
        </View>
      )}

      {/* Notification for Ibuprofen */}
      <TouchableOpacity
        style={[styles.notifyBtn, { borderColor: BRUFEN_COLOR }]}
        onPress={() => onSchedule(360, '부루펜')}
        activeOpacity={0.7}
      >
        <Text style={styles.notifyBtnIcon}>{'🔔'}</Text>
        <Text style={[styles.notifyBtnText, { color: BRUFEN_COLOR }]}>
          6시간 후 부루펜 알림
        </Text>
      </TouchableOpacity>

      {/* Alternating schedule */}
      {dose.alternatingSchedule.length > 0 && (
        <View style={styles.scheduleSection}>
          <Text style={styles.scheduleTitle}>교대 복용 스케줄</Text>
          {dose.alternatingSchedule.map((item, idx) => (
            <View key={`sched-${idx}`} style={styles.scheduleRow}>
              <View
                style={[
                  styles.scheduleIndicator,
                  { backgroundColor: idx % 2 === 0 ? TYLENOL_COLOR : BRUFEN_COLOR },
                ]}
              />
              <Text style={styles.scheduleText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Warning */}
      <View style={styles.warningBox}>
        <Text style={styles.warningIcon}>{'💡'}</Text>
        <Text style={styles.warningText}>{dose.warning}</Text>
      </View>
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
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  brandBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 90,
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A8D5BA',
  },
  brandEmoji: { fontSize: 22, marginBottom: 2 },
  brandLabel: { fontSize: 13, fontWeight: '700', color: '#1B5E20' },
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
    fontWeight: '800',
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
  modalChipTextActive: { color: '#FF8C5A', fontWeight: '800' },
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
  modalBtnSaveText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
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
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    gap: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLOR.text,
  },
  screenSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.textSub,
  },

  /* Section common */
  section: {
    backgroundColor: COLOR.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 13,
    color: COLOR.textSub,
    marginBottom: 16,
  },

  /* Big temperature input */
  bigTempContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9F4',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLOR.border,
  },
  bigTempInput: {
    fontSize: 48,
    fontWeight: '700',
    color: COLOR.text,
    textAlign: 'center',
    minWidth: 160,
    paddingVertical: Platform.OS === 'ios' ? 0 : 4,
  },
  bigTempUnit: {
    fontSize: 28,
    fontWeight: '600',
    color: COLOR.textSub,
    marginLeft: 4,
  },

  /* Measurement method */
  methodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F8F5F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 48,
  },
  methodButtonSelected: {
    backgroundColor: '#FFF0E6',
    borderColor: COLOR.accent,
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.textSub,
  },
  methodLabelSelected: {
    color: COLOR.accent,
    fontWeight: '700',
  },
  adjustNote: {
    fontSize: 12,
    color: COLOR.textSub,
    marginBottom: 14,
    fontStyle: 'italic',
  },

  /* Check button */
  checkButton: {
    backgroundColor: COLOR.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  checkButtonDisabled: {
    backgroundColor: '#D4C8BC',
  },
  checkButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Fever level card */
  levelCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  levelEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  levelLabel: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  levelTemp: {
    fontSize: 16,
    fontWeight: '600',
    color: COLOR.text,
    marginBottom: 14,
  },
  levelAdvice: {
    fontSize: 15,
    color: COLOR.text,
    lineHeight: 24,
    textAlign: 'center',
  },
  emergencyCallButton: {
    marginTop: 16,
    backgroundColor: '#D32F2F',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'stretch',
  },
  emergencyCallButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* Medicine */
  medicineContainer: {
    marginTop: 4,
  },
  /* 입력 몸무게 카드 (안내 페이지 전용 — 실시간 계산 트리거) */
  weightInputCard: {
    backgroundColor: '#FFF8F3',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFE0CC',
  },
  weightInputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6F00',
    marginBottom: 8,
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightInputField: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#FF8C5A',
  },
  weightInputUnit: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FF6F00',
  },
  weightInputHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
  },

  weightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  weightLabel: {
    fontSize: 13,
    color: COLOR.textSub,
  },
  weightValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLOR.text,
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  medicineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  medicineBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  medicineDoseWrap: {
    flex: 1,
    paddingTop: 2,
  },
  medicineDoseText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.text,
  },
  medicineSyrup: {
    fontSize: 14,
    color: COLOR.textSub,
    marginTop: 2,
  },
  medicineInterval: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },

  /* Notification button */
  notifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1.5,
    backgroundColor: COLOR.card,
    minHeight: 48,
  },
  notifyBtnIcon: {
    fontSize: 16,
  },
  notifyBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Schedule */
  scheduleSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: 10,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  scheduleIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scheduleText: {
    fontSize: 13,
    color: COLOR.text,
    flex: 1,
    lineHeight: 20,
  },

  /* Warning box */
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBF0',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    gap: 8,
  },
  warningIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: COLOR.text,
    lineHeight: 20,
  },

  /* History */
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '600',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  historyTime: {
    fontSize: 13,
    color: COLOR.textSub,
    width: 80,
  },
  historyTemp: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.text,
    width: 56,
  },
  historyMethod: {
    fontSize: 12,
    color: COLOR.textSub,
    width: 48,
  },
  historyLevel: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
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

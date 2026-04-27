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
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sosApi } from '../../services/api';
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

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

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
              />
            ) : (
              <Text style={styles.noDataText}>
                해열제 정보를 불러올 수 없습니다.
              </Text>
            )}
          </View>
        )}

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
      <AdSlot />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function MedicineSection({
  dose,
  onSchedule,
}: {
  dose: MedicineDose;
  onSchedule: (minutes: number, label: string) => void;
}) {
  return (
    <View style={styles.medicineContainer}>
      {/* Weight basis */}
      <View style={styles.weightRow}>
        <Text style={styles.weightLabel}>체중 기준</Text>
        <Text style={styles.weightValue}>{dose.childWeight}kg</Text>
      </View>

      {/* Tylenol (acetaminophen) */}
      <View style={styles.medicineRow}>
        <View style={[styles.medicineBadge, { backgroundColor: '#E3F2FD' }]}>
          <Text style={[styles.medicineBadgeText, { color: TYLENOL_COLOR }]}>
            타이레놀
          </Text>
        </View>
        <View style={styles.medicineDoseWrap}>
          <Text style={styles.medicineDoseText}>
            {dose.acetaminophen.doseMg}
          </Text>
          <Text style={styles.medicineSyrup}>
            {dose.acetaminophen.syrupMl}
          </Text>
          <Text style={[styles.medicineInterval, { color: TYLENOL_COLOR }]}>
            {dose.acetaminophen.interval} / {dose.acetaminophen.maxDaily}
          </Text>
        </View>
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
        <View style={styles.medicineDoseWrap}>
          <Text style={styles.medicineDoseText}>
            {dose.ibuprofen.doseMg}
          </Text>
          <Text style={styles.medicineSyrup}>
            {dose.ibuprofen.syrupMl}
          </Text>
          <Text style={[styles.medicineInterval, { color: BRUFEN_COLOR }]}>
            {dose.ibuprofen.interval} / {dose.ibuprofen.maxDaily}
          </Text>
        </View>
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

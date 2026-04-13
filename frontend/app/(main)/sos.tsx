import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sosApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type SeverityLevel = 'EMERGENCY' | 'HOSPITAL' | 'URGENT' | 'MONITOR';

interface SymptomCheckResult {
  urgency: SeverityLevel;
  message: string;
  actions: string[];
  showEmergencyCall: boolean;
}

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

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const EMERGENCY_RED = '#FF3B30';
const HOSPITAL_ORANGE = '#FF9500';
const URGENT_YELLOW = '#FFCC00';
const MONITOR_GREEN = '#34C759';

const COLOR = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  text: '#2D2016',
  textSub: '#8C7A6B',
  textLight: '#B5A99A',
  border: '#F0E6DA',
  accent: '#FF8C5A',
};

interface SymptomItem {
  id: string;
  emoji: string;
  label: string;
}

const SYMPTOMS: SymptomItem[] = [
  { id: 'fever', emoji: '🌡️', label: '발열 38+' },
  { id: 'vomiting', emoji: '🤢', label: '구토/설사' },
  { id: 'seizure', emoji: '⚡', label: '경련' },
  { id: 'breathing', emoji: '💨', label: '호흡곤란' },
  { id: 'bleeding', emoji: '🩸', label: '출혈/상처' },
  { id: 'rash', emoji: '🔴', label: '발진/두드러기' },
];

const PREGNANCY_SYMPTOMS: SymptomItem[] = [
  { id: 'bleeding', emoji: '🩸', label: '출혈' },
  { id: 'severe_pain', emoji: '😣', label: '심한 복통' },
  { id: 'headache', emoji: '🤕', label: '심한 두통' },
  { id: 'swelling', emoji: '🦶', label: '심한 부종' },
  { id: 'vision', emoji: '👁️', label: '시야 흐림' },
  { id: 'leaking', emoji: '💧', label: '양수 파수' },
  { id: 'no_movement', emoji: '🤰', label: '태동 감소' },
  { id: 'fever', emoji: '🌡️', label: '발열 38+' },
  { id: 'breathing', emoji: '💨', label: '호흡곤란' },
  { id: 'contractions', emoji: '⏱️', label: '규칙적 수축' },
];

const SEVERITY_CONFIG: Record<SeverityLevel, {
  bg: string;
  border: string;
  textColor: string;
  title: string;
}> = {
  EMERGENCY: {
    bg: '#FFF0F0',
    border: EMERGENCY_RED,
    textColor: EMERGENCY_RED,
    title: '즉시 119 전화하세요',
  },
  HOSPITAL: {
    bg: '#FFF8F0',
    border: HOSPITAL_ORANGE,
    textColor: HOSPITAL_ORANGE,
    title: '병원 방문을 권합니다',
  },
  URGENT: {
    bg: '#FFFDF0',
    border: URGENT_YELLOW,
    textColor: '#B8860B',
    title: '조치가 필요합니다',
  },
  MONITOR: {
    bg: '#F0FFF4',
    border: MONITOR_GREEN,
    textColor: MONITOR_GREEN,
    title: '관찰하세요',
  },
};

/* ------------------------------------------------------------------ */
/* Main Screen                                                         */
/* ------------------------------------------------------------------ */

export default function SOSScreen() {
  const insets = useSafeAreaInsets();
  const { selectedChild } = useChildStore();
  const isPregnant = selectedChild?.isPregnant === true;
  const activeSymptoms = isPregnant ? PREGNANCY_SYMPTOMS : SYMPTOMS;

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [temperature, setTemperature] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<SymptomCheckResult | null>(null);

  const [showFeverCalc, setShowFeverCalc] = useState(false);
  const [feverLoading, setFeverLoading] = useState(false);
  const [medicineDose, setMedicineDose] = useState<MedicineDose | null>(null);

  const [notifyingFamily, setNotifyingFamily] = useState(false);

  /* -- Symptom toggle -- */
  const toggleSymptom = useCallback((id: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
    setResult(null);
  }, []);

  /* -- Call 119 -- */
  const call119 = useCallback(() => {
    Linking.openURL('tel:119').catch(() => {
      Alert.alert('전화 연결 실패', '전화 앱을 열 수 없습니다. 직접 119를 눌러주세요.');
    });
  }, []);

  /* -- Check symptoms -- */
  const checkSymptoms = useCallback(async () => {
    if (selectedSymptoms.length === 0) {
      Alert.alert('증상 선택', '하나 이상의 증상을 선택해주세요.');
      return;
    }
    if (!selectedChild) {
      Alert.alert('아이 선택', '먼저 아이를 선택해주세요.');
      return;
    }

    setChecking(true);
    try {
      const temp = temperature ? parseFloat(temperature) : undefined;
      const res = await sosApi.checkSymptom(
        selectedChild.id,
        selectedSymptoms,
        temp,
      );
      const data = res.data?.data as SymptomCheckResult | undefined;
      if (data) {
        setResult(data);
        if (!isPregnant && temp && temp >= 37.5) {
          setShowFeverCalc(true);
          loadMedicineDose();
        }
      }
    } catch {
      Alert.alert('오류', '증상 확인 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setChecking(false);
    }
  }, [selectedSymptoms, selectedChild, temperature]);

  /* -- Load medicine dose -- */
  const loadMedicineDose = useCallback(async () => {
    if (!selectedChild) return;
    setFeverLoading(true);
    try {
      const temp = temperature ? parseFloat(temperature) : undefined;
      const res = await sosApi.feverCalculator(selectedChild.id, temp);
      const data = res.data?.data as MedicineDose | undefined;
      if (data) {
        setMedicineDose(data);
      }
    } catch {
      Alert.alert('오류', '해열제 정보를 불러올 수 없습니다.');
    } finally {
      setFeverLoading(false);
    }
  }, [selectedChild, temperature]);

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
          body: `${label} 복용 시간입니다.`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: minutes * 60,
          repeats: false,
        },
      });
      Alert.alert('알림 설정 완료', `${minutes}분 후 알림이 실행됩니다.`);
    } catch {
      Alert.alert('알림 오류', '알림을 설정할 수 없습니다.');
    }
  }, []);

  /* -- Notify family -- */
  const notifyFamily = useCallback(async () => {
    if (!selectedChild) return;
    setNotifyingFamily(true);
    try {
      const symptomLabels = selectedSymptoms
        .map((id) => activeSymptoms.find((s) => s.id === id)?.label ?? id)
        .join(', ');
      const situation = temperature
        ? `${symptomLabels} (체온 ${temperature}도)`
        : symptomLabels;
      await sosApi.notifyFamily(selectedChild.id, situation);
      Alert.alert('알림 완료', '가족에게 알림을 보냈습니다.');
    } catch {
      Alert.alert('오류', '가족 알림에 실패했습니다.');
    } finally {
      setNotifyingFamily(false);
    }
  }, [selectedChild, selectedSymptoms, temperature]);

  /* -- Open hospital map -- */
  const openHospitalMap = useCallback(() => {
    const query = isPregnant ? '산부인과+응급' : '소아과+응급';
    Linking.openURL(`https://map.kakao.com/link/search/${query}`).catch(() => {
      Alert.alert('오류', '지도 앱을 열 수 없습니다.');
    });
  }, [isPregnant]);

  /* -- Render -- */
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* == Title Bar == */}
        <View style={styles.titleBar}>
          <Text style={styles.screenTitle}>SOS</Text>
          <Text style={styles.screenSubtitle}>
            {selectedChild ? (isPregnant ? `${selectedChild.name} 엄마` : selectedChild.name) : '응급 도우미'}
          </Text>
        </View>

        {/* ============================================ */}
        {/* Section 1: Emergency Call                    */}
        {/* ============================================ */}
        <View style={styles.emergencySection}>
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={call119}
            activeOpacity={0.8}
          >
            <Text style={styles.emergencyButtonIcon}>{'🚨'}</Text>
            <Text style={styles.emergencyButtonText}>119 응급전화</Text>
          </TouchableOpacity>
          <Text style={styles.emergencySubtitle}>
            응급 상황이면 먼저 전화하세요
          </Text>
        </View>

        {/* ============================================ */}
        {/* Section 2: Symptom Quick Checker             */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>증상 빠른 확인</Text>
          <Text style={styles.sectionDesc}>
            {isPregnant ? '엄마/태아 관련 증상을 선택해주세요' : '해당하는 증상을 모두 선택해주세요'}
          </Text>

          <View style={styles.symptomGrid}>
            {activeSymptoms.map((symptom) => {
              const isSelected = selectedSymptoms.includes(symptom.id);
              return (
                <TouchableOpacity
                  key={symptom.id}
                  style={[
                    styles.symptomButton,
                    isSelected && styles.symptomButtonSelected,
                  ]}
                  onPress={() => toggleSymptom(symptom.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.symptomEmoji}>{symptom.emoji}</Text>
                  <Text
                    style={[
                      styles.symptomLabel,
                      isSelected && styles.symptomLabelSelected,
                    ]}
                  >
                    {symptom.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Temperature input */}
          <View style={styles.tempRow}>
            <Text style={styles.tempLabel}>체온 (선택사항)</Text>
            <View style={styles.tempInputWrap}>
              <TextInput
                style={styles.tempInput}
                placeholder="37.5"
                placeholderTextColor={COLOR.textLight}
                keyboardType="decimal-pad"
                value={temperature}
                onChangeText={setTemperature}
                maxLength={5}
              />
              <Text style={styles.tempUnit}>{'°C'}</Text>
            </View>
          </View>

          {/* Check button */}
          <TouchableOpacity
            style={[
              styles.checkButton,
              selectedSymptoms.length === 0 && styles.checkButtonDisabled,
            ]}
            onPress={checkSymptoms}
            activeOpacity={0.8}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.checkButtonText}>증상 확인</Text>
            )}
          </TouchableOpacity>

          {/* Result card */}
          {result && <ResultCard result={result} onCall119={call119} onOpenMap={openHospitalMap} />}
        </View>

        {/* ============================================ */}
        {/* Section 3: Fever Medicine Calculator (아기만) */}
        {/* ============================================ */}
        {!isPregnant && !showFeverCalc && (
          <TouchableOpacity
            style={styles.feverCalcToggle}
            onPress={() => {
              setShowFeverCalc(true);
              if (!medicineDose) loadMedicineDose();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.feverCalcToggleIcon}>{'💊'}</Text>
            <Text style={styles.feverCalcToggleText}>해열제 계산기</Text>
          </TouchableOpacity>
        )}

        {!isPregnant && showFeverCalc && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>해열제 계산기</Text>
            {feverLoading ? (
              <ActivityIndicator
                color={COLOR.accent}
                size="large"
                style={styles.loadingIndicator}
              />
            ) : medicineDose ? (
              <MedicineCard
                dose={medicineDose}
                onScheduleNotification={scheduleNotification}
              />
            ) : (
              <Text style={styles.noDataText}>
                아이 정보를 불러올 수 없습니다.
              </Text>
            )}
          </View>
        )}

        {/* ============================================ */}
        {/* Section 4: Quick Actions                     */}
        {/* ============================================ */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={openHospitalMap}
            activeOpacity={0.7}
          >
            <Text style={styles.quickActionIcon}>{'🏥'}</Text>
            <Text style={styles.quickActionText}>{isPregnant ? '가까운 산부인과 찾기' : '가까운 병원 찾기'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={notifyFamily}
            activeOpacity={0.7}
            disabled={notifyingFamily}
          >
            {notifyingFamily ? (
              <ActivityIndicator color={COLOR.accent} size="small" />
            ) : (
              <>
                <Text style={styles.quickActionIcon}>{'👨‍👩‍👧'}</Text>
                <Text style={styles.quickActionText}>가족에게 알리기</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ResultCard({
  result,
  onCall119,
  onOpenMap,
}: {
  result: SymptomCheckResult;
  onCall119: () => void;
  onOpenMap: () => void;
}) {
  const config = SEVERITY_CONFIG[result.urgency];

  return (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: config.bg, borderColor: config.border },
      ]}
    >
      <Text style={[styles.resultTitle, { color: config.textColor }]}>
        {config.title}
      </Text>
      <Text style={styles.resultMessage}>{result.message}</Text>

      {result.actions.length > 0 && (
        <View style={styles.resultActions}>
          {result.actions.map((action, idx) => (
            <View key={`action-${idx}`} style={styles.resultActionRow}>
              <Text style={[styles.resultBullet, { color: config.border }]}>
                {'•'}
              </Text>
              <Text style={styles.resultActionText}>{action}</Text>
            </View>
          ))}
        </View>
      )}

      {result.urgency === 'EMERGENCY' && (
        <TouchableOpacity
          style={[styles.resultBtn, { backgroundColor: EMERGENCY_RED }]}
          onPress={onCall119}
          activeOpacity={0.8}
        >
          <Text style={styles.resultBtnText}>119 전화하기</Text>
        </TouchableOpacity>
      )}

      {(result.urgency === 'URGENT' || result.urgency === 'HOSPITAL') && (
        <TouchableOpacity
          style={[styles.resultBtn, { backgroundColor: config.border }]}
          onPress={onOpenMap}
          activeOpacity={0.8}
        >
          <Text style={styles.resultBtnText}>가까운 병원 찾기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MedicineCard({
  dose,
  onScheduleNotification,
}: {
  dose: MedicineDose;
  onScheduleNotification: (minutes: number, label: string) => void;
}) {
  return (
    <View style={styles.medicineCard}>
      {/* 체중 기준 */}
      <View style={styles.weightRow}>
        <Text style={styles.weightLabel}>체중 기준</Text>
        <Text style={styles.weightValue}>{dose.childWeight}kg</Text>
      </View>

      {/* Tylenol (acetaminophen) */}
      <View style={styles.medicineRow}>
        <View style={[styles.medicineBadge, { backgroundColor: '#E3F2FD' }]}>
          <Text style={[styles.medicineBadgeText, { color: '#1565C0' }]}>
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
          <Text style={styles.medicineInterval}>
            {dose.acetaminophen.interval} / {dose.acetaminophen.maxDaily}
          </Text>
        </View>
      </View>

      {/* Ibuprofen */}
      <View style={styles.medicineRow}>
        <View style={[styles.medicineBadge, { backgroundColor: '#FFF3E0' }]}>
          <Text style={[styles.medicineBadgeText, { color: '#E65100' }]}>
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
          <Text style={styles.medicineInterval}>
            {dose.ibuprofen.interval} / {dose.ibuprofen.maxDaily}
          </Text>
        </View>
      </View>

      {/* Age restriction warning */}
      {dose.ibuprofen.ageRestriction && (
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>{'⚠️'}</Text>
          <Text style={styles.warningText}>
            {dose.ibuprofen.ageRestriction}
          </Text>
        </View>
      )}

      {/* Schedule */}
      {dose.alternatingSchedule.length > 0 && (
        <View style={styles.scheduleSection}>
          <Text style={styles.scheduleTitle}>교대 복용 스케줄</Text>
          {dose.alternatingSchedule.map((item, idx) => (
            <View key={`sched-${idx}`} style={styles.scheduleRow}>
              <View
                style={[
                  styles.scheduleIndicator,
                  { backgroundColor: idx % 2 === 0 ? '#1565C0' : '#E65100' },
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

      {/* Notification button */}
      <TouchableOpacity
        style={styles.notifyBtn}
        onPress={() => onScheduleNotification(240, '해열제')}
        activeOpacity={0.7}
      >
        <Text style={styles.notifyBtnIcon}>{'🔔'}</Text>
        <Text style={styles.notifyBtnText}>다음 복용 알림 설정</Text>
      </TouchableOpacity>
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

  /* Title Bar */
  titleBar: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingVertical: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: EMERGENCY_RED,
  },
  screenSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.textSub,
  },

  /* Section 1: Emergency */
  emergencySection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  emergencyButton: {
    backgroundColor: EMERGENCY_RED,
    width: '100%',
    paddingVertical: 22,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: EMERGENCY_RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  emergencyButtonIcon: {
    fontSize: 28,
  },
  emergencyButtonText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emergencySubtitle: {
    fontSize: 13,
    color: COLOR.textSub,
    marginTop: 10,
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

  /* Symptom grid */
  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  symptomButton: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#F8F5F2',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 48,
  },
  symptomButtonSelected: {
    backgroundColor: '#FFF0F0',
    borderColor: EMERGENCY_RED,
  },
  symptomEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  symptomLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.text,
    textAlign: 'center',
  },
  symptomLabelSelected: {
    color: EMERGENCY_RED,
    fontWeight: '700',
  },

  /* Temperature */
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tempLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLOR.text,
  },
  tempInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F5F2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  tempInput: {
    fontSize: 16,
    fontWeight: '600',
    color: COLOR.text,
    width: 60,
    textAlign: 'center',
  },
  tempUnit: {
    fontSize: 14,
    color: COLOR.textSub,
    marginLeft: 4,
  },

  /* Check button */
  checkButton: {
    backgroundColor: EMERGENCY_RED,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  checkButtonDisabled: {
    backgroundColor: '#D4C8BC',
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Result card */
  resultCard: {
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
    borderWidth: 2,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  resultMessage: {
    fontSize: 14,
    color: COLOR.text,
    lineHeight: 22,
    marginBottom: 10,
  },
  resultActions: {
    marginBottom: 12,
  },
  resultActionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  resultBullet: {
    fontSize: 16,
    marginRight: 8,
    lineHeight: 22,
  },
  resultActionText: {
    flex: 1,
    fontSize: 14,
    color: COLOR.text,
    lineHeight: 22,
  },
  resultBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    minHeight: 48,
  },
  resultBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Fever calc toggle */
  feverCalcToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLOR.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderStyle: 'dashed',
  },
  feverCalcToggleIcon: {
    fontSize: 20,
  },
  feverCalcToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.accent,
  },

  /* Medicine card */
  medicineCard: {
    marginTop: 12,
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
  medicineInterval: {
    fontSize: 12,
    color: COLOR.accent,
    marginTop: 2,
    fontWeight: '500',
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  medicineBadge: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 72,
    alignItems: 'center',
  },
  medicineBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  medicineDoseWrap: {
    flex: 1,
  },
  medicineDoseText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLOR.text,
  },
  medicineSyrup: {
    fontSize: 13,
    color: COLOR.textSub,
    marginTop: 2,
  },

  /* Warning */
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#B8860B',
    lineHeight: 20,
  },

  /* Schedule */
  scheduleSection: {
    marginBottom: 12,
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
    lineHeight: 20,
  },

  /* Notify button */
  notifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    paddingVertical: 14,
    minHeight: 48,
  },
  notifyBtnIcon: {
    fontSize: 16,
  },
  notifyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
  },

  /* Quick Actions */
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: COLOR.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLOR.border,
    minHeight: 80,
  },
  quickActionIcon: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.text,
    textAlign: 'center',
  },

  /* Loading */
  loadingIndicator: {
    marginVertical: 24,
  },
  noDataText: {
    fontSize: 14,
    color: COLOR.textSub,
    textAlign: 'center',
    marginVertical: 16,
  },
});

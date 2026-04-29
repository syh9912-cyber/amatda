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
  Modal,
  Image,
  Dimensions,
  ImageSourcePropType,
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

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const EMERGENCY_RED = '#FF3B30';
const HOSPITAL_ORANGE = '#FF9500';
const URGENT_YELLOW = '#FFCC00';
const MONITOR_GREEN = '#34C759';

const COLOR = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#ABABAB',
  border: '#E5E5EA',
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
/* Emergency Guide Data                                                */
/* ------------------------------------------------------------------ */

const SOS_IMAGES: Record<string, ImageSourcePropType> = {
  heimlich: require('../../assets/sos-heimlich.png'),
  cpr: require('../../assets/sos-cpr.png'),
  burn_fall: require('../../assets/sos-burn-fall.png'),
  foreign: require('../../assets/sos-foreign.png'),
};

const EMERGENCY_GUIDES = [
  { key: 'heimlich', emoji: '🫁', label: '하임리히', sublabel: '기도막힘 대처법', color: '#D32F2F', bg: '#FFEBEE' },
  { key: 'cpr', emoji: '❤️', label: 'CPR', sublabel: '심폐소생술', color: '#C62828', bg: '#FCE4EC' },
  { key: 'burn_fall', emoji: '🔥', label: '화상/낙상', sublabel: '', color: '#E65100', bg: '#FFF3E0' },
  { key: 'foreign', emoji: '⚠️', label: '이물질', sublabel: '', color: '#F57F17', bg: '#FFFDE7' },
] as const;

interface GuideData {
  title: string;
  subtitle: string;
  headerColor: string;
  quickSteps: string[];
  warning: string;
}

const GUIDE_CONTENT: Record<string, GuideData> = {
  heimlich: {
    title: '하임리히법 (기도 폐쇄)',
    subtitle: '아이가 이물질로 숨을 못 쉴 때',
    headerColor: '#D32F2F',
    quickSteps: [
      '1세 미만: 얼굴 아래로 → 등 5회 두드리기',
      '뒤집어서 가슴 중앙 손가락 2개로 5회 압박',
      '1세 이상: 뒤에서 배꼽 위 주먹으로 밀어올리기',
      '나올 때까지 반복! 의식 잃으면 CPR + 119',
    ],
    warning: '손가락으로 억지로 빼지 마세요! 의식 잃으면 즉시 CPR',
  },
  cpr: {
    title: '심폐소생술 (CPR)',
    subtitle: '아이가 반응 없거나 숨을 안 쉴 때',
    headerColor: '#C62828',
    quickSteps: [
      '반응 확인 → 즉시 119 신고 (스피커폰)',
      '머리 뒤로 젖혀 기도 열기',
      '가슴 중앙 압박 30회 (깊이 4~5cm, 분당 100~120)',
      '인공호흡 2회 → 30:2 반복, 멈추지 않기!',
    ],
    warning: '구급대 올 때까지 절대 멈추면 안 됩니다!',
  },
  burn_fall: {
    title: '화상/낙상 대처',
    subtitle: '데이거나 떨어졌을 때',
    headerColor: '#E65100',
    quickSteps: [
      '화상: 흐르는 찬물 10분 이상 (얼음 금지!)',
      '연고/된장/치약 바르지 않기, 물집 터뜨리지 않기',
      '낙상: 바로 일으키지 말고 그 자리에서 안정',
      '머리 부딪혔으면 24시간 관찰 (구토/경련 시 응급실)',
    ],
    warning: '2도 이상 화상/넓은 범위/의식 변화 → 즉시 119',
  },
  foreign: {
    title: '이물질 삼킴/삽입',
    subtitle: '아이가 이물질을 삼키거나 넣었을 때',
    headerColor: '#F57F17',
    quickSteps: [
      '억지로 빼내지 않기 (더 깊이 들어감)',
      '코: 반대쪽 막고 훌! 불기, 안 나오면 병원',
      '귀: 면봉/핀셋 금지, 병원으로',
      '배터리/자석 삼킴 → 즉시 응급실! (구토 유도 금지)',
    ],
    warning: '배터리/자석은 2시간 내 장 천공 가능! 즉시 응급실',
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

  const [notifyingFamily, setNotifyingFamily] = useState(false);
  const [guideKey, setGuideKey] = useState<string | null>(null);

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
      }
    } catch {
      Alert.alert('오류', '증상 확인 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setChecking(false);
    }
  }, [selectedSymptoms, selectedChild, temperature]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {/* Section 2: Emergency Guides                  */}
        {/* ============================================ */}
        {/* 임신부 모드에서는 영유아용 응급 대처(하임리히/CPR/화상/이물질) 숨김 */}
        {!isPregnant && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>응급 대처법</Text>
          <Text style={styles.sectionDesc}>
            버튼을 누르면 대처 방법을 바로 확인할 수 있어요
          </Text>
          <View style={styles.guideGrid}>
            {EMERGENCY_GUIDES.map((g) => (
              <TouchableOpacity
                key={g.key}
                style={[styles.guideBtn, { backgroundColor: g.bg }]}
                onPress={() => setGuideKey(g.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.guideBtnEmoji}>{g.emoji}</Text>
                <Text style={[styles.guideBtnLabel, { color: g.color }]}>{g.label}</Text>
                {g.sublabel ? (
                  <Text style={[styles.guideBtnSublabel, { color: g.color }]}>{g.sublabel}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
        )}

        {/* Emergency Guide Modal */}
        <EmergencyGuideModal
          guideKey={guideKey}
          onClose={() => setGuideKey(null)}
        />

        {/* ============================================ */}
        {/* Section 3: Symptom Quick Checker             */}
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

/* ------------------------------------------------------------------ */
/* Emergency Guide Modal (이미지 중심)                                  */
/* ------------------------------------------------------------------ */

const SCREEN_WIDTH = Dimensions.get('window').width;

function EmergencyGuideModal({ guideKey, onClose }: { guideKey: string | null; onClose: () => void }) {
  if (!guideKey) return null;
  const guide = GUIDE_CONTENT[guideKey];
  const img = SOS_IMAGES[guideKey];
  if (!guide || !img) return null;

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={guideStyles.container}>
        {/* 닫기 버튼 (항상 위에) */}
        <TouchableOpacity style={guideStyles.closeBtn} onPress={onClose} hitSlop={16}>
          <Text style={guideStyles.closeBtnText}>{'X'}</Text>
        </TouchableOpacity>

        <ScrollView
          style={guideStyles.scroll}
          contentContainerStyle={guideStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 제목 */}
          <View style={[guideStyles.titleBar, { backgroundColor: guide.headerColor }]}>
            <Text style={guideStyles.titleText}>{guide.title}</Text>
            <Text style={guideStyles.subtitleText}>{guide.subtitle}</Text>
          </View>

          {/* 이미지 (핵심!) */}
          <View style={guideStyles.imageWrap}>
            <Image
              source={img}
              style={guideStyles.guideImage}
              resizeMode="contain"
            />
          </View>

          {/* 빠른 요약 텍스트 */}
          <View style={guideStyles.stepsCard}>
            {guide.quickSteps.map((step, idx) => (
              <View key={`qs-${idx}`} style={guideStyles.stepRow}>
                <View style={[guideStyles.stepDot, { backgroundColor: guide.headerColor }]}>
                  <Text style={guideStyles.stepDotText}>{idx + 1}</Text>
                </View>
                <Text style={guideStyles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          {/* 경고 */}
          <View style={guideStyles.warningCard}>
            <Text style={guideStyles.warningIcon}>{'⚠️'}</Text>
            <Text style={guideStyles.warningText}>{guide.warning}</Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* 119 고정 버튼 (하단) */}
        <View style={guideStyles.bottomBar}>
          <TouchableOpacity
            style={guideStyles.call119Btn}
            onPress={() =>
              Linking.openURL('tel:119').catch((err) => {
                console.error('[sos] tel:119 failed', err);
                Alert.alert('전화 연결 실패', '직접 119로 전화해주세요.');
              })
            }
            activeOpacity={0.8}
          >
            <Text style={guideStyles.call119Text}>{'🚨  119 응급전화'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const guideStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5F2' },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  titleBar: {
    paddingTop: 54,
    paddingBottom: 18,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  titleText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  subtitleText: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.85)' },
  imageWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 1,
  },
  guideImage: {
    width: SCREEN_WIDTH - 56,
    height: SCREEN_WIDTH - 56,
  },
  stepsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  stepDotText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  stepText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1C1C1E', lineHeight: 21 },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  warningIcon: { fontSize: 20, marginRight: 10 },
  warningText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#E65100', lineHeight: 20 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: 'rgba(248,245,242,0.95)',
  },
  call119Btn: {
    backgroundColor: EMERGENCY_RED,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  call119Text: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
});

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
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

  /* Emergency Guide grid */
  guideGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  guideBtn: {
    width: '48%',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  guideBtnEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  guideBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  guideBtnSublabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.85,
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
});

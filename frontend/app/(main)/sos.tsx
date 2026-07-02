import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
import { BackButton } from '../../components/common/BackButton';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { GuideButton } from '../../components/common/GuideButton';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import { getSosGuide } from '../../features/guide/sosGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sosApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { useLocationStore } from '../../stores/locationStore';
import { pickDeliveryPhone, getHospital, type HospitalInfo } from '../../services/deliveryHospital';
import { HospitalRegisterModal } from '../../components/pregnancy/HospitalRegisterModal';
import { captureError } from '../../services/sentry';

/* PNG 아이콘 (기본 이모지 대신 — 앱 일러스트 톤 통일) */
const IC_THERMOMETER = require('../../assets/quick-thermometer.png') as ImageSourcePropType;
const IC_NAUSEA = require('../../assets/preg-mood-nausea.png') as ImageSourcePropType;
const IC_REDFLAG = require('../../assets/icon-redflag.png') as ImageSourcePropType;
const IC_BLOOD = require('../../assets/quick-blood.png') as ImageSourcePropType;
const IC_PAIN = require('../../assets/preg-mood-pain.png') as ImageSourcePropType;
const IC_TIRED = require('../../assets/preg-mood-tired.png') as ImageSourcePropType;
const IC_FOOT = require('../../assets/preg-foot.png') as ImageSourcePropType;
const IC_WATER = require('../../assets/quick-water.png') as ImageSourcePropType;
const IC_PREG = require('../../assets/preg-test.png') as ImageSourcePropType;
const IC_CONTRACTION = require('../../assets/contraction-clock.png') as ImageSourcePropType;
const IC_HOSPITAL = require('../../assets/icon-hospital.png') as ImageSourcePropType;
const IC_FAMILY = require('../../assets/mascot-happy.png') as ImageSourcePropType;
const IC_HEART = require('../../assets/icon-heart.png') as ImageSourcePropType;
const IC_HEIMLICH = require('../../assets/sos/heimlich-infant-1.webp') as ImageSourcePropType;
const IC_CPR = require('../../assets/sos/cpr-infant-1.webp') as ImageSourcePropType;
const IC_BURN = require('../../assets/sos/burn_fall-1.webp') as ImageSourcePropType;
const IC_FOREIGN = require('../../assets/sos/foreign-1.webp') as ImageSourcePropType;

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
  icon: ImageSourcePropType;
  label: string;
}

const getSymptoms = (t: TFunction): SymptomItem[] => [
  { id: 'fever', icon: IC_THERMOMETER, label: t('sos.symptom.fever') },
  { id: 'vomiting', icon: IC_NAUSEA, label: t('sos.symptom.vomiting') },
  { id: 'seizure', icon: IC_REDFLAG, label: t('sos.symptom.seizure') },
  { id: 'breathing', icon: IC_TIRED, label: t('sos.symptom.breathing') },
  { id: 'bleeding', icon: IC_BLOOD, label: t('sos.symptom.bleedingWound') },
  { id: 'rash', icon: IC_REDFLAG, label: t('sos.symptom.rash') },
];

const getPregnancySymptoms = (t: TFunction): SymptomItem[] => [
  { id: 'bleeding', icon: IC_BLOOD, label: t('sos.symptom.bleeding') },
  { id: 'severe_pain', icon: IC_PAIN, label: t('sos.symptom.severePain') },
  { id: 'headache', icon: IC_PAIN, label: t('sos.symptom.severeHeadache') },
  { id: 'swelling', icon: IC_FOOT, label: t('sos.symptom.severeSwelling') },
  { id: 'vision', icon: IC_REDFLAG, label: t('sos.symptom.blurryVision') },
  { id: 'leaking', icon: IC_WATER, label: t('sos.symptom.waterBreaking') },
  { id: 'no_movement', icon: IC_PREG, label: t('sos.symptom.reducedMovement') },
  { id: 'fever', icon: IC_THERMOMETER, label: t('sos.symptom.fever38') },
  { id: 'breathing', icon: IC_TIRED, label: t('sos.symptom.breathing') },
  { id: 'contractions', icon: IC_CONTRACTION, label: t('sos.symptom.regularContractions') },
];

const getSeverityConfig = (t: TFunction): Record<SeverityLevel, {
  bg: string;
  border: string;
  textColor: string;
  title: string;
}> => ({
  EMERGENCY: {
    bg: '#FFF0F0',
    border: EMERGENCY_RED,
    textColor: EMERGENCY_RED,
    title: t('sos.severity.emergencyTitle'),
  },
  HOSPITAL: {
    bg: '#FFF8F0',
    border: HOSPITAL_ORANGE,
    textColor: HOSPITAL_ORANGE,
    title: t('sos.severity.hospitalTitle'),
  },
  URGENT: {
    bg: '#FFFDF0',
    border: URGENT_YELLOW,
    textColor: '#B8860B',
    title: t('sos.severity.urgentTitle'),
  },
  MONITOR: {
    bg: '#F0FFF4',
    border: MONITOR_GREEN,
    textColor: MONITOR_GREEN,
    title: t('sos.severity.monitorTitle'),
  },
});

/* ------------------------------------------------------------------ */
/* Emergency Guide Data                                                */
/* ------------------------------------------------------------------ */

/** 4-패널 분할 이미지 (영유아 기준 — 각 패널이 한 step. 텍스트가 이미지에 포함됨) */
const SOS_STEP_IMAGES: Record<string, ImageSourcePropType[]> = {
  heimlich: [
    require('../../assets/sos/heimlich-infant-1.webp'),
    require('../../assets/sos/heimlich-infant-2.webp'),
    require('../../assets/sos/heimlich-infant-3.webp'),
    require('../../assets/sos/heimlich-infant-4.webp'),
  ],
  cpr: [
    require('../../assets/sos/cpr-infant-1.webp'),
    require('../../assets/sos/cpr-infant-2.webp'),
    require('../../assets/sos/cpr-infant-3.webp'),
    require('../../assets/sos/cpr-infant-4.webp'),
  ],
  burn_fall: [
    require('../../assets/sos/burn_fall-1.webp'),
    require('../../assets/sos/burn_fall-2.webp'),
    require('../../assets/sos/burn_fall-3.webp'),
    require('../../assets/sos/burn_fall-4.webp'),
  ],
  foreign: [
    require('../../assets/sos/foreign-1.webp'),
    require('../../assets/sos/foreign-2.webp'),
    require('../../assets/sos/foreign-3.webp'),
    require('../../assets/sos/foreign-4.webp'),
  ],
};

/**
 * 각 step 이미지의 실제 aspect ratio (width / height).
 * PNG 원본 dimension 기반 (모두 width=941, height만 다름).
 *
 * 컨테이너에 고정 aspectRatio 를 두면 letterbox 가 생기거나 잘림이 발생.
 * 이미지마다 자기 비율로 표시하기 위해 매핑.
 */
const STEP_IMAGE_ASPECTS: Record<string, number[]> = {
  heimlich: [941 / 482, 941 / 439, 941 / 404, 941 / 347],
  cpr:      [941 / 452, 941 / 429, 941 / 380, 941 / 411],
  burn_fall:[941 / 468, 941 / 438, 941 / 382, 941 / 384],
  foreign:  [941 / 456, 941 / 441, 941 / 412, 941 / 363],
};

const getEmergencyGuides = (t: TFunction) => [
  { key: 'heimlich', icon: IC_HEIMLICH, label: t('sos.guide.heimlichLabel'), sublabel: t('sos.guide.heimlichSublabel'), color: '#D32F2F', bg: '#FFEBEE' },
  { key: 'cpr', icon: IC_CPR, label: 'CPR', sublabel: t('sos.guide.cprSublabel'), color: '#C62828', bg: '#FCE4EC' },
  { key: 'burn_fall', icon: IC_BURN, label: t('sos.guide.burnFallLabel'), sublabel: t('sos.guide.burnFallSublabel'), color: '#E65100', bg: '#FFF3E0' },
  { key: 'foreign', icon: IC_FOREIGN, label: t('sos.guide.foreignLabel'), sublabel: t('sos.guide.foreignSublabel'), color: '#F57F17', bg: '#FFFDE7' },
] as const;

type AgeKey = 'infant' | 'child' | 'adult';
const AGE_LABELS: Record<AgeKey, { title: string; sub: string }> = {
  infant: { title: '12개월 미만',         sub: '영아 (1세 미만)' },
  child:  { title: '만 1세 ~ 사춘기 전',  sub: '소아' },
  adult:  { title: '성인 · 보호자',       sub: '청소년/성인' },
};
const AGE_KEYS: AgeKey[] = ['infant', 'child', 'adult'];

interface GuideData {
  title: string;
  subtitle: string;
  headerColor: string;
  quickSteps: string[];
  warning: string;
}

/** heimlich/cpr 은 연령별로 분기 */
const getHeimlichByAge = (t: TFunction): Record<AgeKey, GuideData> => ({
  infant: {
    title: t('sos.heimlich.infant.title'),
    subtitle: t('sos.heimlich.infant.subtitle'),
    headerColor: '#D32F2F',
    quickSteps: [
      t('sos.heimlich.infant.step1'),
      t('sos.heimlich.infant.step2'),
      t('sos.heimlich.infant.step3'),
      t('sos.heimlich.infant.step4'),
      t('sos.heimlich.infant.step5'),
    ],
    warning: t('sos.heimlich.infant.warning'),
  },
  child: {
    title: t('sos.heimlich.child.title'),
    subtitle: t('sos.heimlich.child.subtitle'),
    headerColor: '#D32F2F',
    quickSteps: [
      t('sos.heimlich.child.step1'),
      t('sos.heimlich.child.step2'),
      t('sos.heimlich.child.step3'),
      t('sos.heimlich.child.step4'),
      t('sos.heimlich.child.step5'),
    ],
    warning: t('sos.heimlich.child.warning'),
  },
  adult: {
    title: t('sos.heimlich.adult.title'),
    subtitle: t('sos.heimlich.adult.subtitle'),
    headerColor: '#D32F2F',
    quickSteps: [
      t('sos.heimlich.adult.step1'),
      t('sos.heimlich.adult.step2'),
      t('sos.heimlich.adult.step3'),
      t('sos.heimlich.adult.step4'),
      t('sos.heimlich.adult.step5'),
    ],
    warning: t('sos.heimlich.adult.warning'),
  },
});

const getCprByAge = (t: TFunction): Record<AgeKey, GuideData> => ({
  infant: {
    title: t('sos.cpr.infant.title'),
    subtitle: t('sos.cpr.infant.subtitle'),
    headerColor: '#C62828',
    quickSteps: [
      t('sos.cpr.infant.step1'),
      t('sos.cpr.infant.step2'),
      t('sos.cpr.infant.step3'),
      t('sos.cpr.infant.step4'),
      t('sos.cpr.infant.step5'),
      t('sos.cpr.infant.step6'),
    ],
    warning: t('sos.cpr.infant.warning'),
  },
  child: {
    title: t('sos.cpr.child.title'),
    subtitle: t('sos.cpr.child.subtitle'),
    headerColor: '#C62828',
    quickSteps: [
      t('sos.cpr.child.step1'),
      t('sos.cpr.child.step2'),
      t('sos.cpr.child.step3'),
      t('sos.cpr.child.step4'),
      t('sos.cpr.child.step5'),
      t('sos.cpr.child.step6'),
    ],
    warning: t('sos.cpr.child.warning'),
  },
  adult: {
    title: t('sos.cpr.adult.title'),
    subtitle: t('sos.cpr.adult.subtitle'),
    headerColor: '#C62828',
    quickSteps: [
      t('sos.cpr.adult.step1'),
      t('sos.cpr.adult.step2'),
      t('sos.cpr.adult.step3'),
      t('sos.cpr.adult.step4'),
      t('sos.cpr.adult.step5'),
      t('sos.cpr.adult.step6'),
    ],
    warning: t('sos.cpr.adult.warning'),
  },
});

const getGuideContent = (t: TFunction): Record<string, GuideData> => ({
  burn_fall: {
    title: t('sos.burnFall.title'),
    subtitle: t('sos.burnFall.subtitle'),
    headerColor: '#E65100',
    quickSteps: [
      t('sos.burnFall.step1'),
      t('sos.burnFall.step2'),
      t('sos.burnFall.step3'),
      t('sos.burnFall.step4'),
    ],
    warning: t('sos.burnFall.warning'),
  },
  foreign: {
    title: t('sos.foreign.title'),
    subtitle: t('sos.foreign.subtitle'),
    headerColor: '#F57F17',
    quickSteps: [
      t('sos.foreign.step1'),
      t('sos.foreign.step2'),
      t('sos.foreign.step3'),
      t('sos.foreign.step4'),
    ],
    warning: t('sos.foreign.warning'),
  },
});

/* ------------------------------------------------------------------ */
/* Main Screen                                                         */
/* ------------------------------------------------------------------ */

export default function SOSScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { selectedChild } = useChildStore();
  const isPregnant = selectedChild?.isPregnant === true;
  const activeSymptoms = isPregnant ? getPregnancySymptoms(t) : getSymptoms(t);

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [temperature, setTemperature] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<SymptomCheckResult | null>(null);

  const [notifyingFamily, setNotifyingFamily] = useState(false);
  const [guideKey, setGuideKey] = useState<string | null>(null);

  // 분만실 전화 (임신부 모드 전용)
  const [deliveryHospital, setDeliveryHospital] = useState<HospitalInfo | null>(null);
  const [hospitalModalOpen, setHospitalModalOpen] = useState(false);

  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => { shouldAutoShowGuide('sos').then((sh) => { if (sh) setGuideVisible(true); }); }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('sos'); };

  const reloadDeliveryHospital = useCallback(async () => {
    if (!selectedChild?.id) {
      setDeliveryHospital(null);
      return;
    }
    // delivery 우선, 없으면 clinic
    const delivery = await getHospital(selectedChild.id, 'delivery');
    if (delivery) {
      setDeliveryHospital(delivery);
    } else {
      const clinic = await getHospital(selectedChild.id, 'clinic');
      setDeliveryHospital(clinic);
    }
  }, [selectedChild?.id]);

  useEffect(() => {
    if (isPregnant) reloadDeliveryHospital();
  }, [isPregnant, reloadDeliveryHospital]);

  const callDeliveryWard = useCallback(async () => {
    if (!selectedChild?.id) return;
    const picked = await pickDeliveryPhone(t, selectedChild.id);
    if (!picked) {
      // 등록된 번호 없음 → 등록 모달 열기
      Alert.alert(
        t('sos.alert.hospitalPhoneRequiredTitle'),
        t('sos.alert.hospitalPhoneRequiredMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('sos.alert.registerAction'), onPress: () => setHospitalModalOpen(true) },
        ],
      );
      return;
    }
    // #25: 국제번호 +82 보존
    const cleaned = picked.phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch((e) => {
      captureError(e, { ctx: 'sos/dialDelivery', phoneLast4: picked.phone.slice(-4) });
      Alert.alert(t('sos.alert.callFailedTitle'), t('sos.alert.callFailedWithPhone', { phone: picked.phone }));
    });
  }, [selectedChild?.id, t]);

  /* -- Symptom toggle -- */
  const toggleSymptom = useCallback((id: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
    setResult(null);
  }, []);

  /* -- Call 119 -- */
  const call119 = useCallback(() => {
    Linking.openURL('tel:119').catch((e) => {
      captureError(e, { ctx: 'sos/call119' });
      Alert.alert(t('sos.alert.callFailedTitle'), t('sos.alert.callFailedOpenApp'));
    });
  }, [t]);

  /* -- Check symptoms -- */
  const checkSymptoms = useCallback(async () => {
    if (selectedSymptoms.length === 0) {
      Alert.alert(t('sos.alert.symptomSelectTitle'), t('sos.alert.symptomSelectMessage'));
      return;
    }
    if (!selectedChild) {
      Alert.alert(t('sos.alert.childSelectTitle'), t('sos.alert.childSelectMessage'));
      return;
    }

    setChecking(true);
    setResult(null); // 새 검사 시작 — 직전 결과(예: 이전 '응급' 카드) 잔류 방지
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
      } else {
        Alert.alert(t('common.error'), t('sos.alert.checkResultMissing'));
      }
    } catch {
      Alert.alert(t('common.error'), t('sos.alert.checkError'));
    } finally {
      setChecking(false);
    }
  }, [selectedSymptoms, selectedChild, temperature, t]);

  /* -- Notify family -- */
  const notifyFamily = useCallback(async () => {
    if (!selectedChild) return;
    setNotifyingFamily(true);
    try {
      const symptomLabels = selectedSymptoms
        .map((id) => activeSymptoms.find((s) => s.id === id)?.label ?? id)
        .join(', ');
      const situation = temperature
        ? t('sos.familyNotify.situationWithTemp', { symptoms: symptomLabels, temp: temperature })
        : symptomLabels;
      await sosApi.notifyFamily(selectedChild.id, situation);
      Alert.alert(t('sos.alert.notifyDoneTitle'), t('sos.alert.notifyDoneMessage'));
    } catch {
      Alert.alert(t('common.error'), t('sos.alert.notifyError'));
    } finally {
      setNotifyingFamily(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild, selectedSymptoms, temperature, t]);

  /* -- Open hospital map --
   * 2026-05-08: 사용자 피드백 — 기존 '산부인과+응급'/'소아과+응급' 키워드는 카카오맵에서
   *   결과가 거의 안 나옴. 대학병원 응급실은 산부인과 MFICU·소아응급의료센터 모두 갖추고
   *   있어 가장 안전. 사용자 위치(시/구) 와 결합해 가까운 곳 우선 정렬.
   */
  const regionName = useLocationStore((s) => s.regionName);
  const requestLocation = useLocationStore((s) => s.requestLocation);

  // 첫 진입 시 위치 요청 (best-effort, 권한 거부되어도 기본 키워드로 작동)
  useEffect(() => {
    requestLocation().catch(() => {});
  }, [requestLocation]);

  const openHospitalMap = useCallback(() => {
    // 권한 거부 시 regionName 이 DEFAULT_REGION('남악') 일 수 있음 — 키워드만 사용
    const trimmedRegion = (regionName ?? '').trim();
    const isDefaultRegion = trimmedRegion === '' || trimmedRegion === '남악';
    const query = isDefaultRegion
      ? '대학병원 응급실'
      : `${trimmedRegion} 대학병원 응급실`;
    Linking.openURL(`https://map.kakao.com/link/search/${encodeURIComponent(query)}`).catch(() => {
      Alert.alert(t('common.error'), t('sos.alert.mapOpenError'));
    });
  }, [regionName, t]);

  /* -- Render -- */
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="SOS" right={<GuideButton onPress={() => setGuideVisible(true)} color="#DB6A5F" />} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* == Subtitle (child / 응급 도우미) == */}
        <View style={[styles.titleBar, { justifyContent: 'center' }]}>
          <Text style={styles.screenSubtitle}>
            {selectedChild ? (isPregnant ? t('sos.subtitleMom', { name: selectedChild.name }) : selectedChild.name) : t('sos.subtitleDefault')}
          </Text>
        </View>

        {/* ============================================ */}
        {/* Section 1: 위급하면 먼저 119 — 안전 상징 영역 */}
        {/* ============================================ */}
        <View style={styles.priorityCard}>
          <Text style={styles.priorityTitle}>{t('sos.priorityTitle')}</Text>
          <View style={styles.priorityBtnRow}>
            <TouchableOpacity
              style={[styles.priorityBtn, styles.priorityBtnRed]}
              onPress={call119}
              activeOpacity={0.85}
            >
              <Image source={IC_REDFLAG} style={styles.priorityBtnIconImg} resizeMode="contain" />
              <Text style={styles.priorityBtnText}>{t('sos.call119Button')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priorityBtn, styles.priorityBtnBlue]}
              onPress={openHospitalMap}
              activeOpacity={0.85}
            >
              <Image source={IC_HOSPITAL} style={styles.priorityBtnIconImg} resizeMode="contain" />
              <Text style={styles.priorityBtnText}>{t('sos.findErButton')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priorityBtn, styles.priorityBtnPurple]}
              onPress={notifyFamily}
              activeOpacity={0.85}
              disabled={notifyingFamily}
            >
              {notifyingFamily ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Image source={IC_FAMILY} style={styles.priorityBtnIconImg} resizeMode="contain" />
                  <Text style={styles.priorityBtnText}>{t('sos.notifyFamilyButton')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.priorityNote}>
            <Image source={IC_REDFLAG} style={styles.priorityNoteIconImg} resizeMode="contain" />
            <Text style={styles.priorityNoteText}>
              {t('sos.priorityNote')}
            </Text>
          </View>
        </View>

        {/* ============================================ */}
        {/* Section 2: 응급 상황 빠른 대처 (연령별 분기 포함) */}
        {/* ============================================ */}
        {!isPregnant && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sos.quickHelpTitle')}</Text>
          <Text style={styles.sectionDesc}>
            {t('sos.quickHelpDesc')}
          </Text>
          <View style={styles.guideGrid}>
            {getEmergencyGuides(t).map((g) => (
              <TouchableOpacity
                key={g.key}
                style={[styles.guideBtn, { backgroundColor: g.bg }]}
                onPress={() => setGuideKey(g.key)}
                activeOpacity={0.7}
              >
                <Image source={g.icon} style={styles.guideBtnIconImg} resizeMode="contain" />
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
          <Text style={styles.sectionTitle}>{t('sos.symptomCheckTitle')}</Text>
          <Text style={styles.sectionDesc}>
            {isPregnant
              ? t('sos.symptomCheckDescPregnant')
              : t('sos.symptomCheckDesc')}
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
                  <Image source={symptom.icon} style={styles.symptomIconImg} resizeMode="contain" />
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
            <Text style={styles.tempLabel}>{t('sos.tempLabel')}</Text>
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
              <Text style={styles.checkButtonText}>{t('sos.checkButton')}</Text>
            )}
          </TouchableOpacity>

          {/* Result card */}
          {result && <ResultCard result={result} onCall119={call119} onOpenMap={openHospitalMap} />}
        </View>

        {/* ============================================ */}
        {/* Section 4: 임신부 전용 - 분만실 직통 (119/가족은 상단에 통합됨) */}
        {/* ============================================ */}
        {isPregnant && (
          <>
            <TouchableOpacity
              style={styles.megaCallBtn}
              onPress={callDeliveryWard}
              activeOpacity={0.85}
              hitSlop={8}
            >
              <Image source={IC_REDFLAG} style={styles.megaCallIconImg} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.megaCallText}>{t('sos.callDeliveryWardButton')}</Text>
                <Text style={styles.megaCallSub}>
                  {deliveryHospital
                    ? `${deliveryHospital.name} · ${deliveryHospital.deliveryWardPhone || deliveryHospital.mainPhone}`
                    : t('sos.touchToRegisterPhone')}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editHospitalLink}
              onPress={() => setHospitalModalOpen(true)}
              hitSlop={10}
            >
              <Text style={styles.editHospitalText}>
                {t('sos.hospitalInfoEditOrRegister', { action: deliveryHospital ? t('common.edit') : t('sos.registerAction') })}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <MedicalCitation
          note={t('sos.medicalCitationNote')}
          sources={[
            { label: t('sos.citationSource.nfa'), url: 'https://www.nfa.go.kr' },
            { label: t('sos.citationSource.kdca'), url: 'https://health.kdca.go.kr' },
            { label: t('sos.citationSource.redcross'), url: 'https://www.redcross.or.kr' },
          ]}
        />
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 병원 등록 모달 */}
      {selectedChild?.id ? (
        <HospitalRegisterModal
          visible={hospitalModalOpen}
          childId={selectedChild.id}
          initialKind="delivery"
          onClose={() => setHospitalModalOpen(false)}
          onSaved={reloadDeliveryHospital}
        />
      ) : null}

      <GuideCarousel visible={guideVisible} pages={getSosGuide(t)} onClose={closeGuide} onComplete={closeGuide} accent="#DB6A5F" />
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
  const { t } = useTranslation();
  const config = getSeverityConfig(t)[result.urgency];

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
          <Text style={{ fontSize: 13, fontWeight: '800', color: config.textColor, marginBottom: 4 }}>{t('sos.doNowLabel')}</Text>
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
          <Text style={styles.resultBtnText}>{t('sos.call119Button')}</Text>
        </TouchableOpacity>
      )}

      {(result.urgency === 'URGENT' || result.urgency === 'HOSPITAL') && (
        <TouchableOpacity
          style={[styles.resultBtn, { backgroundColor: config.border }]}
          onPress={onOpenMap}
          activeOpacity={0.8}
        >
          <Text style={styles.resultBtnText}>{t('sos.findNearbyHospitalButton')}</Text>
        </TouchableOpacity>
      )}

      <Text style={{ fontSize: 11, color: '#888', marginTop: 10, lineHeight: 16 }}>
        {t('sos.resultDisclaimer')}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Emergency Guide Modal (이미지 중심)                                  */
/* ------------------------------------------------------------------ */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function EmergencyGuideModal({ guideKey, onClose }: { guideKey: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [pageIdx, setPageIdx] = useState(0);

  if (!guideKey) return null;

  const stepImages = SOS_STEP_IMAGES[guideKey];
  const guideMeta = getEmergencyGuides(t).find((g) => g.key === guideKey);
  const headerColor = guideMeta?.color ?? '#D32F2F';
  const guideTitle = guideMeta?.label ?? '';
  // warning text — heimlich/cpr 은 연령별 데이터에서, 나머지는 GUIDE_CONTENT에서
  const warningText =
    guideKey === 'heimlich' ? getHeimlichByAge(t).infant.warning
    : guideKey === 'cpr'    ? getCprByAge(t).infant.warning
    : getGuideContent(t)[guideKey]?.warning ?? '';
  // 각 단계 설명 (이미지 인덱스에 대응)
  const stepDescriptions: string[] =
    guideKey === 'heimlich' ? getHeimlichByAge(t).infant.quickSteps
    : guideKey === 'cpr'    ? getCprByAge(t).infant.quickSteps
    : getGuideContent(t)[guideKey]?.quickSteps ?? [];

  if (!stepImages) return null;

  const handleClose = () => {
    setPageIdx(0);
    onClose();
  };

  // 4 panel + 1 warning = 5 pages
  const totalPages = stepImages.length + 1;

  const onScroll = (e: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / SCREEN_WIDTH);
    if (next !== pageIdx) setPageIdx(next);
  };

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={guideStyles.container}>
        {/* 닫기 버튼 */}
        <TouchableOpacity style={guideStyles.closeBtn} onPress={handleClose} hitSlop={16}>
          <Text style={guideStyles.closeBtnText}>{'X'}</Text>
        </TouchableOpacity>

        {/* 상단 타이틀 (간단) */}
        <View style={[guideStyles.simpleTopBar, { backgroundColor: headerColor }]}>
          <Text style={guideStyles.simpleTopText}>{guideTitle}</Text>
          <Text style={guideStyles.simplePageText}>
            {pageIdx < stepImages.length ? `${pageIdx + 1} / ${stepImages.length}` : t('sos.warningPageLabel')}
          </Text>
        </View>

        {/* 의료 disclaimer — 응급처치 가이드는 일반 참고용임을 항상 표시 */}
        <View style={guideStyles.disclaimerBar}>
          <Text style={guideStyles.disclaimerBarText}>
            {t('sos.disclaimerBar')}
          </Text>
        </View>

        {/* 가로 스크롤 카드 페이저 */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          style={guideStyles.pager}
        >
          {/* Page 0..3 — 4 패널 이미지 + 한국어 단계 설명 */}
          {stepImages.map((src, idx) => {
            const stepText = stepDescriptions[idx];
            return (
              <View key={`panel-${idx}`} style={[guideStyles.panelPage, { width: SCREEN_WIDTH }]}>
                <View style={guideStyles.panelImageWrap}>
                  <Image
                    source={src}
                    style={guideStyles.panelImage}
                    resizeMode="contain"
                  />
                </View>
                {stepText ? (
                  <View style={guideStyles.stepDescBox}>
                    <Text style={guideStyles.stepDescNum}>{t('sos.stepNumLabel', { num: idx + 1 })}</Text>
                    <Text style={guideStyles.stepDescText}>{stepText}</Text>
                  </View>
                ) : null}
                {idx === 0 ? (
                  <Text style={guideStyles.swipeHint}>{t('sos.swipeHint')}</Text>
                ) : null}
              </View>
            );
          })}

          {/* 마지막 — 경고 카드 */}
          <View style={[guideStyles.cardPage, { width: SCREEN_WIDTH }]}>
            <View style={guideStyles.warningCardLarge}>
              <Image source={IC_REDFLAG} style={guideStyles.warningIconImg} resizeMode="contain" />
              <Text style={guideStyles.warningTitleLarge}>{t('sos.call119Immediately')}</Text>
              <Text style={guideStyles.warningTextLarge}>{warningText}</Text>
            </View>
          </View>
        </ScrollView>

        {/* 점 인디케이터 */}
        <View style={guideStyles.dotRow}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <View
              key={`dot-${i}`}
              style={[
                guideStyles.dot,
                i === pageIdx && [guideStyles.dotActive, { backgroundColor: headerColor }],
              ]}
            />
          ))}
        </View>

        {/* 119 고정 버튼 (하단) */}
        <View style={guideStyles.bottomBar}>
          <TouchableOpacity
            style={guideStyles.call119Btn}
            onPress={() =>
              Linking.openURL('tel:119').catch((err) => {
                captureError(err, { ctx: 'sos/call119-bottom' });
                Alert.alert(t('sos.alert.callFailedTitle'), t('sos.alert.callFailedDialDirectly'));
              })
            }
            activeOpacity={0.8}
          >
            <Text style={guideStyles.call119Text}>{t('sos.emergencyCall119')}</Text>
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
  closeBtnText: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  titleBar: {
    paddingTop: 54,
    paddingBottom: 18,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  titleText: { fontSize: 22, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
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
  stepDotText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
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
  call119Text: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },

  /* === 가로 스크롤 카드뷰 (P-SOS 리뉴얼) === */
  pager: { flex: 1 },
  cardPage: {
    paddingTop: 60,
    paddingBottom: 100,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  /* === 4-패널 이미지 (텍스트 포함) 풀스크린 표시 === */
  simpleTopBar: {
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  simpleTopText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  simplePageText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  // 응급처치 가이드 disclaimer — 의료기기성 위험 회피 (App Store 심사 대비)
  disclaimerBar: {
    backgroundColor: '#FFF8E1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  disclaimerBarText: {
    fontSize: 11,
    color: '#5D4037',
    textAlign: 'center',
    fontWeight: '600',
  },
  panelPage: {
    paddingTop: 12,
    paddingBottom: 90,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  panelImageWrap: {
    width: SCREEN_WIDTH - 24,
    height: SCREEN_HEIGHT * 0.55,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  panelImage: {
    width: '100%',
    height: '100%',
  },
  bigImageWrap: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    padding: 12,
  },
  bigImage: {
    width: '100%',
    height: '100%',
  },
  stepDescBox: {
    width: SCREEN_WIDTH - 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  stepDescNum: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D32F2F',
    letterSpacing: 1,
    marginBottom: 3,
  },
  stepDescText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    lineHeight: 20,
  },
  swipeHint: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    fontWeight: '600',
  },
  stepBigImageWrap: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH * 0.55,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    padding: 8,
  },
  stepBigImage: { width: '90%', height: '90%' },
  stepNumberCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepNumberText: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  stepBigText: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  warningCardLarge: {
    backgroundColor: '#FFEBEE',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF9A9A',
    width: '100%',
    marginTop: 30,
  },
  warningIconLarge: { fontSize: 56, marginBottom: 12 },
  warningIconImg: { width: 64, height: 64, marginBottom: 12 },
  warningTitleLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 12,
  },
  warningTextLarge: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '700',
    color: '#B71C1C',
    textAlign: 'center',
  },

  /* 연령 선택 카드 */
  agePicker: {},
  /* 점 인디케이터 */
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 110 : 92,
    left: 0,
    right: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
  },
  dotActive: {
    width: 24,
  },
});

const agePickerStyles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0E0DC',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  cardLeft: { flex: 1 },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: '#636366',
    fontWeight: '600',
  },
  cardArrow: {
    fontSize: 32,
    fontWeight: '700',
    marginLeft: 8,
  },
  hint: {
    marginTop: 8,
    paddingHorizontal: 4,
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
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
    fontWeight: '600',
    color: EMERGENCY_RED,
  },
  screenSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.textSub,
  },

  /* Section 1: 위급하면 먼저 119 */
  priorityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: EMERGENCY_RED,
    shadowColor: EMERGENCY_RED,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
  },
  priorityTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: EMERGENCY_RED,
    textAlign: 'center',
    marginBottom: 14,
  },
  priorityBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 84,
    gap: 6,
  },
  priorityBtnRed: {
    backgroundColor: EMERGENCY_RED,
  },
  priorityBtnBlue: {
    backgroundColor: '#1976D2',
  },
  priorityBtnPurple: {
    backgroundColor: '#7C5CFF',
  },
  priorityBtnIcon: {
    fontSize: 22,
  },
  priorityBtnIconImg: {
    width: 28,
    height: 28,
    marginBottom: 4,
  },
  priorityBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 16,
  },
  priorityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  priorityNoteIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  priorityNoteIconImg: {
    width: 18,
    height: 18,
    marginTop: 1,
  },
  priorityNoteText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#7E5400',
    lineHeight: 18,
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
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  guideBtnEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  // 카드 안에 들어가는 일러스트 — 이전 64×64 는 너무 작고, '100%'+aspectRatio 는 native에서
  // 의도와 다르게 동작해 카드를 폭주시킴. 고정 크기 + resizeMode contain 으로 안전하게.
  guideBtnIconImg: {
    width: 130,
    height: 80,
    marginBottom: 8,
  },
  guideBtnLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  guideBtnSublabel: {
    fontSize: 12,
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
  symptomIconImg: {
    width: 36,
    height: 36,
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
    fontWeight: '600',
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

  /* 임신부 전용 — 분만실 전화 거대 버튼 */
  megaCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 12,
    gap: 16,
    borderWidth: 2,
    borderColor: '#B71C1C',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  megaCallIcon: { fontSize: 44 },
  megaCallIconImg: { width: 44, height: 44 },
  megaCallText: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 28 },
  megaCallSub: { fontSize: 13, color: '#FFE4D2', marginTop: 4, fontWeight: '600' },

  /* 임신부 전용 — 가족 알림 거대 버튼 */
  megaFamilyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C5CFF',
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 12,
    gap: 16,
    borderWidth: 2,
    borderColor: '#5E40D9',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  megaFamilyIcon: { fontSize: 40 },
  megaFamilyText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', lineHeight: 26 },
  megaFamilySub: { fontSize: 12, color: '#E1D9FA', marginTop: 4, fontWeight: '600' },

  /* 병원 정보 수정 링크 */
  editHospitalLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  editHospitalText: { fontSize: 13, color: '#666', textDecorationLine: 'underline' },

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

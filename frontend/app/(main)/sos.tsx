import { useState, useCallback, useEffect } from 'react';
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
import { SOS_GUIDE } from '../../features/guide/sosGuide';
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

const SYMPTOMS: SymptomItem[] = [
  { id: 'fever', icon: IC_THERMOMETER, label: '38도+ 발열' },
  { id: 'vomiting', icon: IC_NAUSEA, label: '구토/설사' },
  { id: 'seizure', icon: IC_REDFLAG, label: '경련' },
  { id: 'breathing', icon: IC_TIRED, label: '호흡곤란' },
  { id: 'bleeding', icon: IC_BLOOD, label: '출혈/상처' },
  { id: 'rash', icon: IC_REDFLAG, label: '발진/두드러기' },
];

const PREGNANCY_SYMPTOMS: SymptomItem[] = [
  { id: 'bleeding', icon: IC_BLOOD, label: '출혈' },
  { id: 'severe_pain', icon: IC_PAIN, label: '심한 복통' },
  { id: 'headache', icon: IC_PAIN, label: '심한 두통' },
  { id: 'swelling', icon: IC_FOOT, label: '심한 부종' },
  { id: 'vision', icon: IC_REDFLAG, label: '시야 흐림' },
  { id: 'leaking', icon: IC_WATER, label: '양수 파수' },
  { id: 'no_movement', icon: IC_PREG, label: '태동 감소' },
  { id: 'fever', icon: IC_THERMOMETER, label: '발열 38+' },
  { id: 'breathing', icon: IC_TIRED, label: '호흡곤란' },
  { id: 'contractions', icon: IC_CONTRACTION, label: '규칙적 수축' },
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

const EMERGENCY_GUIDES = [
  { key: 'heimlich', icon: IC_HEIMLICH, label: '기도막힘', sublabel: '4단계 대처', color: '#D32F2F', bg: '#FFEBEE' },
  { key: 'cpr', icon: IC_CPR, label: 'CPR', sublabel: '심폐소생술', color: '#C62828', bg: '#FCE4EC' },
  { key: 'burn_fall', icon: IC_BURN, label: '화상/낙상', sublabel: '응급 처치', color: '#E65100', bg: '#FFF3E0' },
  { key: 'foreign', icon: IC_FOREIGN, label: '이물질 삼킴', sublabel: '코/귀/입', color: '#F57F17', bg: '#FFFDE7' },
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
const HEIMLICH_BY_AGE: Record<AgeKey, GuideData> = {
  infant: {
    title: '기도막힘 (12개월 미만)',
    subtitle: '영아 - 등 두드리기 + 가슴 압박',
    headerColor: '#D32F2F',
    quickSteps: [
      '아이를 한 팔에 엎드리게 두고 머리를 가슴보다 낮게',
      '등 가운데를 손바닥 아래쪽으로 5번 강하게 두드리기',
      '뒤집어서 머리 낮추고, 가슴 중앙(젖꼭지 사이)을 손가락 2개로 5번 압박',
      '나올 때까지 등 두드리기 ↔ 가슴 압박 반복',
      '의식을 잃으면 즉시 CPR 시작 + 119 신고',
    ],
    warning: '입속을 손가락으로 후비지 마세요. 더 깊이 들어갈 수 있어요.',
  },
  child: {
    title: '기도막힘 (만 1세 ~ 사춘기 전)',
    subtitle: '소아 - 하임리히 (복부 밀어올리기)',
    headerColor: '#D32F2F',
    quickSteps: [
      '아이 뒤에 무릎 꿇거나 서기 (눈높이 맞춰)',
      '한 손은 주먹, 엄지 안쪽을 배꼽 위·명치 아래에 위치',
      '다른 손으로 주먹을 감싸 안쪽·위쪽으로 5번 빠르게 당기듯 밀기',
      '나올 때까지 반복',
      '의식 잃으면 눕히고 CPR + 119 신고',
    ],
    warning: '명치 위(가슴뼈)는 누르지 마세요. 갈비뼈 손상 위험.',
  },
  adult: {
    title: '기도막힘 (성인 / 보호자)',
    subtitle: '청소년·성인 하임리히',
    headerColor: '#D32F2F',
    quickSteps: [
      '뒤에서 양팔로 명치 아래·배꼽 위 부위를 감싸안기',
      '한 손은 주먹, 다른 손은 그 위에 포개기',
      '안쪽·위쪽 방향으로 빠르게 5번 당기듯 밀기',
      '나올 때까지 반복',
      '혼자라면 의자 등받이에 명치 부위 대고 압박',
    ],
    warning: '임산부·비만인은 명치 아래 대신 가슴 중앙을 압박하세요.',
  },
};

const CPR_BY_AGE: Record<AgeKey, GuideData> = {
  infant: {
    title: 'CPR (12개월 미만)',
    subtitle: '영아 - 손가락 2개로 가슴 압박',
    headerColor: '#C62828',
    quickSteps: [
      '반응·호흡 확인 (10초 이내)',
      '먼저 119 신고 (스피커폰으로 지시 받으며 진행)',
      '평평한 곳에 눕히고 머리 살짝 뒤로 젖히기',
      '가슴 중앙(젖꼭지 사이)을 손가락 2개로 깊이 4cm 압박',
      '분당 100~120회로 30회 압박 → 입·코 동시에 가볍게 인공호흡 2회',
      '구급대 올 때까지 30:2 반복, 절대 멈추지 말기',
    ],
    warning: '인공호흡이 어렵다면 가슴 압박만이라도 계속하세요.',
  },
  child: {
    title: 'CPR (만 1세 ~ 사춘기 전)',
    subtitle: '소아 - 한 손 또는 양손 압박',
    headerColor: '#C62828',
    quickSteps: [
      '어깨 두드리며 반응 확인, 호흡 확인 (10초 이내)',
      '먼저 119 신고 (스피커폰)',
      '평평한 곳에 눕히고 머리 젖혀 기도 열기',
      '가슴 중앙을 한 손바닥(작은 아이) 또는 양손으로 깊이 5cm 압박',
      '분당 100~120회로 30회 압박 → 입 대 입 인공호흡 2회',
      '30:2 반복, AED 도착하면 즉시 사용',
    ],
    warning: '구급대가 올 때까지 멈추지 마세요. 갈비뼈가 부러져도 계속.',
  },
  adult: {
    title: 'CPR (성인 / 보호자)',
    subtitle: '청소년·성인 - 양손 가슴 압박',
    headerColor: '#C62828',
    quickSteps: [
      '의식·호흡 확인 후 119 신고 (스피커폰)',
      '가슴 중앙(흉골 아래쪽)에 양손 포개고 팔꿈치 펴기',
      '체중 실어 깊이 5~6cm로 압박',
      '분당 100~120회로 30회 압박',
      '인공호흡 2회 (가능할 때) → 30:2 반복',
      'AED 도착하면 즉시 사용, 구급대 올 때까지 멈추지 말기',
    ],
    warning: '갈비뼈가 부러져도 멈추지 마세요. 생명이 우선입니다.',
  },
};

const GUIDE_CONTENT: Record<string, GuideData> = {
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
    const picked = await pickDeliveryPhone(selectedChild.id);
    if (!picked) {
      // 등록된 번호 없음 → 등록 모달 열기
      Alert.alert(
        '병원 번호 등록 필요',
        '먼저 분만 예정 병원의 전화번호를 등록해 주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '등록하기', onPress: () => setHospitalModalOpen(true) },
        ],
      );
      return;
    }
    // #25: 국제번호 +82 보존
    const cleaned = picked.phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch((e) => {
      captureError(e, { ctx: 'sos/dialDelivery', phoneLast4: picked.phone.slice(-4) });
      Alert.alert('전화 연결 실패', `직접 전화해 주세요: ${picked.phone}`);
    });
  }, [selectedChild?.id]);

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
      Alert.alert('오류', '지도 앱을 열 수 없습니다.');
    });
  }, [regionName]);

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
            {selectedChild ? (isPregnant ? `${selectedChild.name} 엄마` : selectedChild.name) : '응급 도우미'}
          </Text>
        </View>

        {/* ============================================ */}
        {/* Section 1: 위급하면 먼저 119 — 안전 상징 영역 */}
        {/* ============================================ */}
        <View style={styles.priorityCard}>
          <Text style={styles.priorityTitle}>위급하면 먼저 119</Text>
          <View style={styles.priorityBtnRow}>
            <TouchableOpacity
              style={[styles.priorityBtn, styles.priorityBtnRed]}
              onPress={call119}
              activeOpacity={0.85}
            >
              <Image source={IC_REDFLAG} style={styles.priorityBtnIconImg} resizeMode="contain" />
              <Text style={styles.priorityBtnText}>119 전화하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priorityBtn, styles.priorityBtnBlue]}
              onPress={openHospitalMap}
              activeOpacity={0.85}
            >
              <Image source={IC_HOSPITAL} style={styles.priorityBtnIconImg} resizeMode="contain" />
              <Text style={styles.priorityBtnText}>응급실 찾기</Text>
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
                  <Text style={styles.priorityBtnText}>가족에게 알리기</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.priorityNote}>
            <Image source={IC_REDFLAG} style={styles.priorityNoteIconImg} resizeMode="contain" />
            <Text style={styles.priorityNoteText}>
              호흡곤란, 의식저하, 경련, 심한 출혈, 입술이 파래짐 등 위급상황은 앱 확인보다 119에 먼저 전화하세요.
            </Text>
          </View>
        </View>

        {/* ============================================ */}
        {/* Section 2: 응급 상황 빠른 대처 (연령별 분기 포함) */}
        {/* ============================================ */}
        {!isPregnant && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>응급 상황 빠른 대처</Text>
          <Text style={styles.sectionDesc}>
            위급하면 119, 애매하면 증상부터 빠르게 확인하세요
          </Text>
          <View style={styles.guideGrid}>
            {EMERGENCY_GUIDES.map((g) => (
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
          <Text style={styles.sectionTitle}>증상 빠른 확인</Text>
          <Text style={styles.sectionDesc}>
            {isPregnant
              ? '바로 119급인지 애매할 때 — 엄마·태아 증상을 선택해주세요'
              : '바로 119급인지 애매할 때 — 증상부터 빠르게 확인하세요'}
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
                <Text style={styles.megaCallText}>분만실 전화하기</Text>
                <Text style={styles.megaCallSub}>
                  {deliveryHospital
                    ? `${deliveryHospital.name} · ${deliveryHospital.deliveryWardPhone || deliveryHospital.mainPhone}`
                    : '터치하여 병원 번호 등록'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editHospitalLink}
              onPress={() => setHospitalModalOpen(true)}
              hitSlop={10}
            >
              <Text style={styles.editHospitalText}>
                분만/진료 병원 정보 {deliveryHospital ? '수정' : '등록'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <MedicalCitation
          note="응급처치 안내는 참고용입니다. 위급 시 즉시 119에 신고하고 의료진 지시를 따르세요."
          sources={[
            { label: '소방청 119 응급처치 안내', url: 'https://www.nfa.go.kr' },
            { label: '질병관리청 국가건강정보포털 (응급처치)', url: 'https://health.kdca.go.kr' },
            { label: '대한적십자사 응급처치 가이드', url: 'https://www.redcross.or.kr' },
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

      <GuideCarousel visible={guideVisible} pages={SOS_GUIDE} onClose={closeGuide} onComplete={closeGuide} accent="#DB6A5F" />
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
          <Text style={{ fontSize: 13, fontWeight: '800', color: config.textColor, marginBottom: 4 }}>{'👉 지금 할 일'}</Text>
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function EmergencyGuideModal({ guideKey, onClose }: { guideKey: string | null; onClose: () => void }) {
  const [pageIdx, setPageIdx] = useState(0);

  if (!guideKey) return null;

  const stepImages = SOS_STEP_IMAGES[guideKey];
  const guideMeta = EMERGENCY_GUIDES.find((g) => g.key === guideKey);
  const headerColor = guideMeta?.color ?? '#D32F2F';
  const guideTitle = guideMeta?.label ?? '';
  // warning text — heimlich/cpr 은 연령별 데이터에서, 나머지는 GUIDE_CONTENT에서
  const warningText =
    guideKey === 'heimlich' ? HEIMLICH_BY_AGE.infant.warning
    : guideKey === 'cpr'    ? CPR_BY_AGE.infant.warning
    : GUIDE_CONTENT[guideKey]?.warning ?? '';
  // 각 단계 설명 (이미지 인덱스에 대응)
  const stepDescriptions: string[] =
    guideKey === 'heimlich' ? HEIMLICH_BY_AGE.infant.quickSteps
    : guideKey === 'cpr'    ? CPR_BY_AGE.infant.quickSteps
    : GUIDE_CONTENT[guideKey]?.quickSteps ?? [];

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
            {pageIdx < stepImages.length ? `${pageIdx + 1} / ${stepImages.length}` : '경고'}
          </Text>
        </View>

        {/* 의료 disclaimer — 응급처치 가이드는 일반 참고용임을 항상 표시 */}
        <View style={guideStyles.disclaimerBar}>
          <Text style={guideStyles.disclaimerBarText}>
            ⓘ 일반 응급처치 참고용 · 의료 행위 대체 아님 · 위급 시 즉시 119
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
                    <Text style={guideStyles.stepDescNum}>{`STEP ${idx + 1}`}</Text>
                    <Text style={guideStyles.stepDescText}>{stepText}</Text>
                  </View>
                ) : null}
                {idx === 0 ? (
                  <Text style={guideStyles.swipeHint}>옆으로 넘기면 다음 단계</Text>
                ) : null}
              </View>
            );
          })}

          {/* 마지막 — 경고 카드 */}
          <View style={[guideStyles.cardPage, { width: SCREEN_WIDTH }]}>
            <View style={guideStyles.warningCardLarge}>
              <Image source={IC_REDFLAG} style={guideStyles.warningIconImg} resizeMode="contain" />
              <Text style={guideStyles.warningTitleLarge}>이럴 땐 즉시 119</Text>
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
                Alert.alert('전화 연결 실패', '직접 119로 전화해주세요.');
              })
            }
            activeOpacity={0.8}
          >
            <Text style={guideStyles.call119Text}>{'119 응급전화'}</Text>
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

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { ImageSourcePropType, StyleProp, TextStyle } from 'react-native';

/* 임신 마일스톤·증상 이모지 → 우리 일러스트 매핑 (3D clay 통일) */
const PREG_EMOJI_ICON: Record<string, ImageSourcePropType> = {
  '🤰': require('../../assets/preg-test.png'),
  '💊': require('../../assets/quick-pill.png'),
  '🏥': require('../../assets/preg-stethoscope.png'),
  '📸': require('../../assets/preg-ultrasound.png'),
  '💓': require('../../assets/icon-heart.png'),
  '🔬': require('../../assets/preg-ultrasound.png'),
  '🌿': require('../../assets/preg-leaf.png'),
  '🌱': require('../../assets/preg-leaf.png'),
  '🧪': require('../../assets/preg-ultrasound.png'),
  '🎀': require('../../assets/preg-ribbon.png'),
  '🦶': require('../../assets/preg-foot.png'),
  '📋': require('../../assets/preg-ultrasound.png'),
  '🩸': require('../../assets/quick-blood.png'),
  '🧳': require('../../assets/preg-bag.png'),
  '📷': require('../../assets/icon-camera.png'),
  '👶': require('../../assets/quick-baby.png'),
  '🤢': require('../../assets/preg-mood-nausea.png'),
  '😴': require('../../assets/preg-mood-tired.png'),
  '🦴': require('../../assets/preg-mood-pain.png'),
  '🤕': require('../../assets/preg-mood-pain.png'),
  '🌙': require('../../assets/preg-mood-tired.png'),
  '🔥': require('../../assets/preg-mood-pain.png'),
  '😣': require('../../assets/preg-mood-pain.png'),
  '🦵': require('../../assets/preg-mood-pain.png'),
  '😢': require('../../assets/preg-mood-tired.png'),
  '🚽': require('../../assets/preg-mood-tired.png'),
  '😊': require('../../assets/preg-mood-good.png'),
  '🫠': require('../../assets/preg-mood-pain.png'),
  '😖': require('../../assets/preg-mood-pain.png'),
  '💩': require('../../assets/preg-mood-pain.png'),
  '📚': require('../../assets/preg-bag.png'),
  '📝': require('../../assets/child-diary.png'),
  '🎉': require('../../assets/preg-ribbon.png'),
  '🏠': require('../../assets/mascot-happy.png'),
  '⭐': require('../../assets/preg-ribbon.png'),
};

function EmojiOrIcon({
  emoji,
  size,
  textStyle,
}: {
  emoji?: string;
  size: number;
  textStyle?: StyleProp<TextStyle>;
}) {
  const src = emoji ? PREG_EMOJI_ICON[emoji] : undefined;
  if (src) {
    return (
      <Image
        source={src}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  return <Text style={textStyle}>{emoji ?? '📌'}</Text>;
}
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';
import { pregnancyApi, coachingApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { NextCheckupModal } from '../../components/home/NextCheckupModal';
import {
  getNextCheckup,
  daysUntil,
  formatDday,
  formatKoreanDate,
  useCheckupStore,
} from '../../services/checkup';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface MomHealth {
  id: string;
  symptoms: string[];
  severity: number;
  memo?: string;
  week?: number;
  createdAt: string;
}

interface SymptomPreset {
  id: string;
  label: string;
  emoji: string;
}

interface TimelineWeek {
  week: number;
  items: Array<{
    id: string;
    source: string;
    type: string;
    title: string;
    emoji?: string;
    content?: string;
    mediaUri?: string;
    mediaType?: string;
    createdAt: string;
  }>;
}

/* ================================================================== */
/*  Week-appropriate milestones                                        */
/* ================================================================== */

interface MilestoneOption {
  type: string;
  title: string;
  emoji: string;
  minWeek: number;
  maxWeek: number;
}

const ALL_MILESTONES: MilestoneOption[] = [
  { type: 'positive_test', title: '임신 테스트 양성', emoji: '🤰', minWeek: 1, maxWeek: 8 },
  { type: 'prenatal_vitamins', title: '엽산/영양제 복용 시작', emoji: '💊', minWeek: 1, maxWeek: 12 },
  { type: 'first_visit', title: '첫 산부인과 방문', emoji: '🏥', minWeek: 1, maxWeek: 10 },
  { type: 'first_ultrasound', title: '첫 초음파 확인', emoji: '📸', minWeek: 1, maxWeek: 12 },
  { type: 'first_heartbeat', title: '첫 심장소리 확인', emoji: '💓', minWeek: 6, maxWeek: 14 },
  { type: 'nt_test', title: 'NT 검사 (목투명대)', emoji: '🔬', minWeek: 11, maxWeek: 14 },
  { type: 'stable_period', title: '안정기 진입', emoji: '🌿', minWeek: 13, maxWeek: 16 },
  { type: 'quad_test', title: '쿼드 검사 완료', emoji: '🧪', minWeek: 15, maxWeek: 20 },
  { type: 'gender_reveal', title: '성별 확인', emoji: '🎀', minWeek: 16, maxWeek: 24 },
  { type: 'first_kick', title: '첫 태동 느낌', emoji: '🦶', minWeek: 16, maxWeek: 24 },
  { type: 'detailed_ultrasound', title: '정밀 초음파 완료', emoji: '📋', minWeek: 18, maxWeek: 24 },
  { type: 'name_decided', title: '이름/태명 결정', emoji: '📝', minWeek: 12, maxWeek: 40 },
  { type: 'gct_test', title: '임신성 당뇨 검사', emoji: '🩸', minWeek: 24, maxWeek: 28 },
  { type: 'nursery_start', title: '아기방 준비 시작', emoji: '🏠', minWeek: 24, maxWeek: 36 },
  { type: 'birth_class', title: '출산 준비 교실', emoji: '📚', minWeek: 28, maxWeek: 36 },
  { type: 'gbs_test', title: 'GBS 검사', emoji: '🔬', minWeek: 35, maxWeek: 37 },
  { type: 'hospital_bag', title: '출산가방 준비 완료', emoji: '🧳', minWeek: 32, maxWeek: 40 },
  { type: 'maternity_photo', title: '만삭 사진 촬영', emoji: '📷', minWeek: 32, maxWeek: 40 },
  { type: 'baby_shower', title: '베이비 샤워', emoji: '🎉', minWeek: 28, maxWeek: 38 },
  { type: 'd_day', title: '출산!', emoji: '👶', minWeek: 36, maxWeek: 42 },
];

function getMilestonesForWeek(week: number): MilestoneOption[] {
  return ALL_MILESTONES.filter((m) => week >= m.minWeek && week <= m.maxWeek);
}

/* ================================================================== */
/*  Week-appropriate questions                                         */
/* ================================================================== */

function getWeeklyQuestion(name: string, week: number): { emoji: string; text: string } {
  if (week <= 6) return { emoji: '🌱', text: `${name}의 첫 초음파, 확인하셨나요?` };
  if (week <= 10) return { emoji: '💓', text: `${name} 심장소리는 들으셨나요?` };
  if (week <= 13) return { emoji: '🔬', text: `${name} 목투명대(NT) 검사는 받으셨나요?` };
  if (week <= 16) return { emoji: '🌿', text: `안정기에요! ${name}가 잘 크고 있나요?` };
  if (week <= 20) return { emoji: '🎀', text: `${name}가 왕자인가요 공주인가요?` };
  if (week <= 24) return { emoji: '🦶', text: `${name} 태동을 자주 느끼시나요?` };
  if (week <= 28) return { emoji: '📋', text: `${name} 키는 많이 컸나요? 잘 크고 있나요?` };
  if (week <= 32) return { emoji: '📚', text: `출산 준비는 시작하셨나요?` };
  if (week <= 36) return { emoji: '🧳', text: `${name} 출산가방은 준비되었나요?` };
  if (week <= 39) return { emoji: '🤰', text: `${name} 만날 준비 되셨나요?` };
  return { emoji: '👶', text: `${name} 만나셨나요?` };
}

/* ================================================================== */
/*  Mom symptom presets (fallback if API fails)                        */
/* ================================================================== */

const FALLBACK_SYMPTOMS: SymptomPreset[] = [
  { id: 'morning_sickness', label: '입덧', emoji: '🤢' },
  { id: 'fatigue', label: '피로감', emoji: '😴' },
  { id: 'back_pain', label: '허리/골반 통증', emoji: '🦴' },
  { id: 'swelling', label: '부종', emoji: '🦶' },
  { id: 'headache', label: '두통', emoji: '🤕' },
  { id: 'insomnia', label: '불면', emoji: '🌙' },
  { id: 'heartburn', label: '속쓰림', emoji: '🔥' },
  { id: 'constipation', label: '변비', emoji: '😣' },
  { id: 'cramp', label: '다리 쥐남', emoji: '🦵' },
  { id: 'mood_swing', label: '감정 기복', emoji: '😢' },
  { id: 'frequent_urination', label: '빈뇨', emoji: '🚽' },
  { id: 'good', label: '컨디션 좋음', emoji: '😊' },
];

/* ================================================================== */
/*  NextCheckupSection — 다음 검진 일정 (AsyncStorage 기반)            */
/*  PDF 앨범 출력엔 포함 안 됨 (PDF는 albumPhotos만 봄)                 */
/* ================================================================== */

function NextCheckupSection({ childId }: { childId: string }) {
  const [open, setOpen] = useState(false);
  const [iso, setIso] = useState<string | null>(null);
  const ver = useCheckupStore((s) => s.version);

  useEffect(() => {
    let cancelled = false;
    if (!childId) {
      setIso(null);
      return;
    }
    (async () => {
      const v = await getNextCheckup(childId);
      if (!cancelled) setIso(v);
    })();
    return () => { cancelled = true; };
  }, [childId, ver]);

  const days = iso ? daysUntil(iso) : null;
  const dday = days != null ? formatDday(days) : null;

  return (
    <>
      <TouchableOpacity
        style={checkupStyles.row}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <EmojiOrIcon emoji={'🏥'} size={26} textStyle={checkupStyles.icon} />
        <View style={{ flex: 1 }}>
          <Text style={checkupStyles.label}>다음 검진 일정</Text>
          {iso ? (
            <Text style={checkupStyles.value}>
              {formatKoreanDate(iso)}
              <Text style={checkupStyles.dday}>{`  ${dday}`}</Text>
            </Text>
          ) : (
            <Text style={checkupStyles.placeholder}>탭해서 등록 (홈에 D-day 표시)</Text>
          )}
        </View>
        <Text style={checkupStyles.arrow}>{'>'}</Text>
      </TouchableOpacity>

      <NextCheckupModal
        visible={open}
        onClose={() => setOpen(false)}
        childId={childId}
        current={iso}
      />
    </>
  );
}

const checkupStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4ED',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FFE5D6',
    gap: 12,
  },
  icon: { fontSize: 22 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF8C5A',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  dday: {
    color: '#FF8C5A',
    fontWeight: '900',
  },
  placeholder: {
    fontSize: 13,
    color: '#636366',
    fontWeight: '600',
  },
  arrow: {
    fontSize: 18,
    color: '#ABABAB',
    fontWeight: '900',
  },
});

/* ================================================================== */
/*  Main Screen                                                        */
/* ================================================================== */

export default function PregnancyScreen() {
  const insets = useSafeAreaInsets();
  const child = useChildStore((s) => s.selectedChild);
  const childId = child?.id ?? '';
  const currentWeek = child?.pregnancyWeeks ?? 0;
  const childName = child?.name ?? '아가';

  const [refreshing, setRefreshing] = useState(false);

  // Timeline
  const [timeline, setTimeline] = useState<TimelineWeek[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Record creation modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [doctorNote, setDoctorNote] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([]);

  // Mom health fields
  const [symptomPresets, setSymptomPresets] = useState<SymptomPreset[]>(FALLBACK_SYMPTOMS);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState(3);
  const [healthMemo, setHealthMemo] = useState('');

  // Health history
  const [healthHistory, setHealthHistory] = useState<MomHealth[]>([]);

  // === 인라인 compose (성장앨범 BabyAlbum과 동일한 UX — 한 번 저장 = 한 카드) ===
  const [composePhoto, setComposePhoto] = useState<string | null>(null);
  const [composeMemo, setComposeMemo] = useState('');
  const [composeChip, setComposeChip] = useState<
    | { kind: 'milestone'; id: string; label: string; emoji: string }
    | { kind: 'symptom'; id: string; label: string; emoji: string }
    | null
  >(null);
  const [shareToFamily, setShareToFamily] = useState(false);

  // AI 일기 (성장앨범과 동일)
  const [diaryText, setDiaryText] = useState<string | null>(null);
  const [diaryDate, setDiaryDate] = useState<string | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);

  // 인라인 compose: 사진 picker
  const composePickPhoto = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '갤러리 접근 권한을 허용해주세요');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets[0]) {
        setComposePhoto(result.assets[0].uri);
      }
    } catch {
      Alert.alert('오류', '사진을 불러오지 못했습니다');
    }
  }, []);

  const generateDiary = useCallback(async () => {
    if (!childId) return;
    setDiaryLoading(true);
    try {
      const res = await coachingApi.dailyDiary(childId);
      const data = res.data?.data as { diary?: string; date?: string } | undefined;
      if (data?.diary) {
        setDiaryText(data.diary);
        setDiaryDate(data.date ?? new Date().toISOString().slice(0, 10));
      } else {
        Alert.alert('알림', '오늘의 기록이 아직 없어서 일기를 생성할 수 없어요.');
      }
    } catch {
      Alert.alert('오류', 'AI 일기 생성에 실패했습니다.');
    } finally {
      setDiaryLoading(false);
    }
  }, [childId]);

  /* ── Load data ── */
  const loadTimeline = useCallback(async () => {
    if (!childId) return;
    setLoadingTimeline(true);
    try {
      const res = await pregnancyApi.getTimeline(childId);
      setTimeline(res.data.data ?? []);
    } catch { /* silent */ }
    setLoadingTimeline(false);
  }, [childId]);

  const loadHealth = useCallback(async () => {
    if (!childId) return;
    try {
      const [presetsRes, historyRes] = await Promise.all([
        pregnancyApi.getSymptomPresets(),
        pregnancyApi.getMomHealth(childId),
      ]);
      const presets = presetsRes.data.data;
      if (Array.isArray(presets) && presets.length > 0) setSymptomPresets(presets);
      setHealthHistory(historyRes.data.data ?? []);
    } catch { /* silent — fallback presets already set */ }
  }, [childId]);

  // 인라인 compose: 한 번 저장 = 한 카드 (성장앨범과 동일)
  const handleSaveUnified = useCallback(async () => {
    if (!childId) return;
    if (!composePhoto && !composeMemo.trim() && !composeChip) {
      Alert.alert('알림', '사진, 메모, 또는 마일스톤·증상 중 하나는 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      if (composeChip?.kind === 'symptom') {
        await pregnancyApi.saveMomHealth({
          childId,
          symptoms: [composeChip.id],
          severity: 3,
          memo: composeMemo.trim() || undefined,
        });
      } else if (composeChip?.kind === 'milestone') {
        const ms = ALL_MILESTONES.find((m) => m.type === composeChip.id);
        await pregnancyApi.createRecord({
          childId,
          type: 'milestone',
          milestoneType: composeChip.id,
          milestoneEmoji: ms?.emoji ?? composeChip.emoji,
          title: ms?.title ?? composeChip.label,
          content: composeMemo.trim() || undefined,
          mediaUri: composePhoto ?? undefined,
          mediaType: composePhoto ? 'photo' : undefined,
          week: currentWeek,
          shareToFamily,
        });
      } else {
        await pregnancyApi.createRecord({
          childId,
          type: 'doctor_note',
          title: composePhoto ? '초음파/영상' : '진료 기록',
          content: composeMemo.trim() || undefined,
          mediaUri: composePhoto ?? undefined,
          mediaType: composePhoto ? 'photo' : undefined,
          week: currentWeek,
          shareToFamily,
        });
      }
      setComposePhoto(null);
      setComposeMemo('');
      setComposeChip(null);
      setShareToFamily(false);
      await Promise.all([loadTimeline(), loadHealth()]);
    } catch {
      Alert.alert('오류', '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }, [childId, composePhoto, composeMemo, composeChip, currentWeek, loadTimeline, loadHealth]);

  useEffect(() => {
    loadTimeline();
    loadHealth();
  }, [loadTimeline, loadHealth]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTimeline(), loadHealth()]);
    setRefreshing(false);
  };

  /* ── Image picker (camera or gallery) ── */
  const launchPicker = async (mode: 'camera' | 'gallery') => {
    try {
      const ImagePicker = await import('expo-image-picker');
      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('권한 필요', '카메라 접근 권한을 허용해주세요');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images', 'videos'],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          setMediaUri(asset.uri);
          setMediaType(asset.type === 'video' ? 'video' : 'photo');
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('권한 필요', '사진 접근 권한을 허용해주세요');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          quality: 0.8,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          setMediaUri(asset.uri);
          setMediaType(asset.type === 'video' ? 'video' : 'photo');
        }
      }
    } catch {
      Alert.alert('오류', '미디어를 불러올 수 없습니다');
    }
  };

  const pickImage = () => {
    Alert.alert('사진/영상 추가', '어떻게 추가할까요?', [
      { text: '카메라로 촬영', onPress: () => launchPicker('camera') },
      { text: '앨범에서 선택', onPress: () => launchPicker('gallery') },
      { text: '취소', style: 'cancel' },
    ]);
  };

  /* ── Save unified record ── */
  const handleSave = async () => {
    if (!childId) return;

    const hasDoctorNote = doctorNote.trim().length > 0;
    const hasMedia = !!mediaUri;
    const hasMilestones = selectedMilestones.length > 0;
    const hasHealth = selectedSymptoms.length > 0 || healthMemo.trim().length > 0;

    if (!hasDoctorNote && !hasMedia && !hasMilestones && !hasHealth) {
      Alert.alert('알림', '하나 이상의 항목을 입력해주세요');
      return;
    }

    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      // 1. Doctor note record
      if (hasDoctorNote || hasMedia) {
        promises.push(
          pregnancyApi.createRecord({
            childId,
            type: 'doctor_note',
            title: hasDoctorNote ? '진료 기록' : '초음파/영상',
            content: doctorNote.trim() || undefined,
            mediaUri: mediaUri ?? undefined,
            mediaType: hasMedia ? mediaType : undefined,
            week: currentWeek,
          }),
        );
      }

      // 2. Milestones
      for (const msType of selectedMilestones) {
        const ms = ALL_MILESTONES.find((m) => m.type === msType);
        if (ms) {
          promises.push(
            pregnancyApi.createRecord({
              childId,
              type: 'milestone',
              milestoneType: ms.type,
              title: ms.title,
              week: currentWeek,
            }),
          );
        }
      }

      // 3. Mom health
      if (hasHealth) {
        promises.push(
          pregnancyApi.saveMomHealth({
            childId,
            symptoms: selectedSymptoms,
            severity,
            memo: healthMemo.trim() || undefined,
          }),
        );
      }

      await Promise.all(promises);

      // Reset form
      setDoctorNote('');
      setMediaUri(null);
      setSelectedMilestones([]);
      setSelectedSymptoms([]);
      setSeverity(3);
      setHealthMemo('');
      setShowModal(false);

      loadTimeline();
      loadHealth();
    } catch {
      Alert.alert('오류', '기록 저장에 실패했습니다');
    }
    setSaving(false);
  };

  /* ── Delete record ── */
  const handleDeleteRecord = (id: string, source?: string) => {
    if (id.startsWith('dev-')) return; // 발달 정보는 정적이라 삭제 불가
    Alert.alert('삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            // source 별로 다른 컬렉션 → 다른 엔드포인트 호출
            if (source === 'health') {
              await pregnancyApi.deleteMomHealth(id);
            } else {
              await pregnancyApi.deleteRecord(id);
            }
            loadTimeline();
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다');
          }
        },
      },
    ]);
  };

  const toggleSymptom = (sid: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid],
    );
  };

  const toggleMilestone = (msType: string) => {
    setSelectedMilestones((prev) =>
      prev.includes(msType) ? prev.filter((m) => m !== msType) : [...prev, msType],
    );
  };

  if (!child?.isPregnant) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '임신앨범' }} />
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyText}>임신 중인 아이를 선택해주세요</Text>
        </View>
      </View>
    );
  }

  const weekQuestion = getWeeklyQuestion(childName, currentWeek);
  const availableMilestones = getMilestonesForWeek(currentWeek);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title (성장앨범과 동일) ── */}
        <Text style={styles.albumTitle}>임신앨범</Text>
        <Text style={styles.albumChildLabel}>{childName}의 임신앨범</Text>

        {/* ── 현재 임신 주차 배지 (성장앨범 currentBadge와 동일) ── */}
        {currentWeek > 0 && (
          <View style={styles.currentBadge}>
            <EmojiOrIcon emoji={'🤰'} size={18} />
            <Text style={styles.currentBadgeText}>{` 현재 임신 ${currentWeek}주차`}</Text>
          </View>
        )}

        {/* ── 다음 검진 일정 (PDF 앨범 출력엔 미포함, 홈에 D-day로 표시) ── */}
        <NextCheckupSection childId={childId} />

        {/* ── 주수별 질문 카드 (한 줄 컴팩트) ── */}
        <View style={styles.questionCardRow}>
          <EmojiOrIcon emoji={weekQuestion.emoji} size={22} textStyle={styles.questionEmojiSmall} />
          <Text style={styles.questionTextRow} numberOfLines={1}>{weekQuestion.text}</Text>
        </View>

        {/* ── 인라인 compose card (성장앨범 BabyAlbum과 동일 UX) ── */}
        <View style={styles.composeCard}>
          {composePhoto ? (
            <View>
              <Image source={{ uri: composePhoto }} style={styles.composePhoto} resizeMode="cover" />
              <TouchableOpacity style={styles.composePhotoChange} onPress={composePickPhoto} activeOpacity={0.7}>
                <Text style={styles.composePhotoChangeText}>변경</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.composePhotoPlaceholder} onPress={composePickPhoto} activeOpacity={0.7}>
              <EmojiOrIcon emoji={'📷'} size={32} textStyle={styles.composePlaceholderEmoji} />
              <Text style={styles.composePlaceholderText}>사진을 추가하세요</Text>
            </TouchableOpacity>
          )}

          {/* 마일스톤 칩 (한 줄) */}
          <Text style={styles.composeChipGroupLabel}>마일스톤</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.composeChipScroll}>
            {availableMilestones.map((ms) => {
              const isActive = composeChip?.kind === 'milestone' && composeChip.id === ms.type;
              return (
                <TouchableOpacity
                  key={`ms-${ms.type}`}
                  style={[styles.composeChip, isActive && styles.composeChipActive, { borderColor: '#FF8C5A' }]}
                  onPress={() =>
                    setComposeChip(
                      isActive ? null : { kind: 'milestone', id: ms.type, label: ms.title, emoji: ms.emoji },
                    )
                  }
                  activeOpacity={0.75}
                >
                  <EmojiOrIcon emoji={ms.emoji} size={18} textStyle={styles.composeChipEmoji} />
                  <Text style={[styles.composeChipText, isActive && styles.composeChipTextActive]}>{ms.title}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 엄마 기분 칩 (한 줄) */}
          <Text style={styles.composeChipGroupLabel}>엄마 기분</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.composeChipScroll}>
            {symptomPresets.map((s) => {
              const isActive = composeChip?.kind === 'symptom' && composeChip.id === s.id;
              return (
                <TouchableOpacity
                  key={`sym-${s.id}`}
                  style={[styles.composeChip, isActive && styles.composeChipActive, { borderColor: '#E91E63' }]}
                  onPress={() =>
                    setComposeChip(
                      isActive ? null : { kind: 'symptom', id: s.id, label: s.label, emoji: s.emoji },
                    )
                  }
                  activeOpacity={0.75}
                >
                  <EmojiOrIcon emoji={s.emoji} size={18} textStyle={styles.composeChipEmoji} />
                  <Text style={[styles.composeChipText, isActive && styles.composeChipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 메모 입력 */}
          <TextInput
            style={styles.composeInput}
            placeholder="하고싶은 이야기나 진료기록을 메모하세요"
            placeholderTextColor={COLORS.textLight}
            value={composeMemo}
            onChangeText={setComposeMemo}
            multiline
          />

          {/* 가족피드 공유 토글 (성장앨범과 동일) */}
          <TouchableOpacity
            style={styles.composeShareRow}
            onPress={() => setShareToFamily((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.composeShareCheck, shareToFamily && styles.composeShareCheckActive]}>
              {shareToFamily && <Text style={styles.composeShareCheckMark}>✓</Text>}
            </View>
            <Text style={styles.composeShareText}>가족피드에도 공유하기</Text>
          </TouchableOpacity>

          {/* 저장 버튼 */}
          <TouchableOpacity
            style={[styles.composeSaveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveUnified}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.composeSaveBtnText}>저장</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── AI 오늘 일기 (성장앨범과 동일) ── */}
        <TouchableOpacity
          style={styles.aiDiaryBtn}
          onPress={generateDiary}
          activeOpacity={0.7}
          disabled={diaryLoading}
        >
          {diaryLoading ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <>
              <EmojiOrIcon emoji={'📝'} size={18} textStyle={styles.aiDiaryBtnEmoji} />
              <Text style={styles.aiDiaryBtnText}> AI 오늘 일기</Text>
            </>
          )}
        </TouchableOpacity>

        {/* AI 일기 결과 */}
        {diaryText && (
          <View style={styles.diaryCard}>
            <View style={styles.diaryHeader}>
              <View style={styles.diaryHeaderRow}>
                <EmojiOrIcon emoji={'📝'} size={16} />
                <Text style={styles.diaryHeaderText}>{` AI 일기 - ${diaryDate}`}</Text>
              </View>
              <TouchableOpacity onPress={() => setDiaryText(null)}>
                <Text style={styles.diaryClose}>{'✕'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.diaryBody}>{diaryText}</Text>
          </View>
        )}

        {loadingTimeline && <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />}

        {/* ── "{N}장의 기록" — 성장앨범 feedCount와 동일 ── */}
        {(() => {
          const totalCount = timeline
            .map((wg) => wg.items.filter((it) => it.source !== 'development'))
            .reduce((sum, items) => sum + items.length, 0);
          if (totalCount === 0) return null;
          return <Text style={styles.feedCount}>{totalCount}장의 기록</Text>;
        })()}

        {/* ── Timeline (성장앨범 feedCard 스타일) ── */}
        {timeline
          .map((weekGroup) => ({
            ...weekGroup,
            items: weekGroup.items.filter((it) => it.source !== 'development'),
          }))
          .filter((wg) => wg.items.length > 0)
          .map((weekGroup) => (
          <View key={weekGroup.week}>
            <View style={styles.weekHeaderRow}>
              <View style={[styles.weekBadge, weekGroup.week === currentWeek && styles.weekBadgeCurrent]}>
                <Text style={styles.weekBadgeText}>임신 {weekGroup.week}주차</Text>
              </View>
              <View style={styles.weekLine} />
            </View>

            {weekGroup.items.map((item) => {
              const stripColor = item.source === 'health' ? '#E91E63' : '#FF8C5A';
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.feedCard}
                  onLongPress={() => handleDeleteRecord(item.id, item.source)}
                  activeOpacity={0.85}
                >
                  {item.mediaUri ? (
                    <Image source={{ uri: item.mediaUri }} style={styles.feedImage} resizeMode="cover" />
                  ) : null}
                  <View style={[styles.feedStrip, { backgroundColor: stripColor }]} />
                  <View style={styles.feedInfo}>
                    {item.createdAt ? (
                      <Text style={styles.feedDate}>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</Text>
                    ) : null}
                    <View style={[styles.feedBadge, { borderColor: stripColor }]}>
                      <View style={[styles.feedBadgeCircle, { backgroundColor: stripColor + '22' }]}>
                        <EmojiOrIcon emoji={item.emoji} size={20} textStyle={{ fontSize: 16 }} />
                      </View>
                      <Text style={[styles.feedBadgeText, { color: stripColor }]}>{item.title}</Text>
                    </View>
                    {item.content ? (
                      <Text style={styles.feedMemo}>{item.content}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {!loadingTimeline && timeline.length === 0 && (
          <View style={styles.emptyCenter}>
            <EmojiOrIcon emoji={'📝'} size={48} textStyle={styles.emptyIcon} />
            <Text style={styles.emptyText}>첫 임신앨범 기록을 남겨보세요</Text>
            <Text style={styles.emptySubText}>진료기록, 초음파, 마일스톤, 엄마상태를 한번에 기록할 수 있어요</Text>
          </View>
        )}

        {/* ── 임신앨범 만들기 (성장앨범 만들기와 동일 디자인) ── */}
        <View style={styles.albumSection}>
          <View style={styles.albumSectionHeader}>
            <Text style={styles.albumSectionTitle}>{'임신앨범 만들기'}</Text>
            <TouchableOpacity
              onPress={() => router.push('/(main)/album' as never)}
              style={styles.albumNewBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.albumNewBtnText}>+ 새 앨범</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.albumSectionDesc}>
            {'기간을 선택하면 기기에서 바로 PDF를 만들어요.\n진료기록·초음파·엄마상태가 자동으로 포함돼요'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      <AdSlot />

      {/* ════════════════════════════════════════════════ */}
      {/*  Unified New Record Modal                        */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Modal header with back button */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowModal(false);
                      setDoctorNote('');
                      setMediaUri(null);
                      setSelectedMilestones([]);
                      setSelectedSymptoms([]);
                      setSeverity(3);
                      setHealthMemo('');
                    }}
                    style={styles.modalBackBtn}
                  >
                    <Text style={styles.modalBackText}>{'< 뒤로'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>임신 {currentWeek}주차 기록</Text>
                  <View style={{ width: 50 }} />
                </View>

                {/* ── Section 1: Doctor Notes ── */}
                <View style={styles.formSection}>
                  <View style={styles.formLabelRow}>
                    <EmojiOrIcon emoji={'🏥'} size={18} />
                    <Text style={styles.formLabel}> 선생님 이야기</Text>
                  </View>
                  <TextInput
                    style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    placeholder="진료 시 들은 이야기를 적어주세요"
                    placeholderTextColor={COLORS.textLight}
                    value={doctorNote}
                    onChangeText={setDoctorNote}
                    multiline
                  />
                </View>

                {/* ── Section 2: Media Upload ── */}
                <View style={styles.formSection}>
                  <View style={styles.formLabelRow}>
                    <EmojiOrIcon emoji={'📸'} size={18} />
                    <Text style={styles.formLabel}> 초음파 / 영상</Text>
                  </View>
                  <TouchableOpacity style={styles.mediaPickerBtn} onPress={pickImage} activeOpacity={0.7}>
                    {mediaUri ? (
                      <Image source={{ uri: mediaUri }} style={styles.mediaPreview} resizeMode="cover" />
                    ) : (
                      <View style={styles.mediaPlaceholder}>
                        <Text style={styles.mediaPlaceholderIcon}>{'+'}</Text>
                        <Text style={styles.mediaPlaceholderText}>사진/영상 추가</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {mediaUri && (
                    <TouchableOpacity onPress={() => setMediaUri(null)} style={styles.mediaRemoveBtn}>
                      <Text style={styles.mediaRemoveText}>삭제</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* ── Section 3: Milestones ── */}
                {availableMilestones.length > 0 && (
                  <View style={styles.formSection}>
                    <View style={styles.formLabelRow}>
                      <Text style={styles.formLabel}>{'★'} 이번 주 마일스톤</Text>
                    </View>
                    <View style={styles.chipGrid}>
                      {availableMilestones.map((ms) => {
                        const selected = selectedMilestones.includes(ms.type);
                        return (
                          <TouchableOpacity
                            key={ms.type}
                            style={[styles.chip, selected && styles.chipActive]}
                            onPress={() => toggleMilestone(ms.type)}
                          >
                            <EmojiOrIcon emoji={ms.emoji} size={18} textStyle={styles.chipEmoji} />
                            <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>
                              {ms.title}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* ── Section 4: Mom Health ── */}
                <View style={styles.formSection}>
                  <View style={styles.formLabelRow}>
                    <EmojiOrIcon emoji={'🤰'} size={18} />
                    <Text style={styles.formLabel}> 엄마 상태</Text>
                  </View>
                  <View style={styles.chipGrid}>
                    {symptomPresets.map((preset) => {
                      const selected = selectedSymptoms.includes(preset.id);
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          style={[styles.chip, selected && styles.chipHealthActive]}
                          onPress={() => toggleSymptom(preset.id)}
                        >
                          <EmojiOrIcon emoji={preset.emoji} size={18} textStyle={styles.chipEmoji} />
                          <Text style={[styles.chipLabel, selected && styles.chipLabelHealthActive]}>
                            {preset.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {selectedSymptoms.length > 0 && (
                    <>
                      <Text style={styles.subLabel}>힘든 정도</Text>
                      <View style={styles.severityRow}>
                        {[1, 2, 3, 4, 5].map((level) => (
                          <TouchableOpacity
                            key={level}
                            style={[styles.severityBtn, severity === level && styles.severityBtnActive]}
                            onPress={() => setSeverity(level)}
                          >
                            <Text style={styles.severityEmoji}>
                              {level <= 2 ? '😊' : level === 3 ? '😐' : level === 4 ? '😣' : '😭'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  <TextInput
                    style={[styles.formInput, { minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder="직접 입력 (증상이나 기분을 자유롭게 적어주세요)"
                    placeholderTextColor={COLORS.textLight}
                    value={healthMemo}
                    onChangeText={setHealthMemo}
                    multiline
                  />
                </View>

                {/* ── Buttons ── */}
                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => {
                      setShowModal(false);
                      setDoctorNote('');
                      setMediaUri(null);
                      setSelectedMilestones([]);
                      setSelectedSymptoms([]);
                      setSeverity(3);
                      setHealthMemo('');
                    }}
                  >
                    <Text style={styles.modalCancelText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSaveBtn, saving && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    <Text style={styles.modalSaveText}>
                      {saving ? '저장 중...' : '저장'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.md, paddingBottom: 100 },

  /* Header */
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* Weekly question */
  /* === 성장앨범과 동일한 시각 요소 === */
  albumTitle: {
    fontSize: FONT_SIZE.xl ?? 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  albumChildLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  aiDiaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  aiDiaryBtnEmoji: { fontSize: 16 },
  aiDiaryBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  diaryCard: {
    backgroundColor: '#FFFBEC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFE0A0',
  },
  diaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  diaryHeaderText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  diaryClose: { fontSize: 18, color: COLORS.textSecondary, padding: 4 },
  diaryBody: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 22, fontWeight: '600' },

  /* === Inline compose card (성장앨범 BabyAlbum과 동일) === */
  composeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  composePhoto: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.md,
    backgroundColor: '#F2F2F7',
  },
  composePhotoChange: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  composePhotoChangeText: { color: '#FFF', fontSize: FONT_SIZE.xs, fontWeight: '700' },
  composePhotoPlaceholder: {
    height: 140,
    borderRadius: RADIUS.md,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  composePlaceholderEmoji: { fontSize: 32, marginBottom: 4 },
  composePlaceholderText: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, fontWeight: '600' },
  composeChipGroupLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  composeChipScroll: { marginBottom: 4 },
  composeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    gap: 4,
  },
  composeChipActive: {
    backgroundColor: '#FFF0E6',
  },
  composeChipEmoji: { fontSize: 14 },
  composeChipText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  composeChipTextActive: { fontWeight: '800' },
  composeInput: {
    minHeight: 60,
    padding: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    backgroundColor: '#FAFAFA',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlignVertical: 'top',
  },
  composeShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.sm,
  },
  composeShareCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeShareCheckActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  composeShareCheckMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  composeShareText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  composeSaveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  composeSaveBtnText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '800' },

  feedCount: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.sm, fontWeight: '700' },
  feedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  feedImage: { width: '100%', height: 240 },
  feedStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  feedInfo: { padding: SPACING.md, paddingLeft: SPACING.md + 2 },
  feedDate: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: 6, fontWeight: '700' },
  feedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  feedBadgeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  feedBadgeText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  feedMemo: {
    fontSize: FONT_SIZE.sm,
    color: '#7A5C40',
    lineHeight: 22,
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontWeight: 'bold',
    marginTop: 4,
  },

  albumSection: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  albumSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  albumSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
    color: COLORS.text,
  },
  albumNewBtn: {
    backgroundColor: '#FFE0E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  albumNewBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: '#C2185B' },
  albumSectionDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  questionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0F5',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFD6E7',
  },
  questionEmojiSmall: { fontSize: 18 },
  questionTextRow: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#C2185B',
  },
  questionCard: {
    backgroundColor: '#FFF0F5',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD6E7',
  },
  questionEmoji: { fontSize: 36, marginBottom: SPACING.sm },
  questionText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: '#C2185B',
    textAlign: 'center',
    lineHeight: 24,
  },

  /* Add button */
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  addBtnText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '700' },

  /* Timeline — 성장앨범(album.tsx pStyles)과 동일 스타일 */
  currentBadge: {
    backgroundColor: '#FCE4EC',
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentBadgeText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#C2185B' },
  weekGroup: { marginBottom: SPACING.lg },
  weekHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  weekBadge: {
    backgroundColor: '#E91E63',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  weekBadgeCurrent: { backgroundColor: '#C2185B' },
  weekBadgeText: { color: '#FFF', fontSize: FONT_SIZE.sm, fontWeight: '700' },
  weekLine: { flex: 1, height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.sm },

  timelineCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginLeft: 20,
    ...SHADOWS.soft,
  },
  timelineCardDev: { backgroundColor: '#FFF3E0', borderLeftWidth: 3, borderLeftColor: '#FF9800' },
  timelineCardHealth: { backgroundColor: '#FCE4EC', borderLeftWidth: 3, borderLeftColor: '#E91E63' },
  timelineEmoji: { fontSize: 24, marginRight: SPACING.sm },
  timelineEmojiWrap: { marginRight: SPACING.sm },
  timelineBody: { flex: 1 },
  timelineTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  timelineContent: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20, fontWeight: '600' },
  timelineDate: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 4, fontWeight: '600' },
  timelineImage: { width: '100%', height: 160, borderRadius: RADIUS.sm, marginTop: SPACING.sm, backgroundColor: COLORS.surfaceLight },

  /* Section card */
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },

  /* History */
  historyItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  historyLeft: { flex: 1 },
  historySymptoms: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  historyDate: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 2 },
  severityDot: { width: 12, height: 12, borderRadius: 6, marginLeft: SPACING.sm },

  /* Empty */
  emptyCenter: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  emptySubText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.lg, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalBackBtn: { paddingVertical: 4 },
  modalBackText: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600' },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },

  /* Form sections */
  formSection: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  formLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  diaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  formInput: {
    backgroundColor: '#F8F5F2', borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },

  /* Media picker */
  mediaPickerBtn: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  mediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#F2F2F7',
  },
  mediaPlaceholderIcon: { fontSize: 32, color: COLORS.textLight, marginBottom: 4 },
  mediaPlaceholderText: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  mediaPreview: { width: '100%', height: 200 },
  mediaRemoveBtn: { alignSelf: 'flex-end', marginTop: 4 },
  mediaRemoveText: { fontSize: FONT_SIZE.sm, color: COLORS.error, fontWeight: '600' },

  /* Chip grid */
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F0EB', borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: '#FFF0E6', borderColor: COLORS.primary },
  chipHealthActive: { backgroundColor: '#FCE4EC', borderColor: '#E91E63' },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  chipLabelActive: { color: COLORS.primary, fontWeight: '600' },
  chipLabelHealthActive: { color: '#E91E63', fontWeight: '600' },

  /* Severity */
  severityRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md, justifyContent: 'center' },
  severityBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F0EB', borderWidth: 2, borderColor: 'transparent',
  },
  severityBtnActive: { borderColor: '#E91E63', backgroundColor: '#FCE4EC' },
  severityEmoji: { fontSize: 22 },

  /* Modal buttons */
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: SPACING.sm, marginBottom: SPACING.lg },
  modalCancelBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: '#F5F0EB' },
  modalCancelText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, fontWeight: '600' },
  modalSaveBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: COLORS.primary },
  modalSaveText: { fontSize: FONT_SIZE.md, color: '#FFF', fontWeight: '700' },
  saveBtnDisabled: { opacity: 0.5 },
});

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
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';
import { pregnancyApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

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
  const handleDeleteRecord = (id: string) => {
    if (id.startsWith('dev-')) return;
    Alert.alert('삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await pregnancyApi.deleteRecord(id);
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
        <Stack.Screen options={{ title: '임신기록' }} />
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

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{childName} {currentWeek}주차</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Weekly Question Card ── */}
        <View style={styles.questionCard}>
          <Text style={styles.questionEmoji}>{weekQuestion.emoji}</Text>
          <Text style={styles.questionText}>{weekQuestion.text}</Text>
        </View>

        {/* ── Add Record Button ── */}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ 새 기록 추가</Text>
        </TouchableOpacity>

        {/* ── Timeline ── */}
        {loadingTimeline && <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />}

        {timeline.map((weekGroup) => (
          <View key={weekGroup.week} style={styles.weekGroup}>
            <View style={styles.weekHeaderRow}>
              <View style={styles.weekBadge}>
                <Text style={styles.weekBadgeText}>임신 {weekGroup.week}주차</Text>
              </View>
              <View style={styles.weekLine} />
            </View>

            {weekGroup.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.timelineCard,
                  item.source === 'development' && styles.timelineCardDev,
                  item.source === 'health' && styles.timelineCardHealth,
                ]}
                onLongPress={() => handleDeleteRecord(item.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.timelineEmoji}>{item.emoji || '📌'}</Text>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  {item.content ? (
                    <Text style={styles.timelineContent} numberOfLines={3}>{item.content}</Text>
                  ) : null}
                  {item.mediaUri ? (
                    <Image source={{ uri: item.mediaUri }} style={styles.timelineImage} resizeMode="cover" />
                  ) : null}
                  {item.createdAt ? (
                    <Text style={styles.timelineDate}>
                      {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {!loadingTimeline && timeline.length === 0 && (
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyIcon}>{'📝'}</Text>
            <Text style={styles.emptyText}>첫 임신 기록을 남겨보세요</Text>
            <Text style={styles.emptySubText}>진료기록, 초음파, 마일스톤, 엄마상태를 한번에 기록할 수 있어요</Text>
          </View>
        )}

        {/* ── Recent health history ── */}
        {healthHistory.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>최근 엄마 상태</Text>
            {healthHistory.slice(0, 5).map((h) => {
              const labels = h.symptoms
                .map((sid) => symptomPresets.find((p) => p.id === sid)?.label ?? sid)
                .join(', ');
              return (
                <View key={h.id} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historySymptoms}>{labels}</Text>
                    <Text style={styles.historyDate}>
                      {h.week ? `임신 ${h.week}주차 · ` : ''}{new Date(h.createdAt).toLocaleDateString('ko-KR')}
                    </Text>
                  </View>
                  <View style={[styles.severityDot, { backgroundColor: h.severity >= 4 ? COLORS.error : h.severity >= 3 ? COLORS.warning : COLORS.success }]} />
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ════════════════════════════════════════════════ */}
      {/*  Unified New Record Modal                        */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={showModal} animationType="slide" transparent>
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
                  <Text style={styles.formLabel}>{'🏥'} 선생님 이야기</Text>
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
                  <Text style={styles.formLabel}>{'📸'} 초음파 / 영상</Text>
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
                    <Text style={styles.formLabel}>{'⭐'} 이번 주 마일스톤</Text>
                    <View style={styles.chipGrid}>
                      {availableMilestones.map((ms) => {
                        const selected = selectedMilestones.includes(ms.type);
                        return (
                          <TouchableOpacity
                            key={ms.type}
                            style={[styles.chip, selected && styles.chipActive]}
                            onPress={() => toggleMilestone(ms.type)}
                          >
                            <Text style={styles.chipEmoji}>{ms.emoji}</Text>
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
                  <Text style={styles.formLabel}>{'🤰'} 엄마 상태</Text>
                  <View style={styles.chipGrid}>
                    {symptomPresets.map((preset) => {
                      const selected = selectedSymptoms.includes(preset.id);
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          style={[styles.chip, selected && styles.chipHealthActive]}
                          onPress={() => toggleSymptom(preset.id)}
                        >
                          <Text style={styles.chipEmoji}>{preset.emoji}</Text>
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

  /* Timeline */
  weekGroup: { marginBottom: SPACING.lg },
  weekHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  weekBadge: {
    backgroundColor: '#E91E63',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
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
  timelineBody: { flex: 1 },
  timelineTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  timelineContent: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 },
  timelineDate: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 4 },
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
    backgroundColor: '#FAFAFA',
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

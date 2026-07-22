import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { BackButton } from '../../components/common/BackButton';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { GuideButton } from '../../components/common/GuideButton';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import { getVaccinationGuide } from '../../features/guide/vaccinationGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';
import { useChildStore } from '../../stores/childStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VaccinationDonut } from '../../components/vaccination/VaccinationDonut';
import { vaccinationApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface VaccineItem {
  id: string;
  name: string;
  disease: string;
  dose: string;
  ageMonths: number;
  rangeStart: number;
  rangeEnd: number;
  required: boolean;
  notes: string;
  preparation: string;
  scheduledDate: string;
  dDay: number;
  completed: boolean;
  recordId: string | null;
  completedAt: string | null;
  hospitalName: string | null;
}

type FilterKey = 'upcoming' | 'overdue' | 'completed' | 'all';

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function ageLabel(months: number, t: TFunction): string {
  if (months === 0) return t('vaccination.ageBirth');
  if (months < 12) return t('vaccination.ageMonths', { months });
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0
    ? t('vaccination.ageYearsMonths', { years: y, months: m })
    : t('vaccination.ageYears', { years: y });
}

function dDayLabel(dDay: number): string {
  if (dDay === 0) return 'D-Day';
  if (dDay > 0) return `D-${dDay}`;
  return `D+${Math.abs(dDay)}`;
}

function dDayColor(dDay: number): string {
  if (dDay < 0) return COLORS.error;        // 지남
  if (dDay <= 2) return '#E91E63';           // 임박
  if (dDay <= 7) return '#FF9800';           // 1주 이내
  if (dDay <= 30) return COLORS.primary;     // 1달 이내
  return COLORS.textLight;                   // 먼 미래
}

/* ================================================================== */
/*  Main Screen                                                        */
/* ================================================================== */

/* ---- Registration baseline (AsyncStorage) ---- */
let _vacStorage: {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
} | null = null;
async function getVacStorage() {
  if (_vacStorage) return _vacStorage;
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    _vacStorage = mod.default;
  } catch {
    const mem: Record<string, string> = {};
    _vacStorage = {
      getItem: async (k) => mem[k] ?? null,
      setItem: async (k, v) => { mem[k] = v; },
    };
  }
  return _vacStorage;
}
function regKey(childId: string) {
  return `vaccination_registration_age_${childId}`;
}
async function loadRegistrationAge(childId: string): Promise<number | null> {
  const s = await getVacStorage();
  if (!s) return null;
  const raw = await s.getItem(regKey(childId));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
async function saveRegistrationAge(childId: string, months: number): Promise<void> {
  const s = await getVacStorage();
  if (!s) return;
  await s.setItem(regKey(childId), String(months));
}

export default function VaccinationScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const child = useChildStore((s) => s.selectedChild);
  const childId = child?.id ?? '';

  const [schedule, setSchedule] = useState<VaccineItem[]>([]);
  const [, setAgeMonths] = useState(0);
  const [registrationAgeMonths, setRegistrationAgeMonths] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('upcoming');

  // Complete modal
  const [showComplete, setShowComplete] = useState<VaccineItem | null>(null);
  const [hospitalName, setHospitalName] = useState('');
  const [completedDate, setCompletedDate] = useState(''); // YYYY-MM-DD
  const [completing, setCompleting] = useState(false);

  // Detail modal
  const [showDetail, setShowDetail] = useState<VaccineItem | null>(null);

  // 사용 가이드 (첫 진입 1회 자동표시 + ? 버튼 재열람) — 육아 모드에서만
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    if (child && !child.isPregnant) {
      shouldAutoShowGuide('vaccination').then((sh) => { if (sh) setGuideVisible(true); });
    }
  }, [child]);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('vaccination'); };

  /* ── Load ── */
  const loadSchedule = useCallback(async () => {
    if (!childId || child?.isPregnant) {
      setLoading(false);
      return;
    }
    try {
      const res = await vaccinationApi.schedule(childId);
      const data = res.data?.data;
      if (!data) throw new Error('응답 데이터 없음');
      setSchedule(data.schedule ?? []);
      setAgeMonths(data.ageMonths ?? 0);

      // 아이 등록 시점의 개월 수를 최초 1회만 저장 (3개월 필터 기준)
      const existing = await loadRegistrationAge(childId);
      if (existing == null) {
        const currentMonths = data.ageMonths ?? 0;
        await saveRegistrationAge(childId, currentMonths);
        setRegistrationAgeMonths(currentMonths);
      } else {
        setRegistrationAgeMonths(existing);
      }
    } catch {
      Alert.alert(t('common.error'), t('vaccination.loadScheduleErrorMessage'));
    } finally {
      setLoading(false);
    }
  }, [childId, child?.isPregnant, t]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // 앱 진입 시 알림 자동 스케줄링 (임신부 모드 제외)
  useEffect(() => {
    if (childId && !child?.isPregnant) {
      vaccinationApi.scheduleAlerts(childId).catch(() => {/* silent */});
    }
  }, [childId, child?.isPregnant]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSchedule();
    setRefreshing(false);
  };

  /* ── 완료일(ISO) → 입력용 YYYY-MM-DD (로컬 타임존 기준) ── */
  const isoToDateInput = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /* ── 완료 기록 수정 모달 열기 (기존 값 미리 채움) ── */
  const openEditModal = (v: VaccineItem) => {
    setShowDetail(null);
    setCompletedDate(isoToDateInput(v.completedAt));
    setHospitalName(v.hospitalName ?? '');
    setShowComplete(v);
  };

  /* ── Complete / Edit ── */
  const handleComplete = async () => {
    if (!showComplete || !childId) return;
    const isEdit = showComplete.completed && !!showComplete.recordId;
    setCompleting(true);
    try {
      // completedDate 검증: YYYY-MM-DD → ISO
      let completedAt: string | undefined;
      if (completedDate.trim()) {
        const m = completedDate.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!m) {
          Alert.alert(t('vaccination.dateFormatErrorTitle'), t('vaccination.dateFormatErrorMessage'));
          setCompleting(false);
          return;
        }
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (isNaN(d.getTime())) {
          Alert.alert(t('vaccination.dateFormatErrorTitle'), t('vaccination.invalidDateMessage'));
          setCompleting(false);
          return;
        }
        completedAt = d.toISOString();
      }

      if (isEdit) {
        // 수정: 전달된 필드만 갱신 (병원명은 빈 값이면 서버에서 제거)
        await vaccinationApi.updateComplete(showComplete.recordId!, completedAt, hospitalName);
      } else {
        await vaccinationApi.complete(childId, showComplete.id, completedAt, hospitalName || undefined);
      }

      setShowComplete(null);
      setHospitalName('');
      setCompletedDate('');
      loadSchedule();
      // 신규 완료 시에만 알림 재스케줄링 (미완료 목록 변동)
      if (!isEdit) vaccinationApi.scheduleAlerts(childId).catch(() => {});
    } catch {
      Alert.alert(
        t('common.error'),
        isEdit ? t('vaccination.editErrorMessage') : t('vaccination.completeRecordErrorMessage'),
      );
    }
    setCompleting(false);
  };

  /* ── Delete (완료 취소) ── */
  const handleDelete = (v: VaccineItem) => {
    if (!v.recordId) return;
    Alert.alert(
      t('vaccination.deleteConfirmTitle'),
      t('vaccination.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await vaccinationApi.undoComplete(v.recordId!);
              setShowDetail(null);
              loadSchedule();
              vaccinationApi.scheduleAlerts(childId).catch(() => {});
            } catch {
              Alert.alert(t('common.error'), t('vaccination.deleteErrorMessage'));
            }
          },
        },
      ],
    );
  };

  /* ── 등록 기준 3개월 이전 오래된 접종은 제외 ── */
  const cutoffMonths = registrationAgeMonths != null ? registrationAgeMonths - 3 : -Infinity;
  const scopedSchedule = schedule.filter((v) => v.ageMonths >= cutoffMonths);

  /* ── Filter ── */
  const filtered = scopedSchedule.filter((v) => {
    switch (filter) {
      case 'upcoming': return !v.completed && v.dDay >= 0;
      case 'overdue': return !v.completed && v.dDay < 0;
      case 'completed': return v.completed;
      case 'all': return true;
    }
  });

  // 연령 그룹별로 묶기
  const grouped = filtered.reduce<Record<string, VaccineItem[]>>((acc, v) => {
    const label = ageLabel(v.ageMonths, t);
    if (!acc[label]) acc[label] = [];
    acc[label].push(v);
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped);

  /* ── Stats (등록 기준 이후만) ── */
  const totalCount = scopedSchedule.length;
  const completedCount = scopedSchedule.filter((v) => v.completed).length;
  // '다가오는' 탭 필터와 동일 기준(미완료 & dDay>=0)으로 통일 — 배지 카운트와 목록 일치
  const upcomingCount = scopedSchedule.filter((v) => !v.completed && v.dDay >= 0).length;
  const overdueCount = scopedSchedule.filter((v) => !v.completed && v.dDay < 0).length;

  if (!child || child.isPregnant) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.navBar}><BackButton /></View>
        <View style={styles.emptyCenter}>
          <Image source={require('../../assets/quick-syringe.png')} style={styles.emptyIconImg} resizeMode="contain" />
          <Text style={styles.emptyText}>
            {child?.isPregnant ? t('vaccination.availableAfterBirth') : t('vaccination.selectChildPrompt')}
          </Text>
        </View>
      </View>
    );
  }

  // 한국 질병관리청 국가예방접종 일정 기반 — 한국어 버전 전용 (SOS·진통체크와 동일 정책).
  // 홈 퀵액션은 이미 게이팅됨 — 딥링크/푸시 직접 진입 방어.
  if (i18n.language !== 'ko') {
    return <Redirect href="/(main)/home" />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.navBar}>
        <BackButton />
        <GuideButton onPress={() => setGuideVisible(true)} color="#5B8DEF" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 도넛 차트 + 배지 (P-vaccination 리뉴얼) ── */}
        <VaccinationDonut
          completed={completedCount}
          upcoming={upcomingCount}
          overdue={overdueCount}
          total={totalCount}
          childName={child.name}
          onPressDonut={() => {
            // 미완료 우선 표시 — overdue 있으면 overdue, 없으면 upcoming
            setFilter(overdueCount > 0 ? 'overdue' : 'upcoming');
          }}
        />

        {/* ── Filter Tabs ── */}
        <View style={styles.filterRow}>
          {([
            { key: 'upcoming' as FilterKey, label: t('vaccination.filterUpcoming') },
            { key: 'overdue' as FilterKey, label: t('vaccination.filterOverdue') },
            { key: 'completed' as FilterKey, label: t('common.complete') },
            { key: 'all' as FilterKey, label: t('vaccination.filterAll') },
          ]).map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />}

        {/* ── Grouped List ── */}
        {groupKeys.map((groupLabel) => (
          <View key={groupLabel} style={styles.ageGroup}>
            <View style={styles.ageHeader}>
              <View style={styles.ageBadge}>
                <Text style={styles.ageBadgeText}>{groupLabel}</Text>
              </View>
              <View style={styles.ageLine} />
            </View>

            {grouped[groupLabel].map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[
                  styles.vaccineCard,
                  v.completed && styles.vaccineCardDone,
                  !v.completed && v.dDay < 0 && styles.vaccineCardOverdue,
                  !v.completed && v.dDay >= 0 && v.dDay <= 2 && styles.vaccineCardUrgent,
                ]}
                onPress={() => setShowDetail(v)}
                activeOpacity={0.7}
              >
                {/* Left: status indicator */}
                <View style={styles.vaccineLeft}>
                  {v.completed ? (
                    <View style={styles.checkCircleDone}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.checkCircle}
                      onPress={() => setShowComplete(v)}
                    >
                      <Text style={styles.checkEmpty}>○</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Center: info */}
                <View style={styles.vaccineCenter}>
                  <View style={styles.vaccineNameRow}>
                    <Text style={[styles.vaccineName, v.completed && styles.vaccineNameDone]}>
                      {v.name} {v.dose}
                    </Text>
                    {v.required && <View style={styles.requiredBadge}><Text style={styles.requiredText}>{t('vaccination.required')}</Text></View>}
                  </View>
                  {v.completed ? (
                    <Text style={styles.vaccineCompleted}>
                      {t('vaccination.completedOn', { date: v.completedAt ? new Date(v.completedAt).toLocaleDateString('ko-KR') : '' })}
                      {v.hospitalName ? ` · ${v.hospitalName}` : ` · ${v.disease}`}
                    </Text>
                  ) : (
                    <Text style={styles.vaccineSchedule} numberOfLines={1}>
                      {t('vaccination.scheduledOn', { date: v.scheduledDate })} · {v.disease}
                    </Text>
                  )}
                </View>

                {/* Right: D-day */}
                {!v.completed && (
                  <View style={styles.vaccineRight}>
                    <Text style={[styles.dDayText, { color: dDayColor(v.dDay) }]}>
                      {dDayLabel(v.dDay)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {!loading && filtered.length === 0 && (
          <View style={styles.emptyCenter}>
            <Image
              source={
                filter === 'completed'
                  ? require('../../assets/preg-ribbon.png')
                  : filter === 'overdue'
                  ? require('../../assets/mascot-happy.png')
                  : require('../../assets/quick-syringe.png')
              }
              style={styles.emptyIconImg}
              resizeMode="contain"
            />
            <Text style={styles.emptyText}>
              {filter === 'completed' ? t('vaccination.emptyCompleted') :
               filter === 'overdue' ? t('vaccination.emptyOverdue') :
               t('vaccination.emptyUpcoming')}
            </Text>
          </View>
        )}

        <MedicalCitation
          note={t('vaccination.citationNote')}
          sources={[
            { label: t('vaccination.citationSourceKdca'), url: 'https://nip.kdca.go.kr' },
            { label: t('vaccination.citationSourcePediatrics'), url: 'https://www.pediatrics.or.kr' },
          ]}
        />
      </ScrollView>

      {/* ════════════════════════════════════════════════ */}
      {/*  접종 완료 모달                                   */}
      {/* ════════════════════════════════════════════════ */}
      <Modal
        visible={!!showComplete}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowComplete(null); setHospitalName(''); setCompletedDate(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {showComplete?.completed ? t('vaccination.editModalTitle') : t('vaccination.completeModalTitle')}
            </Text>
            {showComplete && (
              <>
                <View style={styles.modalInfoBox}>
                  <Text style={styles.modalVaccineName}>
                    {showComplete.name} {showComplete.dose}
                  </Text>
                  <Text style={styles.modalVaccineDisease}>{showComplete.disease}</Text>
                </View>

                <Text style={styles.modalLabel}>{t('vaccination.vaccinationDateLabel')}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t('vaccination.datePlaceholder', { date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` })}
                  placeholderTextColor={COLORS.textLight}
                  value={completedDate}
                  onChangeText={setCompletedDate}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />

                <Text style={styles.modalLabel}>{t('vaccination.hospitalLabelOptional')}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t('vaccination.hospitalPlaceholder')}
                  placeholderTextColor={COLORS.textLight}
                  value={hospitalName}
                  onChangeText={setHospitalName}
                />

                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => { setShowComplete(null); setHospitalName(''); setCompletedDate(''); }}
                  >
                    <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSaveBtn, completing && { opacity: 0.5 }]}
                    onPress={handleComplete}
                    disabled={completing}
                  >
                    <Text style={styles.modalSaveText}>
                      {completing
                        ? t('vaccination.recordingInProgress')
                        : showComplete.completed
                          ? t('common.save')
                          : t('vaccination.completeExclaim')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════ */}
      {/*  접종 상세 모달                                   */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={!!showDetail} animationType="slide" transparent onRequestClose={() => setShowDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {showDetail && (
              <>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailName}>
                    {showDetail.name} {showDetail.dose}
                  </Text>
                  {showDetail.required && (
                    <View style={styles.requiredBadge}><Text style={styles.requiredText}>{t('vaccination.required')}</Text></View>
                  )}
                </View>
                <Text style={styles.detailDisease}>{t('vaccination.diseasePrevention', { disease: showDetail.disease })}</Text>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>{t('vaccination.vaccinationTimingTitle')}</Text>
                  <Text style={styles.detailSectionBody}>
                    {t('vaccination.recommendedLabel', { age: ageLabel(showDetail.ageMonths, t) })}{'\n'}
                    {t('vaccination.allowedRangeLabel', { start: ageLabel(showDetail.rangeStart, t), end: ageLabel(showDetail.rangeEnd, t) })}{'\n'}
                    {t('vaccination.scheduledDateLabel', { date: showDetail.scheduledDate })}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>{t('vaccination.notesTitle')}</Text>
                  <Text style={styles.detailSectionBody}>{showDetail.notes}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>{t('vaccination.preparationTitle')}</Text>
                  <Text style={styles.detailSectionBody}>{showDetail.preparation}</Text>
                </View>

                {showDetail.completed ? (
                  <>
                    <View style={styles.detailDoneBox}>
                      <Text style={styles.detailDoneText}>
                        {t('vaccination.completedOnCheck', { date: showDetail.completedAt ? new Date(showDetail.completedAt).toLocaleDateString('ko-KR') : '' })}
                        {showDetail.hospitalName ? ` (${showDetail.hospitalName})` : ''}
                      </Text>
                    </View>
                    <View style={styles.detailEditRow}>
                      <TouchableOpacity style={styles.detailEditBtn} onPress={() => openEditModal(showDetail)}>
                        <Text style={styles.detailEditBtnText}>{t('common.edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.detailDeleteBtn} onPress={() => handleDelete(showDetail)}>
                        <Text style={styles.detailDeleteBtnText}>{t('common.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.detailCompleteBtn}
                    onPress={() => { setShowDetail(null); setShowComplete(showDetail); }}
                  >
                    <Text style={styles.detailCompleteBtnText}>{t('vaccination.recordCompletionButton')}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setShowDetail(null)}>
                  <Text style={styles.detailCloseText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      <AdSlot />
      <GuideCarousel visible={guideVisible} pages={getVaccinationGuide(t)} onClose={closeGuide} onComplete={closeGuide} accent="#5B8DEF" />
    </View>
  );
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  navBar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  scrollContent: { padding: SPACING.md, paddingBottom: 100 },

  /* Summary */
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.medium,
  },
  summaryTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  summaryLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, height: 30, backgroundColor: COLORS.border },
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.success },
  progressText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'right', marginTop: 4 },

  /* Filter */
  filterRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#FFF', fontWeight: '700' },

  /* Age group — 컴팩트 */
  ageGroup: { marginBottom: 10 },
  ageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ageBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  ageBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  ageLine: { flex: 1, height: 1, backgroundColor: COLORS.border, marginLeft: 6 },

  /* Vaccine card — 컴팩트 (위아래 폭 축소) */
  vaccineCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 4,
    marginLeft: 8,
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  vaccineCardDone: { backgroundColor: '#F0FFF0', borderLeftWidth: 3, borderLeftColor: COLORS.success },
  vaccineCardOverdue: { backgroundColor: '#FFF0F0', borderLeftWidth: 3, borderLeftColor: COLORS.error },
  vaccineCardUrgent: { backgroundColor: '#FFF3E0', borderLeftWidth: 3, borderLeftColor: '#E91E63' },

  vaccineLeft: { marginRight: 8 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  checkEmpty: { color: COLORS.textLight, fontSize: 14 },
  checkCircleDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center' },
  checkMark: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  vaccineCenter: { flex: 1 },
  vaccineNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vaccineName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  vaccineNameDone: { color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  requiredBadge: { backgroundColor: '#E91E63', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 0 },
  requiredText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  vaccineDisease: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  vaccineCompleted: { fontSize: 10, color: COLORS.success, marginTop: 1 },
  vaccineSchedule: { fontSize: 10, color: COLORS.textLight, marginTop: 1 },

  vaccineRight: { marginLeft: 6 },
  dDayText: { fontSize: 12, fontWeight: '600' },

  /* Empty */
  emptyCenter: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyIconImg: { width: 64, height: 64, marginBottom: 12 },
  emptyText: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text, textAlign: 'center' },

  /* Modal base */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },

  /* Complete modal */
  modalInfoBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  modalVaccineName: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  modalVaccineDisease: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  modalLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  modalInput: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  modalBtns: { flexDirection: 'row', gap: SPACING.md },
  modalCancelBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, fontWeight: '600' },
  modalSaveBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.success,
    alignItems: 'center',
  },
  modalSaveText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '700' },

  /* Detail modal */
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  detailName: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  detailDisease: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.md },
  detailSection: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  detailSectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  detailSectionBody: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
  detailDoneBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  detailDoneText: { fontSize: FONT_SIZE.md, color: COLORS.success, fontWeight: '600', textAlign: 'center' },
  detailEditRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  detailEditBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  detailEditBtnText: { fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '700' },
  detailDeleteBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: COLORS.error,
    alignItems: 'center',
  },
  detailDeleteBtnText: { fontSize: FONT_SIZE.md, color: COLORS.error, fontWeight: '700' },
  detailCompleteBtn: {
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  detailCompleteBtnText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '700' },
  detailCloseBtn: {
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  detailCloseText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
});

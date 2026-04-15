import { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { Stack } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { vaccinationApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

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
  completedAt: string | null;
  hospitalName: string | null;
}

type FilterKey = 'upcoming' | 'overdue' | 'completed' | 'all';

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function ageLabel(months: number): string {
  if (months === 0) return '출생';
  if (months < 12) return `${months}개월`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `만 ${y}세 ${m}개월` : `만 ${y}세`;
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

export default function VaccinationScreen() {
  const child = useChildStore((s) => s.selectedChild);
  const childId = child?.id ?? '';

  const [schedule, setSchedule] = useState<VaccineItem[]>([]);
  const [, setAgeMonths] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('upcoming');

  // Complete modal
  const [showComplete, setShowComplete] = useState<VaccineItem | null>(null);
  const [hospitalName, setHospitalName] = useState('');
  const [completing, setCompleting] = useState(false);

  // Detail modal
  const [showDetail, setShowDetail] = useState<VaccineItem | null>(null);

  /* ── Load ── */
  const loadSchedule = useCallback(async () => {
    if (!childId) return;
    try {
      const res = await vaccinationApi.schedule(childId);
      const data = res.data?.data;
      if (!data) throw new Error('응답 데이터 없음');
      setSchedule(data.schedule ?? []);
      setAgeMonths(data.ageMonths ?? 0);
    } catch {
      Alert.alert('오류', '접종 일정을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해주세요.');
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // 앱 진입 시 알림 자동 스케줄링
  useEffect(() => {
    if (childId) {
      vaccinationApi.scheduleAlerts(childId).catch(() => {/* silent */});
    }
  }, [childId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSchedule();
    setRefreshing(false);
  };

  /* ── Complete ── */
  const handleComplete = async () => {
    if (!showComplete || !childId) return;
    setCompleting(true);
    try {
      await vaccinationApi.complete(childId, showComplete.id, undefined, hospitalName || undefined);
      setShowComplete(null);
      setHospitalName('');
      loadSchedule();
      // 알림 재스케줄링
      vaccinationApi.scheduleAlerts(childId).catch(() => {});
    } catch {
      Alert.alert('오류', '접종 완료 기록에 실패했습니다');
    }
    setCompleting(false);
  };

  /* ── Filter ── */
  const filtered = schedule.filter((v) => {
    switch (filter) {
      case 'upcoming': return !v.completed && v.dDay >= -30;
      case 'overdue': return !v.completed && v.dDay < 0;
      case 'completed': return v.completed;
      case 'all': return true;
    }
  });

  // 연령 그룹별로 묶기
  const grouped = filtered.reduce<Record<string, VaccineItem[]>>((acc, v) => {
    const label = ageLabel(v.ageMonths);
    if (!acc[label]) acc[label] = [];
    acc[label].push(v);
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped);

  /* ── Stats ── */
  const totalCount = schedule.length;
  const completedCount = schedule.filter((v) => v.completed).length;
  const upcomingCount = schedule.filter((v) => !v.completed && v.dDay >= 0 && v.dDay <= 30).length;
  const overdueCount = schedule.filter((v) => !v.completed && v.dDay < 0).length;

  if (!child || child.isPregnant) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '접종달력' }} />
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyIcon}>💉</Text>
          <Text style={styles.emptyText}>
            {child?.isPregnant ? '출산 후 이용 가능합니다' : '아이를 선택해주세요'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${child.name} 접종달력` }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary Card ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{child.name}의 접종 현황</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{completedCount}/{totalCount}</Text>
              <Text style={styles.summaryLabel}>완료</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, upcomingCount > 0 && { color: COLORS.primary }]}>{upcomingCount}</Text>
              <Text style={styles.summaryLabel}>다가오는</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, overdueCount > 0 && { color: COLORS.error }]}>{overdueCount}</Text>
              <Text style={styles.summaryLabel}>놓친 접종</Text>
            </View>
          </View>
          {/* Progress bar */}
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}% 완료
          </Text>
        </View>

        {/* ── Filter Tabs ── */}
        <View style={styles.filterRow}>
          {([
            { key: 'upcoming' as FilterKey, label: '다가오는' },
            { key: 'overdue' as FilterKey, label: '놓친 접종' },
            { key: 'completed' as FilterKey, label: '완료' },
            { key: 'all' as FilterKey, label: '전체' },
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
                    {v.required && <View style={styles.requiredBadge}><Text style={styles.requiredText}>필수</Text></View>}
                  </View>
                  <Text style={styles.vaccineDisease}>{v.disease}</Text>
                  {v.completed ? (
                    <Text style={styles.vaccineCompleted}>
                      {v.completedAt ? new Date(v.completedAt).toLocaleDateString('ko-KR') : ''} 접종 완료
                      {v.hospitalName ? ` · ${v.hospitalName}` : ''}
                    </Text>
                  ) : (
                    <Text style={styles.vaccineSchedule}>
                      {v.scheduledDate} 예정
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
            <Text style={styles.emptyIcon}>
              {filter === 'completed' ? '🎉' : filter === 'overdue' ? '✅' : '💉'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'completed' ? '아직 완료한 접종이 없어요' :
               filter === 'overdue' ? '놓친 접종이 없어요!' :
               '예정된 접종이 없어요'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ════════════════════════════════════════════════ */}
      {/*  접종 완료 모달                                   */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={!!showComplete} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>접종 완료 기록</Text>
            {showComplete && (
              <>
                <View style={styles.modalInfoBox}>
                  <Text style={styles.modalVaccineName}>
                    {showComplete.name} {showComplete.dose}
                  </Text>
                  <Text style={styles.modalVaccineDisease}>{showComplete.disease}</Text>
                </View>

                <Text style={styles.modalLabel}>접종 병원 (선택)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="예: OO소아과"
                  placeholderTextColor={COLORS.textLight}
                  value={hospitalName}
                  onChangeText={setHospitalName}
                />

                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => { setShowComplete(null); setHospitalName(''); }}
                  >
                    <Text style={styles.modalCancelText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSaveBtn, completing && { opacity: 0.5 }]}
                    onPress={handleComplete}
                    disabled={completing}
                  >
                    <Text style={styles.modalSaveText}>
                      {completing ? '기록 중...' : '접종 완료!'}
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
      <Modal visible={!!showDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {showDetail && (
              <>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailName}>
                    {showDetail.name} {showDetail.dose}
                  </Text>
                  {showDetail.required && (
                    <View style={styles.requiredBadge}><Text style={styles.requiredText}>필수</Text></View>
                  )}
                </View>
                <Text style={styles.detailDisease}>{showDetail.disease} 예방</Text>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>접종 시기</Text>
                  <Text style={styles.detailSectionBody}>
                    권장: {ageLabel(showDetail.ageMonths)}{'\n'}
                    허용 범위: {ageLabel(showDetail.rangeStart)} ~ {ageLabel(showDetail.rangeEnd)}{'\n'}
                    예정일: {showDetail.scheduledDate}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>참고사항</Text>
                  <Text style={styles.detailSectionBody}>{showDetail.notes}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>준비물 & 주의사항</Text>
                  <Text style={styles.detailSectionBody}>{showDetail.preparation}</Text>
                </View>

                {showDetail.completed ? (
                  <View style={styles.detailDoneBox}>
                    <Text style={styles.detailDoneText}>
                      ✓ {showDetail.completedAt ? new Date(showDetail.completedAt).toLocaleDateString('ko-KR') : ''} 접종 완료
                      {showDetail.hospitalName ? ` (${showDetail.hospitalName})` : ''}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.detailCompleteBtn}
                    onPress={() => { setShowDetail(null); setShowComplete(showDetail); }}
                  >
                    <Text style={styles.detailCompleteBtnText}>접종 완료 기록하기</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setShowDetail(null)}>
                  <Text style={styles.detailCloseText}>닫기</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
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

  /* Age group */
  ageGroup: { marginBottom: SPACING.lg },
  ageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  ageBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  ageBadgeText: { color: '#FFF', fontSize: FONT_SIZE.sm, fontWeight: '700' },
  ageLine: { flex: 1, height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.sm },

  /* Vaccine card */
  vaccineCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginLeft: 12,
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  vaccineCardDone: { backgroundColor: '#F0FFF0', borderLeftWidth: 3, borderLeftColor: COLORS.success },
  vaccineCardOverdue: { backgroundColor: '#FFF0F0', borderLeftWidth: 3, borderLeftColor: COLORS.error },
  vaccineCardUrgent: { backgroundColor: '#FFF3E0', borderLeftWidth: 3, borderLeftColor: '#E91E63' },

  vaccineLeft: { marginRight: SPACING.sm },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  checkEmpty: { color: COLORS.textLight, fontSize: 18 },
  checkCircleDone: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center' },
  checkMark: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  vaccineCenter: { flex: 1 },
  vaccineNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vaccineName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  vaccineNameDone: { color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  requiredBadge: { backgroundColor: '#E91E63', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  requiredText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  vaccineDisease: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  vaccineCompleted: { fontSize: FONT_SIZE.xs, color: COLORS.success, marginTop: 2 },
  vaccineSchedule: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 2 },

  vaccineRight: { marginLeft: SPACING.sm },
  dDayText: { fontSize: FONT_SIZE.md, fontWeight: '700' },

  /* Empty */
  emptyCenter: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
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

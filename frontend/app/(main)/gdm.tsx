import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { pregnancyApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type MealType = 'fasting' | 'before_meal' | 'after_meal_1h' | 'after_meal_2h' | 'bedtime';

const MEAL_LABELS: Record<MealType, string> = {
  fasting: '공복',
  before_meal: '식전',
  after_meal_1h: '식후 1시간',
  after_meal_2h: '식후 2시간',
  bedtime: '취침 전',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  normal: { bg: '#E8F5E9', text: '#2E7D32', label: '정상' },
  caution: { bg: '#FFF8E1', text: '#F57F17', label: '주의' },
  warning: { bg: '#FFEBEE', text: '#C62828', label: '위험' },
};

interface GdmRecord {
  id: string;
  glucoseLevel: number;
  mealType: MealType;
  status: 'normal' | 'caution' | 'warning';
  memo: string | null;
  measuredAt: string;
  date: string;
}

interface GdmStats {
  total: number;
  avg: number;
  max: number;
  min: number;
  cautionCount: number;
  warningCount: number;
  days: number;
}

export default function GdmScreen() {
  const child = useChildStore((s) => s.selectedChild);
  const childId = child?.id ?? '';

  const [records, setRecords] = useState<GdmRecord[]>([]);
  const [stats, setStats] = useState<GdmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 입력 모달
  const [showModal, setShowModal] = useState(false);
  const [glucose, setGlucose] = useState('');
  const [mealType, setMealType] = useState<MealType>('fasting');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!childId) return;
    try {
      const res = await pregnancyApi.getGdm(childId, 30);
      const data = res.data?.data ?? res.data;
      if (data?.records) setRecords(data.records as GdmRecord[]);
      if (data?.stats) setStats(data.stats as GdmStats);
    } catch { /* silent */ }
  }, [childId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSave = async () => {
    const level = parseFloat(glucose);
    if (isNaN(level) || level < 30 || level > 500) {
      Alert.alert('알림', '혈당 수치를 올바르게 입력해주세요 (30~500 mg/dL)');
      return;
    }
    setSaving(true);
    try {
      await pregnancyApi.saveGdm({
        childId,
        glucoseLevel: level,
        mealType,
        memo: memo.trim() || undefined,
      });
      setGlucose('');
      setMemo('');
      setShowModal(false);
      await loadData();
    } catch {
      Alert.alert('오류', '혈당 기록 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await pregnancyApi.deleteGdm(id);
            await loadData();
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  // 날짜별 그룹핑
  const grouped: Record<string, GdmRecord[]> = {};
  for (const r of records) {
    const key = r.date ?? r.measuredAt?.slice(0, 10) ?? 'unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // 기준 수치 안내
  const thresholdInfo = `공복: 95 이하 | 식후1h: 140 이하 | 식후2h: 120 이하`;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '임당 관리', headerShown: true }} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 산모 정보 */}
        {child && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{child.name} 산모님의 임당 관리</Text>
            {child.momWeight ? (
              <Text style={styles.infoSub}>
                {child.momHeight ? `${child.momHeight}cm` : ''}{child.momWeight ? ` / ${child.momWeight}kg` : ''}
                {child.momBloodType ? ` / ${child.momBloodType}형` : ''}
              </Text>
            ) : null}
            <Text style={styles.thresholdText}>{thresholdInfo}</Text>
          </View>
        )}

        {/* 통계 카드 */}
        {stats && stats.total > 0 && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>최근 {stats.days}일 통계</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.avg}</Text>
                <Text style={styles.statLabel}>평균</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.min}</Text>
                <Text style={styles.statLabel}>최저</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.max}</Text>
                <Text style={styles.statLabel}>최고</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>측정</Text>
              </View>
            </View>
            {(stats.cautionCount > 0 || stats.warningCount > 0) && (
              <View style={styles.alertRow}>
                {stats.cautionCount > 0 && (
                  <View style={[styles.alertPill, { backgroundColor: '#FFF8E1' }]}>
                    <Text style={{ color: '#F57F17', fontSize: 12, fontWeight: '600' }}>
                      주의 {stats.cautionCount}회
                    </Text>
                  </View>
                )}
                {stats.warningCount > 0 && (
                  <View style={[styles.alertPill, { backgroundColor: '#FFEBEE' }]}>
                    <Text style={{ color: '#C62828', fontSize: 12, fontWeight: '600' }}>
                      위험 {stats.warningCount}회
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* 기록 리스트 */}
        {!loading && dateKeys.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>{'🩸'}</Text>
            <Text style={styles.emptyTitle}>아직 기록이 없어요</Text>
            <Text style={styles.emptySub}>+ 버튼으로 혈당을 기록해보세요</Text>
          </View>
        )}

        {dateKeys.map((date) => (
          <View key={date} style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{formatKoreanDate(date)}</Text>
            {grouped[date].map((r) => {
              const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.normal;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={styles.recordCard}
                  onLongPress={() => handleDelete(r.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recordLeft}>
                    <Text style={styles.recordGlucose}>{r.glucoseLevel}</Text>
                    <Text style={styles.recordUnit}>mg/dL</Text>
                  </View>
                  <View style={styles.recordCenter}>
                    <Text style={styles.recordMeal}>{MEAL_LABELS[r.mealType] ?? r.mealType}</Text>
                    {r.memo ? <Text style={styles.recordMemo} numberOfLines={1}>{r.memo}</Text> : null}
                    <Text style={styles.recordTime}>{r.measuredAt?.slice(11, 16) ?? ''}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* 입력 모달 */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalBack}>{'< 뒤로'}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>혈당 기록</Text>
              <View style={{ width: 50 }} />
            </View>

            <Text style={styles.modalLabel}>혈당 수치 (mg/dL)</Text>
            <TextInput
              style={styles.modalInput}
              value={glucose}
              onChangeText={setGlucose}
              placeholder="예: 95"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              autoFocus
            />

            <Text style={styles.modalLabel}>측정 시점</Text>
            <View style={styles.mealGrid}>
              {(Object.keys(MEAL_LABELS) as MealType[]).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.mealChip, mealType === key && styles.mealChipActive]}
                  onPress={() => setMealType(key)}
                >
                  <Text style={[styles.mealChipText, mealType === key && styles.mealChipTextActive]}>
                    {MEAL_LABELS[key]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>메모 (선택)</Text>
            <TextInput
              style={[styles.modalInput, { height: 50 }]}
              value={memo}
              onChangeText={setMemo}
              placeholder="아침식사 후, 간식 먹고 등"
              placeholderTextColor={COLORS.textLight}
              multiline
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '기록 저장'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: SPACING.md },

  /* Info card */
  infoCard: {
    backgroundColor: '#FCE4EC',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  infoTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: '#AD1457', marginBottom: 4 },
  infoSub: { fontSize: FONT_SIZE.sm, color: '#C2185B' },
  thresholdText: { fontSize: 11, color: '#880E4F', marginTop: 8, textAlign: 'center' },

  /* Stats */
  statsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  statsTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  alertRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm, justifyContent: 'center' },
  alertPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },

  /* Records */
  dateGroup: { marginBottom: SPACING.md },
  dateLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    paddingLeft: 4,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 6,
    ...SHADOWS.soft,
  },
  recordLeft: { flexDirection: 'row', alignItems: 'baseline', marginRight: SPACING.md, minWidth: 70 },
  recordGlucose: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  recordUnit: { fontSize: 11, color: COLORS.textSecondary, marginLeft: 2 },
  recordCenter: { flex: 1 },
  recordMeal: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  recordMemo: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  recordTime: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },

  /* Empty */
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  emptySub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },

  /* FAB */
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E91E63',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  },
  fabText: { fontSize: 28, color: '#FFF', fontWeight: '300', marginTop: -2 },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalBack: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600' },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  modalLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  mealChipActive: { borderColor: '#E91E63', backgroundColor: '#FCE4EC' },
  mealChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  mealChipTextActive: { color: '#E91E63', fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#E91E63',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  saveBtnText: { color: '#FFF', fontSize: FONT_SIZE.lg, fontWeight: '600' },
});

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { childApi } from '../../services/api';
import {
  cancelAllChildLocalNotifications,
  cancelAllPregnancyLocalNotifications,
  schedulePregnancyReminders,
} from '../../services/pushNotifications';
import { captureError } from '../../services/sentry';
import { useChildStore, Child } from '../../stores/childStore';
import { BackButton } from '../../components/common/BackButton';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

export default function ChildEditScreen() {
  const { t } = useTranslation();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const updateChild = useChildStore((s) => s.updateChild);
  const removeChild = useChildStore((s) => s.removeChild);
  const [loading, setLoading] = useState(false);

  // 공통
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'U'>('M');

  // 아이 전용
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  // 임산부 전용
  const [dueDate, setDueDate] = useState('');
  const [pregnancyNotes, setPregnancyNotes] = useState('');
  const [momHeight, setMomHeight] = useState('');
  const [momWeight, setMomWeight] = useState('');
  const [momBloodType, setMomBloodType] = useState('');
  const [momSpecialNotes, setMomSpecialNotes] = useState('');
  const [isHighRiskPregnancy, setIsHighRiskPregnancy] = useState(false);

  const isPregnant = selectedChild?.isPregnant === true;

  useEffect(() => {
    if (!selectedChild) return;
    setName(selectedChild.name ?? '');
    setGender(selectedChild.gender ?? 'U');
    // 아이
    setHeight(selectedChild.height ? String(selectedChild.height) : '');
    setWeight(selectedChild.weight ? String(selectedChild.weight) : '');
    setBloodType(selectedChild.bloodType ?? '');
    setSpecialNotes(selectedChild.specialNotes ?? '');
    // 임산부
    setDueDate(selectedChild.dueDate ?? '');
    setPregnancyNotes(selectedChild.pregnancyNotes ?? '');
    setMomHeight(selectedChild.momHeight ? String(selectedChild.momHeight) : '');
    setMomWeight(selectedChild.momWeight ? String(selectedChild.momWeight) : '');
    setMomBloodType(selectedChild.momBloodType ?? '');
    setMomSpecialNotes(selectedChild.momSpecialNotes ?? '');
    setIsHighRiskPregnancy(selectedChild.isHighRiskPregnancy === true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id]);

  if (!selectedChild) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('childEdit.infoManagement'), headerShown: true, headerLeft: () => <BackButton /> }} />
        <Text style={styles.emptyText}>{t('childEdit.noSelectedChild')}</Text>
      </View>
    );
  }

  // 숫자 입력 안전 파싱 — "abc" 같은 비숫자 입력 → null. NaN Firestore 저장 방지.
  const safeParseNum = (raw: string, label: string): number | null | 'INVALID' => {
    if (!raw.trim()) return null;
    const n = parseFloat(raw.replace(/,/g, '.'));
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert(t('common.notice'), t('childEdit.invalidNumberMessage', { label }));
      return 'INVALID';
    }
    return n;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.notice'), t('childEdit.nameRequired'));
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { name: name.trim(), gender };

      if (isPregnant) {
        if (dueDate.trim()) payload.dueDate = dueDate.trim();
        if (pregnancyNotes.trim()) payload.pregnancyNotes = pregnancyNotes.trim();
        const mh = safeParseNum(momHeight, t('childEdit.momHeightLabel'));
        if (mh === 'INVALID') { setLoading(false); return; }
        payload.momHeight = mh;
        const mw = safeParseNum(momWeight, t('childEdit.momWeightLabel'));
        if (mw === 'INVALID') { setLoading(false); return; }
        payload.momWeight = mw;
        payload.momBloodType = momBloodType || null;
        payload.momSpecialNotes = momSpecialNotes.trim() || null;
        payload.isHighRiskPregnancy = isHighRiskPregnancy;
      } else {
        const h = safeParseNum(height, t('childEdit.childHeightLabel'));
        if (h === 'INVALID') { setLoading(false); return; }
        payload.height = h;
        const w = safeParseNum(weight, t('childEdit.childWeightLabel'));
        if (w === 'INVALID') { setLoading(false); return; }
        payload.weight = w;
        payload.bloodType = bloodType || null;
        payload.specialNotes = specialNotes.trim() || null;
      }

      const res = await childApi.update(selectedChild.id, payload);
      const updated = res.data?.data ?? res.data;
      updateChild({ ...selectedChild, ...updated } as Child);

      // #16 isHighRiskPregnancy 토글 또는 dueDate 변경 → 임신 알림 재스케줄
      // (24주 분만병원 등록 알림이 고위험에만 표시되도록)
      if (isPregnant) {
        const finalDueDate = (updated as { dueDate?: string })?.dueDate ?? dueDate.trim();
        if (finalDueDate) {
          try {
            await schedulePregnancyReminders(selectedChild.id, finalDueDate, {
              isHighRisk: isHighRiskPregnancy,
            });
          } catch (e) {
            captureError(e, { ctx: 'child-edit/reschedulePregnancy', childId: selectedChild.id });
          }
        }
      }

      Alert.alert(t('common.complete'), t('childEdit.updateSuccessMessage'));
      router.back();
    } catch (e) {
      captureError(e, { ctx: 'child-edit/save', childId: selectedChild.id });
      Alert.alert(t('common.error'), t('childEdit.updateFailMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    const label = isPregnant ? t('childEdit.pregnancyInfoLabel') : t('childEdit.childInfoLabel');
    Alert.alert(
      t('childEdit.deleteConfirmTitle', { label }),
      t('childEdit.deleteConfirmMessage', { name: selectedChild.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await childApi.delete(selectedChild.id);
              // 삭제된 아이 관련 로컬 알림 모두 취소
              await cancelAllChildLocalNotifications(selectedChild.id, selectedChild.name);
              if (selectedChild.isPregnant) {
                // #15 per-child: 해당 자녀 임신 알림만 정리
                await cancelAllPregnancyLocalNotifications(selectedChild.id);
              }
              removeChild(selectedChild.id);
              Alert.alert(t('common.complete'), t('childEdit.deleteSuccessMessage', { label }));
              router.back();
            } catch {
              Alert.alert(t('common.error'), t('childEdit.deleteFailMessage'));
            }
          },
        },
      ],
    );
  };

  const screenTitle = isPregnant ? t('childEdit.pregnancyInfoManagement') : t('childEdit.childInfoManagement');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Stack.Screen options={{ title: screenTitle, headerShown: true, headerLeft: () => <BackButton /> }} />

        {/* 기본 정보 */}
        <Text style={styles.sectionTitle}>{t('childEdit.basicInfo')}</Text>

        <Text style={styles.label}>{isPregnant ? t('childEdit.babyNickname') : t('childEdit.name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={isPregnant ? t('childEdit.babyNickname') : t('childEdit.name')}
          placeholderTextColor={COLORS.textLight}
        />

        <Text style={styles.label}>{t('childEdit.gender')}</Text>
        <View style={styles.row}>
          {(['F', 'M'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, gender === g && styles.chipActive]}
              onPress={() => setGender(g)}
              accessibilityRole="radio"
              accessibilityState={{ selected: gender === g }}
              accessibilityLabel={g === 'F' ? t('childEdit.girl') : t('childEdit.boy')}
            >
              <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                {g === 'F' ? t('childEdit.girl') : t('childEdit.boy')}
              </Text>
            </TouchableOpacity>
          ))}
          {isPregnant && (
            <TouchableOpacity
              style={[styles.chip, gender === 'U' && styles.chipActive]}
              onPress={() => setGender('U')}
              accessibilityRole="radio"
              accessibilityState={{ selected: gender === 'U' }}
              accessibilityLabel={t('childEdit.genderUnknown')}
            >
              <Text style={[styles.chipText, gender === 'U' && styles.chipTextActive]}>{t('childEdit.unknown')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 임산부 전용 */}
        {isPregnant && (
          <>
            <Text style={styles.label}>{t('childEdit.dueDate')}</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textLight}
            />

            {/* 고위험 임신 체크박스 — SOS/진통 화면 안내 강도에 영향 */}
            <Text style={styles.label}>{t('childEdit.highRiskPregnancyLabel')}</Text>
            <TouchableOpacity
              style={[styles.checkRow, isHighRiskPregnancy && styles.checkRowActive]}
              onPress={() => setIsHighRiskPregnancy((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkBox, isHighRiskPregnancy && styles.checkBoxOn]}>
                {isHighRiskPregnancy && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkTitle}>{t('childEdit.highRiskCheckTitle')}</Text>
                <Text style={styles.checkSub}>
                  {t('childEdit.highRiskCheckSub')}
                </Text>
              </View>
            </TouchableOpacity>
            {isHighRiskPregnancy && (
              <View style={styles.highRiskInfo}>
                <Text style={styles.highRiskInfoText}>
                  {t('childEdit.highRiskInfoNotice')}
                </Text>
              </View>
            )}

            <Text style={styles.label}>{t('childEdit.pregnancyNotes')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={pregnancyNotes}
              onChangeText={setPregnancyNotes}
              placeholder={t('childEdit.pregnancyNotesPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              multiline
            />

            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>{t('childEdit.momHealthInfo')}</Text>

            <Text style={styles.label}>{t('childEdit.heightCm')}</Text>
            <TextInput
              style={styles.input}
              value={momHeight}
              onChangeText={setMomHeight}
              placeholder={t('childEdit.momHeightPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>{t('childEdit.weightKg')}</Text>
            <TextInput
              style={styles.input}
              value={momWeight}
              onChangeText={setMomWeight}
              placeholder={t('childEdit.momWeightPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>{t('childEdit.bloodType')}</Text>
            <View style={styles.row}>
              {['A', 'B', 'O', 'AB'].map((bt) => (
                <TouchableOpacity
                  key={bt}
                  style={[styles.chip, momBloodType === bt && styles.chipActive]}
                  onPress={() => setMomBloodType(momBloodType === bt ? '' : bt)}
                >
                  <Text style={[styles.chipText, momBloodType === bt && styles.chipTextActive]}>{t('childEdit.bloodTypeSuffix', { type: bt })}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('childEdit.specialNotes')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={momSpecialNotes}
              onChangeText={setMomSpecialNotes}
              placeholder={t('childEdit.momSpecialNotesPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              multiline
            />
          </>
        )}

        {/* 아이 전용 */}
        {!isPregnant && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>{t('childEdit.healthInfo')}</Text>

            <Text style={styles.label}>{t('childEdit.heightCm')}</Text>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={setHeight}
              placeholder={t('childEdit.childHeightPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>{t('childEdit.weightKg')}</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder={t('childEdit.childWeightPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>{t('childEdit.bloodType')}</Text>
            <View style={styles.row}>
              {['A', 'B', 'O', 'AB'].map((bt) => (
                <TouchableOpacity
                  key={bt}
                  style={[styles.chip, bloodType === bt && styles.chipActive]}
                  onPress={() => setBloodType(bloodType === bt ? '' : bt)}
                >
                  <Text style={[styles.chipText, bloodType === bt && styles.chipTextActive]}>{t('childEdit.bloodTypeSuffix', { type: bt })}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('childEdit.specialNotes')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={specialNotes}
              onChangeText={setSpecialNotes}
              placeholder={t('childEdit.childSpecialNotesPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              multiline
            />
          </>
        )}

        {/* 저장 버튼 */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={loading ? t('childEdit.saving') : t('childEdit.saveInfo')}
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          <Text style={styles.saveBtnText}>{loading ? t('childEdit.savingEllipsis') : t('childEdit.saveInfo')}</Text>
        </TouchableOpacity>

        {/* 삭제 버튼 */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel={t('childEdit.deleteChildInfoLabel')}
          accessibilityHint={t('childEdit.deleteChildInfoHint')}
        >
          <Text style={styles.deleteBtnText}>
            {isPregnant ? t('childEdit.deletePregnancyInfo') : t('childEdit.deleteChildInfo')}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingBottom: 120 },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center', marginTop: 100 },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    paddingLeft: SPACING.sm,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  chipText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary, fontWeight: '600' },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontSize: FONT_SIZE.lg, fontWeight: '600' },
  deleteBtn: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#E8847C',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#E8847C', fontSize: FONT_SIZE.md, fontWeight: '600' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  checkRowActive: {
    backgroundColor: '#FFF1ED',
    borderColor: '#E8847C',
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#BBB',
    backgroundColor: '#FFF',
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    borderColor: '#E8847C',
    backgroundColor: '#E8847C',
  },
  checkMark: { color: '#FFF', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  checkTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  checkSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, lineHeight: 17 },
  highRiskInfo: {
    backgroundColor: '#FFF8E8',
    borderLeftWidth: 3,
    borderLeftColor: '#F5B400',
    padding: SPACING.md,
    borderRadius: 8,
    marginTop: SPACING.sm,
  },
  highRiskInfoText: { fontSize: 13, color: '#5A4A20', lineHeight: 19 },
});

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
import { childApi } from '../../services/api';
import {
  cancelAllChildLocalNotifications,
  cancelAllPregnancyLocalNotifications,
} from '../../services/pushNotifications';
import { useChildStore, Child } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

export default function ChildEditScreen() {
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
        <Stack.Screen options={{ title: '정보 관리' }} />
        <Text style={styles.emptyText}>선택된 아이가 없습니다</Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('알림', '이름을 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { name: name.trim(), gender };

      if (isPregnant) {
        if (dueDate.trim()) payload.dueDate = dueDate.trim();
        if (pregnancyNotes.trim()) payload.pregnancyNotes = pregnancyNotes.trim();
        payload.momHeight = momHeight.trim() ? parseFloat(momHeight) : null;
        payload.momWeight = momWeight.trim() ? parseFloat(momWeight) : null;
        payload.momBloodType = momBloodType || null;
        payload.momSpecialNotes = momSpecialNotes.trim() || null;
        payload.isHighRiskPregnancy = isHighRiskPregnancy;
      } else {
        payload.height = height.trim() ? parseFloat(height) : null;
        payload.weight = weight.trim() ? parseFloat(weight) : null;
        payload.bloodType = bloodType || null;
        payload.specialNotes = specialNotes.trim() || null;
      }

      const res = await childApi.update(selectedChild.id, payload);
      const updated = res.data?.data ?? res.data;
      updateChild({ ...selectedChild, ...updated } as Child);
      Alert.alert('완료', '정보가 수정되었습니다.');
      router.back();
    } catch {
      Alert.alert('오류', '정보 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    const label = isPregnant ? '임신 정보' : '아이 정보';
    Alert.alert(
      `${label} 삭제`,
      `${selectedChild.name}의 모든 데이터가 영구적으로 삭제됩니다.\n정말 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await childApi.delete(selectedChild.id);
              // 삭제된 아이 관련 로컬 알림 모두 취소
              await cancelAllChildLocalNotifications(selectedChild.id, selectedChild.name);
              if (selectedChild.isPregnant) {
                await cancelAllPregnancyLocalNotifications();
              }
              removeChild(selectedChild.id);
              Alert.alert('완료', `${label}가 삭제되었습니다.`);
              router.back();
            } catch {
              Alert.alert('오류', '삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

  const screenTitle = isPregnant ? '임신 정보 관리' : '아이 정보 관리';

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
        <Stack.Screen options={{ title: screenTitle }} />

        {/* 기본 정보 */}
        <Text style={styles.sectionTitle}>기본 정보</Text>

        <Text style={styles.label}>{isPregnant ? '태명' : '이름'}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={isPregnant ? '태명' : '이름'}
          placeholderTextColor={COLORS.textLight}
        />

        <Text style={styles.label}>성별</Text>
        <View style={styles.row}>
          {(['F', 'M'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, gender === g && styles.chipActive]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                {g === 'F' ? '여아' : '남아'}
              </Text>
            </TouchableOpacity>
          ))}
          {isPregnant && (
            <TouchableOpacity
              style={[styles.chip, gender === 'U' && styles.chipActive]}
              onPress={() => setGender('U')}
            >
              <Text style={[styles.chipText, gender === 'U' && styles.chipTextActive]}>모름</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 임산부 전용 */}
        {isPregnant && (
          <>
            <Text style={styles.label}>출산예정일</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textLight}
            />

            {/* 고위험 임신 체크박스 — SOS/진통 화면 안내 강도에 영향 */}
            <Text style={styles.label}>고위험 임신 여부</Text>
            <TouchableOpacity
              style={[styles.checkRow, isHighRiskPregnancy && styles.checkRowActive]}
              onPress={() => setIsHighRiskPregnancy((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkBox, isHighRiskPregnancy && styles.checkBoxOn]}>
                {isHighRiskPregnancy && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkTitle}>⚠️ 고위험 임신이에요</Text>
                <Text style={styles.checkSub}>
                  쌍둥이/세쌍둥이, 임신성 고혈압, 임신성 당뇨, 조산 이력,{'\n'}
                  35세 이상 고령 임신, 전치태반, 기타 의사 권고 사항
                </Text>
              </View>
            </TouchableOpacity>
            {isHighRiskPregnancy && (
              <View style={styles.highRiskInfo}>
                <Text style={styles.highRiskInfoText}>
                  💡 24주부터 분만 병원 등록 알림이 표시되고,{'\n'}
                  진통 발생 시 더 빠른 응급 안내가 제공됩니다.
                </Text>
              </View>
            )}

            <Text style={styles.label}>임신 특이사항</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={pregnancyNotes}
              onChangeText={setPregnancyNotes}
              placeholder="쌍둥이, 고위험 임신 등"
              placeholderTextColor={COLORS.textLight}
              multiline
            />

            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>산모 건강 정보</Text>

            <Text style={styles.label}>키 (cm)</Text>
            <TextInput
              style={styles.input}
              value={momHeight}
              onChangeText={setMomHeight}
              placeholder="예: 163"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>몸무게 (kg)</Text>
            <TextInput
              style={styles.input}
              value={momWeight}
              onChangeText={setMomWeight}
              placeholder="예: 58.5"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>혈액형</Text>
            <View style={styles.row}>
              {['A', 'B', 'O', 'AB'].map((bt) => (
                <TouchableOpacity
                  key={bt}
                  style={[styles.chip, momBloodType === bt && styles.chipActive]}
                  onPress={() => setMomBloodType(momBloodType === bt ? '' : bt)}
                >
                  <Text style={[styles.chipText, momBloodType === bt && styles.chipTextActive]}>{bt}형</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>특이사항</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={momSpecialNotes}
              onChangeText={setMomSpecialNotes}
              placeholder="알레르기, 복용 중인 약, 기저질환 등"
              placeholderTextColor={COLORS.textLight}
              multiline
            />
          </>
        )}

        {/* 아이 전용 */}
        {!isPregnant && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>건강 정보</Text>

            <Text style={styles.label}>키 (cm)</Text>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={setHeight}
              placeholder="예: 85"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>몸무게 (kg)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="예: 11.5"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>혈액형</Text>
            <View style={styles.row}>
              {['A', 'B', 'O', 'AB'].map((bt) => (
                <TouchableOpacity
                  key={bt}
                  style={[styles.chip, bloodType === bt && styles.chipActive]}
                  onPress={() => setBloodType(bloodType === bt ? '' : bt)}
                >
                  <Text style={[styles.chipText, bloodType === bt && styles.chipTextActive]}>{bt}형</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>특이사항</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={specialNotes}
              onChangeText={setSpecialNotes}
              placeholder="알레르기, 조심해야 하는 약 등"
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
        >
          <Text style={styles.saveBtnText}>{loading ? '저장 중...' : '정보 저장'}</Text>
        </TouchableOpacity>

        {/* 삭제 버튼 */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>
            {isPregnant ? '임신 정보 삭제' : '아이 정보 삭제'}
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
  checkMark: { color: '#FFF', fontSize: 14, fontWeight: '900', lineHeight: 16 },
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

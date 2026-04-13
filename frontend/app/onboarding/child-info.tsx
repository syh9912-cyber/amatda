import { useState } from 'react';
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
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { BirthDatePicker } from '../../components/onboarding/BirthDatePicker';
import { BirthTimePicker } from '../../components/onboarding/BirthTimePicker';
import { PhotoPicker } from '../../components/onboarding/PhotoPicker';

type ChildType = 'born' | 'pregnant';

export default function ChildInfoScreen() {
  const [childType, setChildType] = useState<ChildType>('born');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [pregnancyNotes, setPregnancyNotes] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  // 임산부 건강정보
  const [momHeight, setMomHeight] = useState('');
  const [momWeight, setMomWeight] = useState('');
  const [momBloodType, setMomBloodType] = useState('');
  const [momSpecialNotes, setMomSpecialNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const addChild = useChildStore((s) => s.addChild);

  const handleSubmitBorn = async () => {
    if (!name || !gender || !birthDate || !birthTime) {
      Alert.alert('알림', '모든 항목을 입력해주세요');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      Alert.alert('알림', '생년월일을 YYYY-MM-DD 형식으로 입력해주세요');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(birthTime)) {
      Alert.alert('알림', '출생시각을 HH:MM 형식으로 입력해주세요');
      return;
    }

    setLoading(true);
    try {
      const createPayload: Record<string, unknown> = { name, gender, birthDate, birthTime };
      if (height.trim()) createPayload.height = parseFloat(height);
      if (weight.trim()) createPayload.weight = parseFloat(weight);
      if (bloodType.trim()) createPayload.bloodType = bloodType.trim();
      if (specialNotes.trim()) createPayload.specialNotes = specialNotes.trim();
      if (photoUri) createPayload.photoUri = photoUri;
      const res = await childApi.create(createPayload);
      const childData = { ...res.data.data };
      addChild(childData);
      router.replace({
        pathname: '/onboarding/result',
        params: { childId: res.data.data.id },
      });
    } catch {
      Alert.alert('오류', '자녀 등록에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPregnant = async () => {
    if (!name || !dueDate) {
      Alert.alert('알림', '태명과 출산예정일을 입력해주세요');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert('알림', '출산예정일을 YYYY-MM-DD 형식으로 입력해주세요');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = { name, dueDate };
      if (gender) payload.gender = gender;
      if (pregnancyNotes.trim()) payload.pregnancyNotes = pregnancyNotes;
      if (momHeight.trim()) payload.momHeight = parseFloat(momHeight);
      if (momWeight.trim()) payload.momWeight = parseFloat(momWeight);
      if (momBloodType.trim()) payload.momBloodType = momBloodType.trim();
      if (momSpecialNotes.trim()) payload.momSpecialNotes = momSpecialNotes.trim();
      if (photoUri) payload.photoUri = photoUri;

      const res = await childApi.registerPregnant(payload);
      const childData = { ...res.data.data };
      addChild(childData);
      // 임산부는 기질분석 없이 바로 홈으로
      router.replace('/(main)/home');
    } catch {
      Alert.alert('오류', '임신 등록에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <Stack.Screen options={{ title: childType === 'pregnant' ? '임신 등록' : '자녀 정보 입력' }} />

        {/* ── 임신 중 / 태어남 선택 ── */}
        <Text style={styles.heading}>어떤 상황인가요?</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, childType === 'pregnant' && styles.typeBtnActive]}
            onPress={() => setChildType('pregnant')}
          >
            <Text style={styles.typeEmoji}>🤰</Text>
            <Text style={[styles.typeText, childType === 'pregnant' && styles.typeTextActive]}>임신 중</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, childType === 'born' && styles.typeBtnActive]}
            onPress={() => setChildType('born')}
          >
            <Text style={styles.typeEmoji}>👶</Text>
            <Text style={[styles.typeText, childType === 'born' && styles.typeTextActive]}>태어난 아이</Text>
          </TouchableOpacity>
        </View>

        {/* ── 임신 중 폼 ── */}
        {childType === 'pregnant' && (
          <>
            <PhotoPicker photoUri={photoUri} onChangePhoto={setPhotoUri} />
            <Text style={styles.subHeading}>배 속 아기 정보</Text>
            <Text style={styles.desc}>태명을 지어주고, 출산예정일을 알려주세요</Text>

            <View style={styles.form}>
              <Text style={styles.label}>태명</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 콩순이, 복덩이"
                placeholderTextColor={COLORS.textLight}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>출산예정일</Text>
              <BirthDatePicker birthDate={dueDate} onChangeBirthDate={setDueDate} allowFuture placeholder="출산예정일을 선택해주세요" />

              <Text style={styles.label}>성별 (모르면 건너뛰기)</Text>
              <View style={styles.genderRow}>
                {(['F', 'M'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderBtn, gender === g && styles.genderActive]}
                    onPress={() => setGender(gender === g ? null : g)}
                  >
                    <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                      {g === 'F' ? '여아' : '남아'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>임신 특이사항 - 선택</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                placeholder="예: 쌍둥이, 고위험 임신 등"
                placeholderTextColor={COLORS.textLight}
                value={pregnancyNotes}
                onChangeText={setPregnancyNotes}
                multiline
              />

              <Text style={[styles.subHeading, { marginTop: SPACING.lg }]}>산모 건강 정보</Text>
              <Text style={styles.desc}>임당관리 등 맞춤 건강 관리를 위해 입력해주세요</Text>

              <Text style={styles.label}>산모 키 (cm) - 선택</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 163"
                placeholderTextColor={COLORS.textLight}
                value={momHeight}
                onChangeText={setMomHeight}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>산모 몸무게 (kg) - 선택</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 58.5"
                placeholderTextColor={COLORS.textLight}
                value={momWeight}
                onChangeText={setMomWeight}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>산모 혈액형 - 선택</Text>
              <View style={styles.genderRow}>
                {['A', 'B', 'O', 'AB'].map((bt) => (
                  <TouchableOpacity
                    key={bt}
                    style={[styles.genderBtn, momBloodType === bt && styles.genderActive]}
                    onPress={() => setMomBloodType(momBloodType === bt ? '' : bt)}
                  >
                    <Text style={[styles.genderText, momBloodType === bt && styles.genderTextActive]}>{bt}형</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>산모 특이사항 - 선택</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                placeholder="예: 알레르기, 복용 중인 약, 기저질환 등"
                placeholderTextColor={COLORS.textLight}
                value={momSpecialNotes}
                onChangeText={setMomSpecialNotes}
                multiline
              />

              <TouchableOpacity
                style={[styles.button, styles.pregnantButton, loading && styles.buttonDisabled]}
                onPress={handleSubmitPregnant}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? '등록 중...' : '임신 등록하기'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── 태어난 아이 폼 ── */}
        {childType === 'born' && (
          <>
            <PhotoPicker photoUri={photoUri} onChangePhoto={setPhotoUri} />
            <Text style={styles.subHeading}>아이의 정보를 알려주세요</Text>
            <Text style={styles.desc}>생년월일시를 기반으로 고유한 기질을 분석합니다</Text>

            <View style={styles.form}>
              <Text style={styles.label}>이름</Text>
              <TextInput
                style={styles.input}
                placeholder="아이 이름"
                placeholderTextColor={COLORS.textLight}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>성별</Text>
              <View style={styles.genderRow}>
                {(['F', 'M'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderBtn, gender === g && styles.genderActive]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                      {g === 'F' ? '여아' : '남아'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>생년월일</Text>
              <BirthDatePicker birthDate={birthDate} onChangeBirthDate={setBirthDate} />

              <Text style={styles.label}>출생 시각</Text>
              <BirthTimePicker birthTime={birthTime} onChangeBirthTime={setBirthTime} />

              <Text style={styles.label}>키 (cm) - 선택</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 85"
                placeholderTextColor={COLORS.textLight}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>몸무게 (kg) - 선택</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 11.5"
                placeholderTextColor={COLORS.textLight}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>혈액형 - 선택</Text>
              <View style={styles.genderRow}>
                {['A', 'B', 'O', 'AB'].map((bt) => (
                  <TouchableOpacity
                    key={bt}
                    style={[styles.genderBtn, bloodType === bt && styles.genderActive]}
                    onPress={() => setBloodType(bloodType === bt ? '' : bt)}
                  >
                    <Text style={[styles.genderText, bloodType === bt && styles.genderTextActive]}>{bt}형</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>특이사항 - 선택</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                placeholder="예: 알레르기, 조심해야 하는 약 등"
                placeholderTextColor={COLORS.textLight}
                value={specialNotes}
                onChangeText={setSpecialNotes}
                multiline
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSubmitBorn}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? '분석 중...' : '기질 분석하기'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingBottom: 160 },
  heading: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.md },
  subHeading: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginTop: SPACING.lg },
  desc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, marginBottom: SPACING.lg },
  typeRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  typeBtn: {
    flex: 1,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  typeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  typeEmoji: { fontSize: 32 },
  typeText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, fontWeight: '600' },
  typeTextActive: { color: COLORS.primary },
  form: { gap: SPACING.md },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginTop: SPACING.xs },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  genderRow: { flexDirection: 'row', gap: SPACING.md },
  genderBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  genderActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  genderText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  genderTextActive: { color: COLORS.primary, fontWeight: '600' },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  pregnantButton: { backgroundColor: '#E91E63' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: FONT_SIZE.lg, fontWeight: '600' },
});

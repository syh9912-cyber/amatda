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

export default function ChildInfoScreen() {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const addChild = useChildStore((s) => s.addChild);

  const handleSubmit = async () => {
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
        <Stack.Screen options={{ title: '자녀 정보 입력' }} />

        <PhotoPicker photoUri={photoUri} onChangePhoto={setPhotoUri} />

        <Text style={styles.heading}>아이의 정보를 알려주세요</Text>
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

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? '분석 중...' : '기질 분석하기'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingBottom: 160 },
  heading: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.lg },
  desc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, marginBottom: SPACING.lg },
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: FONT_SIZE.lg, fontWeight: '600' },
});

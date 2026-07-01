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
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { childApi, uploadApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { BirthDatePicker } from '../../components/onboarding/BirthDatePicker';
import { BirthTimePicker } from '../../components/onboarding/BirthTimePicker';
import { PhotoPicker } from '../../components/onboarding/PhotoPicker';

type ChildType = 'born' | 'pregnant';

export default function ChildInfoScreen() {
  const { t } = useTranslation();
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
      Alert.alert(t('common.notice'), t('onboardingChildInfo.fillAllFields'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      Alert.alert(t('common.notice'), t('onboardingChildInfo.birthDateFormat'));
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(birthTime)) {
      Alert.alert(t('common.notice'), t('onboardingChildInfo.birthTimeFormat'));
      return;
    }

    setLoading(true);
    try {
      const createPayload: Record<string, unknown> = { name, gender, birthDate, birthTime };
      if (height.trim()) createPayload.height = parseFloat(height);
      if (weight.trim()) createPayload.weight = parseFloat(weight);
      if (bloodType.trim()) createPayload.bloodType = bloodType.trim();
      if (specialNotes.trim()) createPayload.specialNotes = specialNotes.trim();
      if (photoUri) {
        try {
          const uploaded = await uploadApi.upload(photoUri, 'profiles');
          createPayload.photoUri = uploaded.url;
        } catch {
          createPayload.photoUri = photoUri; // 업로드 실패 시 로컬 URI 폴백
        }
      }
      const res = await childApi.create(createPayload);
      const childData = { ...res.data.data };
      addChild(childData);
      router.replace({
        pathname: '/onboarding/result',
        params: { childId: res.data.data.id },
      });
    } catch {
      Alert.alert(t('common.error'), t('onboardingChildInfo.registerChildFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPregnant = async () => {
    if (!name || !dueDate) {
      Alert.alert(t('common.notice'), t('onboardingChildInfo.fillNameAndDueDate'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      Alert.alert(t('common.notice'), t('onboardingChildInfo.dueDateFormat'));
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
      if (photoUri) {
        try {
          const uploaded = await uploadApi.upload(photoUri, 'profiles');
          payload.photoUri = uploaded.url;
        } catch {
          payload.photoUri = photoUri;
        }
      }

      const res = await childApi.registerPregnant(payload);
      const childData = { ...res.data.data };
      addChild(childData);
      // 임산부는 기질분석 없이 바로 홈으로. 알림 priming 은 (main)/_layout 게이트가 처리.
      router.replace('/(main)/home');
    } catch {
      Alert.alert(t('common.error'), t('onboardingChildInfo.registerPregnancyFailed'));
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
        <Stack.Screen
          options={{
            // iOS 뒤로가기: 하드웨어 버튼이 없으므로 이 화면만 네이티브 헤더를 켜서
            // 좌상단 뒤로 버튼 + 엣지 스와이프 + 안전영역(노치) 처리를 일괄 확보.
            // 헤더 배경/색을 앱 톤(크림)에 맞춰 이질감 제거.
            headerShown: true,
            title: childType === 'pregnant' ? t('onboardingChildInfo.titlePregnant') : t('onboardingChildInfo.titleBorn'),
            headerStyle: { backgroundColor: COLORS.background },
            headerShadowVisible: false,
            headerTintColor: COLORS.text,
            headerBackTitle: t('onboardingChildInfo.headerBack'),
            // 이 화면은 onboarding 스택의 첫 화면이라 네이티브 자동 뒤로버튼이 안 뜸 →
            // headerLeft 로 명시적 뒤로 버튼 강제(router.back 은 루트 history 로 복귀: 홈 등).
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('onboardingChildInfo.headerBack')}
              >
                <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '600' }}>{`‹ ${t('onboardingChildInfo.headerBack')}`}</Text>
              </TouchableOpacity>
            ),
          }}
        />

        {/* ── 임신 중 / 태어남 선택 ── */}
        <Text style={styles.heading}>{t('onboardingChildInfo.whatSituation')}</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, childType === 'pregnant' && styles.typeBtnActive]}
            onPress={() => setChildType('pregnant')}
          >
            <Image source={require('../../assets/preg-test.png')} style={styles.typeIcon} resizeMode="contain" />
            <Text style={[styles.typeText, childType === 'pregnant' && styles.typeTextActive]}>{t('onboardingChildInfo.typePregnant')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, childType === 'born' && styles.typeBtnActive]}
            onPress={() => setChildType('born')}
          >
            <Image source={require('../../assets/quick-baby.png')} style={styles.typeIcon} resizeMode="contain" />
            <Text style={[styles.typeText, childType === 'born' && styles.typeTextActive]}>{t('onboardingChildInfo.typeBorn')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── 임신 중 폼 ── */}
        {childType === 'pregnant' && (
          <>
            <PhotoPicker photoUri={photoUri} onChangePhoto={setPhotoUri} />
            <Text style={styles.subHeading}>{t('onboardingChildInfo.pregnantInfoHeading')}</Text>
            <Text style={styles.desc}>{t('onboardingChildInfo.pregnantInfoDesc')}</Text>

            <View style={styles.form}>
              <Text style={styles.label}>{t('onboardingChildInfo.taemyeongLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('onboardingChildInfo.taemyeongPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>{t('onboardingChildInfo.dueDateLabel')}</Text>
              <BirthDatePicker birthDate={dueDate} onChangeBirthDate={setDueDate} allowFuture placeholder={t('onboardingChildInfo.dueDatePlaceholder')} />

              <Text style={styles.label}>{t('onboardingChildInfo.genderSkippableLabel')}</Text>
              <View style={styles.genderRow}>
                {(['F', 'M'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderBtn, gender === g && styles.genderActive]}
                    onPress={() => setGender(gender === g ? null : g)}
                  >
                    <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                      {g === 'F' ? t('onboardingChildInfo.genderGirl') : t('onboardingChildInfo.genderBoy')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('onboardingChildInfo.pregnancyNotesLabel')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                placeholder={t('onboardingChildInfo.pregnancyNotesPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                value={pregnancyNotes}
                onChangeText={setPregnancyNotes}
                multiline
              />

              <Text style={[styles.subHeading, { marginTop: SPACING.lg }]}>{t('onboardingChildInfo.momHealthHeading')}</Text>
              <Text style={styles.desc}>{t('onboardingChildInfo.momHealthDesc')}</Text>

              <Text style={styles.label}>{t('onboardingChildInfo.momHeightLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('onboardingChildInfo.momHeightPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                value={momHeight}
                onChangeText={setMomHeight}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>{t('onboardingChildInfo.momWeightLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('onboardingChildInfo.momWeightPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                value={momWeight}
                onChangeText={setMomWeight}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>{t('onboardingChildInfo.momBloodTypeLabel')}</Text>
              <View style={styles.genderRow}>
                {['A', 'B', 'O', 'AB'].map((bt) => (
                  <TouchableOpacity
                    key={bt}
                    style={[styles.genderBtn, momBloodType === bt && styles.genderActive]}
                    onPress={() => setMomBloodType(momBloodType === bt ? '' : bt)}
                  >
                    <Text style={[styles.genderText, momBloodType === bt && styles.genderTextActive]}>{t('onboardingChildInfo.bloodTypeSuffix', { type: bt })}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('onboardingChildInfo.momSpecialNotesLabel')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                placeholder={t('onboardingChildInfo.momSpecialNotesPlaceholder')}
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
                  {loading ? t('onboardingChildInfo.registeringPregnancy') : t('onboardingChildInfo.registerPregnancyButton')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── 태어난 아이 폼 ── */}
        {childType === 'born' && (
          <>
            <PhotoPicker photoUri={photoUri} onChangePhoto={setPhotoUri} />
            <Text style={styles.subHeading}>{t('onboardingChildInfo.bornInfoHeading')}</Text>
            <Text style={styles.desc}>{t('onboardingChildInfo.bornInfoDesc')}</Text>

            <View style={styles.form}>
              <Text style={styles.label}>{t('onboardingChildInfo.nameLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('onboardingChildInfo.namePlaceholder')}
                placeholderTextColor={COLORS.textLight}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>{t('onboardingChildInfo.genderLabel')}</Text>
              <View style={styles.genderRow}>
                {(['F', 'M'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderBtn, gender === g && styles.genderActive]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                      {g === 'F' ? t('onboardingChildInfo.genderGirl') : t('onboardingChildInfo.genderBoy')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('onboardingChildInfo.birthDateLabel')}</Text>
              <BirthDatePicker birthDate={birthDate} onChangeBirthDate={setBirthDate} />

              <Text style={styles.label}>{t('onboardingChildInfo.birthTimeLabel')}</Text>
              <BirthTimePicker birthTime={birthTime} onChangeBirthTime={setBirthTime} />

              <Text style={styles.label}>{t('onboardingChildInfo.heightLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('onboardingChildInfo.heightPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>{t('onboardingChildInfo.weightLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('onboardingChildInfo.weightPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>{t('onboardingChildInfo.bloodTypeLabel')}</Text>
              <View style={styles.genderRow}>
                {['A', 'B', 'O', 'AB'].map((bt) => (
                  <TouchableOpacity
                    key={bt}
                    style={[styles.genderBtn, bloodType === bt && styles.genderActive]}
                    onPress={() => setBloodType(bloodType === bt ? '' : bt)}
                  >
                    <Text style={[styles.genderText, bloodType === bt && styles.genderTextActive]}>{t('onboardingChildInfo.bloodTypeSuffix', { type: bt })}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('onboardingChildInfo.specialNotesLabel')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                placeholder={t('onboardingChildInfo.specialNotesPlaceholder')}
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
                  {loading ? t('onboardingChildInfo.analyzing') : t('onboardingChildInfo.analyzeTemperamentButton')}
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
  typeIcon: { width: 44, height: 44 },
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

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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const addChild = useChildStore((s) => s.addChild);

  const handleSubmit = async () => {
    if (!name || !gender || !birthDate || !birthTime) {
      Alert.alert('\uC54C\uB9BC', '\uBAA8\uB4E0 \uD56D\uBAA9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      Alert.alert('\uC54C\uB9BC', '\uC0DD\uB144\uC6D4\uC77C\uC744 YYYY-MM-DD \uD615\uC2DD\uC73C\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(birthTime)) {
      Alert.alert('\uC54C\uB9BC', '\uCD9C\uC0DD\uC2DC\uAC01\uC744 HH:MM \uD615\uC2DD\uC73C\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694');
      return;
    }

    setLoading(true);
    try {
      const res = await childApi.create({ name, gender, birthDate, birthTime });
      const childData = { ...res.data.data, photoUri };
      addChild(childData);
      router.replace({
        pathname: '/onboarding/result',
        params: { childId: res.data.data.id },
      });
    } catch {
      Alert.alert('\uC624\uB958', '\uC790\uB140 \uB4F1\uB85D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>
        <Stack.Screen options={{ title: '\uC790\uB140 \uC815\uBCF4 \uC785\uB825' }} />

        <PhotoPicker photoUri={photoUri} onChangePhoto={setPhotoUri} />

        <Text style={styles.heading}>{'\uC544\uC774\uC758 \uC815\uBCF4\uB97C \uC54C\uB824\uC8FC\uC138\uC694'}</Text>
        <Text style={styles.desc}>{'\uC0DD\uB144\uC6D4\uC77C\uC2DC\uB97C \uAE30\uBC18\uC73C\uB85C \uACE0\uC720\uD55C \uAE30\uC9C8\uC744 \uBD84\uC11D\uD569\uB2C8\uB2E4'}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{'\uC774\uB984'}</Text>
          <TextInput
            style={styles.input}
            placeholder={'\uC544\uC774 \uC774\uB984'}
            placeholderTextColor={COLORS.textLight}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>{'\uC131\uBCC4'}</Text>
          <View style={styles.genderRow}>
            {(['F', 'M'] as const).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genderBtn, gender === g && styles.genderActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                  {g === 'F' ? '\uC5EC\uC544' : '\uB0A8\uC544'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{'\uC0DD\uB144\uC6D4\uC77C'}</Text>
          <BirthDatePicker birthDate={birthDate} onChangeBirthDate={setBirthDate} />

          <Text style={styles.label}>{'\uCD9C\uC0DD \uC2DC\uAC01'}</Text>
          <BirthTimePicker birthTime={birthTime} onChangeBirthTime={setBirthTime} />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? '\uBD84\uC11D \uC911...' : '\uAE30\uC9C8 \uBD84\uC11D\uD558\uAE30'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl },
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

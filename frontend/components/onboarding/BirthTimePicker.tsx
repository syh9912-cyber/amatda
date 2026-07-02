import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface BirthTimePickerProps {
  birthTime: string;
  onChangeBirthTime: (time: string) => void;
}

/**
 * 출생 시각 입력 — 직접 텍스트 입력 (HH:MM).
 *
 * 이전엔 native DateTimePicker(아날로그/스피너) 사용했으나
 * "돌려서 체크하는 시스템 불편" 사용자 피드백으로 직접 입력으로 변경.
 *
 * 입력 편의:
 *  - 숫자만 입력하면 자동으로 HH:MM 포맷 (1430 → 14:30)
 *  - 24시간제 (00:00 ~ 23:59)
 *  - 잘못된 값은 시각화 (border 빨강) — 저장은 호환 형식 (HH:MM) 만 허용
 */
function formatTimeInput(raw: string): string {
  // 숫자만 추출, 최대 4자리
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTime(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [h, m] = time.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function BirthTimePicker({ birthTime, onChangeBirthTime }: BirthTimePickerProps) {
  const { t } = useTranslation();
  const handleChange = (text: string) => {
    const formatted = formatTimeInput(text);
    onChangeBirthTime(formatted);
  };

  const showError = birthTime.length === 5 && !isValidTime(birthTime);

  return (
    <View>
      <TextInput
        style={[styles.input, showError && styles.inputError]}
        placeholder={t('components.birthTimePicker.placeholder')}
        placeholderTextColor={COLORS.textLight}
        value={birthTime}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={5}
      />
      {showError ? (
        <Text style={styles.errorText}>{t('components.birthTimePicker.errorText')}</Text>
      ) : (
        <Text style={styles.hintText}>{t('components.birthTimePicker.hintText')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  inputError: {
    borderColor: '#E53935',
    backgroundColor: '#FFEBEE',
  },
  hintText: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 4,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#C62828',
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '600',
  },
});

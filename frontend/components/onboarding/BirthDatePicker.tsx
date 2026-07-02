import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface BirthDatePickerProps {
  birthDate: string;
  onChangeBirthDate: (date: string) => void;
  /** 미래 날짜 허용 (출산예정일 등) — 기본 false */
  allowFuture?: boolean;
  placeholder?: string;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function BirthDatePicker({ birthDate, onChangeBirthDate, allowFuture, placeholder }: BirthDatePickerProps) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  const defaultPlaceholder = allowFuture
    ? t('components.birthDatePicker.selectDatePlaceholder')
    : t('components.birthDatePicker.selectBirthDatePlaceholder');
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const maxDate = allowFuture
    ? new Date(now.getFullYear() + 2, 11, 31)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const minDate = allowFuture ? todayStart : new Date(2000, 0, 1);
  const defaultDate = allowFuture
    ? new Date(now.getFullYear(), now.getMonth() + 6, now.getDate())
    : new Date(2020, 0, 1);

  if (Platform.OS === 'web') {
    return (
      <TextInput
        style={styles.input}
        placeholder={placeholder ?? '2020-01-15'}
        placeholderTextColor={COLORS.textLight}
        value={birthDate}
        onChangeText={onChangeBirthDate}
        keyboardType="numbers-and-punctuation"
      />
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DateTimePicker = require('@react-native-community/datetimepicker').default;

  const currentValue = birthDate ? new Date(birthDate + 'T00:00:00') : defaultDate;

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios');
    if (selectedDate) {
      onChangeBirthDate(toISODate(selectedDate));
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.input} onPress={() => setShow(true)}>
        <Text style={birthDate ? styles.valueText : styles.placeholderText}>
          {birthDate
            ? t('components.birthDatePicker.dateLabel', {
                year: currentValue.getFullYear(),
                month: currentValue.getMonth() + 1,
                day: currentValue.getDate(),
              })
            : placeholder ?? defaultPlaceholder}
        </Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={currentValue}
          mode="date"
          display={Platform.OS === 'ios' || allowFuture ? 'spinner' : 'default'}
          onChange={handleChange}
          maximumDate={maxDate}
          minimumDate={minDate}
        />
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
  },
  valueText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  placeholderText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
  },
});

import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Platform } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface BirthDatePickerProps {
  birthDate: string;
  onChangeBirthDate: (date: string) => void;
}

function formatDateLabel(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}년 ${m}월 ${d}일`;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function BirthDatePicker({ birthDate, onChangeBirthDate }: BirthDatePickerProps) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <TextInput
        style={styles.input}
        placeholder="2020-01-15"
        placeholderTextColor={COLORS.textLight}
        value={birthDate}
        onChangeText={onChangeBirthDate}
        keyboardType="numbers-and-punctuation"
      />
    );
  }

  const DateTimePicker = require('@react-native-community/datetimepicker').default;

  const currentValue = birthDate ? new Date(birthDate + 'T00:00:00') : new Date(2020, 0, 1);

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
          {birthDate ? formatDateLabel(currentValue) : '생년월일을 선택해주세요'}
        </Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={currentValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          maximumDate={new Date()}
          minimumDate={new Date(2000, 0, 1)}
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

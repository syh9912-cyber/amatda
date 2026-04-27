import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Platform } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface BirthTimePickerProps {
  birthTime: string;
  onChangeBirthTime: (time: string) => void;
}

function toHHMM(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function BirthTimePicker({ birthTime, onChangeBirthTime }: BirthTimePickerProps) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <TextInput
        style={styles.input}
        placeholder="14:30"
        placeholderTextColor={COLORS.textLight}
        value={birthTime}
        onChangeText={onChangeBirthTime}
        keyboardType="numbers-and-punctuation"
      />
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DateTimePicker = require('@react-native-community/datetimepicker').default;

  const parseTime = (): Date => {
    const d = new Date(2020, 0, 1, 12, 0);
    if (birthTime && /^\d{2}:\d{2}$/.test(birthTime)) {
      const [h, m] = birthTime.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    }
    return d;
  };

  const currentValue = parseTime();

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios');
    if (selectedDate) {
      onChangeBirthTime(toHHMM(selectedDate));
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.input} onPress={() => setShow(true)}>
        <Text style={birthTime ? styles.valueText : styles.placeholderText}>
          {birthTime || '출생 시각을 선택해주세요'}
        </Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={currentValue}
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
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

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

interface DividerProps {
  text?: string;
  color?: string;
  spacing?: number;
}

export function Divider({
  text,
  color = COLORS.border,
  spacing = SPACING.lg,
}: DividerProps) {
  if (!text) {
    return (
      <View
        style={[
          styles.line,
          { backgroundColor: color, marginVertical: spacing },
        ]}
      />
    );
  }

  return (
    <View style={[styles.container, { marginVertical: spacing }]}>
      <View style={[styles.line, { backgroundColor: color }]} />
      <Text style={[styles.text, { color: COLORS.textLight }]}>
        {text}
      </Text>
      <View style={[styles.line, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  line: {
    flex: 1,
    height: 1,
  },
  text: {
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZE.sm,
  },
});

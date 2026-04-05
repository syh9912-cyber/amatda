import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AppNameDisplayProps {
  size?: 'large' | 'small';
}

const CONFIG = {
  large: { main: 40, sub: 16 },
  small: { main: 28, sub: 12 },
} as const;

const INDIGO = '#4338CA';
const GRAY = '#9CA3AF';

const PARTS: Array<{ text: string; isMain: boolean }> = [
  { text: '\uC544', isMain: true },
  { text: '\uC774', isMain: false },
  { text: '\uB9DE', isMain: true },
  { text: '\uCDA4', isMain: false },
  { text: '\uB2E4', isMain: true },
  { text: '\uC774\uC5B4\uB9AC', isMain: false },
];

export function AppNameDisplay({ size = 'large' }: AppNameDisplayProps) {
  const cfg = CONFIG[size];

  return (
    <View style={styles.row}>
      {PARTS.map((part, i) => (
        <Text
          key={i}
          style={[
            styles.base,
            part.isMain
              ? { fontSize: cfg.main, color: INDIGO, fontWeight: '800' }
              : { fontSize: cfg.sub, color: GRAY, fontWeight: '500' },
          ]}
        >
          {part.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  base: {
    letterSpacing: -0.3,
  },
});

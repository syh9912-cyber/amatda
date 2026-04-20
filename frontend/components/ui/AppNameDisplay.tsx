import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AppNameDisplayProps {
  size?: 'large' | 'small';
}

const CONFIG = {
  large: { main: 48, sub: 18 },
  small: { main: 30, sub: 13 },
} as const;

/* 단일 브랜드 컬러 — Bold/Regular 굵기로만 대비 */
const BRAND = '#1C1C1E';

const PARTS: { text: string; isMain: boolean }[] = [
  { text: '아', isMain: true },
  { text: '이', isMain: false },
  { text: '맞', isMain: true },
  { text: '춤', isMain: false },
  { text: '다', isMain: true },
  { text: '이어리', isMain: false },
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
              ? { fontSize: cfg.main, color: BRAND, fontWeight: '800' }
              : { fontSize: cfg.sub, color: BRAND, fontWeight: '400', opacity: 0.5 },
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
    letterSpacing: -0.5,
  },
});

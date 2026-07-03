import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface AppNameDisplayProps {
  size?: 'large' | 'small';
}

const CONFIG = {
  large: { main: 48, sub: 18 },
  small: { main: 30, sub: 13 },
} as const;

/* 단일 브랜드 컬러 — Bold/Regular 굵기로만 대비 */
const BRAND = '#1C1C1E';

// 한국어 워드마크: 주요 글자(아·맞·다 = 아맞다)를 굵게 강조하고 나머지는 흐리게.
const PARTS: { text: string; isMain: boolean }[] = [
  { text: '아', isMain: true },
  { text: '이', isMain: false },
  { text: '맞', isMain: true },
  { text: '춤', isMain: false },
  { text: '다', isMain: true },
  { text: '이어리', isMain: false },
];

// 비한국어 워드마크 — 한국어 글자 분해 강조가 불가하므로 로마자/가나 단일 표기.
const BRAND_NAME: Record<string, string> = { ja: 'アマッタ', 'zh-Hant': 'Amatda' };

export function AppNameDisplay({ size = 'large' }: AppNameDisplayProps) {
  const cfg = CONFIG[size];
  const { i18n } = useTranslation();

  // 비한국어: 브랜드명을 단일 텍스트로 표시(Amatda / アマッタ)
  const brandName = BRAND_NAME[i18n.language];
  if (brandName) {
    return (
      <View style={styles.row}>
        <Text style={[styles.base, { fontSize: cfg.main, color: BRAND, fontWeight: '800' }]}>
          {brandName}
        </Text>
      </View>
    );
  }

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

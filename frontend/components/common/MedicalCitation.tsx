import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

export interface CitationSource {
  label: string;
  url?: string;
}

/**
 * 의료/건강 정보 출처 표기 (App Store Guideline 1.4.1 준수).
 *
 * 건강·의료 정보를 제공하는 화면 하단에 신뢰할 수 있는 출처를 명시한다.
 * 출처는 사용자가 쉽게 찾을 수 있도록 화면에 항상 노출하고, 가능하면 링크를 제공한다.
 */
export function MedicalCitation({ sources, note }: { sources: CitationSource[]; note?: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>📚 정보 출처</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {sources.map((s, i) =>
        s.url ? (
          <TouchableOpacity key={i} onPress={() => { if (s.url) Linking.openURL(s.url).catch(() => {}); }} activeOpacity={0.7}>
            <Text style={styles.link}>· {s.label}</Text>
          </TouchableOpacity>
        ) : (
          <Text key={i} style={styles.item}>· {s.label}</Text>
        ),
      )}
      <Text style={styles.disclaimer}>
        본 정보는 일반적인 참고용이며 의학적 진단·치료를 대체하지 않습니다. 증상이 있으면 전문의와 상담하세요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  note: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  item: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 18 },
  link: { fontSize: FONT_SIZE.xs, color: COLORS.info, lineHeight: 18, textDecorationLine: 'underline' },
  disclaimer: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 16 },
});

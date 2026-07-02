import { useState } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

export interface CitationSource {
  label: string;
  url?: string;
}

/**
 * 의료/건강 정보 출처 표기 (App Store Guideline 1.4.1 준수).
 *
 * 건강·의료 정보를 제공하는 화면에 신뢰할 수 있는 출처를 명시한다.
 * 출처는 사용자가 쉽게 찾을 수 있도록 화면에 항상 노출하고, 가능하면 링크를 제공한다.
 *
 * `compact` 모드: 화면 상단(헤더 바로 아래)에 둘 수 있는 접이식 형태.
 * 제목 줄("의학 정보 출처·근거")은 항상 보이며, 탭하면 출처 목록이 펼쳐진다.
 * 긴 스크롤 화면에서 출처가 하단에 묻혀 보이지 않는 문제를 해결한다.
 */
export function MedicalCitation({
  sources,
  note,
  compact = false,
}: {
  sources: CitationSource[];
  note?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  // compact 모드는 기본 접힘(제목은 항상 노출), 일반 모드는 항상 펼침.
  const [expanded, setExpanded] = useState(!compact);

  const openLink = (url?: string) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.box, compact && styles.boxCompact]}>
      {compact ? (
        <TouchableOpacity
          style={styles.compactHeader}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('components.medicalCitation.accessibilityLabel')}
        >
          <Text style={styles.title}>{t('components.medicalCitation.titleCompact')}</Text>
          <Text style={styles.toggle}>{expanded ? t('components.medicalCitation.toggleClose') : t('components.medicalCitation.toggleOpen')}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.title}>{t('components.medicalCitation.title')}</Text>
      )}

      {expanded ? (
        <>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          {sources.map((s, i) =>
            s.url ? (
              <TouchableOpacity key={i} onPress={() => openLink(s.url)} activeOpacity={0.7}>
                <Text style={styles.link}>· {s.label}</Text>
              </TouchableOpacity>
            ) : (
              <Text key={i} style={styles.item}>· {s.label}</Text>
            ),
          )}
          <Text style={styles.disclaimer}>
            {t('components.medicalCitation.disclaimer')}
          </Text>
        </>
      ) : null}
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
  boxCompact: {
    marginTop: SPACING.sm,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  toggle: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.info },
  note: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  item: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 18 },
  link: { fontSize: FONT_SIZE.xs, color: COLORS.info, lineHeight: 18, textDecorationLine: 'underline' },
  disclaimer: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 16 },
});

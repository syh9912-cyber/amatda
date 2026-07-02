import { useMemo } from 'react';
import { ScrollView, TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COACHING_COLORS, getCategoriesForAge, getConcernCategories } from './types';
import type { AgeGroupKey } from '../../constants/ageGroups';

interface Props {
  onSelect: (categoryKey: string, label: string) => void;
  ageGroup?: AgeGroupKey;
}

export function CategoryBar({ onSelect, ageGroup }: Props) {
  const { t } = useTranslation();
  const concernCategories = useMemo(() => getConcernCategories(t), [t]);
  const categories = ageGroup ? getCategoriesForAge(concernCategories, ageGroup) : concernCategories;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
    >
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.key}
          style={styles.chip}
          onPress={() => onSelect(cat.key, cat.label)}
          activeOpacity={0.7}
        >
          <Image source={cat.icon} style={styles.chipIcon} resizeMode="contain" />
          <Text style={styles.chipLabel}>{cat.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    maxHeight: 50,
  },
  row: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COACHING_COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: COACHING_COLORS.border,
  },
  chipIcon: { width: 20, height: 20, borderRadius: 4 },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COACHING_COLORS.text,
  },
});

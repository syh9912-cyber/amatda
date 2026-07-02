import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getTraitTabs, TRAIT_COLORS, TraitTab } from './traitConstants';

interface Props {
  activeTab: TraitTab;
  onTabChange: (tab: TraitTab) => void;
}

export function TraitTabBar({ activeTab, onTabChange }: Props) {
  const { t } = useTranslation();
  const tabs = getTraitTabs(t);
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onTabChange(tab.key)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: TRAIT_COLORS.tabInactiveBg,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: TRAIT_COLORS.coral,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: TRAIT_COLORS.tabInactiveText,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});

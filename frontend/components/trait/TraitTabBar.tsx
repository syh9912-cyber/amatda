import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TABS, TRAIT_COLORS, TraitTab } from './traitConstants';

interface Props {
  activeTab: TraitTab;
  onTabChange: (tab: TraitTab) => void;
}

export function TraitTabBar({ activeTab, onTabChange }: Props) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
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

import { View, Text, StyleSheet } from 'react-native';
import { useShowAds } from '../../hooks/useShowAds';

const ADS_MOCK = process.env.EXPO_PUBLIC_ADS_MOCK === 'true';

export function AdSlot() {
  const show = useShowAds();
  if (!show) return null;

  if (ADS_MOCK) {
    return (
      <View style={styles.banner}>
        <Text style={styles.label}>광고 영역 (테스트 — 50pt)</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    height: 50,
    backgroundColor: '#E8E8E8',
    borderTopWidth: 1,
    borderTopColor: '#D0D0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

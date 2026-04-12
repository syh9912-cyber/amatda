import { View, Text, StyleSheet } from 'react-native';
import { useOffline } from '../../hooks/useOffline';

export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <View style={s.banner}>
      <Text style={s.text}>오프라인 상태입니다. 일부 기능이 제한될 수 있어요.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

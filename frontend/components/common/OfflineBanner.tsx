import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOffline } from '../../hooks/useOffline';

export function OfflineBanner() {
  const { t } = useTranslation();
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <View style={s.banner}>
      <Text style={s.text}>{t('components.offlineBanner.message')}</Text>
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

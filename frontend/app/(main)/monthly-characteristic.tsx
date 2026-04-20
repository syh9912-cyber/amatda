import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { AdSlot } from '../../components/ads/AdSlot';

const COLOR = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  accent: '#FF8C5A',
  text: '#1C1C1E',
  textSub: '#636366',
  textLight: '#ABABAB',
  border: '#E5E5EA',
  physical: '#FF8C5A',
  cognitive: '#9B59B6',
  language: '#4285F4',
  social: '#2BA89E',
};

interface CharacteristicData {
  month: number;
  endMonth?: number;
  label: string;
  title: string;
  physical: string[];
  cognitive: string[];
  language: string[];
  social: string[];
  tips: string[];
  temperamentTips: Record<string, string>;
}

const DOMAIN_CONFIG = [
  { key: 'physical' as const, emoji: '🏃', label: '신체 발달', color: COLOR.physical },
  { key: 'cognitive' as const, emoji: '🧠', label: '인지 발달', color: COLOR.cognitive },
  { key: 'language' as const, emoji: '💬', label: '언어 발달', color: COLOR.language },
  { key: 'social' as const, emoji: '🤝', label: '사회/정서', color: COLOR.social },
];

export default function MonthlyCharacteristicScreen() {
  const router = useRouter();
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [data, setData] = useState<CharacteristicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [temperamentTip, setTemperamentTip] = useState('');

  useEffect(() => {
    loadCharacteristic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChild?.id]);

  const loadCharacteristic = async () => {
    if (!selectedChild) return;
    setLoading(true);
    try {
      const { getCharacteristicForChild } = await import('../../constants/monthlyCharacteristics');
      const months = selectedChild.ageInfo?.months ?? 0;
      const temperament = selectedChild.innateData?.dominantType ?? '';
      const result = getCharacteristicForChild(months, temperament);
      if (result) {
        setData(result.characteristic as CharacteristicData);
        setTemperamentTip(result.temperamentTip);
      }
    } catch {
      // data not available yet
    } finally {
      setLoading(false);
    }
  };

  const childName = selectedChild?.name ?? '아이';

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>개월별 발달 특징</Text>
        <View style={s.headerSpacer} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={COLOR.accent} />
          <Text style={s.loadingText}>{childName}의 발달 특징을 불러오고 있어요...</Text>
        </View>
      ) : !data ? (
        <View style={s.loadingWrap}>
          <Text style={s.emptyEmoji}>{'📅'}</Text>
          <Text style={s.loadingText}>발달 특징 데이터가 아직 준비되지 않았습니다</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadCharacteristic}>
            <Text style={s.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Age header card */}
          <View style={s.ageCard}>
            <Text style={s.ageLabel}>{data.label}</Text>
            <Text style={s.ageTitle}>{data.title}</Text>
            <Text style={s.ageName}>{childName}의 발달 시기</Text>
          </View>

          {/* Domain cards */}
          {DOMAIN_CONFIG.map((domain) => {
            const items = data[domain.key] as string[];
            if (!items || items.length === 0) return null;
            return (
              <View key={domain.key} style={s.domainCard}>
                <View style={s.domainHeader}>
                  <Text style={s.domainEmoji}>{domain.emoji}</Text>
                  <Text style={[s.domainTitle, { color: domain.color }]}>{domain.label}</Text>
                </View>
                {items.map((item, idx) => (
                  <View key={idx} style={s.bulletRow}>
                    <View style={[s.bulletDot, { backgroundColor: domain.color }]} />
                    <Text style={s.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          })}

          {/* Tips */}
          {data.tips && data.tips.length > 0 && (
            <View style={s.tipsCard}>
              <Text style={s.tipsTitle}>{'💡 양육 팁'}</Text>
              {data.tips.map((tip, idx) => (
                <View key={idx} style={s.bulletRow}>
                  <Text style={s.tipBullet}>{'•'}</Text>
                  <Text style={s.bulletText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Temperament-specific tip */}
          {temperamentTip ? (
            <View style={s.tempCard}>
              <Text style={s.tempTitle}>
                {'🎯 '}{childName}의 기질 맞춤 조언
              </Text>
              <Text style={s.tempBody}>{temperamentTip}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
      <AdSlot />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: COLOR.text, fontWeight: '300' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLOR.text },
  headerSpacer: { width: 36 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { fontSize: 14, color: COLOR.textSub, marginTop: 12, textAlign: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  retryBtn: { backgroundColor: COLOR.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16 },
  retryText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  ageCard: {
    backgroundColor: COLOR.accent, borderRadius: 20, padding: 24, marginBottom: 16, alignItems: 'center',
  },
  ageLabel: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  ageTitle: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  ageName: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 8 },

  domainCard: {
    backgroundColor: COLOR.card, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 16, elevation: 1,
  },
  domainHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  domainEmoji: { fontSize: 20 },
  domainTitle: { fontSize: 15, fontWeight: '700' },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, paddingLeft: 4 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, marginRight: 10 },
  bulletText: { fontSize: 14, color: COLOR.text, lineHeight: 21, flex: 1 },
  tipBullet: { fontSize: 14, color: COLOR.accent, marginRight: 8, marginTop: 1 },

  tipsCard: {
    backgroundColor: '#FFF8E1', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#FFE082',
  },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: COLOR.text, marginBottom: 12 },

  tempCard: {
    backgroundColor: '#F3EEFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#D1C4E9',
  },
  tempTitle: { fontSize: 15, fontWeight: '700', color: '#5E35B1', marginBottom: 8 },
  tempBody: { fontSize: 14, color: COLOR.text, lineHeight: 21 },
});

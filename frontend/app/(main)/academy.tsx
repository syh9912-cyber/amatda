import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Stack } from 'expo-router';
import { academyApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Academy {
  id: string;
  name: string;
  category: string;
  distance: number;
  traitMatch: boolean;
  suitableTraits: string[];
  phone?: string;
  address?: string;
}

interface AcademyResponse {
  academies: Academy[];
  total: number;
  fallback: boolean;
  fallbackMessage: string | null;
}

// 남악 기본 좌표
const DEFAULT_LAT = 34.815;
const DEFAULT_LNG = 126.463;

export default function AcademyScreen() {
  const [data, setData] = useState<AcademyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedChild = useChildStore((s) => s.selectedChild);

  useEffect(() => {
    if (selectedChild) loadAcademies();
  }, [selectedChild?.id]);

  const loadAcademies = async () => {
    if (!selectedChild) return;
    setLoading(true);
    try {
      const res = await academyApi.list(
        DEFAULT_LAT,
        DEFAULT_LNG,
        selectedChild.ageInfo.months,
        selectedChild.innateData.dominantType
      );
      setData(res.data.data);
    } catch {
      Alert.alert('오류', '학원 정보를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '학원 추천', headerShown: true }} />

      {selectedChild && (
        <Text style={styles.heading}>
          {selectedChild.name}({selectedChild.innateData.dominantType})에게 맞는 학원
        </Text>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : !data ? (
        <Text style={styles.emptyText}>데이터를 불러올 수 없습니다</Text>
      ) : (
        <>
          {/* LBS Fallback */}
          {data.fallback && (
            <View style={styles.fallbackCard}>
              <Text style={styles.fallbackEmoji}>📦</Text>
              <Text style={styles.fallbackTitle}>
                우리 동네엔 아직 추천 장소가 부족해요
              </Text>
              <Text style={styles.fallbackDesc}>
                월간 도담 교구 구독으로 집에서도 기질 맞춤 활동을 해보세요!
              </Text>
              <TouchableOpacity style={styles.fallbackBtn}>
                <Text style={styles.fallbackBtnText}>교구 구독 알아보기</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 학원 목록 */}
          {data.academies.length > 0 && (
            <Text style={styles.sectionTitle}>
              반경 5km 내 추천 ({data.total}곳)
            </Text>
          )}

          {data.academies.map((academy) => (
            <View key={academy.id} style={styles.academyCard}>
              <View style={styles.academyHeader}>
                <Text style={styles.academyName}>{academy.name}</Text>
                {academy.traitMatch && (
                  <View style={styles.matchBadge}>
                    <Text style={styles.matchText}>기질 적합</Text>
                  </View>
                )}
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaText}>{academy.category}</Text>
                </View>
                <Text style={styles.distance}>{academy.distance}km</Text>
              </View>
              <View style={styles.traitRow}>
                {academy.suitableTraits.map((t, i) => (
                  <Text key={i} style={styles.traitChip}>{t}</Text>
                ))}
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.naverBtn}
                  onPress={() => {
                    const query = academy.address
                      ? `${academy.name} ${academy.address}`
                      : academy.name;
                    Linking.openURL(
                      `https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(query)}`
                    );
                  }}
                >
                  <Text style={styles.naverBtnText}>{'🗺️ 네이버 지도'}</Text>
                </TouchableOpacity>
                {academy.phone ? (
                  <TouchableOpacity
                    style={styles.phoneBtn}
                    onPress={() => Linking.openURL(`tel:${academy.phone}`)}
                  >
                    <Text style={styles.phoneBtnText}>{'📞 전화'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}

          {data.academies.length === 0 && !data.fallback && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                해당 연령대의 추천 학원이 없습니다
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },
  heading: {
    fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  fallbackCard: {
    backgroundColor: '#FFF8E1', borderRadius: RADIUS.lg,
    padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: '#FFE082',
  },
  fallbackEmoji: { fontSize: 40, marginBottom: SPACING.md },
  fallbackTitle: {
    fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text,
    textAlign: 'center', marginBottom: SPACING.sm,
  },
  fallbackDesc: {
    fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: SPACING.md,
  },
  fallbackBtn: {
    backgroundColor: COLORS.secondary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm,
  },
  fallbackBtnText: { color: '#FFF', fontWeight: '600', fontSize: FONT_SIZE.sm },
  sectionTitle: {
    fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text,
    marginBottom: SPACING.md,
  },
  academyCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  academyHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.sm,
  },
  academyName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, flex: 1 },
  matchBadge: {
    backgroundColor: COLORS.success + '20', borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  matchText: { fontSize: FONT_SIZE.xs, color: COLORS.success, fontWeight: '600' },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  metaChip: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  metaText: { fontSize: FONT_SIZE.xs, color: COLORS.primary },
  distance: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  traitRow: { flexDirection: 'row', gap: SPACING.xs },
  traitChip: {
    fontSize: FONT_SIZE.xs, color: COLORS.textSecondary,
    backgroundColor: COLORS.border, borderRadius: 4,
    paddingHorizontal: SPACING.xs, paddingVertical: 1,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm,
  },
  naverBtn: {
    backgroundColor: '#1EC800', borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  naverBtnText: { fontSize: FONT_SIZE.xs, color: '#FFFFFF', fontWeight: '600' },
  phoneBtn: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  phoneBtnText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600' },
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.xl, alignItems: 'center',
  },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center' },
});

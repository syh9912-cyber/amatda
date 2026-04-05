import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Alert, Linking,
} from 'react-native';
import { Stack } from 'expo-router';
import { academyApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { useLocation } from '../../hooks/useLocation';
import RecommendCard from '../../components/academy/RecommendCard';
import TraitExplanation from '../../components/academy/TraitExplanation';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Recommendation {
  category: string;
  emoji: string;
  reason: string;
  searchQuery: string;
  priority: number;
  naverMapUrl: string;
}

interface RecommendResponse {
  dominantType: string;
  ageMonths: number;
  region: string;
  recommendations: Recommendation[];
  total: number;
}

interface StaticAcademy {
  id: string;
  name: string;
  category: string;
  distance: number;
  traitMatch: boolean;
  suitableTraits: string[];
  phone?: string;
  address?: string;
}

interface StaticResponse {
  academies: StaticAcademy[];
  total: number;
  fallback: boolean;
  fallbackMessage: string | null;
}

export default function AcademyScreen() {
  const [recData, setRecData] = useState<RecommendResponse | null>(null);
  const [staticData, setStaticData] = useState<StaticResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedChild = useChildStore((s) => s.selectedChild);
  const location = useLocation();

  useEffect(() => {
    if (selectedChild && !location.loading) loadData();
  }, [selectedChild?.id, location.loading]);

  const loadData = async () => {
    if (!selectedChild) return;
    setLoading(true);
    try {
      const [recRes, staticRes] = await Promise.all([
        academyApi.recommend(
          selectedChild.innateData.dominantType,
          selectedChild.ageInfo.months,
          location.lat,
          location.lng,
          location.regionName,
        ),
        academyApi.list(
          location.lat,
          location.lng,
          selectedChild.ageInfo.months,
          selectedChild.innateData.dominantType,
        ),
      ]);
      setRecData(recRes.data.data);
      setStaticData(staticRes.data.data);
    } catch {
      Alert.alert('오류', '학원 정보를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const isReady = !loading && !location.loading;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '학원 추천', headerShown: true }} />

      {selectedChild && (
        <View style={styles.headerSection}>
          <Text style={styles.heading}>
            {selectedChild.name}에게 맞는 학원 종류
          </Text>
          <View style={styles.traitBadge}>
            <Text style={styles.traitBadgeText}>
              {selectedChild.innateData.dominantType}
            </Text>
          </View>
          {location.regionName && (
            <Text style={styles.locationText}>
              {'📍 '}{location.regionName}
              {location.error ? ' (기본 위치)' : ''}
            </Text>
          )}
        </View>
      )}

      {!isReady ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: SPACING.xl }}
        />
      ) : (
        <>
          {/* Trait-based recommendations */}
          {recData && recData.recommendations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                추천 학원 종류 ({recData.total}가지)
              </Text>
              <TraitExplanation
                dominantType={selectedChild?.innateData.dominantType || ''}
              />
              {recData.recommendations.map((rec) => (
                <RecommendCard key={rec.category} item={rec} />
              ))}
            </>
          )}

          {/* Static academies */}
          {staticData && staticData.academies.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>
                주변 등록된 학원 ({staticData.total}곳)
              </Text>
              {staticData.academies.map((a) => (
                <StaticAcademyCard key={a.id} academy={a} />
              ))}
            </>
          )}

          {/* Fallback CTA */}
          {staticData?.fallback && (
            <FallbackCard />
          )}

          {/* Empty state */}
          {recData?.recommendations.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                해당 연령대의 추천 학원 종류가 없습니다
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function StaticAcademyCard({ academy }: { academy: StaticAcademy }) {
  const openNaverMap = () => {
    const query = academy.address
      ? `${academy.name} ${academy.address}`
      : academy.name;
    Linking.openURL(
      `https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(query)}`
    );
  };

  return (
    <View style={styles.staticCard}>
      <View style={styles.staticHeader}>
        <Text style={styles.staticName}>{academy.name}</Text>
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
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.naverSmallBtn} onPress={openNaverMap}>
          <Text style={styles.naverSmallText}>{'🗺️ 지도'}</Text>
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
  );
}

function FallbackCard() {
  return (
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  headerSection: { marginBottom: SPACING.lg },
  heading: {
    fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  traitBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  traitBadgeText: {
    fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary,
  },
  locationText: {
    fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text,
    marginBottom: SPACING.md,
  },
  // Static academy cards
  staticCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  staticHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.sm,
  },
  staticName: {
    fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, flex: 1,
  },
  matchBadge: {
    backgroundColor: COLORS.successLight, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  matchText: { fontSize: FONT_SIZE.xs, color: COLORS.successDark, fontWeight: '600' },
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
  actionRow: {
    flexDirection: 'row', gap: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm,
  },
  naverSmallBtn: {
    backgroundColor: '#1EC800', borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  naverSmallText: { fontSize: FONT_SIZE.xs, color: '#FFFFFF', fontWeight: '600' },
  phoneBtn: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  phoneBtnText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600' },
  // Fallback
  fallbackCard: {
    backgroundColor: '#FFF8E1', borderRadius: RADIUS.lg,
    padding: SPACING.xl, alignItems: 'center', marginTop: SPACING.lg,
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
  // Empty
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.xl, alignItems: 'center',
  },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center' },
});

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, ImageSourcePropType, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, Alert, Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { academyApi } from '../../services/api';
import { useChildStore } from '../../stores/childStore';
import { useLocation } from '../../hooks/useLocation';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

type FilterTab = 'all' | 'academy' | 'food' | 'lifestyle';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'academy', label: '학습/학원' },
  { key: 'food', label: '음식' },
  { key: 'lifestyle', label: '생활습관' },
];

const CORAL = '#FF6B6B';
const CORAL_LIGHT = '#FFF0F0';

const CATEGORY_ICONS: Record<string, ImageSourcePropType> = {
  '미술': require('../../assets/academy-art.png'),
  '코딩': require('../../assets/academy-coding.png'),
  '무용': require('../../assets/academy-dance.png'),
  '영어': require('../../assets/academy-english.png'),
  '수학': require('../../assets/academy-math.png'),
  '음악': require('../../assets/academy-music.png'),
  '과학': require('../../assets/academy-science.png'),
  '체육': require('../../assets/academy-sports.png'),
};

function getCategoryIcon(category: string): ImageSourcePropType | null {
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (category.includes(key)) return icon;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export default function AcademyScreen() {
  const router = useRouter();
  const [recData, setRecData] = useState<RecommendResponse | null>(null);
  const [staticData, setStaticData] = useState<StaticResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
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
          selectedChild.innateData?.dominantType ?? '',
          selectedChild.ageInfo.months,
          location.lat,
          location.lng,
          location.regionName,
        ),
        academyApi.list(
          location.lat,
          location.lng,
          selectedChild.ageInfo.months,
          selectedChild.innateData?.dominantType ?? '',
        ),
      ]);
      setRecData(recRes.data.data);
      setStaticData(staticRes.data.data);
    } catch {
      Alert.alert('오류', '추천 정보를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const report = selectedChild?.analysisReport;
  const childName = selectedChild?.name ?? '';
  const isReady = !loading && !location.loading;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <Header
        title={`${childName}를 위한 맞춤 추천`}
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Tabs */}
        <FilterTabBar active={activeTab} onChange={setActiveTab} />

        {!isReady ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: SPACING.xl * 2 }}
          />
        ) : (
          <>
            {/* Academy Section */}
            {(activeTab === 'all' || activeTab === 'academy') && (
              <AcademySection
                recData={recData}
                staticData={staticData}
              />
            )}

            {/* Study Tips Section */}
            {(activeTab === 'all' || activeTab === 'academy') && report && (
              <StudyTipsSection report={report} />
            )}

            {/* Fallback CTA */}
            {staticData?.fallback && activeTab !== 'food' && activeTab !== 'lifestyle' && (
              <FallbackCard />
            )}

            {/* Empty state */}
            {recData?.recommendations.length === 0 &&
             staticData?.academies.length === 0 &&
             (activeTab === 'all' || activeTab === 'academy') && (
              <EmptyState text="해당 연령대의 추천 정보가 없습니다" />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backArrow}>{'<'}</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.backBtn} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter Tab Bar                                                     */
/* ------------------------------------------------------------------ */

function FilterTabBar({
  active,
  onChange,
}: {
  active: FilterTab;
  onChange: (t: FilterTab) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabBarScroll}
      contentContainerStyle={styles.tabBarContent}
    >
      {FILTER_TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabPill, isActive && styles.tabPillActive]}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  Academy Section                                                    */
/* ------------------------------------------------------------------ */

function AcademySection({
  recData,
  staticData,
}: {
  recData: RecommendResponse | null;
  staticData: StaticResponse | null;
}) {
  const recs = recData?.recommendations ?? [];
  const statics = staticData?.academies ?? [];
  if (recs.length === 0 && statics.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="학습/학원 추천" />

      {recs.map((rec) => (
        <AcademyCard key={rec.category} item={rec} />
      ))}

      {statics.map((a) => (
        <StaticAcademyCard key={a.id} academy={a} />
      ))}
    </View>
  );
}

function priorityToPercent(p: number): string {
  if (p === 1) return '95%';
  if (p === 2) return '85%';
  return '70%';
}

function AcademyCard({ item }: { item: Recommendation }) {
  const openNaverMap = useCallback(() => {
    Linking.openURL(item.naverMapUrl);
  }, [item.naverMapUrl]);

  return (
    <TouchableOpacity style={styles.card} onPress={openNaverMap} activeOpacity={0.7}>
      <View style={styles.cardLeft}>
        {getCategoryIcon(item.category) ? (
          <Image source={getCategoryIcon(item.category) as ImageSourcePropType} style={styles.cardIcon} resizeMode="contain" />
        ) : (
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
        )}
      </View>
      <View style={styles.cardCenter}>
        <Text style={styles.cardTitle}>{item.category}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {item.reason}
        </Text>
      </View>
      <View style={styles.cardRight}>
        <View style={styles.coralBadge}>
          <Text style={styles.coralBadgeText}>
            {'추천도 '}{priorityToPercent(item.priority)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StaticAcademyCard({ academy }: { academy: StaticAcademy }) {
  const openNaverMap = useCallback(() => {
    const query = academy.address
      ? `${academy.name} ${academy.address}`
      : academy.name;
    Linking.openURL(
      `https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(query)}`
    );
  }, [academy.name, academy.address]);

  return (
    <TouchableOpacity style={styles.card} onPress={openNaverMap} activeOpacity={0.7}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardEmoji}>{'🏫'}</Text>
      </View>
      <View style={styles.cardCenter}>
        <Text style={styles.cardTitle}>{academy.name}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {academy.category} {'  '}{academy.distance}km
        </Text>
      </View>
      <View style={styles.cardRight}>
        {academy.traitMatch && (
          <View style={styles.coralBadge}>
            <Text style={styles.coralBadgeText}>기질 적합</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */
/*  Study Tips (checklist)                                             */
/* ------------------------------------------------------------------ */

function StudyTipsSection({ report }: { report: { studyStyle?: string; parentingTip?: string } }) {
  const tips: string[] = [];
  if (report.studyStyle) tips.push(report.studyStyle);
  if (report.parentingTip) tips.push(report.parentingTip);
  if (tips.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="공부 방법" />
      {tips.map((tip, i) => (
        <View key={i} style={styles.checkItem}>
          <Text style={styles.checkIcon}>{'✅'}</Text>
          <Text style={styles.checkText}>{tip}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Section Header                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Fallback & Empty                                                   */
/* ------------------------------------------------------------------ */

function FallbackCard() {
  return (
    <View style={styles.fallbackCard}>
      <Text style={styles.fallbackEmoji}>{'📦'}</Text>
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

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },
  scrollView: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl * 3,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: '#FFF8F2',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: COLORS.text, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* Filter Tabs */
  tabBarScroll: { marginBottom: SPACING.lg },
  tabBarContent: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  tabPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabPillActive: {
    backgroundColor: CORAL,
    borderColor: CORAL,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  /* Section */
  section: { marginBottom: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* Card (shared academy card) */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardLeft: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: CORAL_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  cardEmoji: { fontSize: 22 },
  cardIcon: { width: 32, height: 32 },
  cardCenter: { flex: 1, marginRight: SPACING.sm },
  cardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  cardRight: { alignItems: 'flex-end' },
  coralBadge: {
    backgroundColor: CORAL_LIGHT,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  coralBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: CORAL,
  },

  /* Study tips checklist */
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  checkIcon: { fontSize: 16, marginRight: SPACING.sm, marginTop: 1 },
  checkText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 22,
  },

  /* Fallback */
  fallbackCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  fallbackEmoji: { fontSize: 40, marginBottom: SPACING.md },
  fallbackTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  fallbackDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  fallbackBtn: {
    backgroundColor: CORAL,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  fallbackBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },

  /* Empty */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
  },
});

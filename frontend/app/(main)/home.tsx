import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { childApi } from '../../services/api';
import { useChildStore, Child } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { ChildSelector } from '../../components/home/ChildSelector';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const COLOR = {
  bg: '#FFF5EC',
  card: '#FFFFFF',
  accent: '#FF8C5A',
  accentLight: '#FFF0E6',
  text: '#2D2016',
  textSub: '#8C7A6B',
  textLight: '#B5A99A',
  mint: '#7DD3B8',
  mintBg: '#E8F8F0',
  yellow: '#FFD76E',
  yellowBg: '#FFF8E1',
  coralBg: '#FFF0E6',
  shadow: '#2D2016',
};

const QUICK_ACTIONS: {
  emoji: string;
  label: string;
  route: string;
  bg: string;
}[] = [
  {
    emoji: '🧩',
    label: '기질 요약',
    route: '/(main)/trait-detail',
    bg: COLOR.coralBg,
  },
  {
    emoji: '📚',
    label: '추천 학습',
    route: '/(main)/academy',
    bg: COLOR.mintBg,
  },
  {
    emoji: '📸',
    label: '성장앨범',
    route: '/(main)/momstagram',
    bg: COLOR.yellowBg,
  },
];

function getAgeText(months: number): string {
  if (months < 12) return `${months}개월`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (remaining === 0) return `${years}세`;
  return `${years}세 ${remaining}개월`;
}

function getRecommendations(child: Child): {
  emoji: string;
  title: string;
  desc: string;
}[] {
  const dominant = child.innateData.dominantType;
  const group = child.ageInfo.group;

  const base = [
    {
      emoji: '🎨',
      title: '창의력이 쑥쑥! 미술 체험 추천',
      desc: `${child.name}의 기질에 맞는 창의 활동을 확인하세요`,
    },
    {
      emoji: '📚',
      title: '집에서 할 수 있는 놀이학습 방법',
      desc: '연령에 맞춘 홈스쿨링 가이드',
    },
    {
      emoji: '🥗',
      title: '면역력에 좋은 제철 음식 추천',
      desc: '성장기 영양 밸런스를 맞춰보세요',
    },
  ];

  if (group === 'infant') {
    base[0] = {
      emoji: '👶',
      title: '감각 발달 놀이 추천',
      desc: '오감을 자극하는 놀이 활동이에요',
    };
    base[2] = {
      emoji: '🍜',
      title: '월령별 이유식 가이드',
      desc: '단계별 이유식 레시피를 확인하세요',
    };
  }

  if (dominant.includes('활동') || dominant.includes('火')) {
    base[0] = {
      emoji: '⚽',
      title: '에너지 넘치는 체육 활동 추천',
      desc: '활동적인 기질에 맞는 스포츠를 찾아보세요',
    };
  }

  return base;
}

/* ------------------------------------------------------------------ */
/* Main Screen                                                         */
/* ------------------------------------------------------------------ */

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { children, selectedChild, setChildren, selectChild } =
    useChildStore();
  const { updateChild } = useChildStore();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildren = async () => {
    try {
      const res = await childApi.list();
      setChildren(res.data.data);
    } catch {
      // token expired etc
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    setRefreshing(false);
  }, []);

  const pickPhoto = async () => {
    if (!selectedChild) return;
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    const updated = { ...selectedChild, photoUri: uri };
    updateChild(updated);
    try {
      await childApi.update(selectedChild.id, {
        photoUri: uri,
      } as Record<string, unknown>);
    } catch {
      // photo saved locally even if backend fails
    }
  };

  /* Loading */
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLOR.accent} />
      </View>
    );
  }

  /* Empty state */
  if (children.length === 0) {
    return <EmptyState />;
  }

  const child = selectedChild;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLOR.accent}
        />
      }
    >
      {/* === 1. Header === */}
      <Header child={child} onPickPhoto={pickPhoto} />

      {/* === Child Selector (multi-child) === */}
      {children.length > 1 && (
        <ChildSelector
          children={children}
          selectedId={selectedChild?.id ?? ''}
          onSelect={selectChild}
        />
      )}

      {child && (
        <>
          {/* === 2. Today's Card === */}
          <TodayCard child={child} />

          {/* === 3. Quick Action Circles === */}
          <QuickActions />

          {/* === 4. Weekly Recommendations === */}
          <RecommendationSection child={child} />
        </>
      )}

      {/* Add Child */}
      <TouchableOpacity
        style={styles.addMore}
        onPress={() => router.push('/onboarding/child-info')}
      >
        <Text style={styles.addMoreText}>+ 자녀 추가</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>아맞다 v1.0.0</Text>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Section Components                                                  */
/* ------------------------------------------------------------------ */

function Header({
  child,
  onPickPhoto,
}: {
  child: Child | null;
  onPickPhoto: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={onPickPhoto} activeOpacity={0.7}>
          {child?.photoUri ? (
            <Image
              source={{ uri: child.photoUri }}
              style={styles.childPhoto}
            />
          ) : (
            <View style={styles.childPhotoPlaceholder}>
              <Text style={styles.childPhotoEmoji}>
                {child?.gender === 'F' ? '👧' : '👦'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerLabel}>우리 아이</Text>
          <Text style={styles.headerName}>
            {child?.name ?? '아이'}{' '}
            <Text style={styles.headerAge}>
              ({child ? getAgeText(child.ageInfo.months) : ''})
            </Text>
          </Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(main)/chatbot' as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconEmoji}>{'🔔'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(main)/profile' as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconEmoji}>{'⚙️'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TodayCard({ child }: { child: Child }) {
  const report = child.analysisReport;
  const summaryRaw = report?.summary ?? child.innateData.label;

  const displayText = `${child.name}은(는) ${summaryRaw}`;

  return (
    <LinearGradient
      colors={['#FF8C5A', '#FFB88C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.todayCard}
    >
      <Text style={styles.todayQuoteIcon}>{'✨'}</Text>
      <Text style={styles.todayLabel}>오늘의 한마디</Text>
      <Text style={styles.todayText}>{displayText}</Text>
      <Text style={styles.todaySparkle}>{'✨'}</Text>
    </LinearGradient>
  );
}

function QuickActions() {
  return (
    <View style={styles.quickSection}>
      {QUICK_ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.label}
          style={styles.quickItem}
          onPress={() => router.push(action.route as never)}
          activeOpacity={0.7}
        >
          <View
            style={[styles.quickCircle, { backgroundColor: action.bg }]}
          >
            <Text style={styles.quickEmoji}>{action.emoji}</Text>
          </View>
          <Text style={styles.quickLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RecommendationSection({ child }: { child: Child }) {
  const items = getRecommendations(child);

  return (
    <View style={styles.recoSection}>
      <View style={styles.recoHeader}>
        <Text style={styles.recoTitle}>이번 주 추천</Text>
        <TouchableOpacity
          onPress={() => router.push('/(main)/academy' as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.recoMore}>더보기 &gt;</Text>
        </TouchableOpacity>
      </View>
      {items.map((item, idx) => (
        <TouchableOpacity
          key={idx}
          style={styles.recoCard}
          activeOpacity={0.7}
          onPress={() => router.push('/(main)/academy' as never)}
        >
          <View style={styles.recoEmojiWrap}>
            <Text style={styles.recoEmoji}>{item.emoji}</Text>
          </View>
          <View style={styles.recoTextWrap}>
            <Text style={styles.recoCardTitle}>{item.title}</Text>
            <Text style={styles.recoCardDesc}>{item.desc}</Text>
          </View>
          <Text style={styles.recoChevron}>{'›'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyEmoji}>{'👶'}</Text>
      <Text style={styles.emptyText}>등록된 자녀가 없습니다</Text>
      <Text style={styles.emptySubtext}>
        자녀를 등록하고 기질을 분석해보세요
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/onboarding/child-info')}
      >
        <Text style={styles.addButtonText}>자녀 등록하기</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const CARD_SHADOW = {
  shadowColor: COLOR.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

const styles = StyleSheet.create({
  /* Layout */
  container: {
    flex: 1,
    backgroundColor: COLOR.bg,
  },
  content: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 110,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLOR.bg,
    padding: 32,
  },

  /* === 1. Header === */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLOR.accent,
  },
  childPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLOR.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLOR.accent,
  },
  childPhotoEmoji: {
    fontSize: 24,
  },
  headerInfo: {
    gap: 2,
  },
  headerLabel: {
    fontSize: 11,
    color: COLOR.textLight,
    fontWeight: '500',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLOR.text,
  },
  headerAge: {
    fontSize: 13,
    fontWeight: '500',
    color: COLOR.textSub,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLOR.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  iconEmoji: {
    fontSize: 18,
  },

  /* === 2. Today's Card === */
  todayCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  todayQuoteIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  todayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
  },
  todayText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 26,
  },
  todaySparkle: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    fontSize: 28,
    opacity: 0.3,
  },

  /* === 3. Quick Action Circles === */
  quickSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  quickItem: {
    alignItems: 'center',
    gap: 8,
  },
  quickCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  quickEmoji: {
    fontSize: 28,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLOR.text,
  },

  /* === 4. Recommendations === */
  recoSection: {
    marginBottom: 20,
  },
  recoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  recoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLOR.text,
  },
  recoMore: {
    fontSize: 13,
    fontWeight: '600',
    color: COLOR.accent,
  },
  recoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLOR.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    ...CARD_SHADOW,
  },
  recoEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLOR.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recoEmoji: {
    fontSize: 22,
  },
  recoTextWrap: {
    flex: 1,
    gap: 2,
  },
  recoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.text,
  },
  recoCardDesc: {
    fontSize: 12,
    color: COLOR.textSub,
    lineHeight: 17,
  },
  recoChevron: {
    fontSize: 22,
    color: COLOR.textLight,
    marginLeft: 8,
    fontWeight: '300',
  },

  /* === Empty state === */
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: COLOR.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLOR.textSub,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: COLOR.accent,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },

  /* === Add more === */
  addMore: {
    borderWidth: 1.5,
    borderColor: '#F0E6DC',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  addMoreText: {
    color: COLOR.textLight,
    fontSize: 15,
    fontWeight: '500',
  },

  /* === Version === */
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: COLOR.textLight,
    marginBottom: 24,
  },
});

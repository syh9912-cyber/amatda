import { useEffect, useState, useCallback, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { childApi } from '../../services/api';
import { useChildStore, Child } from '../../stores/childStore';
import { useAuthStore } from '../../stores/authStore';
import { FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { ChildSelector } from '../../components/home/ChildSelector';
import { TraitSummary } from '../../components/home/TraitSummary';
import { HomeTabBar } from '../../components/home/HomeTabBar';
import { DiaryContent } from '../../components/home/DiaryContent';
import { AcademyContent } from '../../components/home/AcademyContent';
import { NutritionContent } from '../../components/home/NutritionContent';
import { ReportContent } from '../../components/home/ReportContent';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '편안한 밤이에요';
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 18) return '좋은 오후에요';
  return '좋은 저녁이에요';
}

const QUICK_ACTIONS = [
  { label: '📸 맘스타그램', route: '/(main)/momstagram' },
  { label: 'Quality Time', route: '/(main)/timer' },
  { label: '성장앨범', route: '/(main)/album' },
  { label: '형제궁합', route: '/(main)/compatibility' },
  { label: '기질메이트', route: '/(main)/mates' },
  { label: '교구구독', route: '/(main)/subscription' },
] as const;

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const { children, selectedChild, setChildren, selectChild } =
    useChildStore();
  const { updateChild } = useChildStore();
  const logout = useAuthStore((s) => s.logout);

  const handleTabChange = useCallback(
    (index: number) => {
      if (index === selectedTab) return;
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start(() => {
        setSelectedTab(index);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    },
    [selectedTab, fadeAnim],
  );

  const pickPhoto = async () => {
    if (!selectedChild) return;
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '권한 필요',
        '사진 라이브러리 접근 권한이 필요합니다.',
      );
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (children.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>{'👶'}</Text>
        <Text style={styles.emptyText}>
          등록된 자녀가 없습니다
        </Text>
        <Text style={styles.emptySubtext}>
          자녀를 등록하고 기질을 분석해보세요
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/onboarding/child-info')}
        >
          <Text style={styles.addButtonText}>
            자녀 등록하기
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366F1"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <TouchableOpacity
            onPress={() => {
              logout();
              router.replace('/');
            }}
          >
            <Text style={styles.logoutText}>
              로그아웃
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={pickPhoto} activeOpacity={0.7}>
          {selectedChild?.photoUri ? (
            <Image
              source={{ uri: selectedChild.photoUri }}
              style={styles.childPhoto}
            />
          ) : (
            <View style={styles.childPhotoPlaceholder}>
              <Text style={styles.childPhotoEmoji}>
                {selectedChild?.gender === 'F'
                  ? '👧'
                  : '👦'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Child Selector */}
      {children.length > 1 && (
        <ChildSelector
          children={children}
          selectedId={selectedChild?.id ?? ''}
          onSelect={selectChild}
        />
      )}

      {selectedChild && (
        <>
          {/* Trait Summary — always visible */}
          <TraitSummary child={selectedChild} compact />

          {/* Circle Tab Bar */}
          <HomeTabBar
            selectedIndex={selectedTab}
            onSelect={handleTabChange}
          />

          {/* Tab Content */}
          <Animated.View
            style={[styles.tabContent, { opacity: fadeAnim }]}
          >
            <TabContentRenderer
              tabIndex={selectedTab}
              child={selectedChild}
            />
          </Animated.View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>
            바로가기
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}
          >
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.quickPill}
                onPress={() => router.push(action.route as never)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
      <Text style={styles.version}>
        아맞다 v1.0.0
      </Text>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Tab content dispatcher                                              */
/* ------------------------------------------------------------------ */

interface TabRendererProps {
  tabIndex: number;
  child: Child;
}

function TabContentRenderer({ tabIndex, child }: TabRendererProps) {
  switch (tabIndex) {
    case 0:
      return (
        <DiaryContent
          childId={child.id}
          ageMonths={child.ageInfo.months}
        />
      );
    case 1:
      return (
        <AcademyContent
          dominantType={child.innateData.dominantType}
          ageMonths={child.ageInfo.months}
        />
      );
    case 2:
      return <NutritionContent ageMonths={child.ageInfo.months} />;
    case 3:
      return <ReportContent child={child} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  content: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl + 20,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    padding: SPACING.xl,
  },
  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#1E1E2E',
  },
  logoutText: {
    fontSize: FONT_SIZE.xs,
    color: '#A0A0B0',
    marginTop: 2,
  },
  childPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  childPhotoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childPhotoEmoji: {
    fontSize: 22,
  },
  /* Tab content area */
  tabContent: {
    marginTop: SPACING.md,
    minHeight: 200,
  },
  /* Section title */
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: '#1E1E2E',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  /* Quick action pills */
  quickRow: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  quickPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  quickPillText: {
    fontSize: FONT_SIZE.xs,
    color: '#1E1E2E',
    fontWeight: '500',
  },
  /* Empty state */
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: {
    fontSize: FONT_SIZE.lg,
    color: '#1E1E2E',
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    fontSize: FONT_SIZE.sm,
    color: '#6B6B80',
    marginBottom: SPACING.lg,
  },
  addButton: {
    backgroundColor: '#4338CA',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  /* Add more */
  addMore: {
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  addMoreText: {
    color: '#A0A0B0',
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  /* Version */
  version: {
    textAlign: 'center' as const,
    fontSize: 11,
    color: '#A0A0B0',
    marginBottom: SPACING.xl * 2,
  },
});

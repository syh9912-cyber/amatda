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
import { WeatherWidget } from '../../components/home/WeatherWidget';
import { HomeTabBar } from '../../components/home/HomeTabBar';
import { DiaryContent } from '../../components/home/DiaryContent';
import { AcademyContent } from '../../components/home/AcademyContent';
import { NutritionContent } from '../../components/home/NutritionContent';
import { ReportContent } from '../../components/home/ReportContent';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '\uD3B8\uC548\uD55C \uBC24\uC774\uC5D0\uC694';
  if (hour < 12) return '\uC88B\uC740 \uC544\uCE68\uC774\uC5D0\uC694';
  if (hour < 18) return '\uC88B\uC740 \uC624\uD6C4\uC5D0\uC694';
  return '\uC88B\uC740 \uC800\uB141\uC774\uC5D0\uC694';
}

const QUICK_ACTIONS = [
  { label: 'Quality Time', route: '/(main)/timer' },
  { label: '\uC131\uC7A5\uC568\uBC94', route: '/(main)/album' },
  { label: '\uD615\uC81C\uAD81\uD569', route: '/(main)/compatibility' },
  { label: '\uAE30\uC9C8\uBA54\uC774\uD2B8', route: '/(main)/mates' },
  { label: '\uAD50\uAD6C\uAD6C\uB3C5', route: '/(main)/subscription' },
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
        '\uAD8C\uD55C \uD544\uC694',
        '\uC0AC\uC9C4 \uB77C\uC774\uBE0C\uB7EC\uB9AC \uC811\uADFC \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.',
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
        <Text style={styles.emptyEmoji}>{'\uD83D\uDC76'}</Text>
        <Text style={styles.emptyText}>
          \uB4F1\uB85D\uB41C \uC790\uB140\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4
        </Text>
        <Text style={styles.emptySubtext}>
          \uC790\uB140\uB97C \uB4F1\uB85D\uD558\uACE0 \uAE30\uC9C8\uC744 \uBD84\uC11D\uD574\uBCF4\uC138\uC694
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/onboarding/child-info')}
        >
          <Text style={styles.addButtonText}>
            \uC790\uB140 \uB4F1\uB85D\uD558\uAE30
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
              \uB85C\uADF8\uC544\uC6C3
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
                  ? '\uD83D\uDC67'
                  : '\uD83D\uDC66'}
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
            \uBC14\uB85C\uAC00\uAE30
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
        <Text style={styles.addMoreText}>+ \uC790\uB140 \uCD94\uAC00</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={styles.version}>
        \uC544\uB9DE\uB2E4 v1.0.0
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
      return <WeatherWidget childId={child.id} />;
    case 1:
      return (
        <DiaryContent
          childId={child.id}
          ageMonths={child.ageInfo.months}
        />
      );
    case 2:
      return (
        <AcademyContent
          dominantType={child.innateData.dominantType}
          ageMonths={child.ageInfo.months}
        />
      );
    case 3:
      return <NutritionContent ageMonths={child.ageInfo.months} />;
    case 4:
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

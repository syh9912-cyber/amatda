import { useState, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import {
  PLAY_ACTIVITIES,
  resolvePlayTemperament,
} from '../../constants/playActivities';
import type { PlayActivity } from '../../constants/playActivities';
import { AdSlot } from '../../components/ads/AdSlot';
import { ScreenHeader } from '../../components/common/ScreenHeader';

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const ACCENT = '#FF8C5A';
const ACCENT_LIGHT = '#FFF0E6';

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export default function PlayLearningScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const selectedChild = useChildStore((s) => s.selectedChild);

  const temperamentKey = resolvePlayTemperament(
    selectedChild?.innateData?.dominantType ?? '',
  );
  const rawGroup = selectedChild?.ageInfo.group ?? 'toddler';
  const ageGroup = rawGroup === 'pregnant' ? 'infant' as const : rawGroup;
  const allActivities = PLAY_ACTIVITIES[temperamentKey];
  const filtered = allActivities.filter((a) =>
    a.ageGroups.includes(ageGroup),
  );

  const toggleExpand = useCallback((idx: number) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  const childName = selectedChild?.name ?? '';
  const dominantLabel =
    selectedChild?.innateData?.dominantType?.split('(')[0] ?? '';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title={`${childName}의 놀이학습`}
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro banner */}
        <View style={styles.introBanner}>
          <Image source={require('../../assets/play-activity.png')} style={styles.introIcon} resizeMode="contain" />
          <Text style={styles.introText}>
            {`${dominantLabel} 기질의 ${childName}에게 딱 맞는\n집에서 할 수 있는 놀이학습 방법이에요`}
          </Text>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {'해당 연령대에 맞는 활동이 준비 중입니다'}
            </Text>
          </View>
        ) : (
          filtered.map((activity, idx) => (
            <ActivityCard
              key={idx}
              activity={activity}
              index={idx}
              expanded={expandedIdx === idx}
              onToggle={toggleExpand}
              childName={childName}
              dominantLabel={dominantLabel}
            />
          ))
        )}
      </ScrollView>
      <AdSlot />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity Card                                                      */
/* ------------------------------------------------------------------ */

function ActivityCard({
  activity,
  index,
  expanded,
  onToggle,
  childName,
  dominantLabel,
}: {
  activity: PlayActivity;
  index: number;
  expanded: boolean;
  onToggle: (idx: number) => void;
  childName: string;
  dominantLabel: string;
}) {
  return (
    <View style={styles.actCard}>
      {/* Top row */}
      <TouchableOpacity
        style={styles.actTopRow}
        onPress={() => onToggle(index)}
        activeOpacity={0.7}
      >
        <View style={styles.actEmojiWrap}>
          <Text style={styles.actEmoji}>{activity.emoji}</Text>
        </View>
        <View style={styles.actInfo}>
          <Text style={styles.actName}>{activity.name}</Text>
          <View style={styles.actMeta}>
            <Text style={styles.actMetaText}>
              {activity.duration}
            </Text>
            {activity.materials.length > 0 && (
              <Text style={styles.actMetaText}>
                {activity.materials.join(', ')}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.chevron}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {/* Reason */}
      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>
          {'왜 좋을까요?'}
        </Text>
        <Text style={styles.reasonText}>
          {`${dominantLabel} 기질의 ${childName}에게 - ${activity.reason}`}
        </Text>
      </View>

      {/* Expanded: Steps */}
      {expanded && (
        <View style={styles.stepsSection}>
          <Text style={styles.stepsTitle}>
            {'이렇게 해보세요'}
          </Text>
          {activity.steps.map((step, sIdx) => (
            <View key={sIdx} style={styles.stepRow}>
              <View style={styles.stepDot}>
                <Text style={styles.stepNumber}>{sIdx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}

          {activity.materials.length > 0 && (
            <View style={styles.materialsBox}>
              <Text style={styles.materialsLabel}>
                {'준비물'}
              </Text>
              {activity.materials.map((m, mIdx) => (
                <Text key={mIdx} style={styles.materialItem}>
                  {'• '}{m}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F2' },
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

  /* Intro banner */
  introBanner: {
    backgroundColor: ACCENT_LIGHT,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  introEmoji: { fontSize: 32, marginBottom: SPACING.xs },
  introIcon: { width: 48, height: 48, marginBottom: SPACING.xs },
  introText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
  },

  /* Activity card */
  actCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: ACCENT,
    shadowColor: '#ABABAB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actEmojiWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  actEmoji: { fontSize: 24 },
  actInfo: { flex: 1 },
  actName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  actMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actMetaText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  chevron: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: SPACING.sm,
  },

  /* Reason */
  reasonBox: {
    marginTop: SPACING.sm,
    backgroundColor: '#FFF8F2',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  reasonLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },

  /* Steps */
  stepsSection: {
    marginTop: SPACING.sm,
    backgroundColor: '#F8FFF8',
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
  },
  stepsTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#4ECDC4',
    marginBottom: SPACING.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  stepNumber: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },

  /* Materials */
  materialsBox: {
    marginTop: SPACING.sm,
    backgroundColor: '#FFF8F2',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  materialsLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 4,
  },
  materialItem: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    lineHeight: 18,
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

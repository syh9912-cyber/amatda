import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import {
  PLAY_ACTIVITIES,
  resolvePlayTemperament,
} from '../../constants/playActivities';
import type { PlayActivity } from '../../constants/playActivities';

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
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const selectedChild = useChildStore((s) => s.selectedChild);

  const temperamentKey = resolvePlayTemperament(
    selectedChild?.innateData.dominantType ?? '',
  );
  const ageGroup = selectedChild?.ageInfo.group ?? 'toddler';
  const allActivities = PLAY_ACTIVITIES[temperamentKey];
  const filtered = allActivities.filter((a) =>
    a.ageGroups.includes(ageGroup),
  );

  const toggleExpand = useCallback((idx: number) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  const childName = selectedChild?.name ?? '';
  const dominantLabel =
    selectedChild?.innateData.dominantType.split('(')[0] ?? '';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <Header
        title={`${childName}\uC758 \uB180\uC774\uD559\uC2B5`}
        onBack={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro banner */}
        <View style={styles.introBanner}>
          <Text style={styles.introEmoji}>{'\uD83C\uDFA8'}</Text>
          <Text style={styles.introText}>
            {`${dominantLabel} \uAE30\uC9C8\uC758 ${childName}\uC5D0\uAC8C \uB531 \uB9DE\uB294\n\uC9D1\uC5D0\uC11C \uD560 \uC218 \uC788\uB294 \uB180\uC774\uD559\uC2B5 \uBC29\uBC95\uC774\uC5D0\uC694`}
          </Text>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {'\uD574\uB2F9 \uC5F0\uB839\uB300\uC5D0 \uB9DE\uB294 \uD65C\uB3D9\uC774 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4'}
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
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function Header({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
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
              {'\u23F1 '}{activity.duration}
            </Text>
            {activity.materials.length > 0 && (
              <Text style={styles.actMetaText}>
                {'\uD83D\uDCE6 '}{activity.materials.join(', ')}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.chevron}>
          {expanded ? '\u25B2' : '\u25BC'}
        </Text>
      </TouchableOpacity>

      {/* Reason */}
      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>
          {'\uD83D\uDCA1 \uC65C \uC88B\uC744\uAE4C\uC694?'}
        </Text>
        <Text style={styles.reasonText}>
          {`${dominantLabel} \uAE30\uC9C8\uC758 ${childName}\uC5D0\uAC8C - ${activity.reason}`}
        </Text>
      </View>

      {/* Expanded: Steps */}
      {expanded && (
        <View style={styles.stepsSection}>
          <Text style={styles.stepsTitle}>
            {'\uD83D\uDCCB \uC774\uB807\uAC8C \uD574\uBCF4\uC138\uC694'}
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
                {'\uD83D\uDCE6 \uC900\uBE44\uBB3C'}
              </Text>
              {activity.materials.map((m, mIdx) => (
                <Text key={mIdx} style={styles.materialItem}>
                  {'\u2022 '}{m}
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
    shadowColor: '#B8A690',
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

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  Image,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { memoriesApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

/* ---- Types ---- */

interface ChildCardData {
  name: string;
  ageLabel: string;
  temperament: string;
  temperamentEmoji: string;
  photoUrl: string | null;
  traits: string[];
  favoriteActivities: string[];
  shareCode: string;
}

/* ---- Screen ---- */

export default function ChildCardScreen() {
  const selectedChild = useChildStore((s) => s.selectedChild);
  const [loading, setLoading] = useState(true);
  const [cardData, setCardData] = useState<ChildCardData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    memoriesApi
      .childCard(selectedChild.id)
      .then((res) => {
        const data = res.data?.data as ChildCardData | undefined;
        if (data) setCardData(data);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [selectedChild?.id]);

  const handleShare = async () => {
    if (!cardData) return;
    try {
      await Share.share({
        message: [
          `${cardData.name}의 디지털 카드`,
          `나이: ${cardData.ageLabel}`,
          `성향: ${cardData.temperamentEmoji} ${cardData.temperament}`,
          cardData.traits.length > 0
            ? `성격: ${cardData.traits.join(', ')}`
            : '',
          cardData.favoriteActivities.length > 0
            ? `좋아하는 활동: ${cardData.favoriteActivities.join(', ')}`
            : '',
          `공유코드: ${cardData.shareCode}`,
          '',
          '- 아맞다 육아 코칭 앱 -',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    } catch {
      // user cancelled share
    }
  };

  return (
    <ScrollView style={ccStyles.container} contentContainerStyle={ccStyles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={ccStyles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={ccStyles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={ccStyles.headerTitle}>아이 디지털 카드</Text>
        <View style={ccStyles.headerSpacer} />
      </View>

      {loading ? (
        <View style={ccStyles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={ccStyles.loadingText}>카드를 만들고 있어요...</Text>
        </View>
      ) : error || !cardData ? (
        <View style={ccStyles.loadingWrap}>
          <Text style={ccStyles.errorIcon}>{'😢'}</Text>
          <Text style={ccStyles.loadingText}>
            카드를 불러올 수 없습니다
          </Text>
          <TouchableOpacity
            style={ccStyles.retryBtn}
            onPress={() => {
              if (selectedChild) {
                setLoading(true);
                setError(false);
                memoriesApi
                  .childCard(selectedChild.id)
                  .then((res) => {
                    const data = res.data?.data as ChildCardData | undefined;
                    if (data) setCardData(data);
                  })
                  .catch(() => setError(true))
                  .finally(() => setLoading(false));
              }
            }}
          >
            <Text style={ccStyles.retryBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* The Card */}
          <View style={ccStyles.card}>
            {/* Top coral accent line */}
            <View style={ccStyles.cardAccent} />

            {/* Photo / Avatar */}
            <View style={ccStyles.avatarWrap}>
              {cardData.photoUrl || selectedChild?.photoUri ? (
                <Image
                  source={{ uri: cardData.photoUrl || selectedChild?.photoUri || '' }}
                  style={ccStyles.avatarImage}
                />
              ) : (
                <View style={ccStyles.avatarPlaceholder}>
                  <Text style={ccStyles.avatarEmoji}>
                    {selectedChild?.gender === 'F' ? '👧' : '👦'}
                  </Text>
                </View>
              )}
            </View>

            {/* Name */}
            <Text style={ccStyles.cardName}>{cardData.name}</Text>

            {/* Age */}
            <Text style={ccStyles.cardAge}>{cardData.ageLabel}</Text>

            {/* Temperament */}
            <View style={ccStyles.temperamentBadge}>
              <Text style={ccStyles.temperamentText}>
                {cardData.temperamentEmoji} {cardData.temperament}
              </Text>
            </View>

            {/* Divider */}
            <View style={ccStyles.divider} />

            {/* Personality Traits */}
            {cardData.traits.length > 0 && (
              <View style={ccStyles.section}>
                <Text style={ccStyles.sectionLabel}>성격 특성</Text>
                <View style={ccStyles.pillRow}>
                  {cardData.traits.slice(0, 3).map((trait) => (
                    <View key={trait} style={ccStyles.traitPill}>
                      <Text style={ccStyles.traitPillText}>{trait}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Favorite Activities */}
            {cardData.favoriteActivities.length > 0 && (
              <View style={ccStyles.section}>
                <Text style={ccStyles.sectionLabel}>좋아하는 활동</Text>
                <View style={ccStyles.pillRow}>
                  {cardData.favoriteActivities.map((act) => (
                    <View key={act} style={ccStyles.activityPill}>
                      <Text style={ccStyles.activityPillText}>{act}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Share Code */}
            <View style={ccStyles.shareCodeWrap}>
              <Text style={ccStyles.shareCodeLabel}>공유 코드</Text>
              <Text style={ccStyles.shareCodeValue}>{cardData.shareCode}</Text>
            </View>
          </View>

          {/* Share Button */}
          <TouchableOpacity style={ccStyles.shareBtn} onPress={handleShare}>
            <Text style={ccStyles.shareBtnText}>공유하기</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

/* ---- Styles ---- */

const ccStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5EC',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
    paddingRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 24,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  retryBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },

  /* Card */
  card: {
    backgroundColor: '#FFFBF5',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.medium,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  avatarWrap: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  avatarEmoji: {
    fontSize: 44,
  },
  cardName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardAge: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  temperamentBadge: {
    backgroundColor: '#FFF0E6',
    borderRadius: RADIUS.full,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: SPACING.md,
  },
  temperamentText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  section: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  traitPill: {
    backgroundColor: '#FFF0E6',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  traitPillText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  activityPill: {
    backgroundColor: '#E8F8F0',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  activityPillText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#2BA89E',
  },
  shareCodeWrap: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  shareCodeLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  shareCodeValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 2,
  },

  /* Share Button */
  shareBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.lg,
    ...SHADOWS.soft,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
});

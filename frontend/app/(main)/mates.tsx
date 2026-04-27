import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import api from '../../services/api';
import { AdSlot } from '../../components/ads/AdSlot';

interface MateMatch {
  id: string;
  gender: string;
  ageLabel: string;
  dominantType: string;
  isComplement: boolean;
  isSameAge: boolean;
  matchScore: number;
  matchReason: string[];
}

interface MateData {
  myChild: { name: string; dominantType: string; ageLabel: string };
  complementTypes: string[];
  matches: MateMatch[];
  total: number;
  message: string | null;
}

export default function MatesScreen() {
  const [data, setData] = useState<MateData | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedChild = useChildStore((s) => s.selectedChild);

  useEffect(() => {
    if (selectedChild) loadMates();
  }, [selectedChild?.id]);

  const loadMates = async () => {
    if (!selectedChild) return;
    try {
      const res = await api.get(`/mates/${selectedChild.id}`);
      setData(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: '동네 기질 메이트', headerShown: true }} />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : !data ? (
        <Text style={styles.emptyText}>데이터를 불러올 수 없습니다</Text>
      ) : (
        <>
          {/* 내 아이 정보 */}
          <View style={styles.myCard}>
            <Text style={styles.myName}>{data.myChild.name}</Text>
            <Text style={styles.myInfo}>
              {data.myChild.dominantType} · {data.myChild.ageLabel}
            </Text>
            <Text style={styles.complement}>
              보완 기질: {data.complementTypes.join(', ')}
            </Text>
          </View>

          {/* 매칭 결과 */}
          {data.message ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>아직 매칭 대기 중이에요</Text>
              <Text style={styles.emptyDesc}>{data.message}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                매칭된 또래 ({data.total}명)
              </Text>
              {data.matches.map((mate) => (
                <View key={mate.id} style={styles.mateCard}>
                  <View style={styles.mateHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {mate.gender === 'F' ? '👧' : '👦'}
                      </Text>
                    </View>
                    <View style={styles.mateInfo}>
                      <Text style={styles.mateType}>{mate.dominantType}</Text>
                      <Text style={styles.mateAge}>{mate.ageLabel}</Text>
                    </View>
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreText}>{mate.matchScore}점</Text>
                    </View>
                  </View>
                  <View style={styles.reasonRow}>
                    {mate.matchReason.map((r, i) => (
                      <View key={i} style={styles.reasonChip}>
                        <Text style={styles.reasonText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                  {mate.isComplement && (
                    <Text style={styles.complementTag}>✨ 보완 기질 매칭</Text>
                  )}
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
    <AdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 120 },
  myCard: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.lg, alignItems: 'center',
  },
  myName: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  myInfo: { fontSize: FONT_SIZE.md, color: COLORS.primary, marginTop: SPACING.xs },
  complement: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm },
  sectionTitle: {
    fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text,
    marginBottom: SPACING.md,
  },
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.xl, alignItems: 'center',
  },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  emptyDesc: {
    fontSize: FONT_SIZE.sm, color: COLORS.textSecondary,
    textAlign: 'center', marginTop: SPACING.sm, lineHeight: 20,
  },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center' },
  mateCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  mateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  avatarText: { fontSize: 20 },
  mateInfo: { flex: 1 },
  mateType: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  mateAge: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  scoreBadge: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  scoreText: { fontSize: FONT_SIZE.xs, color: '#FFF', fontWeight: '600' },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.xs },
  reasonChip: {
    backgroundColor: COLORS.border, borderRadius: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  reasonText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  complementTag: {
    fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600',
    marginTop: SPACING.xs,
  },
});

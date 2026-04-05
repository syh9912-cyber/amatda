import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { academyApi } from '../../services/api';
import { FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  dominantType: string;
  ageMonths: number;
}

interface AcademyRec {
  type: string;
  reason: string;
  emoji: string;
}

export function AcademyContent({ dominantType, ageMonths }: Props) {
  const [recs, setRecs] = useState<AcademyRec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecs();
  }, [dominantType, ageMonths]);

  const loadRecs = async () => {
    setLoading(true);
    try {
      const res = await academyApi.recommend(dominantType, ageMonths);
      const data = res.data.data ?? [];
      setRecs(data.slice(0, 3));
    } catch {
      setRecs(getFallback(dominantType));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color="#6366F1" />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>
          {'🏫'} 추천 학원 유형
        </Text>
        {recs.length > 0 ? (
          recs.map((rec, i) => (
            <View key={i} style={styles.recRow}>
              <Text style={styles.recEmoji}>{rec.emoji || '🎯'}</Text>
              <View style={styles.recInfo}>
                <Text style={styles.recType}>{rec.type}</Text>
                {rec.reason ? (
                  <Text style={styles.recReason} numberOfLines={2}>
                    {rec.reason}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>
            주변 추천 학원이 없어요
          </Text>
        )}
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => router.push('/(main)/academy')}
        >
          <Text style={styles.moreBtnText}>
            더보기
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getFallback(dominantType: string): AcademyRec[] {
  const map: Record<string, AcademyRec[]> = {
    '탐구형': [
      { type: '과학 탐구', reason: '탐구 성향에 적합', emoji: '🔬' },
      { type: '코딩', reason: '논리적 사고 발달', emoji: '💻' },
    ],
    '활동형': [
      { type: '체육', reason: '에너지 발산에 좋아요', emoji: '⚽' },
      { type: '무용', reason: '사회성 + 활동 결합', emoji: '💃' },
    ],
    '안정형': [
      { type: '미술', reason: '안정적 성향과 잘 맞아요', emoji: '🎨' },
      { type: '음악', reason: '집중력 강화', emoji: '🎵' },
    ],
  };
  return map[dominantType] ?? [
    { type: '예체능', reason: '기질에 맞는 활동', emoji: '🎯' },
  ];
}

const styles = StyleSheet.create({
  loadingWrap: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#1E1E2E',
    marginBottom: SPACING.md,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: SPACING.sm,
  },
  recEmoji: {
    fontSize: 28,
  },
  recInfo: {
    flex: 1,
  },
  recType: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: '#1E1E2E',
  },
  recReason: {
    fontSize: FONT_SIZE.xs,
    color: '#6B6B80',
    marginTop: 2,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: '#A0A0B0',
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  moreBtn: {
    marginTop: SPACING.md,
    backgroundColor: '#4338CA',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  moreBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});

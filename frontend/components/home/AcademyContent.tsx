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
          {'\uD83C\uDFEB'} \uCD94\uCC9C \uD559\uC6D0 \uC720\uD615
        </Text>
        {recs.length > 0 ? (
          recs.map((rec, i) => (
            <View key={i} style={styles.recRow}>
              <Text style={styles.recEmoji}>{rec.emoji || '\uD83C\uDFAF'}</Text>
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
            \uC8FC\uBCC0 \uCD94\uCC9C \uD559\uC6D0\uC774 \uC5C6\uC5B4\uC694
          </Text>
        )}
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => router.push('/(main)/academy')}
        >
          <Text style={styles.moreBtnText}>
            \uB354\uBCF4\uAE30
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getFallback(dominantType: string): AcademyRec[] {
  const map: Record<string, AcademyRec[]> = {
    '\uD0D0\uAD6C\uD615': [
      { type: '\uACFC\uD559 \uD0D0\uAD6C', reason: '\uD0D0\uAD6C \uC131\uD5A5\uC5D0 \uC801\uD569', emoji: '\uD83D\uDD2C' },
      { type: '\uCF54\uB529', reason: '\uB17C\uB9AC\uC801 \uC0AC\uACE0 \uBC1C\uB2EC', emoji: '\uD83D\uDCBB' },
    ],
    '\uD65C\uB3D9\uD615': [
      { type: '\uCCB4\uC721', reason: '\uC5D0\uB108\uC9C0 \uBC1C\uC0B0\uC5D0 \uC88B\uC544\uC694', emoji: '\u26BD' },
      { type: '\uBB34\uC6A9', reason: '\uC0AC\uD68C\uC131 + \uD65C\uB3D9 \uACB0\uD569', emoji: '\uD83D\uDC83' },
    ],
    '\uC548\uC815\uD615': [
      { type: '\uBBF8\uC220', reason: '\uC548\uC815\uC801 \uC131\uD5A5\uACFC \uC798 \uB9DE\uC544\uC694', emoji: '\uD83C\uDFA8' },
      { type: '\uC74C\uC545', reason: '\uC9D1\uC911\uB825 \uAC15\uD654', emoji: '\uD83C\uDFB5' },
    ],
  };
  return map[dominantType] ?? [
    { type: '\uC608\uCCB4\uB2A5', reason: '\uAE30\uC9C8\uC5D0 \uB9DE\uB294 \uD65C\uB3D9', emoji: '\uD83C\uDFAF' },
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

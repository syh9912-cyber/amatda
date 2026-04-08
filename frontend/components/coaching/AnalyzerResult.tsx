import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COACHING_COLORS } from './types';

interface Possibility {
  label: string;
  likelihood: string;
}

interface AnalysisData {
  childName?: string;
  type: 'cry' | 'poop';
  analysis: string;
  possibilities: Possibility[];
  recommendations: string[];
  needsDoctor: boolean;
}

interface Props {
  result: AnalysisData;
  onReset: () => void;
}

function likelihoodToWidth(l: string): number {
  if (l.includes('\uB192\uC74C')) return 90;
  if (l.includes('\uBCF4\uD1B5')) return 55;
  return 25;
}

function likelihoodToColor(l: string): string {
  if (l.includes('\uB192\uC74C')) return '#FF6B6B';
  if (l.includes('\uBCF4\uD1B5')) return '#FFB347';
  return '#77DD77';
}

export function AnalyzerResult({ result, onReset }: Props) {
  return (
    <View style={styles.container}>
      {result.needsDoctor ? (
        <View style={styles.doctorBanner}>
          <Text style={styles.doctorIcon}>{'\u26A0\uFE0F'}</Text>
          <Text style={styles.doctorText}>
            {'\uC804\uBB38\uC758 \uC0C1\uB2F4\uC774 \uD544\uC694\uD560 \uC218 \uC788\uC5B4\uC694'}
          </Text>
        </View>
      ) : null}

      <View style={styles.analysisBox}>
        <Text style={styles.sectionTitle}>
          {'\uD83D\uDD0D \uBD84\uC11D \uACB0\uACFC'}
        </Text>
        <Text style={styles.analysisText}>{result.analysis}</Text>
      </View>

      <View style={styles.possBox}>
        <Text style={styles.sectionTitle}>
          {'\uD83D\uDCCA \uAC00\uB2A5\uC131'}
        </Text>
        {result.possibilities.map((p, i) => (
          <View key={i} style={styles.barRow}>
            <Text style={styles.barLabel}>{p.label}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${likelihoodToWidth(p.likelihood)}%`,
                    backgroundColor: likelihoodToColor(p.likelihood),
                  },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{p.likelihood}</Text>
          </View>
        ))}
      </View>

      <View style={styles.recsBox}>
        <Text style={styles.sectionTitle}>
          {'\u2705 \uCD94\uCC9C \uC870\uCE58'}
        </Text>
        {result.recommendations.map((r, i) => (
          <Text key={i} style={styles.recItem}>
            {i + 1}. {r}
          </Text>
        ))}
      </View>

      <TouchableOpacity
        style={styles.resetBtn}
        onPress={onReset}
        activeOpacity={0.7}
      >
        <Text style={styles.resetText}>
          {'\uB2E4\uC2DC \uBD84\uC11D\uD558\uAE30'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 24 },
  doctorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0F0',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFB8B8',
  },
  doctorIcon: { fontSize: 20 },
  doctorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#D32F2F',
    lineHeight: 20,
  },
  analysisBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COACHING_COLORS.text,
    marginBottom: 10,
  },
  analysisText: {
    fontSize: 14,
    color: COACHING_COLORS.text,
    lineHeight: 22,
  },
  possBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  barLabel: {
    width: 76,
    fontSize: 13,
    fontWeight: '600',
    color: COACHING_COLORS.text,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: '#F0E6DA',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: 12,
    borderRadius: 6,
  },
  barValue: {
    width: 36,
    fontSize: 11,
    color: COACHING_COLORS.textSub,
    textAlign: 'right',
  },
  recsBox: {
    backgroundColor: '#E8FAF8',
    borderRadius: 14,
    padding: 16,
  },
  recItem: {
    fontSize: 13,
    color: COACHING_COLORS.text,
    lineHeight: 22,
    paddingLeft: 4,
  },
  resetBtn: {
    backgroundColor: COACHING_COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useChildStore } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

const ELEMENT_COLORS: Record<string, string> = {
  wood: COLORS.wood,
  fire: COLORS.fire,
  earth: COLORS.earth,
  metal: COLORS.metal,
  water: COLORS.water,
};

const ELEMENT_LABELS: Record<string, string> = {
  wood: '탐구',
  fire: '활동',
  earth: '안정',
  metal: '분석',
  water: '감성',
};

export default function ResultScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const child = children.find((c) => c.id === childId);

  if (!child) {
    return (
      <View style={styles.container}>
        <Text>자녀 정보를 찾을 수 없습니다</Text>
      </View>
    );
  }

  const { fiveElements, dominantType, label } = child.innateData;
  const maxVal = Math.max(...Object.values(fiveElements));

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '기질 분석 결과' }} />

      <View style={styles.card}>
        <Text style={styles.childName}>{child.name}</Text>
        <Text style={styles.dominant}>{dominantType}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>에너지 분포</Text>
        {Object.entries(fiveElements).map(([key, val]) => (
          <View key={key} style={styles.barRow}>
            <Text style={styles.barLabel}>{ELEMENT_LABELS[key]}</Text>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${(val / maxVal) * 100}%`,
                    backgroundColor: ELEMENT_COLORS[key],
                  },
                ]}
              />
            </View>
            <Text style={styles.barVal}>{val}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          router.replace({
            pathname: '/onboarding/intake-form',
            params: { childId: childId },
          })
        }
      >
        <Text style={styles.buttonText}>성향 질문 시작</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipLink}
        onPress={() => router.replace('/(main)/home')}
      >
        <Text style={styles.skipText}>건너뛰고 홈으로</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    marginTop: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  childName: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  dominant: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.primary,
  },
  label: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
  },
  chartTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  barLabel: {
    width: 36,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  barBg: {
    flex: 1,
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginHorizontal: SPACING.sm,
  },
  barFill: { height: '100%', borderRadius: 6 },
  barVal: {
    width: 28,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    textAlign: 'right',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  buttonText: { color: '#FFFFFF', fontSize: FONT_SIZE.lg, fontWeight: '600' },
  skipLink: { alignItems: 'center', marginTop: SPACING.md },
  skipText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
});

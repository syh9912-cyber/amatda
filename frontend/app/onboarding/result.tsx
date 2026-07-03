import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useChildStore } from '../../stores/childStore';
import { getTraitTypeName } from '../../utils/traitTypeName';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

const ELEMENT_COLORS: Record<string, string> = {
  wood: COLORS.wood,
  fire: COLORS.fire,
  earth: COLORS.earth,
  metal: COLORS.metal,
  water: COLORS.water,
};

const getElementLabels = (t: TFunction): Record<string, string> => ({
  wood: t('onboardingResult.element.wood'),
  fire: t('onboardingResult.element.fire'),
  earth: t('onboardingResult.element.earth'),
  metal: t('onboardingResult.element.metal'),
  water: t('onboardingResult.element.water'),
});

export default function ResultScreen() {
  const { t } = useTranslation();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const children = useChildStore((s) => s.children);
  const child = children.find((c) => c.id === childId);

  if (!child) {
    return (
      <View style={styles.container}>
        <Text>{t('onboardingResult.childNotFound')}</Text>
      </View>
    );
  }

  const innateData = child.innateData;
  if (!innateData) {
    return (
      <View style={styles.container}>
        <Text>{t('onboardingResult.analysisDataNotFound')}</Text>
      </View>
    );
  }
  const { fiveElements, dominantType, label } = innateData;
  const maxVal = Math.max(...Object.values(fiveElements));
  const elementLabels = getElementLabels(t);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('onboardingResult.screenTitle') }} />

      <View style={styles.card}>
        <Text style={styles.childName}>{child.name}</Text>
        <Text style={styles.dominant}>{getTraitTypeName(t, dominantType)}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{t('onboardingResult.energyDistribution')}</Text>
        {Object.entries(fiveElements).map(([key, val]) => (
          <View key={key} style={styles.barRow}>
            <Text style={styles.barLabel}>{elementLabels[key]}</Text>
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
            pathname: '/onboarding/questions',
            params: { childId: childId },
          })
        }
      >
        <Text style={styles.buttonText}>{t('onboardingResult.startQuestions')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipLink}
        onPress={() => router.replace('/(main)/home')}
      >
        <Text style={styles.skipText}>{t('onboardingResult.skipToHome')}</Text>
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

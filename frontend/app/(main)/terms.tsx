import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../../components/common/BackButton';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function TermsScreen() {
  const { t, i18n } = useTranslation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('terms.pageTitle'), headerShown: true, headerLeft: () => <BackButton /> }} />

      <Text style={styles.heading}>{t('terms.heading')}</Text>

      {i18n.language !== 'ko' && (
        <Text style={styles.disclaimer}>{t('terms.translationDisclaimer')}</Text>
      )}

      <Text style={styles.meta}>{t('terms.meta')}</Text>

      <Section title={t('terms.purpose.title')}>{t('terms.purpose.body')}</Section>

      <Section title={t('terms.definitions.title')}>{t('terms.definitions.body')}</Section>

      <Section title={t('terms.effectAndChanges.title')}>{t('terms.effectAndChanges.body')}</Section>

      <Section title={t('terms.serviceContent.title')}>{t('terms.serviceContent.body')}</Section>

      <Section title={t('terms.membership.title')}>{t('terms.membership.body')}</Section>

      <Section title={t('terms.userObligations.title')}>{t('terms.userObligations.body')}</Section>

      <Section title={t('terms.prohibitedActs.title')}>{t('terms.prohibitedActs.body')}</Section>

      <Section title={t('terms.serviceChangeSuspension.title')}>{t('terms.serviceChangeSuspension.body')}</Section>

      <Section title={t('terms.intellectualProperty.title')}>{t('terms.intellectualProperty.body')}</Section>

      <Section title={t('terms.disclaimer.title')}>{t('terms.disclaimer.body')}</Section>

      <Section title={t('terms.paidServiceAndPayment.title')}>{t('terms.paidServiceAndPayment.body')}</Section>

      <Section title={t('terms.subscriptionCancelRefund.title')}>{t('terms.subscriptionCancelRefund.body')}</Section>

      <Section title={t('terms.damages.title')}>{t('terms.damages.body')}</Section>

      <Section title={t('terms.disputeResolution.title')}>{t('terms.disputeResolution.body')}</Section>

      <Section title={t('terms.addendum.title')}>{t('terms.addendum.body')}</Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          SY Labs | privacy@sylabs.kr
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 60 },
  heading: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  disclaimer: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  meta: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  section: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  body: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  footerText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
});

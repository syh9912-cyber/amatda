import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';
import { BackButton } from '../../components/common/BackButton';

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const { t, i18n } = useTranslation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('privacy.pageTitle'), headerShown: true, headerLeft: () => <BackButton /> }} />

      <Text style={styles.heading}>{t('privacy.heading')}</Text>

      {i18n.language !== 'ko' && (
        <Text style={styles.disclaimer}>{t('privacy.translationDisclaimer')}</Text>
      )}

      <Text style={styles.meta}>{t('privacy.meta')}</Text>

      <Text style={styles.intro}>{t('privacy.intro')}</Text>

      <Section title={t('privacy.collectionItems.title')}>{t('privacy.collectionItems.body')}</Section>

      <Section title={t('privacy.socialLogin.title')}>{t('privacy.socialLogin.body')}</Section>

      <Section title={t('privacy.purpose.title')}>{t('privacy.purpose.body')}</Section>

      <Section title={t('privacy.retention.title')}>{t('privacy.retention.body')}</Section>

      <Section title={t('privacy.thirdParty.title')}>{t('privacy.thirdParty.body')}</Section>

      <Section title={t('privacy.childProtection.title')}>{t('privacy.childProtection.body')}</Section>

      <Section title={t('privacy.userRights.title')}>{t('privacy.userRights.body')}</Section>

      <Section title={t('privacy.dpo.title')}>{t('privacy.dpo.body')}</Section>

      <Section title={t('privacy.outsourcing.title')}>{t('privacy.outsourcing.body')}</Section>

      <Section title={t('privacy.cookies.title')}>{t('privacy.cookies.body')}</Section>

      <Section title={t('privacy.policyChanges.title')}>{t('privacy.policyChanges.body')}</Section>

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
  intro: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SPACING.lg,
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

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useChildStore } from '../../stores/childStore';
import { recommendationApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { BackButton } from '../../components/common/BackButton';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { MedicalCitation } from '../../components/common/MedicalCitation';

/* ------------------------------------------------------------------ */
/*  Category meta                                                      */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<string, { emoji: string; color: string; bgColor: string }> = {
  default: { emoji: '📋', color: COLORS.primary, bgColor: COLORS.primaryLight },
};

function getCategoryMeta(category: string) {
  return CATEGORY_META[category] ?? CATEGORY_META.default;
}

/* ------------------------------------------------------------------ */
/*  AI Response parser                                                 */
/* ------------------------------------------------------------------ */

interface ParsedSection {
  heading: string;
  bullets: string[];
}

function parseAIResponse(text: string): ParsedSection[] {
  const lines = text.split('\n').filter((l) => l.trim());
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    // Heading detection: starts with # or **bold** or ends with :
    if (
      trimmed.startsWith('#') ||
      (trimmed.startsWith('**') && trimmed.endsWith('**')) ||
      (trimmed.endsWith(':') && trimmed.length < 40)
    ) {
      if (current) sections.push(current);
      current = {
        heading: trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/:$/, ''),
        bullets: [],
      };
    } else if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+[.)]/.test(trimmed)) {
      if (!current) current = { heading: '', bullets: [] };
      current.bullets.push(
        trimmed.replace(/^[-*]\s*/, '').replace(/^\d+[.)]\s*/, ''),
      );
    } else {
      if (!current) current = { heading: '', bullets: [] };
      current.bullets.push(trimmed);
    }
  }
  if (current) sections.push(current);
  return sections;
}

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */

export default function RecommendationDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    title: string;
    category: string;
    desc: string;
  }>();
  const title = params.title ?? '';
  const category = params.category ?? '';
  const desc = params.desc ?? '';

  const selectedChild = useChildStore((s) => s.selectedChild);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const meta = getCategoryMeta(category);

  useEffect(() => {
    if (!selectedChild || !title) { setLoading(false); return; }
    fetchContent();
  }, [selectedChild?.id, title]);

  const fetchContent = async () => {
    if (!selectedChild) { setLoading(false); return; }
    setLoading(true);
    setErrorMsg(null);
    try {
      const ageGroup = selectedChild.ageInfo?.group === 'infant' ? 'infant' : 'elementary';
      const temperament = selectedChild.innateData?.dominantType ?? '안정형';

      const res = await recommendationApi.get(
        title, ageGroup, temperament, selectedChild.id, category, i18n.language,
      );
      const data = res.data?.data as Record<string, unknown> | undefined;

      const answer = String(data?.answer ?? '');
      const actions = (data?.actions ?? []) as string[];
      const reasons = (data?.reasons ?? []) as string[];
      const personalNote = String(data?.personalNote ?? '');

      // Build formatted text
      const parts: string[] = [];
      if (answer) parts.push(answer);
      if (reasons.length > 0) {
        parts.push(`\n**${t('recommendationDetail.section.reasons')}**`);
        reasons.forEach((r) => parts.push(`- ${r}`));
      }
      if (actions.length > 0) {
        parts.push(`\n**${t('recommendationDetail.section.actions')}**`);
        actions.forEach((a) => parts.push(`- ${a}`));
      }
      if (personalNote) {
        parts.push(`\n**${t('recommendationDetail.section.personalNote')}**\n${personalNote}`);
      }

      setContent(parts.join('\n') || t('recommendationDetail.contentPreparing'));
    } catch {
      setErrorMsg(t('recommendationDetail.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const sections = content ? parseAIResponse(content) : [];

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.headerWrap}>
        <ScreenHeader title={title} />
      </View>

      {/* Category Badge */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: meta.bgColor }]}>
          <Text style={styles.badgeEmoji}>{meta.emoji}</Text>
          <Text style={[styles.badgeText, { color: meta.color }]}>{category}</Text>
        </View>
      </View>

      {/* Description */}
      {desc ? <Text style={styles.desc}>{desc}</Text> : null}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('recommendationDetail.loading', {
              name: selectedChild?.name ?? t('recommendationDetail.defaultChildName'),
            })}
          </Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorEmoji}>{'😥'}</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchContent}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((section, sIdx) => (
            <View key={sIdx} style={styles.sectionCard}>
              {section.heading ? (
                <View style={styles.sectionHeaderRow}>
                  <View style={[styles.sectionDot, { backgroundColor: meta.color }]} />
                  <Text style={styles.sectionHeading}>{section.heading}</Text>
                </View>
              ) : null}
              {section.bullets.map((bullet, bIdx) => (
                <View key={bIdx} style={styles.bulletRow}>
                  {section.heading ? (
                    <Text style={styles.bulletDot}>{'  '}</Text>
                  ) : null}
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* CTA: Ask more in chatbot */}
          <TouchableOpacity
            style={styles.askMoreBtn}
            onPress={() => router.push('/(main)/chatbot' as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.askMoreText}>{t('recommendationDetail.askMore')}</Text>
          </TouchableOpacity>

          <MedicalCitation
            note={t('recommendationDetail.citationNote')}
            sources={[
              { label: t('chatbot.medicalSource.kdca'), url: 'https://health.kdca.go.kr' },
              { label: t('recommendationDetail.citationSourceFoodSafety'), url: 'https://www.foodsafetykorea.go.kr' },
            ]}
          />
        </ScrollView>
      )}
      <AdSlot />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerWrap: {
    paddingTop: 56,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 4,
  },
  badgeEmoji: {
    fontSize: 14,
  },
  badgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  desc: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: {
    color: '#FFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  sectionHeading: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 2,
  },
  bulletDot: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginRight: 4,
    lineHeight: 22,
  },
  bulletText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    lineHeight: 22,
    flex: 1,
  },
  askMoreBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  askMoreText: {
    color: '#FFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});

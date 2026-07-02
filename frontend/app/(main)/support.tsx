import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Linking, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { COLORS } from '../../constants/theme';
import { ScreenHeader } from '../../components/common/ScreenHeader';

const COLOR = {
  bg: COLORS.background,
  card: COLORS.surface,
  accent: COLORS.primary,
  text: COLORS.text,
  textSub: COLORS.textSecondary,
  textLight: COLORS.textLight,
  border: COLORS.borderLight,
};

type InquiryType = 'bug' | 'feature' | 'account' | 'etc';

function getInquiryTypes(t: TFunction): { key: InquiryType; emoji: string; label: string }[] {
  return [
    { key: 'bug', emoji: '🐛', label: t('support.inquiryTypes.bug') },
    { key: 'feature', emoji: '💡', label: t('support.inquiryTypes.feature') },
    { key: 'account', emoji: '👤', label: t('support.inquiryTypes.account') },
    { key: 'etc', emoji: '📝', label: t('support.inquiryTypes.etc') },
  ];
}

function getFaqItems(t: TFunction): { q: string; a: string }[] {
  return [
    { q: t('support.faq.temperament.q'), a: t('support.faq.temperament.a') },
    { q: t('support.faq.coachLimit.q'), a: t('support.faq.coachLimit.a') },
    { q: t('support.faq.dataSafety.q'), a: t('support.faq.dataSafety.a') },
    { q: t('support.faq.errorReport.q'), a: t('support.faq.errorReport.a') },
  ];
}

const SUPPORT_EMAIL = 'support@sylabs.kr';

export default function SupportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<InquiryType | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const inquiryTypes = getInquiryTypes(t);
  const faqItems = getFaqItems(t);

  const handleSend = async () => {
    if (!selectedType) {
      Alert.alert(t('common.notice'), t('support.selectInquiryType'));
      return;
    }
    if (!title.trim()) {
      Alert.alert(t('common.notice'), t('support.enterTitle'));
      return;
    }
    if (!content.trim()) {
      Alert.alert(t('common.notice'), t('support.enterContent'));
      return;
    }

    setSending(true);

    const typeLabel = inquiryTypes.find((it) => it.key === selectedType)?.label ?? '';
    const subject = encodeURIComponent(`[${t('support.emailSubjectPrefix')} ${typeLabel}] ${title}`);
    const body = encodeURIComponent(
      `${t('support.emailBodyInquiryType')}: ${typeLabel}\n\n${content}\n\n---\n${t('support.emailBodyDevice')}: ${Platform.OS} ${Platform.Version}\n${t('support.emailBodyAppVersion')}: 1.4.2`
    );
    const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(mailUrl);
      if (canOpen) {
        await Linking.openURL(mailUrl);
        Alert.alert(t('support.thankYouTitle'), t('support.mailAppOpened'));
        setTitle('');
        setContent('');
        setSelectedType(null);
      } else {
        Alert.alert(
          t('support.noMailAppTitle'),
          `${t('support.noMailAppMessage')}\n${t('support.sendDirectly')}: ${SUPPORT_EMAIL}`,
          [{ text: t('support.copyEmail'), onPress: () => copyEmail() }, { text: t('common.confirm') }]
        );
      }
    } catch {
      Alert.alert(t('common.error'), t('support.cannotOpenMailApp'));
    } finally {
      setSending(false);
    }
  };

  const copyEmail = async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(SUPPORT_EMAIL);
      Alert.alert(t('support.copyCompleteTitle'), t('support.emailCopied'));
    } catch {
      // clipboard not available
    }
  };

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.headerWrap}>
        <ScreenHeader title={t('support.title')} onBack={() => router.back()} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* FAQ Section */}
        <Text style={s.sectionTitle}>{t('support.faqSectionTitle')}</Text>
        <View style={s.card}>
          {faqItems.map((faq, idx) => (
            <TouchableOpacity
              key={idx}
              style={[s.faqRow, idx < faqItems.length - 1 && s.faqBorder]}
              onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
              activeOpacity={0.7}
            >
              <View style={s.faqQ}>
                <Text style={s.faqQText}>Q. {faq.q}</Text>
                <Text style={s.faqArrow}>{expandedFaq === idx ? '∧' : '∨'}</Text>
              </View>
              {expandedFaq === idx && (
                <Text style={s.faqA}>A. {faq.a}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Inquiry Form */}
        <Text style={s.sectionTitle}>{t('support.inquirySectionTitle')}</Text>
        <View style={s.card}>
          {/* Type Selection */}
          <Text style={s.fieldLabel}>{t('support.inquiryTypeLabel')}</Text>
          <View style={s.typeRow}>
            {inquiryTypes.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[s.typeChip, selectedType === type.key && s.typeChipActive]}
                onPress={() => setSelectedType(type.key)}
                activeOpacity={0.7}
              >
                <Text style={s.typeEmoji}>{type.emoji}</Text>
                <Text style={[s.typeLabel, selectedType === type.key && s.typeLabelActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Title */}
          <Text style={s.fieldLabel}>{t('support.titleFieldLabel')}</Text>
          <TextInput
            style={s.input}
            placeholder={t('support.titlePlaceholder')}
            placeholderTextColor={COLOR.textLight}
            value={title}
            onChangeText={setTitle}
          />

          {/* Content */}
          <Text style={s.fieldLabel}>{t('support.contentFieldLabel')}</Text>
          <TextInput
            style={[s.input, s.textarea]}
            placeholder={t('support.contentPlaceholder')}
            placeholderTextColor={COLOR.textLight}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />

          {/* Send Button */}
          <TouchableOpacity
            style={[s.sendBtn, sending && s.sendBtnDisabled]}
            onPress={handleSend}
            activeOpacity={0.7}
            disabled={sending}
          >
            <Text style={s.sendBtnText}>
              {sending ? t('support.openingMailApp') : t('support.sendByMail')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Direct Email */}
        <TouchableOpacity style={s.emailRow} onPress={copyEmail} activeOpacity={0.7}>
          <Text style={s.emailLabel}>{t('support.sendDirectEmail')}</Text>
          <Text style={s.emailAddr}>{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.bg },
  headerWrap: {
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: COLOR.text, marginBottom: 12, marginTop: 8,
  },
  card: {
    backgroundColor: COLOR.card, borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 16, elevation: 1,
  },

  /* FAQ */
  faqRow: { paddingVertical: 12 },
  faqBorder: { borderBottomWidth: 1, borderBottomColor: COLOR.border },
  faqQ: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQText: { fontSize: 14, fontWeight: '600', color: COLOR.text, flex: 1, lineHeight: 21 },
  faqArrow: { fontSize: 14, color: COLOR.textLight, marginLeft: 8 },
  faqA: { fontSize: 13, color: COLOR.textSub, lineHeight: 20, marginTop: 8, paddingLeft: 4 },

  /* Type chips */
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLOR.textSub, marginBottom: 8, marginTop: 12 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F5F0EB', borderWidth: 1, borderColor: COLOR.border,
  },
  typeChipActive: { backgroundColor: COLOR.accent, borderColor: COLOR.accent },
  typeEmoji: { fontSize: 14 },
  typeLabel: { fontSize: 13, fontWeight: '500', color: COLOR.textSub },
  typeLabelActive: { color: '#FFFFFF' },

  /* Input */
  input: {
    backgroundColor: '#F9F5F0', borderRadius: 12, padding: 14,
    fontSize: 14, color: COLOR.text, borderWidth: 1, borderColor: COLOR.border,
  },
  textarea: { height: 120, textAlignVertical: 'top' },

  /* Send */
  sendBtn: {
    backgroundColor: COLOR.accent, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 16,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  /* Email row */
  emailRow: {
    alignItems: 'center', paddingVertical: 16,
  },
  emailLabel: { fontSize: 12, color: COLOR.textLight, marginBottom: 4 },
  emailAddr: { fontSize: 14, fontWeight: '600', color: COLOR.accent },
});

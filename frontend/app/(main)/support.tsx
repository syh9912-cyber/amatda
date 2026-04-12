import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Linking, Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';

const COLOR = {
  bg: '#FFF5EC',
  card: '#FFFFFF',
  accent: '#FF8C5A',
  text: '#2D2016',
  textSub: '#8C7A6B',
  textLight: '#B5A99A',
  border: '#F0E6DC',
};

type InquiryType = 'bug' | 'feature' | 'account' | 'etc';

const INQUIRY_TYPES: { key: InquiryType; emoji: string; label: string }[] = [
  { key: 'bug', emoji: '🐛', label: '오류 신고' },
  { key: 'feature', emoji: '💡', label: '기능 건의' },
  { key: 'account', emoji: '👤', label: '계정 문의' },
  { key: 'etc', emoji: '📝', label: '기타 문의' },
];

const FAQ_ITEMS = [
  { q: '기질 검사는 몇 번까지 할 수 있나요?', a: '기질 검사는 횟수 제한 없이 무료로 이용 가능합니다.' },
  { q: 'AI 상담은 하루에 몇 번까지 가능한가요?', a: '무료 플랜은 하루 200회, 프리미엄은 999회까지 가능합니다.' },
  { q: '아이 정보는 안전하게 보호되나요?', a: '모든 데이터는 Firebase 보안 규칙으로 보호되며, AI 전송 시 실명이 마스킹됩니다.' },
  { q: '앱 사용 중 오류가 발생하면 어떻게 하나요?', a: '아래 문의하기에서 오류 내용을 보내주시면 빠르게 수정하겠습니다.' },
];

const SUPPORT_EMAIL = 'support@sylabs.kr';

export default function SupportScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<InquiryType | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleSend = async () => {
    if (!selectedType) {
      Alert.alert('알림', '문의 유형을 선택해주세요.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('알림', '제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      Alert.alert('알림', '내용을 입력해주세요.');
      return;
    }

    setSending(true);

    const typeLabel = INQUIRY_TYPES.find((t) => t.key === selectedType)?.label ?? '';
    const subject = encodeURIComponent(`[아맞다 ${typeLabel}] ${title}`);
    const body = encodeURIComponent(
      `문의 유형: ${typeLabel}\n\n${content}\n\n---\n기기: ${Platform.OS} ${Platform.Version}\n앱 버전: 1.4.2`
    );
    const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(mailUrl);
      if (canOpen) {
        await Linking.openURL(mailUrl);
        Alert.alert('감사합니다', '메일 앱이 열렸습니다. 보내기를 눌러주세요.');
        setTitle('');
        setContent('');
        setSelectedType(null);
      } else {
        Alert.alert(
          '메일 앱 없음',
          `메일 앱을 찾을 수 없습니다.\n직접 보내주세요: ${SUPPORT_EMAIL}`,
          [{ text: '이메일 복사', onPress: () => copyEmail() }, { text: '확인' }]
        );
      }
    } catch {
      Alert.alert('오류', '메일 앱을 열 수 없습니다.');
    } finally {
      setSending(false);
    }
  };

  const copyEmail = async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(SUPPORT_EMAIL);
      Alert.alert('복사 완료', '이메일 주소가 복사되었습니다.');
    } catch {
      // clipboard not available
    }
  };

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>고객센터</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* FAQ Section */}
        <Text style={s.sectionTitle}>자주 묻는 질문</Text>
        <View style={s.card}>
          {FAQ_ITEMS.map((faq, idx) => (
            <TouchableOpacity
              key={idx}
              style={[s.faqRow, idx < FAQ_ITEMS.length - 1 && s.faqBorder]}
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
        <Text style={s.sectionTitle}>문의하기</Text>
        <View style={s.card}>
          {/* Type Selection */}
          <Text style={s.fieldLabel}>문의 유형</Text>
          <View style={s.typeRow}>
            {INQUIRY_TYPES.map((type) => (
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
          <Text style={s.fieldLabel}>제목</Text>
          <TextInput
            style={s.input}
            placeholder="문의 제목을 입력해주세요"
            placeholderTextColor={COLOR.textLight}
            value={title}
            onChangeText={setTitle}
          />

          {/* Content */}
          <Text style={s.fieldLabel}>내용</Text>
          <TextInput
            style={[s.input, s.textarea]}
            placeholder="문의 내용을 자세히 적어주세요"
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
              {sending ? '메일 앱 여는 중...' : '메일로 문의하기'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Direct Email */}
        <TouchableOpacity style={s.emailRow} onPress={copyEmail} activeOpacity={0.7}>
          <Text style={s.emailLabel}>직접 이메일 보내기</Text>
          <Text style={s.emailAddr}>{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: COLOR.text, fontWeight: '300' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLOR.text },
  headerSpacer: { width: 36 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: COLOR.text, marginBottom: 12, marginTop: 8,
  },
  card: {
    backgroundColor: COLOR.card, borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: '#2D2016', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
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

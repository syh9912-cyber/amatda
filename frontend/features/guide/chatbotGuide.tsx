/** 상담이모(AI 코칭) 가이드 페이지 */
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GuideBubble, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  chip: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '700', color: GUIDE_C.textSub },
  arrow: { fontSize: 16, color: GUIDE_C.textLight, textAlign: 'center', marginVertical: 8, fontWeight: '800' },
  preInput: { backgroundColor: GUIDE_C.accentSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  preText: { fontSize: 12.5, color: '#C2703B', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 4 },
  anChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  anText: { fontSize: 12.5, fontWeight: '800' },
  note: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 12, marginTop: 10 },
  noteText: { fontSize: 12, color: GUIDE_C.textSub, lineHeight: 18, fontWeight: '600' },
  warn: { fontSize: 11.5, color: GUIDE_C.red, fontWeight: '700', textAlign: 'center', marginTop: 10 },
});

export function getChatbotGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.chatbot.page1.title'),
      desc: t('guides.chatbot.page1.desc'),
      visual: (
        <GuideFrame>
          <GuideBubble text={t('guides.chatbot.page1.bubble1')} me />
          <GuideBubble text={t('guides.chatbot.page1.bubble2')} />
          <GuideBubble text={t('guides.chatbot.page1.bubble3')} me />
        </GuideFrame>
      ),
    },
    {
      title: t('guides.chatbot.page2.title'),
      desc: t('guides.chatbot.page2.desc'),
      visual: (
        <GuideFrame>
          <Text style={g.cap}>{t('guides.chatbot.page2.topicSelect')}</Text>
          <View style={g.chipRow}>
            {(t('guides.chatbot.page2.topics', { returnObjects: true }) as string[]).map((c) => (
              <View key={c} style={g.chip}><Text style={g.chipText}>{c}</Text></View>
            ))}
          </View>
          <Text style={g.arrow}>↓</Text>
          <View style={g.preInput}><Text style={g.preText}>{t('guides.chatbot.page2.samplePrompt')}</Text></View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.chatbot.page3.title'),
      desc: t('guides.chatbot.page3.desc'),
      visual: (
        <GuideFrame>
          <View style={g.row}>
            <View style={[g.anChip, { backgroundColor: GUIDE_C.blueLight }]}><Text style={[g.anText, { color: GUIDE_C.blue }]}>🔊  {t('chatbot.cryAnalysis')}</Text></View>
            <View style={[g.anChip, { backgroundColor: GUIDE_C.goldLight }]}><Text style={[g.anText, { color: GUIDE_C.gold }]}>💩  {t('chatbot.poopAnalysis')}</Text></View>
          </View>
          <View style={g.note}>
            <Text style={g.noteText}>{t('guides.chatbot.page3.note')}</Text>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.chatbot.page4.title'),
      desc: t('guides.chatbot.page4.desc'),
      visual: (
        <GuideFrame>
          <GuideBubble text={t('guides.chatbot.page4.bubble')} />
          <View style={g.note}>
            <Text style={g.noteText}>{t('guides.chatbot.page4.note')}</Text>
          </View>
          <Text style={g.warn}>{t('guides.chatbot.page4.warning')}</Text>
        </GuideFrame>
      ),
    },
  ];
}

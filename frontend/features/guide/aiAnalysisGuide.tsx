/** AI분석 가이드 페이지 — 육아패턴 · 대변 · 울음 3가지 분석 (커스텀 아이콘 사용) */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_PATTERN = require('../../assets/quick-report.png') as number;
const IC_POOP = require('../../assets/cat-poop.png') as number;
const IC_CRY = require('../../assets/cat-crying.png') as number;
const IC_CAMERA = require('../../assets/icon-camera.png') as number;
const IC_MIC = require('../../assets/icon-mic.png') as number;

const g = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  mode: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modeIcon: { width: 30, height: 30, marginBottom: 5 },
  modeText: { fontSize: 12, fontWeight: '800' },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginVertical: 3 },
  metricLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: GUIDE_C.text },
  metricVal: { fontSize: 11.5, fontWeight: '700', color: GUIDE_C.textSub },
  okPill: { backgroundColor: GUIDE_C.greenLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  okText: { fontSize: 10.5, fontWeight: '800', color: GUIDE_C.green },
  evalPill: { backgroundColor: GUIDE_C.accentSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8, alignItems: 'center' },
  evalText: { fontSize: 12, fontWeight: '800', color: '#BC7C53' },
  inputRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  inputCard: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  inputIcon: { width: 26, height: 26, marginBottom: 4 },
  inputText: { fontSize: 12, fontWeight: '800' },
  inputSub: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  note: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11, marginTop: 10 },
  noteText: { fontSize: 11.5, color: GUIDE_C.textSub, lineHeight: 17, fontWeight: '600' },
  warn: { fontSize: 11.5, color: GUIDE_C.red, fontWeight: '700', textAlign: 'center', marginTop: 10 },
});

export function getAiAnalysisGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.aiAnalysis.page1.title'),
      desc: t('guides.aiAnalysis.page1.desc'),
      visual: (
        <GuideFrame>
          <View style={g.modeRow}>
            <View style={[g.mode, { backgroundColor: GUIDE_C.purpleLight }]}><Image source={IC_PATTERN} style={g.modeIcon} resizeMode="contain" /><Text style={[g.modeText, { color: GUIDE_C.purple }]}>{t('aiAnalysis.tabs.pattern.label')}</Text></View>
            <View style={[g.mode, { backgroundColor: GUIDE_C.goldLight }]}><Image source={IC_POOP} style={g.modeIcon} resizeMode="contain" /><Text style={[g.modeText, { color: GUIDE_C.gold }]}>{t('aiAnalysis.tabs.poop.label')}</Text></View>
            <View style={[g.mode, { backgroundColor: GUIDE_C.blueLight }]}><Image source={IC_CRY} style={g.modeIcon} resizeMode="contain" /><Text style={[g.modeText, { color: GUIDE_C.blue }]}>{t('aiAnalysis.tabs.cry.label')}</Text></View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.aiAnalysis.page2.title'),
      desc: t('guides.aiAnalysis.page2.desc'),
      visual: (
        <GuideFrame>
          <Text style={g.cap}>{t('guides.aiAnalysis.page2.cardTitle')}</Text>
          <View style={g.metricRow}><Text style={g.metricLabel}>{t('guides.aiAnalysis.page2.feeding')}</Text><Text style={g.metricVal}>{t('guides.aiAnalysis.page2.feedingCount')}</Text><View style={g.okPill}><Text style={g.okText}>{t('guides.aiAnalysis.page2.ok')}</Text></View></View>
          <View style={g.metricRow}><Text style={g.metricLabel}>{t('guides.aiAnalysis.page2.sleep')}</Text><Text style={g.metricVal}>{t('guides.aiAnalysis.page2.sleepHours')}</Text><View style={g.okPill}><Text style={g.okText}>{t('guides.aiAnalysis.page2.ok')}</Text></View></View>
          <View style={g.metricRow}><Text style={g.metricLabel}>{t('guides.aiAnalysis.page2.poop')}</Text><Text style={g.metricVal}>{t('guides.aiAnalysis.page2.poopCount')}</Text><View style={g.okPill}><Text style={g.okText}>{t('guides.aiAnalysis.page2.ok')}</Text></View></View>
          <View style={g.evalPill}><Text style={g.evalText}>{t('guides.aiAnalysis.page2.evalText')}</Text></View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.aiAnalysis.page3.title'),
      desc: t('guides.aiAnalysis.page3.desc'),
      visual: (
        <GuideFrame>
          <View style={g.inputRow}>
            <View style={[g.inputCard, { backgroundColor: GUIDE_C.goldLight }]}><Image source={IC_CAMERA} style={g.inputIcon} resizeMode="contain" /><Text style={[g.inputText, { color: GUIDE_C.gold }]}>{t('guides.aiAnalysis.page3.poopPhoto')}</Text><Text style={[g.inputSub, { color: GUIDE_C.gold }]}>{t('guides.aiAnalysis.page3.poopHint')}</Text></View>
            <View style={[g.inputCard, { backgroundColor: GUIDE_C.blueLight }]}><Image source={IC_MIC} style={g.inputIcon} resizeMode="contain" /><Text style={[g.inputText, { color: GUIDE_C.blue }]}>{t('guides.aiAnalysis.page3.cryRecording')}</Text><Text style={[g.inputSub, { color: GUIDE_C.blue }]}>{t('guides.aiAnalysis.page3.cryHint')}</Text></View>
          </View>
          <View style={g.note}>
            <Text style={g.noteText}>{t('guides.aiAnalysis.page3.ageNote')}</Text>
          </View>
          <Text style={g.warn}>{t('guides.aiAnalysis.page3.warning')}</Text>
        </GuideFrame>
      ),
    },
  ];
}

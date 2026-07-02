/** 임신여정 가이드 — 5단계 여정 · 단계별 할 일 · 다음 단계 안내 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GuidePill, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_LEAF = require('../../assets/preg-leaf.png') as number;
const IC_STETH = require('../../assets/preg-stethoscope.png') as number;
const IC_RIBBON = require('../../assets/preg-ribbon.png') as number;

const g = StyleSheet.create({
  hero: { width: 46, height: 46, alignSelf: 'center', marginBottom: 8 },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, textAlign: 'center', marginBottom: 10 },
  steps: { gap: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 11, fontWeight: '900', color: '#FFF' },
  stepLabel: { fontSize: 12.5, fontWeight: '700', color: GUIDE_C.text },
  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: GUIDE_C.border, padding: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  bullet: { fontSize: 13 },
  lineText: { fontSize: 12.5, color: GUIDE_C.text, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  arrow: { fontSize: 14, color: GUIDE_C.textLight, fontWeight: '800' },
});

function getSteps(t: TFunction) {
  return [
    { n: '1', label: t('guides.pregnancyJourney.steps.early'), c: GUIDE_C.green },
    { n: '2', label: t('guides.pregnancyJourney.steps.stable'), c: GUIDE_C.blue },
    { n: '3', label: t('guides.pregnancyJourney.steps.late'), c: GUIDE_C.gold },
    { n: '4', label: t('guides.pregnancyJourney.steps.imminent'), c: GUIDE_C.accent },
    { n: '5', label: t('guides.pregnancyJourney.steps.birth'), c: GUIDE_C.red },
  ];
}

export function getPregnancyJourneyGuide(t: TFunction): GuidePage[] {
  const STEPS = getSteps(t);
  return [
    {
      title: t('guides.pregnancyJourney.page1.title'),
      desc: t('guides.pregnancyJourney.page1.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_LEAF} style={g.hero} resizeMode="contain" />
          <View style={g.steps}>
            {STEPS.map((s) => (
              <View key={s.n} style={g.step}>
                <View style={[g.stepDot, { backgroundColor: s.c }]}><Text style={g.stepNum}>{s.n}</Text></View>
                <Text style={g.stepLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.pregnancyJourney.page2.title'),
      desc: t('guides.pregnancyJourney.page2.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_STETH} style={g.hero} resizeMode="contain" />
          <Text style={g.cap}>{t('guides.pregnancyJourney.page2.captionLabel')}</Text>
          <View style={g.card}>
            <View style={g.line}><Text style={g.bullet}>🩺</Text><Text style={g.lineText}>{t('guides.pregnancyJourney.page2.task1')}</Text></View>
            <View style={g.line}><Text style={g.bullet}>💊</Text><Text style={g.lineText}>{t('guides.pregnancyJourney.page2.task2')}</Text></View>
            <View style={g.line}><Text style={g.bullet}>🧘</Text><Text style={g.lineText}>{t('guides.pregnancyJourney.page2.task3')}</Text></View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.pregnancyJourney.page3.title'),
      desc: t('guides.pregnancyJourney.page3.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_RIBBON} style={g.hero} resizeMode="contain" />
          <Text style={g.cap}>{t('guides.pregnancyJourney.page3.captionLabel')}</Text>
          <View style={g.row}>
            <GuidePill label={t('guides.pregnancyJourney.page3.pillStable')} color={GUIDE_C.textSub} bg="#EFEFF3" />
            <Text style={g.arrow}>→</Text>
            <GuidePill label={t('guides.pregnancyJourney.page3.pillLateGuide')} color="#FFF" filled bg={GUIDE_C.gold} />
          </View>
        </GuideFrame>
      ),
    },
  ];
}

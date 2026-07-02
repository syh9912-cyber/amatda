/** 접종달력 가이드 — 국가접종 자동 정리 · D-day 알림 · 완료 진행률 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GuidePill, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_SYRINGE = require('../../assets/quick-syringe.png') as number;

const g = StyleSheet.create({
  hero: { width: 46, height: 46, alignSelf: 'center', marginBottom: 8 },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, textAlign: 'center', marginBottom: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: GUIDE_C.border, padding: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  check: { fontSize: 11, color: '#FFF', fontWeight: '900' },
  name: { flex: 1, fontSize: 12.5, fontWeight: '700', color: GUIDE_C.text },
  ddayWrap: { alignItems: 'center', marginBottom: 10 },
  dday: { fontSize: 32, fontWeight: '900', color: GUIDE_C.accent },
  ddaySub: { fontSize: 12, color: GUIDE_C.textSub, marginTop: 2 },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: '#EEEEF2', overflow: 'hidden', marginTop: 4 },
  progressFill: { height: 10, borderRadius: 5, backgroundColor: GUIDE_C.green, width: '70%' },
  progressText: { fontSize: 12, fontWeight: '800', color: GUIDE_C.green, textAlign: 'center', marginTop: 8 },
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 },
});

export function getVaccinationGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.vaccination.page1.title'),
      desc: t('guides.vaccination.page1.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_SYRINGE} style={g.hero} resizeMode="contain" />
          <View style={g.card}>
            <View style={g.line}>
              <View style={[g.dot, { backgroundColor: GUIDE_C.green }]}><Text style={g.check}>✓</Text></View>
              <Text style={g.name}>{t('guides.vaccination.page1.vaccineBcg')}</Text>
              <GuidePill label={t('guides.vaccination.page1.statusDone')} color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
            </View>
            <View style={g.line}>
              <View style={[g.dot, { backgroundColor: GUIDE_C.accent }]} />
              <Text style={g.name}>{t('guides.vaccination.page1.vaccineDtap')}</Text>
              <GuidePill label={t('guides.vaccination.page1.statusUpcoming')} color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
            </View>
            <View style={g.line}>
              <View style={[g.dot, { backgroundColor: GUIDE_C.red }]} />
              <Text style={g.name}>{t('guides.vaccination.page1.vaccinePneumo')}</Text>
              <GuidePill label={t('guides.vaccination.page1.statusOverdue')} color={GUIDE_C.red} bg={GUIDE_C.redLight} />
            </View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.vaccination.page2.title'),
      desc: t('guides.vaccination.page2.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_SYRINGE} style={g.hero} resizeMode="contain" />
          <View style={g.ddayWrap}>
            <Text style={g.dday}>D-5</Text>
            <Text style={g.ddaySub}>{t('guides.vaccination.page2.ddaySub')}</Text>
          </View>
          <View style={[g.row, { marginTop: 0 }]}>
            <GuidePill label={t('guides.vaccination.page2.notifyPill')} color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.vaccination.page3.title'),
      desc: t('guides.vaccination.page3.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_SYRINGE} style={g.hero} resizeMode="contain" />
          <Text style={g.cap}>{t('guides.vaccination.page3.cap')}</Text>
          <View style={g.card}>
            <View style={g.progressTrack}><View style={g.progressFill} /></View>
            <Text style={g.progressText}>{t('guides.vaccination.page3.progressText')}</Text>
          </View>
        </GuideFrame>
      ),
    },
  ];
}

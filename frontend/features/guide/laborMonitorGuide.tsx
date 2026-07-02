/** 진통·태동 측정 가이드 — 진통 간격(5-1-1) · 가진통/진진통 · 태동 카운트 · 응급 */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_HOSPITAL = require('../../assets/icon-hospital.png') as number;
const IC_BABY = require('../../assets/quick-baby.png') as number;
const IC_REDFLAG = require('../../assets/icon-redflag.png') as number;

const g = StyleSheet.create({
  bigBtn: { alignSelf: 'center', width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  bigBtnLabel: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  bigBtnSub: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  flowText: { fontSize: 12, color: GUIDE_C.textSub, fontWeight: '700', textAlign: 'center' },
  cmpRow: { flexDirection: 'row', gap: 8 },
  cmpCard: { flex: 1, borderRadius: 12, padding: 11 },
  cmpTitle: { fontSize: 12.5, fontWeight: '800', marginBottom: 5 },
  cmpLine: { fontSize: 11, fontWeight: '600', lineHeight: 16 },
  ruleCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: GUIDE_C.redLight, borderRadius: 12, padding: 11, marginTop: 10 },
  ruleIcon: { width: 26, height: 26 },
  ruleText: { flex: 1, fontSize: 12, fontWeight: '700', color: GUIDE_C.red, lineHeight: 17 },
  counter: { alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 14, paddingVertical: 14 },
  counterBig: { fontSize: 38, fontWeight: '900', color: GUIDE_C.text },
  counterSub: { fontSize: 11.5, fontWeight: '700', color: GUIDE_C.textSub, marginTop: 2 },
  babyIcon: { width: 28, height: 28, marginBottom: 4 },
  warnCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: GUIDE_C.redLight, borderRadius: 12, padding: 11, marginTop: 10 },
  warnIcon: { width: 24, height: 24 },
  warnText: { flex: 1, fontSize: 11.5, fontWeight: '700', color: GUIDE_C.red, lineHeight: 17 },
});

export function getLaborMonitorGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.laborMonitor.page1.title'),
      desc: t('guides.laborMonitor.page1.desc'),
      visual: (
        <GuideFrame>
          <View style={[g.bigBtn, { backgroundColor: GUIDE_C.red }]}>
            <Text style={g.bigBtnLabel}>{t('guides.laborMonitor.page1.btnLabel')}</Text>
            <Text style={g.bigBtnSub}>{t('guides.laborMonitor.page1.btnSub')}</Text>
          </View>
          <Text style={g.flowText}>{t('guides.laborMonitor.page1.flow')}</Text>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.laborMonitor.page2.title'),
      desc: t('guides.laborMonitor.page2.desc'),
      visual: (
        <GuideFrame>
          <View style={g.cmpRow}>
            <View style={[g.cmpCard, { backgroundColor: GUIDE_C.greenLight }]}>
              <Text style={[g.cmpTitle, { color: GUIDE_C.green }]}>{t('guides.laborMonitor.page2.falseLaborTitle')}</Text>
              <Text style={[g.cmpLine, { color: GUIDE_C.green }]}>{t('guides.laborMonitor.page2.falseLaborDesc')}</Text>
            </View>
            <View style={[g.cmpCard, { backgroundColor: GUIDE_C.redLight }]}>
              <Text style={[g.cmpTitle, { color: GUIDE_C.red }]}>{t('guides.laborMonitor.page2.trueLaborTitle')}</Text>
              <Text style={[g.cmpLine, { color: GUIDE_C.red }]}>{t('guides.laborMonitor.page2.trueLaborDesc')}</Text>
            </View>
          </View>
          <View style={g.ruleCard}>
            <Image source={IC_HOSPITAL} style={g.ruleIcon} resizeMode="contain" />
            <Text style={g.ruleText}>{t('guides.laborMonitor.page2.rule511')}</Text>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.laborMonitor.page3.title'),
      desc: t('guides.laborMonitor.page3.desc'),
      visual: (
        <GuideFrame>
          <View style={g.counter}>
            <Image source={IC_BABY} style={g.babyIcon} resizeMode="contain" />
            <Text style={g.counterBig}>8</Text>
            <Text style={g.counterSub}>{t('guides.laborMonitor.page3.counterSub')}</Text>
          </View>
          <View style={g.warnCard}>
            <Image source={IC_REDFLAG} style={g.warnIcon} resizeMode="contain" />
            <Text style={g.warnText}>{t('guides.laborMonitor.page3.warn')}</Text>
          </View>
        </GuideFrame>
      ),
    },
  ];
}

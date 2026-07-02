/** 열나열나 가이드 — 체온 기록 · 위험 단계 · 몸무게별 용량 · 교차복용 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GuidePill, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_THERMO = require('../../assets/quick-thermometer.png') as number;
const IC_PILL = require('../../assets/quick-pill.png') as number;
const IC_SYRINGE = require('../../assets/quick-syringe.png') as number;

const g = StyleSheet.create({
  hero: { width: 46, height: 46, alignSelf: 'center', marginBottom: 8 },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, textAlign: 'center', marginBottom: 10 },
  bigTemp: { fontSize: 38, fontWeight: '900', color: GUIDE_C.red, textAlign: 'center', marginBottom: 2 },
  tempSub: { fontSize: 12, color: GUIDE_C.textSub, textAlign: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap' },
  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: GUIDE_C.border, padding: 12, marginTop: 2 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  lineLabel: { fontSize: 12.5, fontWeight: '700', color: GUIDE_C.text },
  lineVal: { fontSize: 12, color: GUIDE_C.textSub, fontWeight: '600' },
  weightBadge: { alignSelf: 'center', backgroundColor: GUIDE_C.accentSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  weightText: { fontSize: 12, fontWeight: '800', color: GUIDE_C.accent },
});

export function getFeverGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.fever.page1.title'),
      desc: t('guides.fever.page1.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_THERMO} style={g.hero} resizeMode="contain" />
          <Text style={g.cap}>{t('guides.fever.page1.currentTemp')}</Text>
          <Text style={g.bigTemp}>38.2°</Text>
          <Text style={g.tempSub}>{t('guides.fever.page1.tempSub')}</Text>
          <View style={g.row}>
            <GuidePill label={t('guides.fever.page1.morningTemp')} color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
            <GuidePill label={t('guides.fever.page1.eveningTemp')} color={GUIDE_C.red} bg={GUIDE_C.redLight} />
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.fever.page2.title'),
      desc: t('guides.fever.page2.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_THERMO} style={g.hero} resizeMode="contain" />
          <View style={[g.row, { marginBottom: 6 }]}>
            <GuidePill label={t('guides.fever.page2.normal')} color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
            <GuidePill label={t('guides.fever.page2.mild')} color={GUIDE_C.gold} bg={GUIDE_C.goldLight} />
          </View>
          <View style={g.row}>
            <GuidePill label={t('guides.fever.page2.high')} color={GUIDE_C.red} bg={GUIDE_C.redLight} />
            <GuidePill label={t('guides.fever.page2.hospitalRecommend')} color="#FFF" filled bg={GUIDE_C.red} />
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.fever.page3.title'),
      desc: t('guides.fever.page3.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_PILL} style={g.hero} resizeMode="contain" />
          <View style={g.weightBadge}><Text style={g.weightText}>{t('guides.fever.page3.weightBasis')}</Text></View>
          <View style={g.card}>
            <View style={g.line}>
              <Text style={g.lineLabel}>{t('guides.fever.page3.tylenol')}</Text>
              <Text style={[g.lineVal, { color: GUIDE_C.accent, fontWeight: '800' }]}>5.0 ml</Text>
            </View>
            <View style={[g.line, { borderTopWidth: 1, borderTopColor: GUIDE_C.border }]}>
              <Text style={g.lineLabel}>{t('guides.fever.page3.ibuprofen')}</Text>
              <Text style={[g.lineVal, { color: GUIDE_C.accent, fontWeight: '800' }]}>4.5 ml</Text>
            </View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.fever.page4.title'),
      desc: t('guides.fever.page4.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_SYRINGE} style={g.hero} resizeMode="contain" />
          <Text style={g.cap}>{t('guides.fever.page4.doseLogTitle')}</Text>
          <View style={g.card}>
            <View style={g.line}>
              <Text style={g.lineLabel}>{t('guides.fever.page3.tylenolShort')}</Text>
              <Text style={g.lineVal}>{t('guides.fever.page4.sampleDoseTime')}</Text>
            </View>
            <View style={[g.line, { borderTopWidth: 1, borderTopColor: GUIDE_C.border }]}>
              <Text style={g.lineLabel}>{t('guides.fever.page4.crossDoseAvailable')}</Text>
              <Text style={[g.lineVal, { color: GUIDE_C.accent, fontWeight: '800' }]}>{t('guides.fever.page4.sampleNextTime')}</Text>
            </View>
          </View>
          <View style={[g.row, { marginTop: 8 }]}>
            <GuidePill label={t('guides.fever.page4.overdosePrevention')} color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
          </View>
        </GuideFrame>
      ),
    },
  ];
}

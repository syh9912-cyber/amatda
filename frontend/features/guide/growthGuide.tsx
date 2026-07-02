/** 성장 기록 & 통계 가이드 페이지 */
import { View, Text, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  curveBox: { height: 110, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 10, justifyContent: 'flex-end' },
  band: { position: 'absolute', left: 10, right: 10, borderRadius: 6 },
  dotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: '100%' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: GUIDE_C.accent },
  legendRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11, color: GUIDE_C.textSub, fontWeight: '700' },
  pctPill: { backgroundColor: GUIDE_C.accentSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 10, alignItems: 'center' },
  pctText: { fontSize: 12, fontWeight: '800', color: '#C2703B' },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginVertical: 4 },
  tipNum: { fontSize: 13, fontWeight: '900', color: GUIDE_C.accent, width: 18 },
  tipText: { flex: 1, fontSize: 12.5, color: GUIDE_C.text, fontWeight: '600', lineHeight: 18 },
});

export function getGrowthGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.growth.page1.title'),
      desc: t('guides.growth.page1.desc'),
      visual: (
        <GuideFrame>
          <Text style={g.cap}>{t('guides.growth.page1.captionLabel')}</Text>
          <View style={g.curveBox}>
            <View style={[g.band, { top: 14, height: 60, backgroundColor: GUIDE_C.greenLight }]} />
            <View style={g.dotRow}>
              {[40, 55, 50, 62, 70].map((h, i) => (
                <View key={i} style={[g.dot, { marginBottom: h }]} />
              ))}
            </View>
          </View>
          <View style={g.legendRow}>
            <View style={g.legendItem}><View style={[g.legendDot, { backgroundColor: GUIDE_C.greenLight }]} /><Text style={g.legendText}>{t('guides.growth.page1.legendNormal')}</Text></View>
            <View style={g.legendItem}><View style={[g.legendDot, { backgroundColor: GUIDE_C.accent }]} /><Text style={g.legendText}>{t('guides.growth.page1.legendMyChild')}</Text></View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.growth.page2.title'),
      desc: t('guides.growth.page2.desc'),
      visual: (
        <GuideFrame>
          <View style={g.pctPill}><Text style={g.pctText}>{t('guides.growth.page2.pctPill')}</Text></View>
          <View style={{ marginTop: 12 }}>
            <Text style={[g.tipText, { textAlign: 'center', color: GUIDE_C.textSub }]}>
              {t('guides.growth.page2.explain')}
            </Text>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.growth.page3.title'),
      desc: t('guides.growth.page3.desc'),
      visual: (
        <GuideFrame>
          <View style={g.tipRow}><Text style={g.tipNum}>1</Text><Text style={g.tipText}>{t('guides.growth.page3.tip1')}</Text></View>
          <View style={g.tipRow}><Text style={g.tipNum}>2</Text><Text style={g.tipText}>{t('guides.growth.page3.tip2')}</Text></View>
          <View style={g.tipRow}><Text style={g.tipNum}>3</Text><Text style={g.tipText}>{t('guides.growth.page3.tip3')}</Text></View>
        </GuideFrame>
      ),
    },
  ];
}

/** 마음 진단 가이드 — 매일 기분일기 · EPDS 자가검사 · 가족공유/위기상담 */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_HEART = require('../../assets/icon-heart.png') as number;

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 10, marginLeft: 2 },
  moodRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  mood: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  moodSel: { borderWidth: 2, borderColor: GUIDE_C.accent },
  moodFace: { fontSize: 18 },
  weekRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  weekDot: { width: 14, height: 14, borderRadius: 7 },
  q: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11 },
  qText: { fontSize: 12.5, fontWeight: '700', color: GUIDE_C.text, marginBottom: 8 },
  opt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  optText: { fontSize: 11.5, color: GUIDE_C.textSub, fontWeight: '600' },
  optDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: GUIDE_C.border },
  optDotOn: { borderColor: GUIDE_C.purple, backgroundColor: GUIDE_C.purple },
  scaleRow: { flexDirection: 'row', gap: 4, marginTop: 10 },
  scaleSeg: { flex: 1, height: 8, borderRadius: 4 },
  scaleLabel: { fontSize: 10, color: GUIDE_C.textSub, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11 },
  shareIcon: { width: 24, height: 24 },
  shareText: { flex: 1, fontSize: 12, fontWeight: '600', color: GUIDE_C.text },
  toggle: { width: 38, height: 22, borderRadius: 11, backgroundColor: GUIDE_C.purple, justifyContent: 'center', paddingHorizontal: 2 },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF', alignSelf: 'flex-end' },
  crisis: { backgroundColor: GUIDE_C.redLight, borderRadius: 12, padding: 11, marginTop: 8 },
  crisisText: { fontSize: 11.5, color: GUIDE_C.red, lineHeight: 17, fontWeight: '700' },
});

export function getMomWellnessGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.momWellness.page1.title'),
      desc: t('guides.momWellness.page1.desc'),
      visual: (
        <GuideFrame>
          <Text style={g.cap}>{t('guides.momWellness.page1.captionLabel')}</Text>
          <View style={g.moodRow}>
            <View style={[g.mood, { backgroundColor: GUIDE_C.greenLight }]}><Text style={g.moodFace}>😄</Text></View>
            <View style={[g.mood, { backgroundColor: GUIDE_C.blueLight }]}><Text style={g.moodFace}>🙂</Text></View>
            <View style={[g.mood, g.moodSel, { backgroundColor: GUIDE_C.accentSoft }]}><Text style={g.moodFace}>😐</Text></View>
            <View style={[g.mood, { backgroundColor: GUIDE_C.purpleLight }]}><Text style={g.moodFace}>😔</Text></View>
            <View style={[g.mood, { backgroundColor: GUIDE_C.redLight }]}><Text style={g.moodFace}>😢</Text></View>
          </View>
          <View style={g.weekRow}>
            {[GUIDE_C.greenLight, GUIDE_C.blueLight, GUIDE_C.greenLight, GUIDE_C.accentSoft, GUIDE_C.purpleLight, GUIDE_C.blueLight, GUIDE_C.greenLight].map((c, i) => (
              <View key={i} style={[g.weekDot, { backgroundColor: c }]} />
            ))}
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.momWellness.page2.title'),
      desc: t('guides.momWellness.page2.desc'),
      visual: (
        <GuideFrame>
          <View style={g.q}>
            <Text style={g.qText}>{t('guides.momWellness.page2.sampleQuestion')}</Text>
            <View style={g.opt}><Text style={g.optText}>{t('guides.momWellness.page2.optNever')}</Text><View style={g.optDot} /></View>
            <View style={g.opt}><Text style={g.optText}>{t('guides.momWellness.page2.optSometimes')}</Text><View style={[g.optDot, g.optDotOn]} /></View>
            <View style={g.opt}><Text style={g.optText}>{t('guides.momWellness.page2.optOften')}</Text><View style={g.optDot} /></View>
          </View>
          <View style={g.scaleRow}>
            <View style={[g.scaleSeg, { backgroundColor: GUIDE_C.green }]} />
            <View style={[g.scaleSeg, { backgroundColor: GUIDE_C.gold }]} />
            <View style={[g.scaleSeg, { backgroundColor: '#E0C24A' }]} />
            <View style={[g.scaleSeg, { backgroundColor: GUIDE_C.red }]} />
          </View>
          <Text style={g.scaleLabel}>{t('guides.momWellness.page2.scaleLabel')}</Text>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.momWellness.page3.title'),
      desc: t('guides.momWellness.page3.desc'),
      visual: (
        <GuideFrame>
          <View style={g.shareRow}>
            <Image source={IC_HEART} style={g.shareIcon} resizeMode="contain" />
            <Text style={g.shareText}>{t('guides.momWellness.page3.shareText')}</Text>
            <View style={g.toggle}><View style={g.knob} /></View>
          </View>
          <View style={g.crisis}>
            <Text style={g.crisisText}>{t('guides.momWellness.page3.crisisText')}</Text>
          </View>
        </GuideFrame>
      ),
    },
  ];
}

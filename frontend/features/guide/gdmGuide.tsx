/** 임당(임신성 당뇨) 관리 가이드 — 혈당 기록 · 식단 AI 분석 · 주간 리포트 */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_BLOOD = require('../../assets/quick-blood.png') as number;
const IC_CAMERA = require('../../assets/icon-camera.png') as number;
const IC_REPORT = require('../../assets/quick-report.png') as number;

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  refCard: { backgroundColor: GUIDE_C.blueLight, borderRadius: 12, padding: 11, marginBottom: 10 },
  refRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  refLabel: { fontSize: 11.5, color: GUIDE_C.blue, fontWeight: '700' },
  refVal: { fontSize: 11.5, color: GUIDE_C.blue, fontWeight: '800' },
  rec: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11 },
  recIcon: { width: 26, height: 26 },
  recVal: { fontSize: 17, fontWeight: '900', color: GUIDE_C.text },
  recUnit: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textSub },
  recTime: { fontSize: 11, color: GUIDE_C.textSub, fontWeight: '600', marginTop: 1 },
  okPill: { backgroundColor: GUIDE_C.greenLight, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  okText: { fontSize: 11, fontWeight: '800', color: GUIDE_C.green },
  mealCard: { flexDirection: 'row', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 10, alignItems: 'center' },
  mealPhoto: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#ECECF1' },
  mealName: { fontSize: 12.5, fontWeight: '800', color: GUIDE_C.text },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  carb: { backgroundColor: GUIDE_C.goldLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  carbText: { fontSize: 10.5, fontWeight: '800', color: GUIDE_C.gold },
  aiChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GUIDE_C.accentSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, alignSelf: 'center', marginTop: 10 },
  aiIcon: { width: 16, height: 16 },
  aiText: { fontSize: 11.5, fontWeight: '800', color: '#BC7C53' },
  report: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11 },
  reportIcon: { width: 30, height: 30 },
  reportLine: { fontSize: 12, fontWeight: '600', color: GUIDE_C.text, marginVertical: 1 },
  note: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11, marginTop: 10 },
  noteText: { fontSize: 11.5, color: GUIDE_C.textSub, lineHeight: 17, fontWeight: '600' },
  warn: { fontSize: 11.5, color: GUIDE_C.red, fontWeight: '700', textAlign: 'center', marginTop: 10 },
});

export function getGdmGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.gdm.page1.title'),
      desc: t('guides.gdm.page1.desc'),
      visual: (
        <GuideFrame>
          <View style={g.refCard}>
            <Text style={[g.cap, { color: GUIDE_C.blue, marginLeft: 0 }]}>{t('guides.gdm.page1.targetBaseline')}</Text>
            <View style={g.refRow}><Text style={g.refLabel}>{t('gdm.mealFasting')}</Text><Text style={g.refVal}>{t('guides.gdm.page1.fastingTarget')}</Text></View>
            <View style={g.refRow}><Text style={g.refLabel}>{t('gdm.mealAfter1h')}</Text><Text style={g.refVal}>{t('guides.gdm.page1.after1hTarget')}</Text></View>
            <View style={g.refRow}><Text style={g.refLabel}>{t('gdm.mealAfter2h')}</Text><Text style={g.refVal}>{t('guides.gdm.page1.after2hTarget')}</Text></View>
          </View>
          <View style={g.rec}>
            <Image source={IC_BLOOD} style={g.recIcon} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={g.recVal}>92<Text style={g.recUnit}> mg/dL</Text></Text>
              <Text style={g.recTime}>{t('guides.gdm.page1.sampleTime')}</Text>
            </View>
            <View style={g.okPill}><Text style={g.okText}>{t('gdm.statusNormal')}</Text></View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.gdm.page2.title'),
      desc: t('guides.gdm.page2.desc'),
      visual: (
        <GuideFrame>
          <View style={g.mealCard}>
            <View style={g.mealPhoto} />
            <View style={{ flex: 1 }}>
              <Text style={g.mealName}>{t('guides.gdm.page2.sampleMeal')}</Text>
              <View style={g.badgeRow}>
                <View style={g.carb}><Text style={g.carbText}>{t('guides.gdm.page2.sampleCarb')}</Text></View>
                <View style={g.carb}><Text style={g.carbText}>{t('guides.gdm.page2.sampleCalories')}</Text></View>
              </View>
            </View>
          </View>
          <View style={g.aiChip}>
            <Image source={IC_CAMERA} style={g.aiIcon} resizeMode="contain" />
            <Text style={g.aiText}>{t('guides.gdm.page2.aiAnalyzeByPhoto')}</Text>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.gdm.page3.title'),
      desc: t('guides.gdm.page3.desc'),
      visual: (
        <GuideFrame>
          <View style={g.report}>
            <Image source={IC_REPORT} style={g.reportIcon} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={g.reportLine}>{t('guides.gdm.page3.reportLine1')}</Text>
              <Text style={g.reportLine}>{t('guides.gdm.page3.reportLine2')}</Text>
            </View>
          </View>
          <View style={g.note}>
            <Text style={g.noteText}>{t('guides.gdm.page3.note')}</Text>
          </View>
        </GuideFrame>
      ),
    },
  ];
}

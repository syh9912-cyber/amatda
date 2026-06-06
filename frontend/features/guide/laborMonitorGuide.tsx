/** 진통·태동 측정 가이드 — 진통 간격(5-1-1) · 가진통/진진통 · 태동 카운트 · 응급 */
import { View, Text, Image, StyleSheet } from 'react-native';
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

export const LABORMONITOR_GUIDE: GuidePage[] = [
  {
    title: '진통을 시작·종료로 측정해요',
    desc: '진통이 오면 버튼, 끝나면 다시 눌러요.\n간격과 지속 시간이 자동으로 기록돼요',
    visual: (
      <GuideFrame>
        <View style={[g.bigBtn, { backgroundColor: GUIDE_C.red }]}>
          <Text style={g.bigBtnLabel}>진통 시작</Text>
          <Text style={g.bigBtnSub}>누르면 측정 시작</Text>
        </View>
        <Text style={g.flowText}>시작 → 진통이 끝나면 다시 눌러 종료</Text>
      </GuideFrame>
    ),
  },
  {
    title: '병원 갈 때를 알려줘요',
    desc: '가진통과 진진통을 구분해서\n병원 갈 시점을 짚어줘요',
    visual: (
      <GuideFrame>
        <View style={g.cmpRow}>
          <View style={[g.cmpCard, { backgroundColor: GUIDE_C.greenLight }]}>
            <Text style={[g.cmpTitle, { color: GUIDE_C.green }]}>가진통</Text>
            <Text style={[g.cmpLine, { color: GUIDE_C.green }]}>불규칙{'\n'}자세 바꾸면 나아짐</Text>
          </View>
          <View style={[g.cmpCard, { backgroundColor: GUIDE_C.redLight }]}>
            <Text style={[g.cmpTitle, { color: GUIDE_C.red }]}>진진통</Text>
            <Text style={[g.cmpLine, { color: GUIDE_C.red }]}>규칙적·점점 짧아짐{'\n'}자세 바꿔도 아픔</Text>
          </View>
        </View>
        <View style={g.ruleCard}>
          <Image source={IC_HOSPITAL} style={g.ruleIcon} resizeMode="contain" />
          <Text style={g.ruleText}>5-1-1 · 5분 간격 진통이 1시간 지속되면 병원으로!</Text>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '태동도 세고, 응급은 바로',
    desc: '아기가 움직일 때마다 버튼을 눌러 세요.\n안 느껴지면 안심 가이드, 위급하면 119·분만실',
    visual: (
      <GuideFrame>
        <View style={g.counter}>
          <Image source={IC_BABY} style={g.babyIcon} resizeMode="contain" />
          <Text style={g.counterBig}>8</Text>
          <Text style={g.counterSub}>30분 동안 8회 · 건강한 신호</Text>
        </View>
        <View style={g.warnCard}>
          <Image source={IC_REDFLAG} style={g.warnIcon} resizeMode="contain" />
          <Text style={g.warnText}>측정·분석은 참고용이에요. 위급 증상은 앱보다 119·분만실에 먼저 연락하세요.</Text>
        </View>
      </GuideFrame>
    ),
  },
];

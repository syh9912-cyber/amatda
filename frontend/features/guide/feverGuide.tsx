/** 열나열나 가이드 — 체온 기록 · 위험 단계 · 몸무게별 용량 · 교차복용 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
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

export const FEVER_GUIDE: GuidePage[] = [
  {
    title: '체온을 빠르게 기록해요',
    desc: '귀·이마·겨드랑이 어디서 쟀는지 고르면\n부위에 맞게 자동 보정해서 정리해요',
    visual: (
      <GuideFrame>
        <Image source={IC_THERMO} style={g.hero} resizeMode="contain" />
        <Text style={g.cap}>🌡️  지금 체온</Text>
        <Text style={g.bigTemp}>38.2°</Text>
        <Text style={g.tempSub}>겨드랑이 측정 · +0.5° 보정됨</Text>
        <View style={g.row}>
          <GuidePill label="아침 37.1°" color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
          <GuidePill label="저녁 38.2°" color={GUIDE_C.red} bg={GUIDE_C.redLight} />
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '위험한 열을 색으로 알려줘요',
    desc: '체온 단계를 색으로 보여주고\n병원에 가야 할 때를 바로 안내해요',
    visual: (
      <GuideFrame>
        <Image source={IC_THERMO} style={g.hero} resizeMode="contain" />
        <View style={[g.row, { marginBottom: 6 }]}>
          <GuidePill label="정상 ~37.4°" color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
          <GuidePill label="미열 ~38°" color={GUIDE_C.gold} bg={GUIDE_C.goldLight} />
        </View>
        <View style={g.row}>
          <GuidePill label="고열 38°+" color={GUIDE_C.red} bg={GUIDE_C.redLight} />
          <GuidePill label="병원 권고" color="#FFF" filled bg={GUIDE_C.red} />
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '몸무게에 맞는 해열제 용량',
    desc: '아이 몸무게만 입력하면 타이레놀·부루펜\n먹일 양(ml)을 자동으로 계산해줘요',
    visual: (
      <GuideFrame>
        <Image source={IC_PILL} style={g.hero} resizeMode="contain" />
        <View style={g.weightBadge}><Text style={g.weightText}>몸무게 12kg 기준</Text></View>
        <View style={g.card}>
          <View style={g.line}>
            <Text style={g.lineLabel}>타이레놀 (아세트아미노펜)</Text>
            <Text style={[g.lineVal, { color: GUIDE_C.accent, fontWeight: '800' }]}>5.0 ml</Text>
          </View>
          <View style={[g.line, { borderTopWidth: 1, borderTopColor: GUIDE_C.border }]}>
            <Text style={g.lineLabel}>부루펜 (이부프로펜)</Text>
            <Text style={[g.lineVal, { color: GUIDE_C.accent, fontWeight: '800' }]}>4.5 ml</Text>
          </View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '교차복용도 헷갈리지 않게',
    desc: '같은 약은 4~6시간, 다른 약과 교차할 땐\n최소 2시간 간격으로 다음 시간을 알려줘요',
    visual: (
      <GuideFrame>
        <Image source={IC_SYRINGE} style={g.hero} resizeMode="contain" />
        <Text style={g.cap}>💊  복용 기록 & 다음 시간</Text>
        <View style={g.card}>
          <View style={g.line}>
            <Text style={g.lineLabel}>타이레놀</Text>
            <Text style={g.lineVal}>오후 7:00 · 5ml</Text>
          </View>
          <View style={[g.line, { borderTopWidth: 1, borderTopColor: GUIDE_C.border }]}>
            <Text style={g.lineLabel}>부루펜 교차 가능</Text>
            <Text style={[g.lineVal, { color: GUIDE_C.accent, fontWeight: '800' }]}>오후 9:00 부터</Text>
          </View>
        </View>
        <View style={[g.row, { marginTop: 8 }]}>
          <GuidePill label="과다복용 자동 방지" color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
        </View>
      </GuideFrame>
    ),
  },
];

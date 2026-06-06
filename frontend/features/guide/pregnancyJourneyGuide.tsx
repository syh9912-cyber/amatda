/** 임신여정 가이드 — 5단계 여정 · 단계별 할 일 · 다음 단계 안내 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
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

const STEPS = [
  { n: '1', label: '초기 (~13주)', c: GUIDE_C.green },
  { n: '2', label: '안정기 (~27주)', c: GUIDE_C.blue },
  { n: '3', label: '후기 (~36주)', c: GUIDE_C.gold },
  { n: '4', label: '출산 임박', c: GUIDE_C.accent },
  { n: '5', label: '출산 🎉', c: GUIDE_C.red },
];

export const PREGNANCY_JOURNEY_GUIDE: GuidePage[] = [
  {
    title: '임신 여정을 5단계로 안내해요',
    desc: '초기부터 출산까지 단계로 나눠\n지금 내가 어디쯤인지 보여줘요',
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
    title: '지금 단계에 필요한 것만',
    desc: '단계마다 챙길 검진·영양제·운동·주의할 점을\n쉬운 말로 콕 집어 알려줘요',
    visual: (
      <GuideFrame>
        <Image source={IC_STETH} style={g.hero} resizeMode="contain" />
        <Text style={g.cap}>✅  안정기에 할 일</Text>
        <View style={g.card}>
          <View style={g.line}><Text style={g.bullet}>🩺</Text><Text style={g.lineText}>정밀 초음파 받기</Text></View>
          <View style={g.line}><Text style={g.bullet}>💊</Text><Text style={g.lineText}>철분·칼슘 챙기기</Text></View>
          <View style={g.line}><Text style={g.bullet}>🧘</Text><Text style={g.lineText}>가벼운 운동하기</Text></View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '출산까지 함께 가요',
    desc: '한 단계가 지나면 다음 단계에 맞는\n안내로 자동으로 바뀌어요',
    visual: (
      <GuideFrame>
        <Image source={IC_RIBBON} style={g.hero} resizeMode="contain" />
        <Text style={g.cap}>➡️  다음 단계</Text>
        <View style={g.row}>
          <GuidePill label="안정기" color={GUIDE_C.textSub} bg="#EFEFF3" />
          <Text style={g.arrow}>→</Text>
          <GuidePill label="후기 안내" color="#FFF" filled bg={GUIDE_C.gold} />
        </View>
      </GuideFrame>
    ),
  },
];

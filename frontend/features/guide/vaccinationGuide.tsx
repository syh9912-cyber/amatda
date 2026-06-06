/** 접종달력 가이드 — 국가접종 자동 정리 · D-day 알림 · 완료 진행률 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
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

export const VACCINATION_GUIDE: GuidePage[] = [
  {
    title: '국가 예방접종을 자동 정리',
    desc: '우리 아이 개월수에 맞는 무료 국가접종을\n순서대로 정리해서 보여줘요',
    visual: (
      <GuideFrame>
        <Image source={IC_SYRINGE} style={g.hero} resizeMode="contain" />
        <View style={g.card}>
          <View style={g.line}>
            <View style={[g.dot, { backgroundColor: GUIDE_C.green }]}><Text style={g.check}>✓</Text></View>
            <Text style={g.name}>BCG (결핵)</Text>
            <GuidePill label="완료" color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
          </View>
          <View style={g.line}>
            <View style={[g.dot, { backgroundColor: GUIDE_C.accent }]} />
            <Text style={g.name}>DTaP 3차</Text>
            <GuidePill label="예정" color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
          </View>
          <View style={g.line}>
            <View style={[g.dot, { backgroundColor: GUIDE_C.red }]} />
            <Text style={g.name}>폐렴구균</Text>
            <GuidePill label="지남" color={GUIDE_C.red} bg={GUIDE_C.redLight} />
          </View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '맞을 때를 놓치지 않아요',
    desc: '다가오는 접종은 며칠 남았는지 D-day로,\n지난 접종은 빨갛게 표시해 챙겨드려요',
    visual: (
      <GuideFrame>
        <Image source={IC_SYRINGE} style={g.hero} resizeMode="contain" />
        <View style={g.ddayWrap}>
          <Text style={g.dday}>D-5</Text>
          <Text style={g.ddaySub}>DTaP 3차 · 6월 11일</Text>
        </View>
        <View style={[g.row, { marginTop: 0 }]}>
          <GuidePill label="🔔 알림으로 미리 알려드려요" color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '맞은 접종은 체크!',
    desc: '맞은 날·병원을 기록하고 완료를 체크하면\n전체 진행률을 한눈에 볼 수 있어요',
    visual: (
      <GuideFrame>
        <Image source={IC_SYRINGE} style={g.hero} resizeMode="contain" />
        <Text style={g.cap}>✅  접종 진행률</Text>
        <View style={g.card}>
          <View style={g.progressTrack}><View style={g.progressFill} /></View>
          <Text style={g.progressText}>14 / 20 완료 (70%)</Text>
        </View>
      </GuideFrame>
    ),
  },
];

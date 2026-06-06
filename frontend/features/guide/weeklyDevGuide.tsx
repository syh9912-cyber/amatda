/** 주수별 발달 가이드 — 이번 주 발달 · 크기 비교 · 매주 업데이트 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
import { GuideFrame, GuidePill, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_BABY = require('../../assets/quick-baby.png') as number;
const IC_LEAF = require('../../assets/preg-leaf.png') as number;

const g = StyleSheet.create({
  hero: { width: 46, height: 46, alignSelf: 'center', marginBottom: 8 },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, textAlign: 'center', marginBottom: 10 },
  weekBadge: { alignSelf: 'center', backgroundColor: GUIDE_C.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10 },
  weekText: { fontSize: 13, fontWeight: '900', color: '#FFF' },
  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: GUIDE_C.border, padding: 12 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  lineLabel: { fontSize: 12.5, color: GUIDE_C.textSub, fontWeight: '600' },
  lineVal: { fontSize: 12.5, fontWeight: '800', color: GUIDE_C.text },
  bigEmoji: { fontSize: 40, textAlign: 'center', marginBottom: 4 },
  compare: { fontSize: 13, fontWeight: '800', color: GUIDE_C.text, textAlign: 'center', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  arrow: { fontSize: 14, color: GUIDE_C.textLight, fontWeight: '800' },
});

export const WEEKLY_DEV_GUIDE: GuidePage[] = [
  {
    title: '이번 주 아기 발달을 알려줘요',
    desc: '지금 주수에 맞춰 아기 키·몸무게와\n어떤 변화가 생기는지 보여줘요',
    visual: (
      <GuideFrame>
        <Image source={IC_BABY} style={g.hero} resizeMode="contain" />
        <View style={g.weekBadge}><Text style={g.weekText}>임신 20주차</Text></View>
        <View style={g.card}>
          <View style={g.line}>
            <Text style={g.lineLabel}>키</Text><Text style={g.lineVal}>약 25cm</Text>
          </View>
          <View style={[g.line, { borderTopWidth: 1, borderTopColor: GUIDE_C.border }]}>
            <Text style={g.lineLabel}>몸무게</Text><Text style={g.lineVal}>약 300g</Text>
          </View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '크기를 과일로 쉽게 비교해요',
    desc: '“이번 주는 바나나만 해요”처럼\n친숙한 것에 비유해 크기를 느낄 수 있어요',
    visual: (
      <GuideFrame>
        <Text style={g.bigEmoji}>🍌</Text>
        <Text style={g.compare}>지금은 바나나만 해요</Text>
        <View style={g.row}>
          <GuidePill label="🫐 12주" color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
          <Text style={g.arrow}>→</Text>
          <GuidePill label="🍌 20주" color="#FFF" filled bg={GUIDE_C.accent} />
          <Text style={g.arrow}>→</Text>
          <GuidePill label="🎃 36주" color={GUIDE_C.gold} bg={GUIDE_C.goldLight} />
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '매주 자동으로 바뀌어요',
    desc: '주수가 지나면 발달 내용이\n다음 주로 알아서 업데이트돼요',
    visual: (
      <GuideFrame>
        <Image source={IC_LEAF} style={g.hero} resizeMode="contain" />
        <Text style={g.cap}>🔄  자동 업데이트</Text>
        <View style={g.row}>
          <GuidePill label="20주" color={GUIDE_C.textSub} bg="#EFEFF3" />
          <Text style={g.arrow}>→</Text>
          <GuidePill label="21주 발달" color="#FFF" filled bg={GUIDE_C.green} />
        </View>
      </GuideFrame>
    ),
  },
];

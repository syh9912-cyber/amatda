/** 성장 기록 & 통계 가이드 페이지 */
import { View, Text, StyleSheet } from 'react-native';
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

export const GROWTH_GUIDE: GuidePage[] = [
  {
    title: '키·몸무게로 성장 곡선을 그려요',
    desc: '기록을 남기면 또래 대비 위치를\n성장 곡선 위에 점으로 보여줘요',
    visual: (
      <GuideFrame>
        <Text style={g.cap}>📈  몸무게 성장 곡선</Text>
        <View style={g.curveBox}>
          <View style={[g.band, { top: 14, height: 60, backgroundColor: GUIDE_C.greenLight }]} />
          <View style={g.dotRow}>
            {[40, 55, 50, 62, 70].map((h, i) => (
              <View key={i} style={[g.dot, { marginBottom: h }]} />
            ))}
          </View>
        </View>
        <View style={g.legendRow}>
          <View style={g.legendItem}><View style={[g.legendDot, { backgroundColor: GUIDE_C.greenLight }]} /><Text style={g.legendText}>정상 범위</Text></View>
          <View style={g.legendItem}><View style={[g.legendDot, { backgroundColor: GUIDE_C.accent }]} /><Text style={g.legendText}>우리 아이</Text></View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '백분위(%)가 뭔가요?',
    desc: '"또래 100명 중 몇 번째"라는 뜻이에요.\n50%면 딱 평균. 너무 높거나 낮은지보다\n곡선을 따라 꾸준히 크는지가 더 중요해요',
    visual: (
      <GuideFrame>
        <View style={g.pctPill}><Text style={g.pctText}>몸무게 62백분위 · 키 58백분위</Text></View>
        <View style={{ marginTop: 12 }}>
          <Text style={[g.tipText, { textAlign: 'center', color: GUIDE_C.textSub }]}>
            또래 100명을 줄 세우면{'\n'}우리 아이는 약 62번째 정도예요{'\n'}(평균보다 조금 큰 편)
          </Text>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '정확히 재는 게 중요해요',
    desc: '같은 방법으로 재야 곡선이 들쭉날쭉하지 않아요',
    visual: (
      <GuideFrame>
        <View style={g.tipRow}><Text style={g.tipNum}>1</Text><Text style={g.tipText}>몸무게는 기저귀를 벗고, 가급적 아침 같은 시간에</Text></View>
        <View style={g.tipRow}><Text style={g.tipNum}>2</Text><Text style={g.tipText}>키(신장)는 24개월 전엔 눕혀서, 이후엔 세워서</Text></View>
        <View style={g.tipRow}><Text style={g.tipNum}>3</Text><Text style={g.tipText}>한 달에 1~2번 정도 꾸준히 기록하면 추이가 또렷해져요</Text></View>
      </GuideFrame>
    ),
  },
];

/** 기질 분석 가이드 — 앱의 핵심 가치 설명 (사주/오행 용어 금지: 기질·에너지·성향만) */
import { View, Text, StyleSheet } from 'react-native';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  enRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  enLabel: { width: 30, fontSize: 11, fontWeight: '700', color: GUIDE_C.textSub },
  enTrack: { flex: 1, height: 8, backgroundColor: '#EEEEF2', borderRadius: 4, overflow: 'hidden' },
  enFill: { height: '100%', borderRadius: 4 },
  flowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginVertical: 6 },
  flowBox: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  flowText: { fontSize: 11.5, fontWeight: '700', color: GUIDE_C.text },
  flowArrow: { fontSize: 14, color: GUIDE_C.textLight, fontWeight: '900' },
  useRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 10, marginVertical: 4 },
  useEmoji: { fontSize: 20, width: 26, textAlign: 'center' },
  useText: { flex: 1, fontSize: 12.5, color: GUIDE_C.text, fontWeight: '600', lineHeight: 17 },
});

function EnergyBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={g.enRow}>
      <Text style={g.enLabel}>{label}</Text>
      <View style={g.enTrack}><View style={[g.enFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

export const TRAIT_GUIDE: GuidePage[] = [
  {
    title: '기질이란 무엇인가요?',
    desc: '아이가 타고난 성향·에너지의 균형이에요.\n탐구·활동·안정·분석·감성 다섯 가지로 풀어서 보여드려요',
    visual: (
      <GuideFrame>
        <Text style={g.cap}>🌱  우리 아이 에너지 분포</Text>
        <EnergyBar label="탐구" pct={82} color={GUIDE_C.blue} />
        <EnergyBar label="활동" pct={64} color={GUIDE_C.accent} />
        <EnergyBar label="안정" pct={48} color={GUIDE_C.green} />
        <EnergyBar label="분석" pct={70} color={GUIDE_C.purple} />
        <EnergyBar label="감성" pct={55} color={GUIDE_C.gold} />
      </GuideFrame>
    ),
  },
  {
    title: '어떻게 분석하나요?',
    desc: '생년월일·시간으로 타고난 성향을 분석하고,\n간단한 관찰 질문으로 더 정교하게 다듬어요',
    visual: (
      <GuideFrame>
        <View style={g.flowRow}>
          <View style={g.flowBox}><Text style={g.flowText}>🎂 생년월일시</Text></View>
          <Text style={g.flowArrow}>＋</Text>
          <View style={g.flowBox}><Text style={g.flowText}>📝 관찰 질문</Text></View>
        </View>
        <Text style={g.flowArrow}>↓</Text>
        <View style={[g.flowBox, { alignSelf: 'center', backgroundColor: GUIDE_C.accentSoft, borderColor: GUIDE_C.accent }]}>
          <Text style={[g.flowText, { color: '#C2703B' }]}>우리 아이만의 기질 리포트</Text>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '어디에 쓰이나요?',
    desc: '기질은 단순 결과가 아니라,\n상담·추천이 우리 아이에 맞게 조정되는 기준이 돼요',
    visual: (
      <GuideFrame>
        <View style={g.useRow}><Text style={g.useEmoji}>💬</Text><Text style={g.useText}>상담이모가 기질에 맞춰 답해줘요</Text></View>
        <View style={g.useRow}><Text style={g.useEmoji}>🍎</Text><Text style={g.useText}>음식·놀이·학습 추천이 달라져요</Text></View>
        <View style={g.useRow}><Text style={g.useEmoji}>🌙</Text><Text style={g.useText}>수면·훈육 팁도 성향에 맞게 제안돼요</Text></View>
      </GuideFrame>
    ),
  },
];

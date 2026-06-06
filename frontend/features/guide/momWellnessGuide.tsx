/** 마음 진단 가이드 — 매일 기분일기 · EPDS 자가검사 · 가족공유/위기상담 */
import { View, Text, Image, StyleSheet } from 'react-native';
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

export const MOMWELLNESS_GUIDE: GuidePage[] = [
  {
    title: '매일 기분을 가볍게 남겨요',
    desc: '5단계 기분과 한 줄 메모로 오늘을 기록해요.\n기기에만 저장돼 부담 없이 남길 수 있어요',
    visual: (
      <GuideFrame>
        <Text style={g.cap}>오늘 기분은 어때요?</Text>
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
    title: 'EPDS로 마음 상태를 체크해요',
    desc: '세계 표준 산전·산후 우울감 자가검사(10문항).\n10점 이상이면 주의, 13점 이상이면 전문가 상담 권장이에요',
    visual: (
      <GuideFrame>
        <View style={g.q}>
          <Text style={g.qText}>Q. 별다른 이유 없이 불안하거나 걱정스러웠나요?</Text>
          <View style={g.opt}><Text style={g.optText}>전혀 그렇지 않다</Text><View style={g.optDot} /></View>
          <View style={g.opt}><Text style={g.optText}>가끔 그랬다</Text><View style={[g.optDot, g.optDotOn]} /></View>
          <View style={g.opt}><Text style={g.optText}>자주 그랬다</Text><View style={g.optDot} /></View>
        </View>
        <View style={g.scaleRow}>
          <View style={[g.scaleSeg, { backgroundColor: GUIDE_C.green }]} />
          <View style={[g.scaleSeg, { backgroundColor: GUIDE_C.gold }]} />
          <View style={[g.scaleSeg, { backgroundColor: '#E0C24A' }]} />
          <View style={[g.scaleSeg, { backgroundColor: GUIDE_C.red }]} />
        </View>
        <Text style={g.scaleLabel}>안정 → 주의 → 경미한 우울감 → 뚜렷</Text>
      </GuideFrame>
    ),
  },
  {
    title: '혼자 힘들면 함께 지켜요',
    desc: '우울감이 중간 이상일 때만 가족에게 알림이 가요.\n많이 힘들 땐 전문 상담으로 바로 연결돼요',
    visual: (
      <GuideFrame>
        <View style={g.shareRow}>
          <Image source={IC_HEART} style={g.shareIcon} resizeMode="contain" />
          <Text style={g.shareText}>남편·가족과 공유</Text>
          <View style={g.toggle}><View style={g.knob} /></View>
        </View>
        <View style={g.crisis}>
          <Text style={g.crisisText}>💙 자가검사는 진단을 대체하지 않아요. 많이 힘들면 정신건강상담 1577-0199 · 자살예방 1393으로 꼭 연락하세요.</Text>
        </View>
      </GuideFrame>
    ),
  },
];

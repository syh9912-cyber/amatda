/** 임당(임신성 당뇨) 관리 가이드 — 혈당 기록 · 식단 AI 분석 · 주간 리포트 */
import { View, Text, Image, StyleSheet } from 'react-native';
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

export const GDM_GUIDE: GuidePage[] = [
  {
    title: '혈당을 시점별로 기록해요',
    desc: '공복·식후 시점과 함께 기록하면 추이가 보여요.\n기준선이 항상 표시돼 한눈에 비교돼요',
    visual: (
      <GuideFrame>
        <View style={g.refCard}>
          <Text style={[g.cap, { color: GUIDE_C.blue, marginLeft: 0 }]}>목표 기준선</Text>
          <View style={g.refRow}><Text style={g.refLabel}>공복</Text><Text style={g.refVal}>95 이하</Text></View>
          <View style={g.refRow}><Text style={g.refLabel}>식후 1시간</Text><Text style={g.refVal}>140 이하</Text></View>
          <View style={g.refRow}><Text style={g.refLabel}>식후 2시간</Text><Text style={g.refVal}>120 이하</Text></View>
        </View>
        <View style={g.rec}>
          <Image source={IC_BLOOD} style={g.recIcon} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={g.recVal}>92<Text style={g.recUnit}> mg/dL</Text></Text>
            <Text style={g.recTime}>오늘 아침 · 공복</Text>
          </View>
          <View style={g.okPill}><Text style={g.okText}>정상</Text></View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '식단은 사진으로 간편하게',
    desc: '음식 사진을 올리면 AI가 탄수·칼로리를 추정해요.\n끼니별 권장 탄수량도 함께 알려줘요',
    visual: (
      <GuideFrame>
        <View style={g.mealCard}>
          <View style={g.mealPhoto} />
          <View style={{ flex: 1 }}>
            <Text style={g.mealName}>현미밥 + 나물 반찬</Text>
            <View style={g.badgeRow}>
              <View style={g.carb}><Text style={g.carbText}>탄수 45g</Text></View>
              <View style={g.carb}><Text style={g.carbText}>320 kcal</Text></View>
            </View>
          </View>
        </View>
        <View style={g.aiChip}>
          <Image source={IC_CAMERA} style={g.aiIcon} resizeMode="contain" />
          <Text style={g.aiText}>사진으로 AI 분석</Text>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '주간 AI 리포트로 관리해요',
    desc: '일주일 혈당·식단을 종합해\n잘한 점과 주의할 점을 코칭해줘요',
    visual: (
      <GuideFrame>
        <View style={g.report}>
          <Image source={IC_REPORT} style={g.reportIcon} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={g.reportLine}>✅ 식후 혈당이 안정적이에요</Text>
            <Text style={g.reportLine}>⚠️ 저녁 탄수는 조금 줄여볼까요?</Text>
          </View>
        </View>
        <View style={g.note}>
          <Text style={g.noteText}>🩺 수치·분석은 참고용이에요. 정확한 임당 관리는 담당 의료진과 상담하세요.</Text>
        </View>
      </GuideFrame>
    ),
  },
];

/** AI분석 가이드 페이지 — 육아패턴 · 대변 · 울음 3가지 분석 (커스텀 아이콘 사용) */
import { View, Text, Image, StyleSheet } from 'react-native';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_PATTERN = require('../../assets/quick-report.png') as number;
const IC_POOP = require('../../assets/cat-poop.png') as number;
const IC_CRY = require('../../assets/cat-crying.png') as number;
const IC_CAMERA = require('../../assets/icon-camera.png') as number;
const IC_MIC = require('../../assets/icon-mic.png') as number;

const g = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  mode: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modeIcon: { width: 30, height: 30, marginBottom: 5 },
  modeText: { fontSize: 12, fontWeight: '800' },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginVertical: 3 },
  metricLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: GUIDE_C.text },
  metricVal: { fontSize: 11.5, fontWeight: '700', color: GUIDE_C.textSub },
  okPill: { backgroundColor: GUIDE_C.greenLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  okText: { fontSize: 10.5, fontWeight: '800', color: GUIDE_C.green },
  evalPill: { backgroundColor: GUIDE_C.accentSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8, alignItems: 'center' },
  evalText: { fontSize: 12, fontWeight: '800', color: '#BC7C53' },
  inputRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  inputCard: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  inputIcon: { width: 26, height: 26, marginBottom: 4 },
  inputText: { fontSize: 12, fontWeight: '800' },
  inputSub: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  note: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11, marginTop: 10 },
  noteText: { fontSize: 11.5, color: GUIDE_C.textSub, lineHeight: 17, fontWeight: '600' },
  warn: { fontSize: 11.5, color: GUIDE_C.red, fontWeight: '700', textAlign: 'center', marginTop: 10 },
});

export const AIANALYSIS_GUIDE: GuidePage[] = [
  {
    title: 'AI가 우리 아이를 분석해요',
    desc: '세 가지로 분석해요 — 육아패턴, 대변, 울음.\n원하는 분석을 골라 시작하면 돼요',
    visual: (
      <GuideFrame>
        <View style={g.modeRow}>
          <View style={[g.mode, { backgroundColor: GUIDE_C.purpleLight }]}><Image source={IC_PATTERN} style={g.modeIcon} resizeMode="contain" /><Text style={[g.modeText, { color: GUIDE_C.purple }]}>육아패턴</Text></View>
          <View style={[g.mode, { backgroundColor: GUIDE_C.goldLight }]}><Image source={IC_POOP} style={g.modeIcon} resizeMode="contain" /><Text style={[g.modeText, { color: GUIDE_C.gold }]}>대변</Text></View>
          <View style={[g.mode, { backgroundColor: GUIDE_C.blueLight }]}><Image source={IC_CRY} style={g.modeIcon} resizeMode="contain" /><Text style={[g.modeText, { color: GUIDE_C.blue }]}>울음</Text></View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '기록만 하면 패턴이 분석돼요',
    desc: '아기시간에 쌓인 배변·수유·수면을\nAI가 표준과 비교해 종합 평가해줘요 (따로 입력 안 해도 돼요)',
    visual: (
      <GuideFrame>
        <Text style={g.cap}>📊  오늘의 육아패턴</Text>
        <View style={g.metricRow}><Text style={g.metricLabel}>수유</Text><Text style={g.metricVal}>7회</Text><View style={g.okPill}><Text style={g.okText}>적정</Text></View></View>
        <View style={g.metricRow}><Text style={g.metricLabel}>수면</Text><Text style={g.metricVal}>13시간</Text><View style={g.okPill}><Text style={g.okText}>적정</Text></View></View>
        <View style={g.metricRow}><Text style={g.metricLabel}>배변</Text><Text style={g.metricVal}>3회</Text><View style={g.okPill}><Text style={g.okText}>적정</Text></View></View>
        <View style={g.evalPill}><Text style={g.evalText}>🤖  전반적으로 안정적인 하루였어요</Text></View>
      </GuideFrame>
    ),
  },
  {
    title: '사진·소리로 대변·울음도 분석',
    desc: '대변은 사진, 울음은 녹음을 올리면\nAI가 원인과 대처법을 알려줘요',
    visual: (
      <GuideFrame>
        <View style={g.inputRow}>
          <View style={[g.inputCard, { backgroundColor: GUIDE_C.goldLight }]}><Image source={IC_CAMERA} style={g.inputIcon} resizeMode="contain" /><Text style={[g.inputText, { color: GUIDE_C.gold }]}>대변 사진</Text><Text style={[g.inputSub, { color: GUIDE_C.gold }]}>밝은 곳에서 또렷이</Text></View>
          <View style={[g.inputCard, { backgroundColor: GUIDE_C.blueLight }]}><Image source={IC_MIC} style={g.inputIcon} resizeMode="contain" /><Text style={[g.inputText, { color: GUIDE_C.blue }]}>울음 녹음</Text><Text style={[g.inputSub, { color: GUIDE_C.blue }]}>조용한 곳에서 가까이</Text></View>
        </View>
        <View style={g.note}>
          <Text style={g.noteText}>👶  대변 분석은 0~72개월, 울음 분석은 0~24개월 아이에게 맞춰져 있어요.</Text>
        </View>
        <Text style={g.warn}>참고용이에요. 이상 증상이 보이면 꼭 병원에 가세요</Text>
      </GuideFrame>
    ),
  },
];

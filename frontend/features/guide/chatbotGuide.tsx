/** 상담이모(AI 코칭) 가이드 페이지 */
import { View, Text, StyleSheet } from 'react-native';
import { GuideFrame, GuideBubble, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  chip: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '700', color: GUIDE_C.textSub },
  arrow: { fontSize: 16, color: GUIDE_C.textLight, textAlign: 'center', marginVertical: 8, fontWeight: '800' },
  preInput: { backgroundColor: GUIDE_C.accentSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  preText: { fontSize: 12.5, color: '#C2703B', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 4 },
  anChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  anText: { fontSize: 12.5, fontWeight: '800' },
  note: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 12, marginTop: 10 },
  noteText: { fontSize: 12, color: GUIDE_C.textSub, lineHeight: 18, fontWeight: '600' },
  warn: { fontSize: 11.5, color: GUIDE_C.red, fontWeight: '700', textAlign: 'center', marginTop: 10 },
});

export const CHATBOT_GUIDE: GuidePage[] = [
  {
    title: '상담이모에게 편하게 물어보세요',
    desc: '우리 아이 기질을 알고 답해주는 AI 상담.\n궁금한 건 무엇이든 대화하듯 물어보면 돼요',
    visual: (
      <GuideFrame>
        <GuideBubble text="이유식을 자꾸 뱉어요. 어떻게 할까요?" me />
        <GuideBubble text="아직 새로운 식감이 낯설 수 있어요. 활동형 아이는 한 번에 조금씩, 좋아하는 재료부터 섞어주면 거부감이 줄어요." />
        <GuideBubble text="얼마나 자주 줘야 하나요?" me />
      </GuideFrame>
    ),
  },
  {
    title: '카테고리로 더 빠르게',
    desc: '주제를 고르면 질문이 자동으로 채워져요.\n그대로 보내거나 자유롭게 고쳐서 물어보세요',
    visual: (
      <GuideFrame>
        <Text style={g.cap}>주제 선택</Text>
        <View style={g.chipRow}>
          {['수유·식사', '수면', '발달', '훈육', '건강', '놀이'].map((c) => (
            <View key={c} style={g.chip}><Text style={g.chipText}>{c}</Text></View>
          ))}
        </View>
        <Text style={g.arrow}>↓</Text>
        <View style={g.preInput}><Text style={g.preText}>아이가 수면 관련해서 고민이 있어요…</Text></View>
      </GuideFrame>
    ),
  },
  {
    title: '울음·대변도 분석해드려요',
    desc: '상담 화면 안에서 울음소리·대변 사진을 올리면\nAI가 원인과 대처법을 분석해줘요',
    visual: (
      <GuideFrame>
        <View style={g.row}>
          <View style={[g.anChip, { backgroundColor: GUIDE_C.blueLight }]}><Text style={[g.anText, { color: GUIDE_C.blue }]}>🔊  울음 분석</Text></View>
          <View style={[g.anChip, { backgroundColor: GUIDE_C.goldLight }]}><Text style={[g.anText, { color: GUIDE_C.gold }]}>💩  대변 분석</Text></View>
        </View>
        <View style={g.note}>
          <Text style={g.noteText}>🔊  5~15초, 아이 가까이서 녹음하면 정확해요{'\n'}💩  밝은 곳에서 또렷하게 찍어주세요</Text>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '상담 후에도 챙겨드려요',
    desc: '상담한 내용은 다음 날 아침\n"그 뒤로 어떤가요?" 팔로업으로 다시 챙겨요',
    visual: (
      <GuideFrame>
        <GuideBubble text="🌙 어제 상담한 수면 루틴, 오늘은 좀 어떠셨어요?" />
        <View style={g.note}>
          <Text style={g.noteText}>💡 상담이모는 참고용이에요. 아이가 아프거나 위급하면 꼭 병원·119를 먼저 이용하세요.</Text>
        </View>
        <Text style={g.warn}>응급 증상은 홈의 SOS(응급) 기능을 이용하세요</Text>
      </GuideFrame>
    ),
  },
];

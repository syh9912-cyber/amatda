/** 응급/SOS 가이드 페이지 — 위험 4단계 색상 의미 강조 */
import { View, Text, StyleSheet } from 'react-native';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const g = StyleSheet.create({
  level: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginVertical: 4 },
  levelBar: { width: 6, height: 34, borderRadius: 3 },
  levelName: { fontSize: 13, fontWeight: '900' },
  levelDesc: { fontSize: 11.5, color: GUIDE_C.text, fontWeight: '600', marginTop: 1 },
  symRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  sym: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  symText: { fontSize: 12, fontWeight: '700', color: GUIDE_C.textSub },
  note: { backgroundColor: GUIDE_C.redLight, borderRadius: 12, padding: 12, marginTop: 10 },
  noteText: { fontSize: 12, color: GUIDE_C.red, lineHeight: 18, fontWeight: '700' },
});

function Level({ name, desc, color, bg }: { name: string; desc: string; color: string; bg: string }) {
  return (
    <View style={[g.level, { backgroundColor: bg }]}>
      <View style={[g.levelBar, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[g.levelName, { color }]}>{name}</Text>
        <Text style={g.levelDesc}>{desc}</Text>
      </View>
    </View>
  );
}

export const SOS_GUIDE: GuidePage[] = [
  {
    title: '아이가 아플 때, 먼저 확인하세요',
    desc: '증상을 선택하면 위험도를 4단계로 알려드려요.\n색깔의 뜻을 꼭 기억해주세요',
    visual: (
      <GuideFrame>
        <Level name="응급 (빨강)" desc="즉시 119 — 한시가 급해요" color={GUIDE_C.red} bg={GUIDE_C.redLight} />
        <Level name="병원 (주황)" desc="바로 병원·응급실로" color="#CF9352" bg="#FAF0E0" />
        <Level name="주의 (노랑)" desc="안전 아님! 잘 지켜보세요" color="#BBA34A" bg="#F8F3DD" />
        <Level name="관찰 (초록)" desc="집에서 경과를 지켜봐요" color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
      </GuideFrame>
    ),
  },
  {
    title: '증상을 선택만 하면 돼요',
    desc: '열·구토·발진 등 증상을 고르고\n체온을 입력하면 더 정확하게 안내해요',
    visual: (
      <GuideFrame>
        <View style={g.symRow}>
          {['🌡️ 열', '🤮 구토', '😮‍💨 호흡곤란', '🩸 출혈', '🔴 발진', '😵 경련'].map((s) => (
            <View key={s} style={g.sym}><Text style={g.symText}>{s}</Text></View>
          ))}
        </View>
        <View style={g.note}>
          <Text style={g.noteText}>⚠️ 이 기능은 참고용이에요. "관찰" 결과여도 아이 상태가 이상하면 망설이지 말고 병원에 가세요.</Text>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: 'CPR·응급처치도 바로 옆에',
    desc: 'CPR, 하임리히(이물질), 화상 등\n월령에 맞는 응급처치 가이드를 단계별로 보여줘요',
    visual: (
      <GuideFrame>
        <View style={g.symRow}>
          {['❤️ 심폐소생', '🫁 하임리히', '🔥 화상', '🧩 이물질'].map((s) => (
            <View key={s} style={g.sym}><Text style={g.symText}>{s}</Text></View>
          ))}
        </View>
        <View style={[g.note, { backgroundColor: GUIDE_C.accentSoft }]}>
          <Text style={[g.noteText, { color: '#C2703B' }]}>👶 영아(12개월 미만)와 그 이상은 처치법이 달라요 — 아이 월령에 맞는 안내를 따라주세요.</Text>
        </View>
      </GuideFrame>
    ),
  },
];

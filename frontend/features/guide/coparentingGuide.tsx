/** 공동육아 가이드 페이지 */
import { View, Text, StyleSheet } from 'react-native';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  inviteCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 14, padding: 14, alignItems: 'center' },
  code: { fontSize: 22, fontWeight: '900', color: GUIDE_C.accent, letterSpacing: 3 },
  codeSub: { fontSize: 11.5, color: GUIDE_C.textSub, marginTop: 4, fontWeight: '600' },
  shareRow: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'center' },
  shareChip: { backgroundColor: GUIDE_C.accentSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  shareText: { fontSize: 12, fontWeight: '800', color: '#C2703B' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 10, marginVertical: 4 },
  roleEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  roleName: { fontSize: 13, fontWeight: '800', color: GUIDE_C.text },
  rolePerm: { fontSize: 11.5, color: GUIDE_C.textSub, marginTop: 1 },
  permPill: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 },
  permText: { fontSize: 10.5, fontWeight: '800' },
  note: { backgroundColor: GUIDE_C.accentSoft, borderRadius: 12, padding: 12, marginTop: 8 },
  noteText: { fontSize: 12, color: '#C2703B', lineHeight: 18, fontWeight: '700' },
});

function Role({ emoji, name, perm, color, bg }: { emoji: string; name: string; perm: string; color: string; bg: string }) {
  return (
    <View style={g.roleRow}>
      <Text style={g.roleEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={g.roleName}>{name}</Text>
        <Text style={g.rolePerm}>{perm}</Text>
      </View>
      <View style={[g.permPill, { backgroundColor: bg }]}><Text style={[g.permText, { color }]}>{perm.includes('기록') ? '기록 가능' : '열람만'}</Text></View>
    </View>
  );
}

export const COPARENTING_GUIDE: GuidePage[] = [
  {
    title: '가족과 함께 아이를 키워요',
    desc: '배우자·조부모를 초대하면 같은 아이를\n함께 기록하고 상담 내역도 공유할 수 있어요',
    emoji: '👨‍👩‍👧‍👦',
  },
  {
    title: '초대는 코드 한 번이면 끝',
    desc: '초대를 만들면 코드/링크가 생겨요.\n카카오·문자로 보내면 상대가 눌러서 바로 연결돼요',
    visual: (
      <GuideFrame>
        <View style={g.inviteCard}>
          <Text style={g.code}>A1B2C3D4</Text>
          <Text style={g.codeSub}>초대 코드</Text>
          <View style={g.shareRow}>
            <View style={g.shareChip}><Text style={g.shareText}>💬 카카오</Text></View>
            <View style={g.shareChip}><Text style={g.shareText}>✉️ 문자</Text></View>
            <View style={g.shareChip}><Text style={g.shareText}>🔗 링크</Text></View>
          </View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '역할마다 권한을 정해요',
    desc: '예: 부모는 기록·상담 모두, 조부모는 열람만.\n초대할 때 역할을 고르면 권한이 자동으로 맞춰져요',
    visual: (
      <GuideFrame>
        <Role emoji="👩" name="엄마 · 아빠 (부모)" perm="기록·상담·전체" color={GUIDE_C.green} bg={GUIDE_C.greenLight} />
        <Role emoji="👵" name="할머니 (조부모)" perm="열람만" color={GUIDE_C.blue} bg={GUIDE_C.blueLight} />
        <Role emoji="🧑‍🍼" name="돌봄 도우미" perm="기록만" color={GUIDE_C.gold} bg={GUIDE_C.goldLight} />
      </GuideFrame>
    ),
  },
  {
    title: '연결은 언제든 정리할 수 있어요',
    desc: '소유자가 연결을 끊으면 상대 앱에서 아이가 사라져요.\n초대받은 분은 "나가기"로 직접 연결을 끊을 수 있어요',
    visual: (
      <GuideFrame>
        <View style={g.note}>
          <Text style={g.noteText}>🔑  아이를 만든 사람이 소유자예요.{'\n'}🔁  기록은 모두에게 실시간으로 공유돼요.{'\n'}🚪  더 이상 함께하지 않으면 연결을 끊으면 돼요.</Text>
        </View>
      </GuideFrame>
    ),
  },
];

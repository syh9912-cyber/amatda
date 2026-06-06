/** 맘스톡 가이드 페이지 — 월방/내 동네 커뮤니티 · 글쓰기 · 익명/신고 (커스텀 아이콘 사용) */
import { View, Text, Image, StyleSheet } from 'react-native';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_MONTH = require('../../assets/quick-timeline.png') as number;
const IC_LOCAL = require('../../assets/cat-social.png') as number;
const IC_ANON = require('../../assets/icon-lock.png') as number;
const IC_REPORT = require('../../assets/icon-redflag.png') as number;

const g = StyleSheet.create({
  roomRow: { gap: 8 },
  room: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11 },
  roomIcon: { width: 30, height: 30 },
  roomName: { fontSize: 13, fontWeight: '800', color: GUIDE_C.text },
  roomDesc: { fontSize: 11.5, color: GUIDE_C.textSub, marginTop: 1 },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  post: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 11, marginVertical: 3 },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  catBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  catText: { fontSize: 10, fontWeight: '800' },
  postTitle: { flex: 1, fontSize: 12.5, fontWeight: '700', color: GUIDE_C.text },
  postMeta: { fontSize: 10.5, color: GUIDE_C.textLight, fontWeight: '600' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 12, marginVertical: 4 },
  noteIcon: { width: 24, height: 24 },
  noteText: { flex: 1, fontSize: 12, color: GUIDE_C.textSub, lineHeight: 18, fontWeight: '600' },
});

export const MOMGROUP_GUIDE: GuidePage[] = [
  {
    title: '같은 시기 엄마들과 이야기해요',
    desc: '비슷한 또래 아이를 키우는 엄마들과\n질문하고 수다 떨고 정보를 나눠요',
    visual: (
      <GuideFrame>
        <View style={g.roomRow}>
          <View style={g.room}>
            <Image source={IC_MONTH} style={g.roomIcon} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={g.roomName}>월방</Text>
              <Text style={g.roomDesc}>같은 출생·예정월 엄마들이 모여요</Text>
            </View>
          </View>
          <View style={g.room}>
            <Image source={IC_LOCAL} style={g.roomIcon} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={g.roomName}>내 동네</Text>
              <Text style={g.roomDesc}>가까운 동네 + 또래 엄마들과 연결돼요</Text>
            </View>
          </View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '궁금한 걸 올리고 댓글로 나눠요',
    desc: '제목·내용·사진으로 글을 쓰고\n주제(질문·수다·정보·고민·축하)를 골라요',
    visual: (
      <GuideFrame>
        <View style={g.post}>
          <View style={g.postTop}>
            <View style={[g.catBadge, { backgroundColor: GUIDE_C.blueLight }]}><Text style={[g.catText, { color: GUIDE_C.blue }]}>질문</Text></View>
            <Text style={g.postTitle} numberOfLines={1}>이앓이 시작인데 어떻게 하세요?</Text>
          </View>
          <Text style={g.postMeta}>익명맘 · 조회 24 · 댓글 6</Text>
        </View>
        <View style={g.catRow}>
          <View style={[g.catBadge, { backgroundColor: GUIDE_C.blueLight }]}><Text style={[g.catText, { color: GUIDE_C.blue }]}>질문</Text></View>
          <View style={[g.catBadge, { backgroundColor: '#FCE9F1' }]}><Text style={[g.catText, { color: '#C77BA0' }]}>수다</Text></View>
          <View style={[g.catBadge, { backgroundColor: GUIDE_C.greenLight }]}><Text style={[g.catText, { color: GUIDE_C.green }]}>정보</Text></View>
          <View style={[g.catBadge, { backgroundColor: GUIDE_C.accentSoft }]}><Text style={[g.catText, { color: GUIDE_C.accent }]}>고민</Text></View>
          <View style={[g.catBadge, { backgroundColor: GUIDE_C.purpleLight }]}><Text style={[g.catText, { color: GUIDE_C.purple }]}>축하</Text></View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '익명·신고로 안전하게',
    desc: '부담되는 이야기는 익명으로,\n불쾌한 글은 신고로 함께 지켜요',
    visual: (
      <GuideFrame>
        <View style={g.note}>
          <Image source={IC_ANON} style={g.noteIcon} resizeMode="contain" />
          <Text style={g.noteText}>익명으로 쓰면 그 방에서는 “익명맘#1234”처럼 같은 별명이 유지돼요.</Text>
        </View>
        <View style={g.note}>
          <Image source={IC_REPORT} style={g.noteIcon} resizeMode="contain" />
          <Text style={g.noteText}>욕설·광고·개인정보 등은 신고할 수 있고, 여러 번 신고되면 자동으로 가려져요.</Text>
        </View>
      </GuideFrame>
    ),
  },
];

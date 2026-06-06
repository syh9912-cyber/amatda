/** 출산가방 체크리스트 가이드 — 맞춤 목록 · 상태/담당 태그 · 아빠모드/공유 */
import { View, Text, Image, StyleSheet } from 'react-native';
import { GuideFrame, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_SHARE = require('../../assets/icon-share.png') as number;

const g = StyleSheet.create({
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  selRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  selCard: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5 },
  selText: { fontSize: 12, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 12, padding: 10, marginVertical: 3 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: GUIDE_C.border },
  checkOn: { backgroundColor: GUIDE_C.green, borderColor: GUIDE_C.green, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  itemName: { flex: 1, fontSize: 12.5, fontWeight: '700', color: GUIDE_C.text },
  tag: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '800' },
  progressWrap: { marginTop: 8 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#EEEEF2', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: GUIDE_C.accent },
  progressText: { fontSize: 11, fontWeight: '800', color: GUIDE_C.accent, marginTop: 5, textAlign: 'right' },
  dadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: GUIDE_C.accentSoft, borderRadius: 12, padding: 11 },
  dadEmoji: { fontSize: 22 },
  dadText: { flex: 1, fontSize: 12.5, fontWeight: '800', color: '#BC7C53' },
  toggle: { width: 38, height: 22, borderRadius: 11, backgroundColor: GUIDE_C.accent, justifyContent: 'center', paddingHorizontal: 2 },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF', alignSelf: 'flex-end' },
  shareChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignSelf: 'center', marginTop: 10 },
  shareIcon: { width: 16, height: 16 },
  shareText: { fontSize: 12, fontWeight: '700', color: GUIDE_C.textSub },
});

export const BIRTHBAG_GUIDE: GuidePage[] = [
  {
    title: '내 상황에 맞는 목록을 받아요',
    desc: '분만 형태와 산후 계획을 고르면\n딱 맞는 준비물만 추려서 보여줘요',
    visual: (
      <GuideFrame>
        <Text style={g.cap}>분만 형태</Text>
        <View style={g.selRow}>
          <View style={[g.selCard, { backgroundColor: GUIDE_C.accentSoft, borderColor: GUIDE_C.accent }]}><Text style={[g.selText, { color: GUIDE_C.accent }]}>자연분만</Text></View>
          <View style={[g.selCard, { backgroundColor: '#FFF', borderColor: GUIDE_C.border }]}><Text style={[g.selText, { color: GUIDE_C.textSub }]}>제왕절개</Text></View>
        </View>
        <Text style={g.cap}>산후 계획</Text>
        <View style={g.selRow}>
          <View style={[g.selCard, { backgroundColor: GUIDE_C.blueLight, borderColor: GUIDE_C.blue }]}><Text style={[g.selText, { color: GUIDE_C.blue }]}>조리원</Text></View>
          <View style={[g.selCard, { backgroundColor: '#FFF', borderColor: GUIDE_C.border }]}><Text style={[g.selText, { color: GUIDE_C.textSub }]}>집으로</Text></View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '상태·담당을 정하고 체크해요',
    desc: '항목마다 구매필요/준비완료를 태그하고\n엄마·아빠 담당을 나눠 진행률을 채워요',
    visual: (
      <GuideFrame>
        <View style={g.item}>
          <View style={g.check} />
          <Text style={g.itemName}>산모 패드</Text>
          <View style={[g.tag, { backgroundColor: GUIDE_C.accentSoft }]}><Text style={[g.tagText, { color: GUIDE_C.accent }]}>구매필요</Text></View>
          <View style={[g.tag, { backgroundColor: '#FCE9F1' }]}><Text style={[g.tagText, { color: '#C77BA0' }]}>엄마</Text></View>
        </View>
        <View style={g.item}>
          <View style={[g.check, g.checkOn]}><Text style={g.checkMark}>✓</Text></View>
          <Text style={g.itemName}>카시트</Text>
          <View style={[g.tag, { backgroundColor: GUIDE_C.blueLight }]}><Text style={[g.tagText, { color: GUIDE_C.blue }]}>가방에 넣음</Text></View>
          <View style={[g.tag, { backgroundColor: GUIDE_C.greenLight }]}><Text style={[g.tagText, { color: GUIDE_C.green }]}>아빠</Text></View>
        </View>
        <View style={g.progressWrap}>
          <View style={g.progressTrack}><View style={[g.progressFill, { width: '62%' }]} /></View>
          <Text style={g.progressText}>62% 준비 완료</Text>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '아빠와 함께, 링크로 공유',
    desc: '아빠 모드로 아빠 담당만 모아 보고\n링크로 가족과 함께 준비해요',
    visual: (
      <GuideFrame>
        <View style={g.dadRow}>
          <Text style={g.dadEmoji}>👨</Text>
          <Text style={g.dadText}>아빠 모드 — 아빠 담당만 보기</Text>
          <View style={g.toggle}><View style={g.knob} /></View>
        </View>
        <View style={g.shareChip}>
          <Image source={IC_SHARE} style={g.shareIcon} resizeMode="contain" />
          <Text style={g.shareText}>카카오톡 · 링크로 공유</Text>
        </View>
      </GuideFrame>
    ),
  },
];

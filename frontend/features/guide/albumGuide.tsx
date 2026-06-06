/** 성장앨범 가이드 — 사진 기록 · 발달 자동분류 · 여러 장 추가 · AI 자동일기 · PDF 앨범 */
import { View, Text, Image, StyleSheet, Switch } from 'react-native';
import { GuideFrame, GuidePill, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_ALBUM_COVER = require('../../assets/album-cover.png') as number;
const IC_MS_BODY = require('../../assets/milestone-body.png') as number;
const IC_MS_TALK = require('../../assets/milestone-talk.png') as number;
const IC_MS_HEART = require('../../assets/milestone-heart.png') as number;
const IC_DIARY = require('../../assets/child-diary.png') as number;

const g = StyleSheet.create({
  hero: { width: 44, height: 44, alignSelf: 'center', marginBottom: 6 },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },
  capC: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, textAlign: 'center', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  tile: { width: 62, height: 62, borderRadius: 12 },
  addTile: { width: 62, height: 62, borderRadius: 12, backgroundColor: GUIDE_C.accentSoft, borderWidth: 1.5, borderColor: GUIDE_C.accent, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 24, color: GUIDE_C.accent, fontWeight: '800', marginTop: -3 },
  photoCard: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: GUIDE_C.border, padding: 10, alignItems: 'center' },
  photoBox: { width: '100%', height: 78, borderRadius: 10, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 6 },
  badgeIcon: { width: 16, height: 16 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
  cover: { width: 152, alignSelf: 'center', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: GUIDE_C.border, padding: 10, alignItems: 'center' },
  coverImg: { width: '100%', height: 96, borderRadius: 8, marginBottom: 8 },
  coverTitle: { fontSize: 13, fontWeight: '800', color: GUIDE_C.text },
  coverSub: { fontSize: 11, color: GUIDE_C.textSub, marginTop: 2 },
  pdfPill: { marginTop: 12, backgroundColor: GUIDE_C.accentSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pdfBadge: { backgroundColor: '#BC7C53', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  pdfBadgeText: { fontSize: 9.5, fontWeight: '900', color: '#FFF' },
  pdfText: { fontSize: 12, fontWeight: '800', color: '#BC7C53' },
  // 여러 장 추가
  batchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: GUIDE_C.border, padding: 8, marginTop: 8 },
  batchThumb: { width: 40, height: 40, borderRadius: 8 },
  batchMemo: { flex: 1, fontSize: 11.5, color: GUIDE_C.textSub, fontWeight: '600' },
  shareTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shareText: { fontSize: 11, fontWeight: '700', color: '#C2407A' },
  // AI 일기
  diaryCard: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: GUIDE_C.border, padding: 14 },
  diaryDate: { fontSize: 11, fontWeight: '800', color: GUIDE_C.accent, marginBottom: 6 },
  diaryText: { fontSize: 12.5, lineHeight: 19, color: GUIDE_C.text, fontWeight: '500' },
  sourceRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 },
});

const TILE_TINTS = ['#F3E7DE', '#E7EFF1', '#EDE8F4', '#E9F1E5', '#F6EEDA'];

export const ALBUM_GUIDE: GuidePage[] = [
  {
    title: '사진으로 성장을 기록해요',
    desc: '갤러리나 카메라로 사진을 더하면\n날짜순으로 차곡차곡 정리돼요',
    visual: (
      <GuideFrame>
        <Text style={g.cap}>📸  우리 아이 사진</Text>
        <View style={g.grid}>
          {TILE_TINTS.map((c, i) => (
            <View key={i} style={[g.tile, { backgroundColor: c }]} />
          ))}
          <View style={g.addTile}><Text style={g.addText}>＋</Text></View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '발달 단계가 자동으로 붙어요',
    desc: '“첫 걸음”, “첫 웃음” 같은 발달 단계를\n월령에 맞춰 자동으로 제안해줘요',
    visual: (
      <GuideFrame>
        <View style={g.photoCard}>
          <View style={[g.photoBox, { backgroundColor: '#ECECF1' }]} />
          <View style={g.badgeRow}>
            <View style={[g.badge, { backgroundColor: GUIDE_C.accentSoft }]}><Image source={IC_MS_BODY} style={g.badgeIcon} /><Text style={[g.badgeText, { color: GUIDE_C.accent }]}>첫 걸음</Text></View>
            <View style={[g.badge, { backgroundColor: GUIDE_C.blueLight }]}><Image source={IC_MS_TALK} style={g.badgeIcon} /><Text style={[g.badgeText, { color: GUIDE_C.blue }]}>첫 말</Text></View>
            <View style={[g.badge, { backgroundColor: GUIDE_C.purpleLight }]}><Image source={IC_MS_HEART} style={g.badgeIcon} /><Text style={[g.badgeText, { color: GUIDE_C.purple }]}>첫 웃음</Text></View>
          </View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '사진을 여러 장 한 번에',
    desc: '갤러리에서 여러 장을 골라 한꺼번에 올리고,\n사진마다 가족피드 공유·메모를 정할 수 있어요',
    visual: (
      <GuideFrame>
        <Text style={g.capC}>🖼️  여러 장 추가 · 검토</Text>
        <View style={g.grid}>
          {TILE_TINTS.slice(0, 4).map((c, i) => (
            <View key={i} style={[g.tile, { backgroundColor: c }]} />
          ))}
        </View>
        <View style={g.batchRow}>
          <View style={[g.batchThumb, { backgroundColor: '#E7EFF1' }]} />
          <Text style={g.batchMemo}>“첫 이유식 도전!”</Text>
          <View style={g.shareTag}>
            <Switch value={true} disabled style={{ transform: [{ scale: 0.7 }] }} trackColor={{ true: '#E91E63' }} />
            <Text style={g.shareText}>피드 공유</Text>
          </View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '하루를 AI가 일기로 써줘요',
    desc: '그날의 아기시간 기록과 상담 내용을 모아\nAI가 부모 마음으로 따뜻한 일기를 써줘요',
    visual: (
      <GuideFrame>
        <Image source={IC_DIARY} style={g.hero} resizeMode="contain" />
        <View style={g.diaryCard}>
          <Text style={g.diaryDate}>6월 6일 토요일</Text>
          <Text style={g.diaryText}>오늘 윤도는 분유를 잘 먹고 낮잠도 푹 잤다. 기저귀 갈 때마다 방긋 웃어줘서 하루 종일 행복했던 하루…</Text>
        </View>
        <View style={g.sourceRow}>
          <GuidePill label="🍼 아기시간 기록" color={GUIDE_C.gold} bg={GUIDE_C.goldLight} />
          <GuidePill label="💬 상담 내용" color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '한 권의 앨범으로 만들어요',
    desc: '기간만 고르면 월별로 정리된\n사진 앨범을 PDF로 받아볼 수 있어요',
    visual: (
      <GuideFrame>
        <View style={g.cover}>
          <Image source={IC_ALBUM_COVER} style={g.coverImg} resizeMode="cover" />
          <Text style={g.coverTitle}>윤도의 성장앨범</Text>
          <Text style={g.coverSub}>2025.06 ~ 2026.05</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <View style={g.pdfPill}>
            <View style={g.pdfBadge}><Text style={g.pdfBadgeText}>PDF</Text></View>
            <Text style={g.pdfText}>앨범으로 저장</Text>
          </View>
        </View>
      </GuideFrame>
    ),
  },
];

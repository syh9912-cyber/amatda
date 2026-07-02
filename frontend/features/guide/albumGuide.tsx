/** 성장앨범 가이드 — 사진 기록 · 발달 자동분류 · 여러 장 추가 · AI 자동일기 · PDF 앨범 */
import { View, Text, Image, StyleSheet, Switch } from 'react-native';
import type { TFunction } from 'i18next';
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

export function getAlbumGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.album.page1.title'),
      desc: t('guides.album.page1.desc'),
      visual: (
        <GuideFrame>
          <Text style={g.cap}>{t('guides.album.page1.cardTitle')}</Text>
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
      title: t('guides.album.page2.title'),
      desc: t('guides.album.page2.desc'),
      visual: (
        <GuideFrame>
          <View style={g.photoCard}>
            <View style={[g.photoBox, { backgroundColor: '#ECECF1' }]} />
            <View style={g.badgeRow}>
              <View style={[g.badge, { backgroundColor: GUIDE_C.accentSoft }]}><Image source={IC_MS_BODY} style={g.badgeIcon} /><Text style={[g.badgeText, { color: GUIDE_C.accent }]}>{t('guides.album.page2.firstStep')}</Text></View>
              <View style={[g.badge, { backgroundColor: GUIDE_C.blueLight }]}><Image source={IC_MS_TALK} style={g.badgeIcon} /><Text style={[g.badgeText, { color: GUIDE_C.blue }]}>{t('guides.album.page2.firstWord')}</Text></View>
              <View style={[g.badge, { backgroundColor: GUIDE_C.purpleLight }]}><Image source={IC_MS_HEART} style={g.badgeIcon} /><Text style={[g.badgeText, { color: GUIDE_C.purple }]}>{t('guides.album.page2.firstSmile')}</Text></View>
            </View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.album.page3.title'),
      desc: t('guides.album.page3.desc'),
      visual: (
        <GuideFrame>
          <Text style={g.capC}>{t('guides.album.page3.cardTitle')}</Text>
          <View style={g.grid}>
            {TILE_TINTS.slice(0, 4).map((c, i) => (
              <View key={i} style={[g.tile, { backgroundColor: c }]} />
            ))}
          </View>
          <View style={g.batchRow}>
            <View style={[g.batchThumb, { backgroundColor: '#E7EFF1' }]} />
            <Text style={g.batchMemo}>{t('guides.album.page3.sampleMemo')}</Text>
            <View style={g.shareTag}>
              <Switch value={true} disabled style={{ transform: [{ scale: 0.7 }] }} trackColor={{ true: '#E91E63' }} />
              <Text style={g.shareText}>{t('guides.album.page3.feedShare')}</Text>
            </View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.album.page4.title'),
      desc: t('guides.album.page4.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_DIARY} style={g.hero} resizeMode="contain" />
          <View style={g.diaryCard}>
            <Text style={g.diaryDate}>{t('guides.album.page4.sampleDate')}</Text>
            <Text style={g.diaryText}>{t('guides.album.page4.sampleDiary')}</Text>
          </View>
          <View style={g.sourceRow}>
            <GuidePill label={t('guides.album.page4.sourceBabyTracker')} color={GUIDE_C.gold} bg={GUIDE_C.goldLight} />
            <GuidePill label={t('guides.album.page4.sourceCoaching')} color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.album.page5.title'),
      desc: t('guides.album.page5.desc'),
      visual: (
        <GuideFrame>
          <View style={g.cover}>
            <Image source={IC_ALBUM_COVER} style={g.coverImg} resizeMode="cover" />
            <Text style={g.coverTitle}>{t('guides.album.page5.sampleCoverTitle')}</Text>
            <Text style={g.coverSub}>{t('guides.album.page5.sampleCoverRange')}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <View style={g.pdfPill}>
              <View style={g.pdfBadge}><Text style={g.pdfBadgeText}>PDF</Text></View>
              <Text style={g.pdfText}>{t('guides.album.page5.saveAsAlbum')}</Text>
            </View>
          </View>
        </GuideFrame>
      ),
    },
  ];
}

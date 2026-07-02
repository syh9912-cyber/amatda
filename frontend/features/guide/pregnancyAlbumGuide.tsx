/** 임신앨범 가이드 — 주수별 사진 · 초음파 보관 · 태교일기 앨범 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GuidePill, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_TEST = require('../../assets/preg-test.png') as number;
const IC_ULTRASOUND = require('../../assets/preg-ultrasound.png') as number;
const IC_RIBBON = require('../../assets/preg-ribbon.png') as number;

const g = StyleSheet.create({
  hero: { width: 46, height: 46, alignSelf: 'center', marginBottom: 8 },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, textAlign: 'center', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  tile: { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileWk: { fontSize: 12, fontWeight: '800', color: GUIDE_C.textSub },
  addTile: { width: 64, height: 64, borderRadius: 12, backgroundColor: GUIDE_C.accentSoft, borderWidth: 1.5, borderColor: GUIDE_C.accent, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 24, color: GUIDE_C.accent, fontWeight: '800', marginTop: -3 },
  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: GUIDE_C.border, padding: 12, alignItems: 'center' },
  scanBox: { width: '100%', height: 78, borderRadius: 10, backgroundColor: '#2B2B30', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  scanEmoji: { fontSize: 28 },
  cover: { width: 150, alignSelf: 'center', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: GUIDE_C.border, padding: 12, alignItems: 'center' },
  coverBox: { width: '100%', height: 86, borderRadius: 8, backgroundColor: '#F3E7DE', marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  coverTitle: { fontSize: 13, fontWeight: '800', color: GUIDE_C.text },
  coverSub: { fontSize: 11, color: GUIDE_C.textSub, marginTop: 2 },
});

const TILE_TINTS = ['#F3E7DE', '#E7EFF1', '#EDE8F4', '#E9F1E5'];

export function getPregnancyAlbumGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.pregnancyAlbum.page1.title'),
      desc: t('guides.pregnancyAlbum.page1.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_TEST} style={g.hero} resizeMode="contain" />
          <View style={g.grid}>
            {TILE_TINTS.map((c, i) => (
              <View key={i} style={[g.tile, { backgroundColor: c }]}><Text style={g.tileWk}>{t('guides.pregnancyAlbum.page1.weekTile', { week: (i + 1) * 8 })}</Text></View>
            ))}
            <View style={g.addTile}><Text style={g.addText}>＋</Text></View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.pregnancyAlbum.page2.title'),
      desc: t('guides.pregnancyAlbum.page2.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_ULTRASOUND} style={g.hero} resizeMode="contain" />
          <View style={g.card}>
            <View style={g.scanBox}><Text style={g.scanEmoji}>👶</Text></View>
            <GuidePill label={t('guides.pregnancyAlbum.page2.pillLabel')} color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.pregnancyAlbum.page3.title'),
      desc: t('guides.pregnancyAlbum.page3.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_RIBBON} style={g.hero} resizeMode="contain" />
          <View style={g.cover}>
            <View style={g.coverBox}><Text style={{ fontSize: 28 }}>📖</Text></View>
            <Text style={g.coverTitle}>{t('guides.pregnancyAlbum.page3.coverTitle')}</Text>
            <Text style={g.coverSub}>{t('guides.pregnancyAlbum.page3.coverSub')}</Text>
          </View>
        </GuideFrame>
      ),
    },
  ];
}

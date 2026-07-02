/** 자장가 / 태교음악 가이드 — 재생 · 울음감지 · 엄마목소리 · 타이머 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
import type { TFunction } from 'i18next';
import { GuideFrame, GuidePill, GUIDE_C, type GuidePage } from '../../components/common/GuideCarousel';

const IC_LULLABY = require('../../assets/quick-lullaby.png') as number;
const IC_MIC = require('../../assets/icon-mic.png') as number;
const IC_CRY = require('../../assets/cat-crying.png') as number;
const IC_SLEEP = require('../../assets/cat-sleep.png') as number;
const IC_WOMB = require('../../assets/sound-womb.png') as number;
const IC_MOZART = require('../../assets/sound-mozart.png') as number;

const g = StyleSheet.create({
  hero: { width: 46, height: 46, alignSelf: 'center', marginBottom: 8 },
  cap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, textAlign: 'center', marginBottom: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: GUIDE_C.border, padding: 12 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: GUIDE_C.purple, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#FFF', fontSize: 15, marginLeft: 2 },
  trackTitle: { fontSize: 13, fontWeight: '800', color: GUIDE_C.text },
  trackSub: { fontSize: 11.5, color: GUIDE_C.textSub, marginTop: 1 },
  timer: { fontSize: 28, fontWeight: '900', color: GUIDE_C.purple, textAlign: 'center' },
  timerSub: { fontSize: 12, color: GUIDE_C.textSub, textAlign: 'center', marginTop: 2, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GUIDE_C.red },
  recText: { fontSize: 12.5, fontWeight: '700', color: GUIDE_C.text },
});

export function getLullabyGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.lullaby.page1.title'),
      desc: t('guides.lullaby.page1.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_LULLABY} style={g.hero} resizeMode="contain" />
          <View style={g.card}>
            <View style={g.trackRow}>
              <View style={g.playBtn}><Text style={g.playIcon}>▶</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={g.trackTitle}>{t('guides.lullaby.page1.trackTitle')}</Text>
                <Text style={g.trackSub}>{t('guides.lullaby.page1.trackSub')}</Text>
              </View>
            </View>
          </View>
          <View style={[g.row, { marginTop: 8 }]}>
            <GuidePill label={t('guides.lullaby.page1.pillLullaby')} color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
            <GuidePill label={t('guides.lullaby.page1.pillWhiteNoise')} color={GUIDE_C.blue} bg={GUIDE_C.blueLight} />
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.lullaby.page2.title'),
      desc: t('guides.lullaby.page2.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_CRY} style={g.hero} resizeMode="contain" />
          <Text style={g.cap}>{t('guides.lullaby.page2.captionLabel')}</Text>
          <View style={g.card}>
            <View style={g.trackRow}>
              <View style={g.recDot} />
              <Text style={g.recText}>{t('guides.lullaby.page2.detecting')}</Text>
            </View>
          </View>
          <View style={[g.row, { marginTop: 8 }]}>
            <GuidePill label={t('guides.lullaby.page2.pillCryToLullaby')} color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.lullaby.page3.title'),
      desc: t('guides.lullaby.page3.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_MIC} style={g.hero} resizeMode="contain" />
          <Text style={g.cap}>{t('guides.lullaby.page3.captionLabel')}</Text>
          <View style={g.card}>
            <View style={g.trackRow}>
              <View style={[g.playBtn, { backgroundColor: GUIDE_C.red }]}><Text style={g.playIcon}>●</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={g.trackTitle}>{t('guides.lullaby.page3.trackTitle')}</Text>
                <Text style={g.trackSub}>{t('guides.lullaby.page3.trackSub')}</Text>
              </View>
            </View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.lullaby.page4.title'),
      desc: t('guides.lullaby.page4.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_SLEEP} style={g.hero} resizeMode="contain" />
          <Text style={g.timer}>30:00</Text>
          <Text style={g.timerSub}>{t('guides.lullaby.page4.timerSub')}</Text>
          <View style={g.row}>
            <GuidePill label={t('guides.lullaby.page4.min15')} color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
            <GuidePill label={t('guides.lullaby.page4.min30')} color="#FFF" filled bg={GUIDE_C.purple} />
            <GuidePill label={t('guides.lullaby.page4.min60')} color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
          </View>
        </GuideFrame>
      ),
    },
  ];
}

export function getLullabyPrenatalGuide(t: TFunction): GuidePage[] {
  return [
    {
      title: t('guides.lullaby.prenatalPage1.title'),
      desc: t('guides.lullaby.prenatalPage1.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_MOZART} style={g.hero} resizeMode="contain" />
          <View style={g.card}>
            <View style={g.trackRow}>
              <View style={g.playBtn}><Text style={g.playIcon}>▶</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={g.trackTitle}>{t('guides.lullaby.prenatalPage1.trackTitle')}</Text>
                <Text style={g.trackSub}>{t('guides.lullaby.prenatalPage1.trackSub')}</Text>
              </View>
            </View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.lullaby.prenatalPage2.title'),
      desc: t('guides.lullaby.prenatalPage2.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_MIC} style={g.hero} resizeMode="contain" />
          <Text style={g.cap}>{t('guides.lullaby.prenatalPage2.captionLabel')}</Text>
          <View style={g.card}>
            <View style={g.trackRow}>
              <View style={[g.playBtn, { backgroundColor: GUIDE_C.red }]}><Text style={g.playIcon}>●</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={g.trackTitle}>{t('guides.lullaby.prenatalPage2.trackTitle')}</Text>
                <Text style={g.trackSub}>{t('guides.lullaby.prenatalPage2.trackSub')}</Text>
              </View>
            </View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('guides.lullaby.prenatalPage3.title'),
      desc: t('guides.lullaby.prenatalPage3.desc'),
      visual: (
        <GuideFrame>
          <Image source={IC_WOMB} style={g.hero} resizeMode="contain" />
          <Text style={g.timer}>20:00</Text>
          <Text style={g.timerSub}>{t('guides.lullaby.prenatalPage3.timerSub')}</Text>
          <View style={g.row}>
            <GuidePill label={t('guides.lullaby.prenatalPage3.pillWomb')} color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
            <GuidePill label={t('guides.lullaby.prenatalPage3.pillHeartbeat')} color={GUIDE_C.red} bg={GUIDE_C.redLight} />
          </View>
        </GuideFrame>
      ),
    },
  ];
}

/** 자장가 / 태교음악 가이드 — 재생 · 울음감지 · 엄마목소리 · 타이머 (실제 기능 기반) */
import { View, Text, Image, StyleSheet } from 'react-native';
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

export const LULLABY_GUIDE: GuidePage[] = [
  {
    title: '잠들기 좋은 소리를 골라요',
    desc: '모차르트·브람스 자장가부터\n빗소리·파도 같은 백색소음까지',
    visual: (
      <GuideFrame>
        <Image source={IC_LULLABY} style={g.hero} resizeMode="contain" />
        <View style={g.card}>
          <View style={g.trackRow}>
            <View style={g.playBtn}><Text style={g.playIcon}>▶</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={g.trackTitle}>모차르트 자장가</Text>
              <Text style={g.trackSub}>편안하게 잠들어요 · 3:20</Text>
            </View>
          </View>
        </View>
        <View style={[g.row, { marginTop: 8 }]}>
          <GuidePill label="🎵 자장가" color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
          <GuidePill label="🌧️ 백색소음" color={GUIDE_C.blue} bg={GUIDE_C.blueLight} />
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '울면 자동으로 틀어줘요',
    desc: '울음 감지를 켜두면 아이가 울 때\n자장가가 자동으로 재생돼요',
    visual: (
      <GuideFrame>
        <Image source={IC_CRY} style={g.hero} resizeMode="contain" />
        <Text style={g.cap}>👂  울음 감지 자동 재생</Text>
        <View style={g.card}>
          <View style={g.trackRow}>
            <View style={g.recDot} />
            <Text style={g.recText}>울음 감지 중…</Text>
          </View>
        </View>
        <View style={[g.row, { marginTop: 8 }]}>
          <GuidePill label="울음 감지 → 자장가 ON" color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '엄마 목소리로 녹음해요',
    desc: '엄마 목소리로 자장가나 인사를 녹음해\n아이에게 직접 들려줄 수 있어요',
    visual: (
      <GuideFrame>
        <Image source={IC_MIC} style={g.hero} resizeMode="contain" />
        <Text style={g.cap}>🎙️  엄마 목소리 녹음</Text>
        <View style={g.card}>
          <View style={g.trackRow}>
            <View style={[g.playBtn, { backgroundColor: GUIDE_C.red }]}><Text style={g.playIcon}>●</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={g.trackTitle}>엄마의 자장가</Text>
              <Text style={g.trackSub}>녹음해서 언제든 들려주기</Text>
            </View>
          </View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '타이머로 자동 종료',
    desc: '시간을 정해두면 아이가 잠든 뒤\n음악이 알아서 꺼져요',
    visual: (
      <GuideFrame>
        <Image source={IC_SLEEP} style={g.hero} resizeMode="contain" />
        <Text style={g.timer}>30:00</Text>
        <Text style={g.timerSub}>30분 뒤 자동 종료</Text>
        <View style={g.row}>
          <GuidePill label="15분" color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
          <GuidePill label="30분" color="#FFF" filled bg={GUIDE_C.purple} />
          <GuidePill label="60분" color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
        </View>
      </GuideFrame>
    ),
  },
];

export const LULLABY_PRENATAL_GUIDE: GuidePage[] = [
  {
    title: '아기에게 들려주는 태교음악',
    desc: '잔잔한 클래식과 편안한 소리를 골라\n뱃속 아기에게 들려줄 수 있어요',
    visual: (
      <GuideFrame>
        <Image source={IC_MOZART} style={g.hero} resizeMode="contain" />
        <View style={g.card}>
          <View style={g.trackRow}>
            <View style={g.playBtn}><Text style={g.playIcon}>▶</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={g.trackTitle}>잔잔한 클래식</Text>
              <Text style={g.trackSub}>마음이 편안해져요 · 4:10</Text>
            </View>
          </View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '엄마 목소리를 들려주세요',
    desc: '엄마 목소리를 녹음해두면\n뱃속 아기에게 매일 들려줄 수 있어요',
    visual: (
      <GuideFrame>
        <Image source={IC_MIC} style={g.hero} resizeMode="contain" />
        <Text style={g.cap}>🎙️  엄마 목소리 녹음</Text>
        <View style={g.card}>
          <View style={g.trackRow}>
            <View style={[g.playBtn, { backgroundColor: GUIDE_C.red }]}><Text style={g.playIcon}>●</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={g.trackTitle}>아가야 안녕</Text>
              <Text style={g.trackSub}>엄마 목소리가 태교에 좋아요</Text>
            </View>
          </View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '자궁 소리로 편안하게',
    desc: '자궁 소리·심장소리 같은 편안한 소리와\n타이머로 매일 편하게 들려주세요',
    visual: (
      <GuideFrame>
        <Image source={IC_WOMB} style={g.hero} resizeMode="contain" />
        <Text style={g.timer}>20:00</Text>
        <Text style={g.timerSub}>20분 뒤 자동 종료</Text>
        <View style={g.row}>
          <GuidePill label="자궁소리" color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
          <GuidePill label="심장소리" color={GUIDE_C.red} bg={GUIDE_C.redLight} />
        </View>
      </GuideFrame>
    ),
  },
];

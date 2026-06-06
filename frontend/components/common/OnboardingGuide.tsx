/**
 * OnboardingGuide — 앱 첫 실행 환영/사용법 투어.
 * GuideCarousel 기반(목업 + 마스코트). 홈에서 1회 자동 표시.
 */
import { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GuideCarousel, GuideFrame, GUIDE_C, type GuidePage } from './GuideCarousel';

const GUIDE_SHOWN_KEY = 'amatda_onboarding_guide_shown';
const MASCOT_WAVING = require('../../assets/mascot-waving.png') as number;

const m = StyleSheet.create({
  mascotTop: { width: 64, height: 64, alignSelf: 'center', marginBottom: 6 },
  frameCap: { fontSize: 11, fontWeight: '700', color: GUIDE_C.textLight, marginBottom: 8, marginLeft: 2 },

  featRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 5 },
  featIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featLabel: { fontSize: 13.5, fontWeight: '800' },
  featSub: { fontSize: 11.5, color: GUIDE_C.textSub, marginTop: 1 },

  enRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  enLabel: { width: 30, fontSize: 11, fontWeight: '700', color: GUIDE_C.textSub },
  enTrack: { flex: 1, height: 8, backgroundColor: '#EEEEF2', borderRadius: 4, overflow: 'hidden' },
  enFill: { height: '100%', borderRadius: 4 },
  traitPill: { backgroundColor: GUIDE_C.accentSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 10, alignItems: 'center' },
  traitPillText: { fontSize: 11.5, fontWeight: '800', color: '#C2703B' },

  chatRow: { width: '100%', flexDirection: 'row', marginVertical: 3 },
  chatBubble: { maxWidth: '84%', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 11 },
  chatBubbleAI: { backgroundColor: '#FFF', borderWidth: 1, borderColor: GUIDE_C.border },
  chatText: { fontSize: 12, color: GUIDE_C.text, fontWeight: '600', lineHeight: 17 },
  analyzerRow: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'center' },
  analyzerChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  analyzerText: { fontSize: 11.5, fontWeight: '800' },

  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  quickBtnText: { fontSize: 12, fontWeight: '800', color: '#5C564E' },
  inputHintRow: { flexDirection: 'row', gap: 8 },
  inputHint: { flex: 1, backgroundColor: '#FFF', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: GUIDE_C.border },
  inputHintText: { fontSize: 12, fontWeight: '700', color: GUIDE_C.textSub },
  hintLine: { fontSize: 11.5, color: GUIDE_C.textLight, textAlign: 'center', marginTop: 10, fontWeight: '600' },

  famCenter: { alignItems: 'center', marginBottom: 10 },
  famBaby: { fontSize: 11.5, fontWeight: '800', color: GUIDE_C.text, marginTop: 2 },
  famRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  famMember: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: GUIDE_C.border },
  famEmoji: { fontSize: 22 },
  famRole: { fontSize: 11.5, fontWeight: '800', color: GUIDE_C.text, marginTop: 2 },
  famPerm: { fontSize: 10, color: GUIDE_C.textSub, marginTop: 1 },

  tabMap: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  tabItem: { alignItems: 'center', gap: 4 },
  tabLabel: { fontSize: 10.5, fontWeight: '700', color: GUIDE_C.textSub },
  tabHint: { fontSize: 11.5, color: GUIDE_C.textLight, textAlign: 'center', marginTop: 16, fontWeight: '600' },
});

/* ── 작은 목업 빌딩 블록 ── */
function FeatureRow({ emoji, label, sub, color, bg }: { emoji: string; label: string; sub: string; color: string; bg: string }) {
  return (
    <View style={m.featRow}>
      <View style={[m.featIcon, { backgroundColor: bg }]}><Text style={{ fontSize: 18 }}>{emoji}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={[m.featLabel, { color }]}>{label}</Text>
        <Text style={m.featSub}>{sub}</Text>
      </View>
    </View>
  );
}

function EnergyBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={m.enRow}>
      <Text style={m.enLabel}>{label}</Text>
      <View style={m.enTrack}><View style={[m.enFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

function ChatLine({ text, me }: { text: string; me?: boolean }) {
  return (
    <View style={[m.chatRow, me ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
      <View style={[m.chatBubble, me ? { backgroundColor: GUIDE_C.accent } : m.chatBubbleAI]}>
        <Text style={[m.chatText, me && { color: '#FFF' }]}>{text}</Text>
      </View>
    </View>
  );
}

/* ── 페이지 ── */
const PAGES: GuidePage[] = [
  {
    title: '아맞다에 오신 걸 환영해요',
    desc: '우리 아이 기질에 딱 맞춘\n육아 기록 · AI 상담 · 가족 공유를 한 곳에서',
    visual: (
      <GuideFrame>
        <Image source={MASCOT_WAVING} style={m.mascotTop} resizeMode="contain" />
        <FeatureRow emoji="📋" label="아기시간" sub="수유·수면·배변을 간편 기록" color={GUIDE_C.gold} bg={GUIDE_C.goldLight} />
        <FeatureRow emoji="💬" label="상담이모" sub="기질 맞춤 AI 육아 상담" color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
        <FeatureRow emoji="👨‍👩‍👧" label="공동육아" sub="가족과 함께 기록·공유" color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
      </GuideFrame>
    ),
  },
  {
    title: '우리 아이만의 기질을 분석해요',
    desc: '생년월일시로 아이의 타고난 에너지·성향을 분석해\n맞춤 상담과 추천의 기준이 돼요',
    visual: (
      <GuideFrame>
        <Text style={m.frameCap}>🌱  우리 아이 에너지 분포</Text>
        <EnergyBar label="탐구" pct={82} color={GUIDE_C.blue} />
        <EnergyBar label="활동" pct={64} color={GUIDE_C.accent} />
        <EnergyBar label="안정" pct={48} color={GUIDE_C.green} />
        <EnergyBar label="분석" pct={70} color={GUIDE_C.purple} />
        <EnergyBar label="감성" pct={55} color={GUIDE_C.gold} />
        <View style={m.traitPill}><Text style={m.traitPillText}>활동·탐구형 — 호기심 많은 우리 아이</Text></View>
      </GuideFrame>
    ),
  },
  {
    title: '24시간 상담이모에게 물어보세요',
    desc: '아이 기질을 알고 답해주는 AI 상담.\n울음·대변 사진 분석도 상담이모 안에서!',
    visual: (
      <GuideFrame>
        <ChatLine text="밤에 자꾸 깨는데 어떻게 해야 할까요?" me />
        <ChatLine text="활동형 아이는 낮 자극이 많으면 밤에 더 깨요. 자기 전 30분은 조용한 루틴을 만들어볼까요?" />
        <View style={m.analyzerRow}>
          <View style={[m.analyzerChip, { backgroundColor: GUIDE_C.blueLight }]}><Text style={[m.analyzerText, { color: GUIDE_C.blue }]}>🔊 울음 분석</Text></View>
          <View style={[m.analyzerChip, { backgroundColor: GUIDE_C.goldLight }]}><Text style={[m.analyzerText, { color: GUIDE_C.gold }]}>💩 대변 분석</Text></View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '기록은 버튼·음성·사진으로 간편하게',
    desc: '버튼 한 번이면 기록 끝.\n말하거나 어린이집 알림장을 찍으면 AI가 정리해줘요',
    visual: (
      <GuideFrame>
        <View style={m.quickRow}>
          <View style={[m.quickBtn, { backgroundColor: '#EBC97E' }]}><Text style={m.quickBtnText}>분유</Text></View>
          <View style={[m.quickBtn, { backgroundColor: '#BCAEDE' }]}><Text style={m.quickBtnText}>수면</Text></View>
          <View style={[m.quickBtn, { backgroundColor: '#96C7D0' }]}><Text style={m.quickBtnText}>소변</Text></View>
        </View>
        <View style={m.inputHintRow}>
          <View style={m.inputHint}><Text style={m.inputHintText}>🎤  음성 입력</Text></View>
          <View style={m.inputHint}><Text style={m.inputHintText}>📷  사진 인식</Text></View>
        </View>
        <Text style={m.hintLine}>한 번 = 지금 기록 · 길게 = 시간 수정</Text>
      </GuideFrame>
    ),
  },
  {
    title: '가족과 함께 키워요',
    desc: '배우자·조부모를 초대해 같은 아이를 함께 기록.\n역할별로 권한(열람/기록)을 정할 수 있어요',
    visual: (
      <GuideFrame>
        <View style={m.famCenter}><Text style={{ fontSize: 30 }}>👶</Text><Text style={m.famBaby}>우리 아이</Text></View>
        <View style={m.famRow}>
          <View style={m.famMember}><Text style={m.famEmoji}>👩</Text><Text style={m.famRole}>엄마</Text><Text style={m.famPerm}>기록·상담</Text></View>
          <View style={m.famMember}><Text style={m.famEmoji}>👨</Text><Text style={m.famRole}>아빠</Text><Text style={m.famPerm}>기록·상담</Text></View>
          <View style={m.famMember}><Text style={m.famEmoji}>👵</Text><Text style={m.famRole}>할머니</Text><Text style={m.famPerm}>열람만</Text></View>
        </View>
      </GuideFrame>
    ),
  },
  {
    title: '이제 시작해볼까요?',
    desc: '아래 탭에서 모든 기능을 만날 수 있어요.\n각 화면의 ? 버튼을 누르면 사용법을 다시 볼 수 있어요',
    visual: (
      <GuideFrame>
        <View style={m.tabMap}>
          {[
            { e: '🏠', l: '홈' },
            { e: '📋', l: '아기시간' },
            { e: '💬', l: '상담이모' },
            { e: '📸', l: '가족피드' },
            { e: '🙂', l: '마이' },
          ].map((t) => (
            <View key={t.l} style={m.tabItem}>
              <Text style={{ fontSize: 22 }}>{t.e}</Text>
              <Text style={m.tabLabel}>{t.l}</Text>
            </View>
          ))}
        </View>
        <Text style={m.tabHint}>하단 탭으로 언제든 이동해요</Text>
      </GuideFrame>
    ),
  },
];

export function OnboardingGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(GUIDE_SHOWN_KEY).then((v) => { if (!v) setVisible(true); }).catch(() => {});
  }, []);

  const close = async () => {
    setVisible(false);
    try { await AsyncStorage.setItem(GUIDE_SHOWN_KEY, '1'); } catch { /* best-effort */ }
  };

  return <GuideCarousel visible={visible} pages={PAGES} onClose={close} onComplete={close} />;
}

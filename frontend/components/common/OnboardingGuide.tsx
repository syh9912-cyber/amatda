/**
 * OnboardingGuide — 앱 첫 실행 환영/사용법 투어.
 * GuideCarousel 기반(목업 + 마스코트). 홈에서 1회 자동 표시.
 */
import { useState, useEffect, useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
function buildPages(t: TFunction): GuidePage[] {
  const tabHome = t('components.onboardingGuide.tabHome');
  const tabBabyTime = t('components.onboardingGuide.tabBabyTime');
  const tabChatbot = t('components.onboardingGuide.tabChatbot');
  const tabFamilyFeed = t('components.onboardingGuide.tabFamilyFeed');
  const tabMy = t('components.onboardingGuide.tabMy');

  return [
    {
      title: t('components.onboardingGuide.page1.title'),
      desc: t('components.onboardingGuide.page1.desc'),
      visual: (
        <GuideFrame>
          <Image source={MASCOT_WAVING} style={m.mascotTop} resizeMode="contain" />
          <FeatureRow emoji="📋" label={t('components.onboardingGuide.page1.feature1Label')} sub={t('components.onboardingGuide.page1.feature1Sub')} color={GUIDE_C.gold} bg={GUIDE_C.goldLight} />
          <FeatureRow emoji="💬" label={t('components.onboardingGuide.page1.feature2Label')} sub={t('components.onboardingGuide.page1.feature2Sub')} color={GUIDE_C.accent} bg={GUIDE_C.accentSoft} />
          <FeatureRow emoji="👨‍👩‍👧" label={t('components.onboardingGuide.page1.feature3Label')} sub={t('components.onboardingGuide.page1.feature3Sub')} color={GUIDE_C.purple} bg={GUIDE_C.purpleLight} />
        </GuideFrame>
      ),
    },
    {
      title: t('components.onboardingGuide.page2.title'),
      desc: t('components.onboardingGuide.page2.desc'),
      visual: (
        <GuideFrame>
          <Text style={m.frameCap}>{t('components.onboardingGuide.page2.frameCap')}</Text>
          <EnergyBar label={t('components.onboardingGuide.page2.energyExplore')} pct={82} color={GUIDE_C.blue} />
          <EnergyBar label={t('components.onboardingGuide.page2.energyActive')} pct={64} color={GUIDE_C.accent} />
          <EnergyBar label={t('components.onboardingGuide.page2.energyStable')} pct={48} color={GUIDE_C.green} />
          <EnergyBar label={t('components.onboardingGuide.page2.energyAnalytic')} pct={70} color={GUIDE_C.purple} />
          <EnergyBar label={t('components.onboardingGuide.page2.energyEmotional')} pct={55} color={GUIDE_C.gold} />
          <View style={m.traitPill}><Text style={m.traitPillText}>{t('components.onboardingGuide.page2.traitPill')}</Text></View>
        </GuideFrame>
      ),
    },
    {
      title: t('components.onboardingGuide.page3.title'),
      desc: t('components.onboardingGuide.page3.desc'),
      visual: (
        <GuideFrame>
          <ChatLine text={t('components.onboardingGuide.page3.chatMe')} me />
          <ChatLine text={t('components.onboardingGuide.page3.chatAi')} />
          <View style={m.analyzerRow}>
            <View style={[m.analyzerChip, { backgroundColor: GUIDE_C.blueLight }]}><Text style={[m.analyzerText, { color: GUIDE_C.blue }]}>{t('components.onboardingGuide.page3.cryAnalysis')}</Text></View>
            <View style={[m.analyzerChip, { backgroundColor: GUIDE_C.goldLight }]}><Text style={[m.analyzerText, { color: GUIDE_C.gold }]}>{t('components.onboardingGuide.page3.poopAnalysis')}</Text></View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('components.onboardingGuide.page4.title'),
      desc: t('components.onboardingGuide.page4.desc'),
      visual: (
        <GuideFrame>
          <View style={m.quickRow}>
            <View style={[m.quickBtn, { backgroundColor: '#EBC97E' }]}><Text style={m.quickBtnText}>{t('components.onboardingGuide.page4.formula')}</Text></View>
            <View style={[m.quickBtn, { backgroundColor: '#BCAEDE' }]}><Text style={m.quickBtnText}>{t('components.onboardingGuide.page4.sleep')}</Text></View>
            <View style={[m.quickBtn, { backgroundColor: '#96C7D0' }]}><Text style={m.quickBtnText}>{t('components.onboardingGuide.page4.pee')}</Text></View>
          </View>
          <View style={m.inputHintRow}>
            <View style={m.inputHint}><Text style={m.inputHintText}>{t('components.onboardingGuide.page4.voiceInput')}</Text></View>
            <View style={m.inputHint}><Text style={m.inputHintText}>{t('components.onboardingGuide.page4.photoRecognition')}</Text></View>
          </View>
          <Text style={m.hintLine}>{t('components.onboardingGuide.page4.hintLine')}</Text>
        </GuideFrame>
      ),
    },
    {
      title: t('components.onboardingGuide.page5.title'),
      desc: t('components.onboardingGuide.page5.desc'),
      visual: (
        <GuideFrame>
          <View style={m.famCenter}><Text style={{ fontSize: 30 }}>👶</Text><Text style={m.famBaby}>{t('components.onboardingGuide.page5.ourBaby')}</Text></View>
          <View style={m.famRow}>
            <View style={m.famMember}><Text style={m.famEmoji}>👩</Text><Text style={m.famRole}>{t('components.onboardingGuide.page5.mom')}</Text><Text style={m.famPerm}>{t('components.onboardingGuide.page5.permFull')}</Text></View>
            <View style={m.famMember}><Text style={m.famEmoji}>👨</Text><Text style={m.famRole}>{t('components.onboardingGuide.page5.dad')}</Text><Text style={m.famPerm}>{t('components.onboardingGuide.page5.permFull')}</Text></View>
            <View style={m.famMember}><Text style={m.famEmoji}>👵</Text><Text style={m.famRole}>{t('components.onboardingGuide.page5.grandma')}</Text><Text style={m.famPerm}>{t('components.onboardingGuide.page5.permViewOnly')}</Text></View>
          </View>
        </GuideFrame>
      ),
    },
    {
      title: t('components.onboardingGuide.page6.title'),
      desc: t('components.onboardingGuide.page6.desc'),
      visual: (
        <GuideFrame>
          <View style={m.tabMap}>
            {[
              { e: '🏠', l: tabHome },
              { e: '📋', l: tabBabyTime },
              { e: '💬', l: tabChatbot },
              { e: '📸', l: tabFamilyFeed },
              { e: '🙂', l: tabMy },
            ].map((tab) => (
              <View key={tab.l} style={m.tabItem}>
                <Text style={{ fontSize: 22 }}>{tab.e}</Text>
                <Text style={m.tabLabel}>{tab.l}</Text>
              </View>
            ))}
          </View>
          <Text style={m.tabHint}>{t('components.onboardingGuide.page6.tabHint')}</Text>
        </GuideFrame>
      ),
    },
  ];
}

export function OnboardingGuide() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const pages = useMemo(() => buildPages(t), [t]);

  useEffect(() => {
    AsyncStorage.getItem(GUIDE_SHOWN_KEY).then((v) => { if (!v) setVisible(true); }).catch(() => {});
  }, []);

  const close = async () => {
    setVisible(false);
    try { await AsyncStorage.setItem(GUIDE_SHOWN_KEY, '1'); } catch { /* best-effort */ }
  };

  return <GuideCarousel visible={visible} pages={pages} onClose={close} onComplete={close} />;
}

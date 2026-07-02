/**
 * GuideCarousel — 앱 공용 가이드/온보딩 (스포트라이트 코치마크 스타일).
 *
 * 디자인: 실제 화면을 반투명으로 덮고(딤), 그 위에
 *   ① 흰 글씨 캡션(제목+설명) ② 점선 화살표 ③ 밝게 떠 있는 하이라이트 카드(목업)
 * 를 얹어 "실제 화면을 짚어주는" 느낌을 준다. (베이비빌리류 온보딩 톤)
 *
 * 각 화면은 pages(제목/설명/비주얼)만 정의하면 동일한 고급 가이드를 얻는다.
 * 기존 GuidePage API 100% 호환 — 콘텐츠 파일 수정 불필요.
 *
 * - 표시 제어는 부모 담당: visible + onClose(닫기/건너뛰기) + onComplete(마지막 '시작하기').
 * - visual 미지정 시 mascot(있으면) 또는 emoji 히어로 카드를 표시.
 * - accent 로 기능별 강조색 지정(기본 오렌지). 진행점/버튼에 반영.
 *
 * 재사용 헬퍼 export: GUIDE_C(팔레트), GuideFrame(하이라이트 카드), GuidePill, GuideBubble.
 */
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Animated, Platform, Image, type ImageSourcePropType,
} from 'react-native';
import { useTranslation } from 'react-i18next';

/* 공용 팔레트 (아맞다 톤) */
export const GUIDE_C = {
  bg: '#FFFFFF',
  overlay: 'rgba(18,17,24,0.82)',
  /* 톤다운된 부드러운 파스텔 팔레트 (채도↓ — 촌스러움 제거) */
  accent: '#F0976C',
  accentSoft: '#FCF1EA',
  blue: '#7FB1BB',
  blueLight: '#EDF5F6',
  gold: '#D8B071',
  goldLight: '#F8F2E4',
  purple: '#9D8CC6',
  purpleLight: '#F1EDF8',
  green: '#7CA46E',
  greenLight: '#ECF2E6',
  red: '#DB6A5F',
  redLight: '#FAEDEB',
  text: '#2B2B30',
  textSub: '#76767E',
  textLight: '#A6A6AE',
  border: '#ECECF1',
  frame: '#F7F7FB',
} as const;

export interface GuidePage {
  title: string;
  desc: string;
  /** 코드 목업 비주얼(권장). 미지정 시 mascot/emoji 카드 표시 */
  visual?: React.ReactNode;
  /** visual 없을 때 보여줄 마스코트 이미지 */
  mascot?: ImageSourcePropType;
  /** mascot/visual 모두 없을 때 보여줄 이모지 히어로 */
  emoji?: string;
  /** 캡션을 카드 위/아래 어디에 둘지 (기본 'top' = 캡션이 위, 화살표 아래로) */
  captionAt?: 'top' | 'bottom';
}

interface Props {
  visible: boolean;
  pages: GuidePage[];
  onClose: () => void;
  onComplete?: () => void;
  accent?: string;
}

/* ── 점선 화살표 (순수 View — 네이티브 모듈 불필요, 크로스플랫폼 일관) ── */
function DashedArrow({ dir = 'down' }: { dir?: 'down' | 'up' }) {
  const dashes = [0, 1, 2, 3];
  const chevron = dir === 'down' ? '▾' : '▴';
  const col = dir === 'down'
    ? [...dashes.map((i) => <View key={i} style={s.dash} />), <Text key="c" style={s.chevron}>{chevron}</Text>]
    : [<Text key="c" style={s.chevron}>{chevron}</Text>, ...dashes.map((i) => <View key={i} style={s.dash} />)];
  return <View style={s.arrowCol}>{col}</View>;
}

/* ── 하이라이트 카드(목업 컨테이너) — 어두운 딤 위에서 밝게 '뜨는' 카드 ── */
export function GuideFrame({ children }: { children: React.ReactNode }) {
  return <View style={s.mockFrame}>{children}</View>;
}

/* ── 재사용 알약형 칩 ── */
export function GuidePill({ label, color, bg, filled }: { label: string; color: string; bg?: string; filled?: boolean }) {
  return (
    <View style={[s.pill, { backgroundColor: filled ? color : (bg ?? '#EFEFF3') }]}>
      <Text style={[s.pillText, { color: filled ? '#FFF' : color }]}>{label}</Text>
    </View>
  );
}

/* ── 재사용 말풍선(채팅 목업) ── */
export function GuideBubble({ text, me, color }: { text: string; me?: boolean; color?: string }) {
  return (
    <View style={[s.bubbleRow, me ? s.bubbleRowMe : s.bubbleRowOther]}>
      <View style={[s.bubble, me ? { backgroundColor: color ?? GUIDE_C.accent } : s.bubbleOther]}>
        <Text style={[s.bubbleText, me && { color: '#FFF' }]}>{text}</Text>
      </View>
    </View>
  );
}

export function GuideCarousel({ visible, pages, onClose, onComplete, accent = GUIDE_C.accent }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (visible) { setStep(0); fade.setValue(1); slide.setValue(0); } }, [visible]);

  const animateTo = (next: number) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(slide, { toValue: -10, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slide.setValue(12);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  };
  const handleNext = () => {
    if (step < pages.length - 1) animateTo(step + 1);
    else (onComplete ?? onClose)();
  };
  const handlePrev = () => { if (step > 0) animateTo(step - 1); };

  if (!visible || pages.length === 0) return null;
  const page = pages[Math.min(step, pages.length - 1)];
  const isLast = step === pages.length - 1;
  const captionTop = (page.captionAt ?? 'top') === 'top';

  const Caption = (
    <View style={[s.caption, captionTop ? s.captionTop : s.captionBottom]}>
      <Text style={s.title}>{page.title}</Text>
      <Text style={s.desc}>{page.desc}</Text>
    </View>
  );

  const Visual = (
    <View style={s.cardWrap}>
      {page.visual
        ? page.visual
        : (
          <View style={s.mockFrame}>
            {page.mascot
              ? <Image source={page.mascot} style={s.mascot} resizeMode="contain" />
              : <Text style={s.emojiHero}>{page.emoji ?? '✨'}</Text>}
          </View>
        )}
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.overlay}>
        {/* 상단 바: 닫기(좌) · 진행점(중) · 다음/시작하기(우) — 레퍼런스 톤 */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.topSide} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}>
            <Text style={s.topBtnText}>{isLast ? t('common.close') : t('components.guideCarousel.skip')}</Text>
          </TouchableOpacity>
          <View style={s.dots}>
            {pages.map((_, i) => (
              <View key={i} style={[s.dot, i === step ? { backgroundColor: accent, width: 20 } : null]} />
            ))}
          </View>
          <TouchableOpacity style={[s.topSide, s.topSideRight]} onPress={handleNext} hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}>
            <Text style={[s.topNextText, { color: accent }]}>{isLast ? t('components.guideCarousel.start') : t('components.guideCarousel.next')}</Text>
          </TouchableOpacity>
        </View>

        {/* 본문: 캡션 + 점선 화살표 + 하이라이트 카드 */}
        <View style={s.body}>
          <Animated.View style={[s.stage, { opacity: fade, transform: [{ translateY: slide }] }]}>
            {captionTop ? (
              <>
                {Caption}
                <DashedArrow dir="down" />
                {Visual}
              </>
            ) : (
              <>
                {Visual}
                <DashedArrow dir="up" />
                {Caption}
              </>
            )}
          </Animated.View>
        </View>

        {/* 하단: 이전(은은) — 레퍼런스처럼 큰 버튼 없이 미니멀 */}
        <View style={s.bottomBar}>
          {step > 0 && (
            <TouchableOpacity style={s.prevBtn} onPress={handlePrev} hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }} activeOpacity={0.7}>
              <Text style={s.prevText}>{t('components.guideCarousel.prev')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const TOP_INSET = Platform.OS === 'ios' ? 56 : 32;
const BOTTOM_INSET = Platform.OS === 'ios' ? 36 : 22;

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: GUIDE_C.overlay, paddingHorizontal: 22 },

  topBar: {
    position: 'absolute', top: TOP_INSET, left: 22, right: 22, height: 30,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topSide: { minWidth: 64, justifyContent: 'center' },
  topSideRight: { alignItems: 'flex-end' },
  topBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  topNextText: { fontSize: 14.5, fontWeight: '700', letterSpacing: 0.2 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },

  body: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingTop: TOP_INSET + 46, paddingBottom: BOTTOM_INSET + 40,
  },
  stage: { width: '100%', maxWidth: 440, alignItems: 'center' },

  caption: { width: '100%', alignItems: 'center', paddingHorizontal: 6 },
  captionTop: { marginBottom: 4 },
  captionBottom: { marginTop: 4 },
  title: {
    fontSize: 21, fontWeight: '800', color: '#FFFFFF', textAlign: 'center',
    letterSpacing: -0.2, marginBottom: 10, lineHeight: 29,
    textShadowColor: 'rgba(0,0,0,0.24)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  desc: {
    fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22, textAlign: 'center', fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  arrowCol: { alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  dash: { width: 2.5, height: 6, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)', marginVertical: 2.5 },
  chevron: { color: 'rgba(255,255,255,0.9)', fontSize: 17, lineHeight: 17, marginTop: 1 },

  cardWrap: { width: '100%', alignItems: 'center' },
  mockFrame: {
    width: '100%', backgroundColor: GUIDE_C.frame, borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 18, paddingHorizontal: 16, minHeight: 210, justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.34, shadowRadius: 30 },
      android: { elevation: 16 },
    }),
  },
  mascot: { width: 120, height: 120, alignSelf: 'center' },
  emojiHero: { fontSize: 64, textAlign: 'center' },

  pill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, alignItems: 'center' },
  pillText: { fontSize: 11.5, fontWeight: '700' },

  bubbleRow: { width: '100%', flexDirection: 'row', marginVertical: 4 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  bubbleOther: { backgroundColor: '#F4F4F7', borderWidth: 1, borderColor: GUIDE_C.border },
  bubbleText: { fontSize: 12.5, color: GUIDE_C.text, fontWeight: '600', lineHeight: 18 },

  bottomBar: {
    position: 'absolute', bottom: BOTTOM_INSET, left: 22, right: 22,
    alignItems: 'center', minHeight: 24,
  },
  prevBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  prevText: { fontSize: 13.5, fontWeight: '500', color: 'rgba(255,255,255,0.65)' },
});

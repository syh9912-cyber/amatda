/**
 * EditorialCover — 기질 리포트 표지 (Editorial-style cover).
 *
 * - 5가지 기질마다 다른 그라디언트 배경
 * - 상단 메타: "아맞다 · 기질 리포트" + 날짜
 * - VOL. 라벨 + 아이 이름·개월
 * - 중앙: 기질 이모지 + "주성향 · X" + 큰 라벨 + 설명
 * - 5개 기질 점수 박스 (탐구/활동/안정/결단/지혜)
 * - "리포트 자세히 보기" 버튼 → onSeeDetail
 *
 * ⚠️ 사주/오행 용어(火/木/水/金/土) UI 노출 절대 금지 — 기질명만 사용.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, RadialGradient, Defs, Stop, Circle } from 'react-native-svg';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface FiveElements {
  wood?: number;
  fire?: number;
  earth?: number;
  metal?: number;
  water?: number;
}

interface Props {
  childName: string;
  ageMonths: number;
  dominantType: string; // e.g. "탐구형"
  label: string; // e.g. "탐구형 활동가" (or with "(0~36개월)" prefix to strip)
  fiveElements?: FiveElements | null;
  description?: string;
  /** 풀스크린 레이아웃 (배경/패딩 확장) */
  fullScreen?: boolean;
  /**
   * 컴팩트 모드 — ConicDisc/spacing 축소. 광고 활성 시 cover 영역 50pt 축소되어
   * statsRow value 잘리는 문제 방지용. false(기본)면 원래 사이즈.
   */
  compact?: boolean;
  /** CTA 클릭 핸들러. undefined 면 CTA 자체 숨김 (풀 리포트 안에 표지 삽입 시 사용). */
  onSeeDetail?: () => void;
}

/** 기질 표시 매핑 — 내부 fiveElements 키 → 화면용 기질 라벨. 오행 단어 노출 금지. */
const TRAITS: { key: keyof FiveElements; label: string }[] = [
  { key: 'wood', label: '탐구' },
  { key: 'fire', label: '활동' },
  { key: 'earth', label: '안정' },
  { key: 'metal', label: '결단' },
  { key: 'water', label: '지혜' },
];

/**
 * Hero disc — 일식/월식 풍 어두운 구체 + 외곽 골드 코로나 글로우 + 중앙 작은 4점 별.
 *
 * 사용자 reference 디자인 매칭:
 *  - 가운데 어두운 갈색 구체 (radial: 중앙은 살짝 밝은 갈색 → 외곽은 흑색)
 *  - 구체 외곽에 따뜻한 골드 글로우 (코로나 효과)
 *  - 정중앙 작은 4-pointed star (황금)
 *
 * 캔버스 비율: hero 영역에 글로우까지 포함하려면 size = 2 × disc_radius.
 */
function ConicDisc({ size, dominantType }: { size: number; dominantType: string }) {
  const colors = TYPE_DISC_COLORS[dominantType] ?? DEFAULT_DISC_COLORS;
  const cx = size / 2;
  const cy = size / 2;
  const discR = size * 0.32;        // 검은 구체 반지름
  const haloR = size * 0.46;        // 글로우 외곽 반지름
  const starOuter = size * 0.06;
  const starInner = size * 0.018;

  // 4-pointed star path (정중앙 cx,cy)
  const sp = (a: number, r: number) => {
    const rad = (a * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  // 8 points alternating outer/inner, starting at top (-90deg)
  const starPoints: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = -90 + i * 45;
    starPoints.push(sp(a, i % 2 === 0 ? starOuter : starInner));
  }
  const starPath = `M ${starPoints.join(' L ')} Z`;

  return (
    <Svg width={size} height={size}>
      <Defs>
        {/* 외곽 코로나 — dominantType 별 액센트 색 글로우 */}
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <Stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <Stop offset="68%" stopColor={colors.halo[0]} stopOpacity="0.55" />
          <Stop offset="78%" stopColor={colors.halo[1]} stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </RadialGradient>
        {/* 검은 구체 본체 — 살짝 위쪽에 하이라이트 (35%, 35%) */}
        <RadialGradient id="orb" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
          <Stop offset="0%" stopColor="#2A1F18" />
          <Stop offset="55%" stopColor="#150E08" />
          <Stop offset="100%" stopColor="#080404" />
        </RadialGradient>
        {/* 별 — dominantType 액센트 그라데이션 */}
        <RadialGradient id="star" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.star[0]} />
          <Stop offset="60%" stopColor={colors.star[1]} />
          <Stop offset="100%" stopColor={colors.star[2]} />
        </RadialGradient>
      </Defs>

      {/* 1) 외곽 골드 글로우 (코로나) */}
      <Circle cx={cx} cy={cy} r={haloR} fill="url(#halo)" />

      {/* 2) 검은 구체 */}
      <Circle cx={cx} cy={cy} r={discR} fill="url(#orb)" />

      {/* 3) 구체 안쪽 림 — 가장자리 골드 라인 */}
      <Circle
        cx={cx}
        cy={cy}
        r={discR}
        fill="none"
        stroke="rgba(230,168,120,0.35)"
        strokeWidth={1.2}
      />

      {/* 4) 중앙 4점 별 */}
      <Path d={starPath} fill="url(#star)" />
    </Svg>
  );
}

/** dominantType → 주성향 한 단어 라벨 */
const TYPE_PRIMARY_LABEL: Record<string, string> = {
  탐구형: '탐구',
  활동형: '활동',
  조화형: '안정',
  분석형: '결단',
  감성형: '지혜',
};

/**
 * dominantType 별 다크 모드 그라디언트 — 원래 다크 브라운 베이스 유지 +
 * type 별 살짝 다른 hue 로 시각 차별화. 어두운 톤이라 차분/고급.
 */
export const TYPE_GRADIENT: Record<string, [string, string, string]> = {
  탐구형: ['#3A2818', '#1F1208', '#0A0604'], // warm amber dark
  활동형: ['#3A1A18', '#1F0A08', '#0A0404'], // crimson dark
  조화형: ['#1F2F1F', '#0F1A0F', '#050A05'], // forest dark
  분석형: ['#1A1F3A', '#0F1224', '#05060A'], // navy dark
  감성형: ['#2A1A3A', '#1A0F24', '#0A050A'], // plum dark
};
const DEFAULT_GRADIENT: [string, string, string] = TYPE_GRADIENT.분석형;

/** primary 텍스트/액센트 색 — 다크 배경 위 밝은 액센트 (가독성) */
const TYPE_PRIMARY_COLOR: Record<string, string> = {
  탐구형: '#FCD34D', // amber 300
  활동형: '#FB7185', // rose 400
  조화형: '#6EE7B7', // emerald 300
  분석형: '#93C5FD', // blue 300
  감성형: '#C4B5FD', // violet 300
};

/**
 * dominantType 별 ConicDisc halo/star 액센트 색 — 배경 hue 와 매칭.
 * halo: [outer, mid] (외곽 글로우), star: [outer, mid, inner] (4점 별 그라디언트).
 */
const TYPE_DISC_COLORS: Record<string, { halo: [string, string]; star: [string, string, string] }> = {
  탐구형: { halo: ['#FCD34D', '#B45309'], star: ['#FEF3C7', '#FCD34D', '#B45309'] },
  활동형: { halo: ['#FB7185', '#9F1239'], star: ['#FECDD3', '#FB7185', '#9F1239'] },
  조화형: { halo: ['#6EE7B7', '#047857'], star: ['#D1FAE5', '#6EE7B7', '#047857'] },
  분석형: { halo: ['#93C5FD', '#1E40AF'], star: ['#DBEAFE', '#93C5FD', '#1E40AF'] },
  감성형: { halo: ['#C4B5FD', '#6D28D9'], star: ['#EDE9FE', '#C4B5FD', '#6D28D9'] },
};
const DEFAULT_DISC_COLORS = TYPE_DISC_COLORS.분석형;

/** dominantType → 5가지 아키타입 짧은 라벨 (예: "탐구형 활동가") */
const TYPE_ARCHETYPE: Record<string, string> = {
  탐구형: '탐구형 활동가',
  활동형: '활동형 도전자',
  조화형: '안정형 협력가',
  분석형: '지혜형 연구가',
  감성형: '감성형 공감가',
};

/** dominantType → 3줄 짧은 설명 (간결·구체적, 추상어 지양) */
const TYPE_DESC: Record<string, string> = {
  탐구형: '호기심이 많고 새 것을 좋아해요\n손으로 만지며 배우는 걸 즐겨요\n자극이 풍부할 때 가장 빛나요',
  활동형: '몸으로 움직일 때 즐거워요\n달리고 뛰는 활동을 좋아해요\n직접 해봐야 만족하는 아이예요',
  조화형: '익숙한 사람·환경에서 편해요\n친구·가족과 어울려 잘 놀아요\n다정하고 협력적인 아이예요',
  분석형: '규칙·순서를 잘 지켜요\n관찰하며 차근차근 익혀요\n반복과 정리를 즐겨요',
  감성형: '주변 분위기를 잘 알아채요\n다른 사람 마음에 공감해요\n섬세하고 표현이 풍부해요',
};

function todayKo(): string {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function ageLabel(months: number): string {
  if (months <= 0) return '신생아';
  if (months < 12) return `${months}개월`;
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${yrs}세` : `${yrs}세 ${rem}개월`;
}

/** "(0~36개월) 탐구형 활동가" → "탐구형 활동가" 처럼 연령 prefix 제거 */
function stripAgePrefix(s: string): string {
  return s.replace(/^\(\d+~?\d*개월\)\s*/, '').replace(/^\(초등\s*\d+~?\d*학년\)\s*/, '');
}

/**
 * dominantType 기반 아키타입 라벨 우선 반환.
 * 백엔드 label이 추상적이거나 길어도 "탐구형 활동가" 식으로 강제 정리.
 */
function shortLabel(_label: string, dominantType: string): string {
  return TYPE_ARCHETYPE[dominantType] ?? dominantType;
}

export function EditorialCover({
  childName,
  ageMonths,
  dominantType,
  label,
  fiveElements,
  description,
  fullScreen,
  compact,
  onSeeDetail,
}: Props) {
  const primary = TYPE_PRIMARY_LABEL[dominantType] ?? '균형';
  const primaryColor = TYPE_PRIMARY_COLOR[dominantType] ?? '#93C5FD';
  // dominantType 별 코발트 톤 그라디언트
  const gradient = TYPE_GRADIENT[dominantType] ?? DEFAULT_GRADIENT;
  // 표지 설명은 항상 짧고 구체적인 fallback 사용 (백엔드 summary는 길고 추상적이라 상세 페이지에서만 표시)
  const desc = TYPE_DESC[dominantType] || '아이만의 고유한 기질이에요.';
  const titleText = shortLabel(label || dominantType, dominantType);
  // description prop은 향후 확장용 (현재는 미사용)
  void description;

  const score = (k: keyof FiveElements): number => {
    const v = fiveElements?.[k];
    if (typeof v !== 'number') return 0;
    return Math.max(0, Math.min(100, Math.round(v)));
  };

  // LinearGradient 제거 — 평평한 단색. fullScreen / card 둘 다 View.
  const Container = View;
  // compact: 광고 활성 시 cover 영역 50pt 축소 흡수용 패딩 축소.
  const fullScreenStyle = compact
    ? [styles.fullScreen, styles.fullScreenCompact]
    : styles.fullScreen;
  // gradient 배열 첫 색을 단색 배경으로 사용
  const cardBg = Array.isArray(gradient) && gradient.length > 0 ? gradient[0] : '#FFF4EE';
  const containerProps = fullScreen
    ? { style: fullScreenStyle }
    : { style: [styles.card, { backgroundColor: cardBg }] };
  // ConicDisc + heroWrap 사이즈는 compact 에서만 작게.
  const heroSize = compact ? 130 : 150;
  const heroWrapStyle = compact
    ? [styles.heroWrap, styles.heroWrapCompact]
    : styles.heroWrap;
  const descStyle = compact ? [styles.desc, styles.descCompact] : styles.desc;

  return (
    <Container {...(containerProps as React.ComponentProps<typeof View>)}>
      <View>
        {/* Top meta — 영문 매거진 톤 */}
        <View style={styles.metaRow}>
          <Text style={styles.metaLeft}>{'INNATE TEMPERAMENT REPORT'}</Text>
          <Text style={styles.metaRight}>{todayKo()}</Text>
        </View>

        {/* Vol */}
        <Text style={styles.vol}>{'VOL. 01'}</Text>
        <Text style={styles.subject}>{`${childName} · ${ageLabel(ageMonths)}`}</Text>
      </View>

      {/* Center hero — conic gradient disc, dominantType 별 halo/star 액센트 색 매칭.
          compact=true (광고 활성) 일 때 ConicDisc/spacing 작게 → statsRow 잘림 방지. */}
      <View style={styles.center}>
        <View style={heroWrapStyle}>
          <ConicDisc size={heroSize} dominantType={dominantType} />
        </View>

        <Text style={[styles.primaryLabel, { color: primaryColor }]}>{`주성향 · ${primary}`}</Text>
        <Text style={styles.title}>{titleText}</Text>
        <Text style={descStyle}>{desc}</Text>
      </View>

      <View>
        {/* 5 stat boxes */}
        {fiveElements ? (
          <View style={styles.statsRow}>
            {TRAITS.map((t) => (
              <View key={t.key} style={styles.statBox}>
                <Text style={styles.statLabel}>{t.label}</Text>
                <Text style={styles.statValue}>{score(t.key)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* CTA — onSeeDetail 없으면 hide (풀 리포트 안 표지에선 불필요) */}
        {onSeeDetail && (
          <TouchableOpacity style={styles.cta} onPress={onSeeDetail} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{'READ THE FULL REPORT  →'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    // 스크롤형: 자연 높이로 위에서부터 쌓임 (flex:1 fit / space-between 제거 →
    // 광고·작은 화면에서도 점수/버튼이 안 잘리고, 넘치면 스크롤됨).
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  // compact 분기 — 광고 활성 시만 cover 영역 50pt 축소 흡수.
  fullScreenCompact: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  card: {
    borderRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 22,
    marginBottom: 18,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  metaLeft: {
    color: '#E0C8B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metaRight: {
    color: '#E0C8B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  vol: {
    color: '#FFD2A8',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 6,
  },
  subject: {
    color: '#F5E6D8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 22,
  },
  center: {
    alignItems: 'center',
  },
  heroWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroWrapCompact: {
    width: 130,
    height: 130,
    marginBottom: 6,
  },
  primaryLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 12,
  },
  desc: {
    color: '#E8D8C8',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  descCompact: {
    lineHeight: 19,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
    marginTop: 6,
    marginBottom: 4,
  },
  statBox: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    // 광고 활성 시 cover 압축으로 value(점수) 잘림 방지 — 최소 height 보장
    minHeight: 50,
  },
  statLabel: {
    color: '#D9C5B5',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  cta: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: '#1C1C1E',
    fontSize: 15,
    fontWeight: '900',
  },
});

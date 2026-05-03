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
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
  onSeeDetail: () => void;
}

/** 기질 표시 매핑 — 내부 fiveElements 키 → 화면용 기질 라벨. 오행 단어 노출 금지. */
const TRAITS: { key: keyof FiveElements; label: string }[] = [
  { key: 'wood', label: '탐구' },
  { key: 'fire', label: '활동' },
  { key: 'earth', label: '안정' },
  { key: 'metal', label: '결단' },
  { key: 'water', label: '지혜' },
];

/** dominantType → 표지 상징 PNG (배경 없는 심볼릭 이미지) */
const TYPE_ICON: Record<string, ImageSourcePropType> = {
  탐구형: require('../../assets/quick-sprout.png'),     // 새싹 = 호기심·탐구
  활동형: require('../../assets/academy-sports.png'),   // 스포츠 = 에너지·활동
  조화형: require('../../assets/icon-heart.png'),       // 하트 = 따뜻함·조화
  분석형: require('../../assets/quick-report.png'),     // 차트 = 분석·관찰
  감성형: require('../../assets/preg-leaf.png'),        // 잎 = 섬세함·감성
};
const FALLBACK_ICON: ImageSourcePropType = require('../../assets/icon-heart.png');

/** dominantType → 주성향 한 단어 라벨 */
const TYPE_PRIMARY_LABEL: Record<string, string> = {
  탐구형: '탐구',
  활동형: '활동',
  조화형: '안정',
  분석형: '결단',
  감성형: '지혜',
};

/** dominantType → 그라디언트 배경 (5가지 성향마다 다른 톤) */
const TYPE_GRADIENT: Record<string, [string, string, string]> = {
  탐구형: ['#5A2E1A', '#3A1A0E', '#1A0A05'], // 따뜻한 갈색·주황 톤 (불·열정)
  활동형: ['#5A1F1F', '#3A0F0F', '#1A0505'], // 빨강·오렌지 (에너지)
  조화형: ['#1F4A38', '#0F2D24', '#051A12'], // 초록·민트 (안정·자연)
  분석형: ['#1F2E5A', '#0F1B3A', '#05101A'], // 네이비·블루 (이성)
  감성형: ['#4A1F50', '#2D0F35', '#1A0520'], // 퍼플·핑크 (감성)
};

const TYPE_PRIMARY_COLOR: Record<string, string> = {
  탐구형: '#FF8C5A',
  활동형: '#FF6B6B',
  조화형: '#5CCB9E',
  분석형: '#7C9CFF',
  감성형: '#C490E8',
};

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
  onSeeDetail,
}: Props) {
  const heroIcon = TYPE_ICON[dominantType] ?? FALLBACK_ICON;
  const primary = TYPE_PRIMARY_LABEL[dominantType] ?? '균형';
  const primaryColor = TYPE_PRIMARY_COLOR[dominantType] ?? '#FF8C5A';
  const gradient = TYPE_GRADIENT[dominantType] ?? ['#3A1F18', '#2A1410', '#1A0E0B'];
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

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={fullScreen ? styles.fullScreen : styles.card}
    >
      <View>
        {/* Top meta */}
        <View style={styles.metaRow}>
          <Text style={styles.metaLeft}>{'아맞다 · 기질 리포트'}</Text>
          <Text style={styles.metaRight}>{todayKo()}</Text>
        </View>

        {/* Vol */}
        <Text style={styles.vol}>{'VOL. 01'}</Text>
        <Text style={styles.subject}>{`${childName}, ${ageLabel(ageMonths)}`}</Text>
      </View>

      {/* Center hero */}
      <View style={styles.center}>
        <View style={styles.heroWrap}>
          <View style={[styles.heroGlow, { backgroundColor: `${primaryColor}33` }]} />
          <Image source={heroIcon} style={styles.heroIcon} resizeMode="contain" />
        </View>

        <Text style={[styles.primaryLabel, { color: primaryColor }]}>{`주성향 · ${primary}`}</Text>
        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.desc}>{desc}</Text>
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

        {/* CTA */}
        <TouchableOpacity style={styles.cta} onPress={onSeeDetail} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{'리포트 자세히 보기'}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    minHeight: SCREEN_HEIGHT,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'space-between',
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
    marginBottom: 4,
  },
  subject: {
    color: '#F5E6D8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 22,
  },
  center: {
    alignItems: 'center',
  },
  heroWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.5,
  },
  heroIcon: {
    width: 100,
    height: 100,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 18,
  },
  desc: {
    color: '#E8D8C8',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  statLabel: {
    color: '#D9C5B5',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  cta: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
  },
  ctaText: {
    color: '#1C1C1E',
    fontSize: 15,
    fontWeight: '900',
  },
});

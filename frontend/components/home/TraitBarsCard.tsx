/**
 * TraitBarsCard — 5 기질 막대 (영아 mode 전용)
 *
 * 사주 fiveElements 비율 → 5트레이트로 매핑
 *  - wood (목)  → 탐구
 *  - fire (화)  → 활동
 *  - metal (금) → 집중
 *  - earth (토) → 사회성
 *  - water (수) → 감수성
 *
 * 우상단에 dominantType 라벨 ("탐구형 활동기" 등) 표시
 * 카드 탭 → 기질 상세 페이지
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

interface InnateData {
  fiveElements?: { wood?: number; fire?: number; earth?: number; metal?: number; water?: number };
  label?: string;
  dominantType?: string;
}

interface Child {
  id: string;
  innateData?: InnateData;
  ageInfo?: { months: number; group: string };
}

interface Props {
  child: Child;
}

const COLOR = {
  card: '#FFFFFF',
  border: '#E5E5EA',
  text: '#1C1C1E',
  textSub: '#636366',
  // 트레이트별 색
  curious: '#FF8C5A',  // 탐구
  active:  '#FBC02D',  // 활동
  focus:   '#E91E63',  // 집중
  social:  '#43A047',  // 사회성
  feeling: '#42A5F5',  // 감수성
  trackBg: '#F2F2F7',
};

interface Trait {
  key: 'wood' | 'fire' | 'metal' | 'earth' | 'water';
  label: string;
  emoji: string;
  color: string;
}

const TRAITS: Trait[] = [
  { key: 'wood',  label: '탐구',  emoji: '🔍', color: COLOR.curious },
  { key: 'fire',  label: '활동',  emoji: '⚡', color: COLOR.active },
  { key: 'metal', label: '집중',  emoji: '🎯', color: COLOR.focus },
  { key: 'earth', label: '사회성', emoji: '💬', color: COLOR.social },
  { key: 'water', label: '감수성', emoji: '💧', color: COLOR.feeling },
];

function getAgeStageLabel(months: number): string {
  if (months <= 12) return '신생아기';
  if (months <= 24) return '영아기';
  if (months <= 36) return '활동기';
  if (months <= 60) return '유아기';
  if (months <= 84) return '학령전기';
  return '학령기';
}

export function TraitBarsCard({ child }: Props) {
  const fe = child.innateData?.fiveElements;
  if (!fe) return null;

  // fiveElements는 백엔드에서 이미 0~100 percent (합=100)으로 정규화됨
  // 단, 시각적 가독성을 위해 막대 길이만 1.5배 확대 (최대 100 clamp)
  // 5개 합 100이라 평균 20 → 막대 평균 30으로 보임 (mockup 시인성 비슷)
  const visualBoost = (v?: number) =>
    Math.max(0, Math.min(100, Math.round((v ?? 0) * 1.5)));
  // 점수 표시는 원본 percent 그대로
  const realPct = (v?: number) => Math.max(0, Math.min(100, Math.round(v ?? 0)));
  const scores: Record<Trait['key'], number> = {
    wood: realPct(fe.wood),
    fire: realPct(fe.fire),
    metal: realPct(fe.metal),
    earth: realPct(fe.earth),
    water: realPct(fe.water),
  };
  const fillWidths: Record<Trait['key'], number> = {
    wood: visualBoost(fe.wood),
    fire: visualBoost(fe.fire),
    metal: visualBoost(fe.metal),
    earth: visualBoost(fe.earth),
    water: visualBoost(fe.water),
  };

  // dominantType 추출
  const fullLabel = child.innateData?.label ?? '';
  const typeMatch = fullLabel.match(/(탐구형|활동형|조화형|분석형|감성형)/);
  const typeName = typeMatch ? typeMatch[1] : (child.innateData?.dominantType ?? '');

  // 연령 단계 라벨
  const ageStage = getAgeStageLabel(child.ageInfo?.months ?? 0);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/(main)/trait-detail' as never)}
      activeOpacity={0.85}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>기질 분석</Text>
        {typeName ? (
          <Text style={styles.headerBadge}>
            <Text style={styles.headerBadgeStrong}>{typeName}</Text>
            <Text style={styles.headerBadgeWeak}>{` ${ageStage}`}</Text>
          </Text>
        ) : null}
      </View>

      <View style={styles.barsRow}>
        {TRAITS.map((t) => {
          const s = scores[t.key];
          const w = fillWidths[t.key];
          return (
            <View key={t.key} style={styles.barCol}>
              <Text style={styles.barEmoji}>{t.emoji}</Text>
              <Text style={styles.barLabel}>{t.label}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${w}%`, backgroundColor: t.color },
                  ]}
                />
              </View>
              <Text style={[styles.barScore, { color: t.color }]}>{s}</Text>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.card,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLOR.text,
  },
  headerBadge: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerBadgeStrong: {
    color: COLOR.curious,
    fontWeight: '900',
  },
  headerBadgeWeak: {
    color: COLOR.textSub,
    fontWeight: '600',
  },
  barsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barEmoji: {
    fontSize: 12,
    marginBottom: 0,
  },
  barLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: 2,
  },
  barTrack: {
    width: '90%',
    height: 4,
    borderRadius: 3,
    backgroundColor: COLOR.trackBg,
    overflow: 'hidden',
    marginBottom: 1,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  barScore: {
    fontSize: 11,
    fontWeight: '900',
  },
});

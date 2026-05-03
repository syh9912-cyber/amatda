/**
 * AIAnalysisRow — AI 분석 3-카드 (가로 정렬, 모드 자동 분기)
 *
 * 영아: 육아 패턴 / 대변 분석 / 울음 분석
 * 임신부: 식단·영양 / 태동 패턴 / 컨디션 추세
 *
 * 우상단 "전체 →" 링크 → 자세한 분석 페이지 (옵션)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { router } from 'expo-router';
import { useAIAnalysisData } from './useAIAnalysisData';

interface Child {
  id: string;
  isPregnant?: boolean;
  pregnancyWeeks?: number;
}

interface Props {
  child: Child;
}

const COLOR = {
  card: '#FFFFFF',
  border: '#E5E5EA',
  text: '#1C1C1E',
  textSub: '#636366',
  // 카드 배경 톤
  warmYellow: '#FFF8E7',
  blue: '#E6F3FF',
  pink: '#FCE4EC',
  green: '#E8F5E9',
  purple: '#F3E5F5',
};

const ASSETS = {
  catEating: require('../../assets/cat-eating.png') as ImageSourcePropType,
  catPoop: require('../../assets/cat-poop.png') as ImageSourcePropType,
  catCrying: require('../../assets/cat-crying.png') as ImageSourcePropType,
  pregLeaf: require('../../assets/preg-leaf.png') as ImageSourcePropType,
  pregFoot: require('../../assets/preg-foot.png') as ImageSourcePropType,
  pregMoodGood: require('../../assets/preg-mood-good.png') as ImageSourcePropType,
  quickPill: require('../../assets/quick-pill.png') as ImageSourcePropType,
};

interface AnalysisCard {
  icon: ImageSourcePropType;
  bg: string;
  title: string;       // "육아 패턴"
  status: string;      // "수유 +1h"
  statusColor?: string;
  route?: string;      // 탭 시 이동
}

function getCardsBase(isPregnant: boolean): AnalysisCard[] {
  if (isPregnant) {
    // 옵션 1: 영양제 7일 / 컨디션 7일 / 이번 주 핵심
    return [
      {
        icon: ASSETS.quickPill,
        bg: COLOR.green,
        title: '영양제',
        status: '—',
        statusColor: '#43A047',
      },
      {
        icon: ASSETS.pregMoodGood,
        bg: COLOR.pink,
        title: '컨디션',
        status: '—',
        statusColor: '#E91E63',
      },
      {
        icon: ASSETS.pregLeaf,
        bg: COLOR.warmYellow,
        title: '이번 주',
        status: '—',
        statusColor: '#F57C00',
        route: '/(main)/pregnancy',
      },
    ];
  }
  return [
    {
      icon: ASSETS.catEating,
      bg: COLOR.warmYellow,
      title: '육아 패턴',
      status: '—',
      statusColor: '#F57C00',
      route: '/(main)/baby-tracker',
    },
    {
      icon: ASSETS.catPoop,
      bg: COLOR.blue,
      title: '대변 분석',
      status: '—',
      statusColor: '#1976D2',
      route: '/(main)/poop-analyzer',
    },
    {
      icon: ASSETS.catCrying,
      bg: COLOR.purple,
      title: '컨디션',
      status: '—',
      statusColor: '#8E24AA',
      route: '/(main)/cry-analyzer',
    },
  ];
}

export function AIAnalysisRow({ child }: Props) {
  const data = useAIAnalysisData(child);
  const baseCards = getCardsBase(!!child.isPregnant);
  // status 동적 주입
  const cards = baseCards.map((c, idx) => ({
    ...c,
    status: data.cards[idx] || c.status,
  }));
  const title = child.isPregnant ? 'AI 임신 분석' : 'AI 분석';

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity
          onPress={() => router.push('/(main)/baby-tracker' as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.headerLink}>전체 →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        {cards.map((c, idx) => (
          <React.Fragment key={c.title}>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: c.bg }]}
              onPress={() => c.route && router.push(c.route as never)}
              activeOpacity={c.route ? 0.85 : 1}
            >
              <Image source={c.icon} style={styles.cardIcon} resizeMode="contain" />
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={[styles.cardStatus, { color: c.statusColor ?? COLOR.text }]}>
                {c.status}
              </Text>
            </TouchableOpacity>
            {idx < cards.length - 1 && <View style={styles.gap} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginVertical: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    paddingHorizontal: 2,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLOR.text,
  },
  headerLink: {
    fontSize: 10,
    fontWeight: '700',
    color: COLOR.textSub,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: COLOR.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: 4,
  },
  card: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  gap: {
    width: 4,
  },
  cardIcon: {
    width: 24,
    height: 24,
    marginBottom: 1,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: 0,
  },
  cardStatus: {
    fontSize: 11,
    fontWeight: '900',
  },
});

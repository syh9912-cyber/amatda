import { View, Text, StyleSheet } from 'react-native';
import { Child } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  child: Child;
}

interface CardData {
  title: string;
  description: string;
  color: string;
}

function getCardsForAge(child: Child): CardData[] {
  const group = child.ageInfo.group;

  if (group === 'infant') {
    return [
      {
        title: '이유식 가이드',
        description: '아이의 기질에 맞는 이유식 식단을 확인하세요',
        color: COLORS.secondary,
      },
      {
        title: '수면 패턴 체크',
        description: '건강한 수면 습관을 위한 체크리스트',
        color: COLORS.water,
      },
      {
        title: '월간 도담 교구',
        description: '기질 맞춤 교구 구독으로 발달을 도와주세요',
        color: COLORS.fire,
      },
    ];
  }

  if (group === 'toddler') {
    return [
      {
        title: '감각 놀이 활동',
        description: '오감을 자극하는 놀이 활동을 추천합니다',
        color: COLORS.wood,
      },
      {
        title: '또래 상호작용',
        description: '사회성 발달을 위한 또래 활동 가이드',
        color: COLORS.earth,
      },
      {
        title: '체험센터 추천',
        description: '근처 체험센터와 놀이 공간을 찾아보세요',
        color: COLORS.metal,
      },
      {
        title: '교구 구독',
        description: '기질에 맞는 월간 교구 배송 서비스',
        color: COLORS.fire,
      },
    ];
  }

  // elementary
  return [
    {
      title: '학습 성향 분석',
      description: '기질에 맞는 학습 방법을 알아보세요',
      color: COLORS.primary,
    },
    {
      title: '학원 추천',
      description: '우리 동네 기질 맞춤 학원을 찾아보세요',
      color: COLORS.wood,
    },
    {
      title: '두뇌 영양 가이드',
      description: '집중력과 두뇌 발달을 위한 영양 식단',
      color: COLORS.metal,
    },
    {
      title: '교구 구독',
      description: '사고력 향상을 위한 월간 교구',
      color: COLORS.fire,
    },
  ];
}

export function AgeCards({ child }: Props) {
  const cards = getCardsForAge(child);

  return (
    <View style={styles.container}>
      {cards.map((card, idx) => (
        <View key={idx} style={styles.card}>
          <View style={[styles.dot, { backgroundColor: card.color }]} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDesc}>{card.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.md },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: SPACING.md,
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

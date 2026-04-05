import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Child } from '../../stores/childStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

interface Props {
  child: Child;
}

interface CardData {
  title: string;
  emoji: string;
  route?: string;
}

function getCardsForAge(child: Child): CardData[] {
  const group = child.ageInfo.group;

  if (group === 'infant') {
    return [
      { title: '이유식', emoji: '🍼', route: '/(main)/nutrition' },
      { title: '하루일기', emoji: '📔', route: '/(main)/diary' },
      { title: '교구 구독', emoji: '📦', route: '/(main)/subscription' },
      { title: '성장 기록', emoji: '📋', route: '/(main)/report' },
    ];
  }

  if (group === 'toddler') {
    return [
      { title: '감각 놀이', emoji: '🎨', route: '/(main)/diary' },
      { title: '또래 활동', emoji: '👫', route: '/(main)/compatibility' },
      { title: '체험센터', emoji: '🏫', route: '/(main)/academy' },
      { title: '교구 구독', emoji: '📦', route: '/(main)/subscription' },
    ];
  }

  return [
    { title: '학습', emoji: '📖', route: '/(main)/report' },
    { title: '학원', emoji: '🏫', route: '/(main)/academy' },
    { title: '영양', emoji: '🥗', route: '/(main)/nutrition' },
    { title: '교구', emoji: '📦', route: '/(main)/subscription' },
  ];
}

export function AgeCards({ child }: Props) {
  const cards = getCardsForAge(child);

  return (
    <View style={styles.grid}>
      {cards.map((card, idx) => (
        <TouchableOpacity
          key={idx}
          style={styles.card}
          onPress={() => card.route && router.push(card.route as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.cardEmoji}>{card.emoji}</Text>
          <Text style={styles.cardTitle}>{card.title}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  card: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    alignItems: 'flex-start',
  },
  cardEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
});

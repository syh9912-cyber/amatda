import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

const TRAIT_EXPLANATIONS: Record<string, string> = {
  '탐구형': '탐구형 아이는 호기심이 왕성하고 원리를 파악하는 것을 좋아합니다. 실험, 관찰, 논리적 사고를 활용하는 학원이 잘 맞으며, 스스로 탐색하고 발견하는 환경에서 가장 잘 성장합니다.',
  '활동형': '활동형 아이는 에너지가 넘치고 몸을 움직이는 활동을 즐깁니다. 스포츠, 신체 활동 중심의 학원에서 에너지를 건강하게 발산하며, 팀 활동을 통해 리더십과 사회성을 함께 기를 수 있습니다.',
  '조화형': '조화형 아이는 사회성이 뛰어나고 함께하는 활동에서 빛을 발합니다. 협동과 소통이 중요한 예술, 단체 활동 학원에서 리더십과 배려심을 동시에 키울 수 있습니다.',
  '분석형': '분석형 아이는 논리적이고 체계적인 사고를 좋아합니다. 수학, 코딩, 전략 게임 등 정밀한 사고력을 요구하는 학원에서 두각을 나타내며, 단계별 도전을 통해 성취감을 느낍니다.',
  '감성형': '감성형 아이는 풍부한 감수성과 상상력을 가지고 있습니다. 음악, 미술, 글쓰기 등 감정을 표현하는 예술 학원에서 재능을 꽃피우며, 자유로운 표현이 가능한 환경에서 가장 행복합니다.',
};

interface Props {
  dominantType: string;
}

export default function TraitExplanation({ dominantType }: Props) {
  const [expanded, setExpanded] = useState(false);
  const explanation = TRAIT_EXPLANATIONS[dominantType];
  if (!explanation) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.title}>왜 이런 학원을 추천할까요?</Text>
        <Text style={styles.arrow}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && (
        <Text style={styles.body}>{explanation}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.infoLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  arrow: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },
  body: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 22,
    marginTop: SPACING.sm,
  },
});

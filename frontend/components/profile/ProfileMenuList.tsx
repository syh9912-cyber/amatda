import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';

interface MenuItem {
  emoji: string;
  label: string;
  description: string;
  route: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    emoji: '🎴',
    label: '아이 디지털 카드',
    description: '아이 정보 카드 공유하기',
    route: '/(main)/child-card',
  },
  {
    emoji: '🧠',
    label: '기질분석 기록',
    description: '기질 검사 결과 보기',
    route: '/(main)/trait-detail',
  },
  {
    emoji: '💆',
    label: '부모 멘탈 체크',
    description: 'AI 스트레스 분석과 위로',
    route: '/(main)/home',
  },
  {
    emoji: '🔮',
    label: '아이 미래 예측',
    description: '3개월 후 성장 예측 보기',
    route: '/(main)/home',
  },
  {
    emoji: '🎯',
    label: '맞춤 활동 추천',
    description: '지금 바로 할 수 있는 활동',
    route: '/(main)/home',
  },
  {
    emoji: '💡',
    label: '추천 내역',
    description: '영양, 학원, 활동 추천',
    route: '/(main)/nutrition',
  },
  {
    emoji: '📚',
    label: '성장앨범 관리',
    description: '사진과 기록 모아보기',
    route: '/(main)/album',
  },
  {
    emoji: '📸',
    label: '맘스타그램',
    description: '엄마들의 인스타그램',
    route: '/(main)/momstagram',
  },
  {
    emoji: '📈',
    label: '성장 기록 & 통계',
    description: '성장 추이 확인',
    route: '/(main)/growth-stats',
  },
  {
    emoji: '🏥',
    label: '소아과 후기',
    description: '근처 소아과 리뷰 보기',
    route: '/(main)/clinic',
  },
  {
    emoji: '💎',
    label: '프리미엄 플랜',
    description: 'AI 코칭 무제한 이용',
    route: '/(main)/subscription',
  },
  {
    emoji: '🔔',
    label: '알림 설정',
    description: '푸시 알림 관리',
    route: '/(main)/home',
  },
  {
    emoji: '📞',
    label: '고객센터',
    description: 'AI 챗봇 상담',
    route: '/(main)/chatbot',
  },
];

export function ProfileMenuList() {
  return (
    <View style={styles.card}>
      {MENU_ITEMS.map((item, idx) => {
        const isLast = idx === MENU_ITEMS.length - 1;
        return (
          <TouchableOpacity
            key={item.label}
            style={[styles.row, !isLast && styles.rowBorder]}
            onPress={() => router.push(item.route as never)}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <View style={styles.labelCol}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.desc}>{item.description}</Text>
            </View>
            <Text style={styles.chevron}>{'>'}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F5EDE4',
  },
  emoji: {
    fontSize: 20,
    width: 32,
    textAlign: 'center',
  },
  labelCol: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  label: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  desc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    fontWeight: '300',
  },
});

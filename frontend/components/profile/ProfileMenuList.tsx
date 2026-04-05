import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants/theme';

interface MenuItem {
  emoji: string;
  label: string;
  route: string;
}

const MENU_ITEMS: MenuItem[] = [
  { emoji: '👶', label: '아이 정보 관리', route: '/(main)/home' },
  { emoji: '🧠', label: '기질 검사 기록', route: '/(main)/trait-detail' },
  { emoji: '💡', label: '추천 내역', route: '/(main)/academy' },
  { emoji: '📸', label: '성장앨범 관리', route: '/(main)/momstagram' },
  { emoji: '📊', label: '성장 기록 & 통계', route: '/(main)/growth-stats' },
  { emoji: '👥', label: '커뮤니티 활동', route: '/(main)/momstagram' },
  { emoji: '🔔', label: '알림 설정', route: '/(main)/home' },
  { emoji: '📞', label: '고객센터', route: '/(main)/chatbot' },
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
            <Text style={styles.label}>{item.label}</Text>
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
  label: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  chevron: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    fontWeight: '300',
  },
});

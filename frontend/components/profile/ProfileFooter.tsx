import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

interface ProfileFooterProps {
  onLogout: () => void;
  onDeleteAccount: () => void;
}

export function ProfileFooter({ onLogout, onDeleteAccount }: ProfileFooterProps) {
  return (
    <View style={styles.container}>
      <View style={styles.linksRow}>
        <TouchableOpacity onPress={() => router.push('/(main)/privacy' as never)}>
          <Text style={styles.linkText}>개인정보 처리방침</Text>
        </TouchableOpacity>
        <Text style={styles.divider}>|</Text>
        <TouchableOpacity onPress={() => router.push('/(main)/terms' as never)}>
          <Text style={styles.linkText}>이용약관</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onDeleteAccount}>
        <Text style={styles.deleteText}>계정 삭제</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  linkText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  divider: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginHorizontal: SPACING.sm,
  },
  logoutBtn: {
    marginBottom: SPACING.md,
  },
  logoutText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  deleteText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
  },
  versionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
});

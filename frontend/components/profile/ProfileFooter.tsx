import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

interface ProfileFooterProps {
  onLogout: () => void;
  onDeleteAccount: () => void;
}

/** 현재 실행 중인 번들 정보를 사람이 읽기 좋은 문자열로 변환 */
function getUpdateLabel(): string {
  try {
    if (Updates.isEmergencyLaunch) return '긴급복구';
    if (Updates.isEmbeddedLaunch || !Updates.createdAt) return '기본빌드';
    const d = new Date(Updates.createdAt);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `OTA ${mm}/${dd} ${hh}:${min}`;
  } catch {
    return '확인불가';
  }
}

export function ProfileFooter({ onLogout, onDeleteAccount }: ProfileFooterProps) {
  const version = Constants.expoConfig?.version ?? '2.2.0';
  const updateLabel = getUpdateLabel();

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

      <Text style={styles.versionText}>v{version} · {updateLabel}</Text>
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

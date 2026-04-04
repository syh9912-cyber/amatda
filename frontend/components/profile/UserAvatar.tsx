import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

interface UserAvatarProps {
  email: string | null;
  childrenCount: number;
}

export function UserAvatar({ email, childrenCount }: UserAvatarProps) {
  const initial = email ? email[0].toUpperCase() : '?';

  return (
    <View style={styles.container}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarLetter}>{initial}</Text>
      </View>
      <Text style={styles.email}>{email ?? '...'}</Text>
      <Text style={styles.childCount}>{childrenCount}명</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>FREE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  avatarLetter: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  email: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  childCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  badge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primaryDark,
    letterSpacing: 1,
  },
});

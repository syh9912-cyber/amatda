import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { Child } from '../../stores/childStore';

interface ProfileCardProps {
  child: Child | null;
}

function calcAge(birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;
  if (totalMonths < 12) return `${totalMonths}개월`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m > 0 ? `${y}세 ${m}개월` : `${y}세`;
}

export function ProfileCard({ child }: ProfileCardProps) {
  if (!child) {
    return (
      <View style={styles.card}>
        <View style={styles.photoCircle}>
          <Text style={styles.photoEmoji}>{'👶'}</Text>
        </View>
        <Text style={styles.nameText}>아이를 등록해주세요</Text>
      </View>
    );
  }

  const age = calcAge(child.birthDate);
  const emoji = child.gender === 'F' ? '👧' : '👦';

  return (
    <View style={styles.card}>
      <View style={styles.photoCircle}>
        <Text style={styles.photoEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.nameText}>
        {child.name} ({age})
      </Text>
      <Text style={styles.birthText}>{child.birthDate}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  photoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  photoEmoji: {
    fontSize: 36,
  },
  nameText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  birthText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
});

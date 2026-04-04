import { StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 36,
    backgroundColor: COLORS.surface,
  },
  content: { alignItems: 'center' },
  iconEmoji: { fontSize: 36, marginBottom: SPACING.md },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '400',
    color: COLORS.textSecondary,
    marginTop: 8,
  },
});

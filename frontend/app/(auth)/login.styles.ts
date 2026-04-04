import { StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../constants/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1 },
  body: { paddingHorizontal: SPACING.xl, flex: 1 },
  form: { gap: SPACING.md },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  registerLink: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  registerText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  registerBold: { color: COLORS.primary, fontWeight: '700' },
});

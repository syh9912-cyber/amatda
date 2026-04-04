import { StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  gradientLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primaryLight,
    opacity: 0.5,
  },
  gradientLayer2: {
    position: 'absolute',
    top: '30%',
    left: '-20%',
    width: '140%',
    height: '80%',
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    opacity: 0.12,
  },
  gradientLayer3: {
    position: 'absolute',
    bottom: 0,
    right: '-10%',
    width: '60%',
    height: '50%',
    borderRadius: 999,
    backgroundColor: COLORS.secondary,
    opacity: 0.1,
  },
  content: { alignItems: 'center', zIndex: 1 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconEmoji: { fontSize: 28 },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
});

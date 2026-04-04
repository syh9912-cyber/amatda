// 모든 테마 값을 하나의 진입점에서 re-export
export { COLORS, GRADIENTS } from './theme.colors';

export const SHADOWS = {
  soft: {
    shadowColor: '#1E1E2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  medium: {
    shadowColor: '#1E1E2E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#1E1E2E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
};

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

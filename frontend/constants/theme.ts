export { COLORS, GRADIENTS } from './theme.colors';

export const SHADOWS = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 4,
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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
};

/** iOS 스타일 헤더 옵션 — Stack.Screen options에 스프레드해서 사용 */
export const IOS_HEADER_STYLE = {
  headerStyle: { backgroundColor: '#F2F2F7' } as const,
  headerShadowVisible: false,
  headerTitleStyle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#1C1C1E',
  },
  headerTintColor: '#FF8C5A',
} as const;

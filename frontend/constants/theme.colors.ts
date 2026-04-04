export const COLORS = {
  // 기본 컬러 (세련된 파스텔)
  primary: '#6B8AF2',
  primaryDark: '#4A6DE5',
  primaryLight: '#B8CFF9',
  secondary: '#F28B6B',
  secondaryDark: '#E5724A',
  secondaryLight: '#F9D4B8',
  background: '#F8F9FD',
  surface: '#FFFFFF',
  text: '#1A2138',
  textSecondary: '#5A6785',
  textLight: '#9BA5B7',
  border: '#E4E9F2',
  error: '#F06B6B',
  success: '#4DC990',

  // 상태 컬러
  info: '#5B9BF2',
  infoLight: '#E8F0FE',
  infoDark: '#2A6DD9',
  warning: '#F2B85B',
  warningLight: '#FEF4E0',
  warningDark: '#D99A2A',
  successLight: '#E0F7EC',
  successDark: '#2AA66B',
  errorLight: '#FDE8E8',
  errorDark: '#D94A4A',

  // 기질별 컬러
  wood: '#6BC784',
  fire: '#FF7A70',
  earth: '#F2C94C',
  metal: '#7EB5F2',
  water: '#6BC4B8',

  // 연령별 테마
  infant: '#FFE0B2',
  toddler: '#C8E6C9',
  elementary: '#BBDEFB',
};

export const GRADIENTS = {
  primary: ['#6B8AF2', '#9B6BF2'] as const,
  warm: ['#F28B6B', '#F2B85B'] as const,
  cool: ['#6BC4B8', '#6B8AF2'] as const,
  sunset: ['#F28B6B', '#F06B9B'] as const,
  nature: ['#6BC784', '#6BC4B8'] as const,
};

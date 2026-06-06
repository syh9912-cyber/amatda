// 컬러 톤다운 v2 (2026-05-29) — iOS 화이트 톤 + 미니멀
//   배경 순백, 카드 그림자 약화, separator hairline.
export const COLORS = {
  // Brand — soft coral pink (채도 ↓)
  primary: '#F4A98C',
  primaryLight: '#FFF4EE',
  primaryDark: '#D88766',
  secondary: '#7FD4CD',
  secondaryLight: '#E4F6F4',

  // Background — pure white iOS style
  background: '#FFFFFF',       // 순백 (iOS systemBackground)
  surface: '#FFFFFF',
  surfaceLight: '#F8F8FA',     // 옅은 회색 (grouped section bg)

  // Text — 베빌 톤 (부드러운 검정, 진하지 않음)
  text: '#333333',             // 부드러운 검정 (베빌 톤)
  textSecondary: '#666666',
  textLight: '#9E9E9E',

  // Border — iOS hairline separator
  border: '#E5E5EA',           // iOS opaqueSeparator
  borderLight: '#F2F2F7',      // iOS systemGroupedBackground

  // Status
  success: '#34C759',          // iOS green
  successLight: '#D4F5E9',
  successDark: '#248A3D',
  error: '#FF3B30',            // iOS red
  warning: '#FF9500',          // iOS orange
  info: '#007AFF',             // iOS blue
  infoLight: '#E5F0FF',

  // Trait colors (kept for personality display)
  wood: '#7BC67E',
  fire: '#FF8C5A',
  earth: '#FFD93D',
  metal: '#6C9CE2',
  water: '#B48EE0',

  // Age theme
  infant: '#FFE0B2',
  toddler: '#C8E6C9',
  elementary: '#BBDEFB',
};

export const GRADIENTS = {
  primary: ['#FF8C5A', '#FFB088'] as const,
  warm: ['#FF8C5A', '#FFD93D'] as const,
  cool: ['#4ECDC4', '#6C9CE2'] as const,
  sunset: ['#FF8C5A', '#FF6B6B'] as const,
  nature: ['#4ECDC4', '#7BC67E'] as const,
};

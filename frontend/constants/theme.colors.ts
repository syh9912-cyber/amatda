export const COLORS = {
  // Brand
  primary: '#FF8C5A',
  primaryLight: '#FFF0E6',
  primaryDark: '#E67040',
  secondary: '#4ECDC4',
  secondaryLight: '#D4F5F2',

  // Background — iOS system grouped style
  background: '#F2F2F7',       // iOS systemGroupedBackground
  surface: '#FFFFFF',           // iOS secondarySystemGroupedBackground (card)
  surfaceLight: '#F9F9F9',

  // Text — iOS label scale
  text: '#1C1C1E',             // iOS label
  textSecondary: '#636366',    // iOS secondaryLabel
  textLight: '#ABABAB',        // iOS tertiaryLabel

  // Border — iOS separator
  border: '#C6C6C8',           // iOS separator
  borderLight: '#E5E5EA',      // iOS opaqueSeparator (lighter)

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

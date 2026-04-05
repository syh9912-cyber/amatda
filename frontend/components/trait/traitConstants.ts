/** Display names mapping fiveElements keys to Korean labels */
export const ELEMENT_DISPLAY_NAMES: Record<string, string> = {
  wood: '호기심',
  fire: '활동성',
  earth: '안정감',
  metal: '집중력',
  water: '민감도',
};

/** Coral-based style constants for the trait detail screen */
export const TRAIT_COLORS = {
  background: '#FFF5EC',
  coral: '#FF8C5A',
  coralEnd: '#FFB088',
  cardBg: '#FFFFFF',
  textBrown: '#5C3D2E',
  textBrownLight: '#8B6F5E',
  tabInactiveBg: '#F5EDE6',
  tabInactiveText: '#7A6A5E',
  barTrack: '#F0E6DD',
  gradientStart: '#FFECD2',
  gradientEnd: '#FFF5EC',
} as const;

export type TraitTab = 'summary' | 'traits' | 'detail';

export const TABS: { key: TraitTab; label: string }[] = [
  { key: 'summary', label: '종합 요약' },
  { key: 'traits', label: '성향 특성' },
  { key: 'detail', label: '상세분석' },
];

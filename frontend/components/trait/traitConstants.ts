import type { TFunction } from 'i18next';

/** Display names mapping fiveElements keys to translated labels */
export function getElementDisplayNames(t: TFunction): Record<string, string> {
  return {
    wood: t('components.traitConstants.element.wood'),
    fire: t('components.traitConstants.element.fire'),
    earth: t('components.traitConstants.element.earth'),
    metal: t('components.traitConstants.element.metal'),
    water: t('components.traitConstants.element.water'),
  };
}

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

export function getTraitTabs(t: TFunction): { key: TraitTab; label: string }[] {
  return [
    { key: 'summary', label: t('components.traitConstants.tabs.summary') },
    { key: 'traits', label: t('components.traitConstants.tabs.traits') },
    { key: 'detail', label: t('components.traitConstants.tabs.detail') },
  ];
}

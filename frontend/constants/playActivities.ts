import type { TFunction } from 'i18next';

/* ------------------------------------------------------------------ */
/*  Static play/learning activity data per temperament & age group      */
/* ------------------------------------------------------------------ */

export interface PlayActivity {
  name: string;
  emoji: string;
  duration: string;
  materials: string[];
  reason: string;
  steps: string[];
  ageGroups: ('infant' | 'toddler' | 'elementary')[];
}

type TemperamentKey =
  | 'active'
  | 'explorer'
  | 'balanced'
  | 'analytical'
  | 'sensitive';

export function resolvePlayTemperament(
  dominantType: string,
): TemperamentKey {
  if (dominantType.includes('활동') || dominantType.includes('fire'))
    return 'active';
  if (dominantType.includes('탐구') || dominantType.includes('wood'))
    return 'explorer';
  if (dominantType.includes('조화') || dominantType.includes('earth'))
    return 'balanced';
  if (dominantType.includes('분석') || dominantType.includes('metal'))
    return 'analytical';
  if (dominantType.includes('감성') || dominantType.includes('water'))
    return 'sensitive';
  return 'balanced';
}

/* ------------------------------------------------------------------ */
/*  Structural shape (non-translatable): emoji, materials/steps count,  */
/*  ageGroups per temperament × activity index.                         */
/* ------------------------------------------------------------------ */

interface ActivityShape {
  emoji: string;
  materialsCount: number;
  stepsCount: number;
  ageGroups: ('infant' | 'toddler' | 'elementary')[];
}

const SHAPE: Record<TemperamentKey, ActivityShape[]> = {
  /* ======================== active ======================== */
  active: [
    { emoji: '🏃', materialsCount: 3, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '⚽', materialsCount: 2, stepsCount: 4, ageGroups: ['infant', 'toddler', 'elementary'] },
    { emoji: '🎵', materialsCount: 1, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '🎈', materialsCount: 1, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '👶', materialsCount: 1, stepsCount: 4, ageGroups: ['infant'] },
    { emoji: '🔴', materialsCount: 2, stepsCount: 4, ageGroups: ['toddler'] },
  ],
  /* ======================== explorer ======================== */
  explorer: [
    { emoji: '🌋', materialsCount: 4, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '🌿', materialsCount: 3, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '🔍', materialsCount: 1, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '💧', materialsCount: 4, stepsCount: 4, ageGroups: ['infant', 'toddler'] },
    { emoji: '🔦', materialsCount: 2, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '📦', materialsCount: 2, stepsCount: 4, ageGroups: ['infant', 'toddler'] },
  ],
  /* ======================== balanced ======================== */
  balanced: [
    { emoji: '🧱', materialsCount: 1, stepsCount: 4, ageGroups: ['infant', 'toddler', 'elementary'] },
    { emoji: '🧑‍🍳', materialsCount: 1, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '🧩', materialsCount: 1, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '🎨', materialsCount: 2, stepsCount: 4, ageGroups: ['infant', 'toddler', 'elementary'] },
    { emoji: '👶', materialsCount: 1, stepsCount: 4, ageGroups: ['infant'] },
    { emoji: '🎭', materialsCount: 2, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
  ],
  /* ======================== analytical ======================== */
  analytical: [
    { emoji: '🔢', materialsCount: 2, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '🏗️', materialsCount: 3, stepsCount: 4, ageGroups: ['elementary'] },
    { emoji: '💻', materialsCount: 1, stepsCount: 4, ageGroups: ['elementary'] },
    { emoji: '🔷', materialsCount: 1, stepsCount: 4, ageGroups: ['infant', 'toddler'] },
    { emoji: '📏', materialsCount: 3, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '🥤', materialsCount: 1, stepsCount: 4, ageGroups: ['infant'] },
  ],
  /* ======================== sensitive ======================== */
  sensitive: [
    { emoji: '🎨', materialsCount: 3, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '🎶', materialsCount: 1, stepsCount: 4, ageGroups: ['infant', 'toddler', 'elementary'] },
    { emoji: '🧸', materialsCount: 2, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '📷', materialsCount: 1, stepsCount: 4, ageGroups: ['toddler', 'elementary'] },
    { emoji: '👶', materialsCount: 1, stepsCount: 4, ageGroups: ['infant'] },
    { emoji: '🌿', materialsCount: 0, stepsCount: 4, ageGroups: ['infant', 'toddler', 'elementary'] },
  ],
};

/** Build the fully translated PLAY_ACTIVITIES data using the given i18next TFunction. */
export function getPlayActivities(
  t: TFunction,
): Record<TemperamentKey, PlayActivity[]> {
  const build = (key: TemperamentKey): PlayActivity[] =>
    SHAPE[key].map((shape, index) => {
      const base = `playActivities.${key}.${index}`;
      return {
        name: t(`${base}.name`),
        emoji: shape.emoji,
        duration: t(`${base}.duration`),
        materials: Array.from({ length: shape.materialsCount }, (_, mIdx) =>
          t(`${base}.materials.${mIdx}`),
        ),
        reason: t(`${base}.reason`),
        steps: Array.from({ length: shape.stepsCount }, (_, sIdx) =>
          t(`${base}.steps.${sIdx}`),
        ),
        ageGroups: shape.ageGroups,
      };
    });

  return {
    active: build('active'),
    explorer: build('explorer'),
    balanced: build('balanced'),
    analytical: build('analytical'),
    sensitive: build('sensitive'),
  };
}

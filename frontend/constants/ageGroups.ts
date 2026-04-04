export const AGE_GROUPS = {
  infant: { min: 0, max: 24, label: '영아', emoji: '👶' },
  toddler: { min: 25, max: 72, label: '유아', emoji: '🧒' },
  elementary: { min: 73, max: 200, label: '초등', emoji: '📚' },
} as const;

export type AgeGroupKey = keyof typeof AGE_GROUPS;

type AgeGroup = 'infant' | 'toddler' | 'elementary';

interface AgeInfo {
  months: number;
  group: AgeGroup;
  label: string;
}

export function calculateAge(birthDate: Date): AgeInfo {
  const now = new Date();
  const diffMs = now.getTime() - birthDate.getTime();
  const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));

  let group: AgeGroup;
  let label: string;

  if (months <= 24) {
    group = 'infant';
    label = '영아';
  } else if (months <= 72) {
    group = 'toddler';
    label = '유아';
  } else {
    group = 'elementary';
    label = '초등';
  }

  return { months, group, label };
}

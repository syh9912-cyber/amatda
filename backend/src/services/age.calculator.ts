type AgeGroup = 'pregnant' | 'infant' | 'toddler' | 'elementary';

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

/** 개월 수를 한국어 문자열로 변환 (예: 20 → "20개월", 30 → "2세 6개월") */
export function formatAgeKo(months: number): string {
  if (months < 24) return `${months}개월`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (remaining === 0) return `${years}세`;
  return `${years}세 ${remaining}개월`;
}

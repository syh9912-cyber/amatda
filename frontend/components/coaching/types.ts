export interface CoachingMessage {
  id: string;
  isCoach: boolean;
  text: string;
  reason?: string;
  solutions?: string[];
  source?: 'knowledge' | 'ai' | 'learned' | 'filter' | 'limit';
  detailPrompt?: string;
  imageUri?: string;
  createdAt: string;
  redFlag?: string;
  reasons?: string[];
  medical?: string;
  followup?: string;
}

export interface FollowupItem {
  id: string;
  originalQuestion: string;
  followupText: string;
  dueDate: string;
  category?: string;
}

export const COACHING_COLORS = {
  bg: '#FFF5EC',
  coachBubble: '#FFFFFF',
  parentBubble: '#FF8C5A',
  reasonBg: '#FFF9E6',
  solutionBg: '#E8FAF8',
  text: '#2D2016',
  textSub: '#8C7A6B',
  textLight: '#B5A99A',
  accent: '#FF8C5A',
  coachAvatar: '#FFE4D6',
  border: '#F0E6DA',
  white: '#FFFFFF',
};

/* eslint-disable @typescript-eslint/no-require-imports */
export const CONCERN_CATEGORIES = [
  // Baby categories
  { icon: require('../../assets/cat-crying.png') as number, label: '울음', key: 'crying' },
  { icon: require('../../assets/cat-sleep.png') as number, label: '수면', key: 'sleep' },
  { icon: require('../../assets/cat-eating.png') as number, label: '식사', key: 'eating' },
  { icon: require('../../assets/cat-poop.png') as number, label: '대변', key: 'poop' },
  { icon: require('../../assets/cat-social.png') as number, label: '사회성', key: 'social' },
  { icon: require('../../assets/cat-growth.png') as number, label: '성장', key: 'growth' },
  { icon: require('../../assets/cat-behavior.png') as number, label: '행동', key: 'behavior' },
  { icon: require('../../assets/cat-etc.png') as number, label: '기타', key: 'etc' },
  // Pregnancy categories
  { icon: require('../../assets/cat-etc.png') as number, label: '임신 증상', key: 'symptoms' },
  { icon: require('../../assets/cat-eating.png') as number, label: '영양/식단', key: 'nutrition' },
  { icon: require('../../assets/cat-growth.png') as number, label: '검진/검사', key: 'checkup' },
  { icon: require('../../assets/cat-behavior.png') as number, label: '산모 운동', key: 'exercise' },
  { icon: require('../../assets/cat-social.png') as number, label: '감정/멘탈', key: 'emotion' },
  { icon: require('../../assets/cat-crying.png') as number, label: '출산 준비', key: 'birth_prep' },
];

// 연령별 카테고리 필터 (key 기준)
import type { AgeGroupKey } from '../../constants/ageGroups';

const CATEGORY_KEYS_BY_AGE: Record<AgeGroupKey, string[]> = {
  pregnant: ['symptoms', 'nutrition', 'checkup', 'exercise', 'emotion', 'birth_prep', 'etc'],
  infant: ['crying', 'sleep', 'eating', 'poop', 'growth', 'behavior', 'etc'],
  toddler: ['sleep', 'eating', 'poop', 'behavior', 'social', 'growth', 'etc'],
  elementary: ['eating', 'sleep', 'behavior', 'social', 'growth', 'etc'],
};

export function getCategoriesForAge(ageGroup: AgeGroupKey) {
  const keys = CATEGORY_KEYS_BY_AGE[ageGroup];
  return CONCERN_CATEGORIES.filter((c) => keys.includes(c.key));
}

export const CHECKIN_OPTIONS = [
  { icon: require('../../assets/mood-good.png') as number, label: '좋아요', mood: 'good' },
  { icon: require('../../assets/mood-normal.png') as number, label: '보통이에요', mood: 'normal' },
  { icon: require('../../assets/mood-bad.png') as number, label: '안 좋아요', mood: 'bad' },
];
/* eslint-enable @typescript-eslint/no-require-imports */

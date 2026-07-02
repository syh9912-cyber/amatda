// 연령별 카테고리 필터 (key 기준)
import type { AgeGroupKey } from '../../constants/ageGroups';
import type { TFunction } from 'i18next';

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
  /** in-chat 추천 질문 칩 (최대 3개). 탭하면 바로 이어 질문. */
  followups?: string[];
}

export interface FollowupItem {
  id: string;
  originalQuestion: string;
  followupText: string;
  dueDate: string;
  category?: string;
}

// 톤다운 v2 — 배경 화이트, accent 부드러운 코랄, 버블 매우 옅은 회색.
export const COACHING_COLORS = {
  bg: '#FFFFFF',           // 진한 베이지 → 순백
  coachBubble: '#F7F7F8',  // AI 답변 옅은 회색
  parentBubble: '#F4A98C', // 톤다운된 코랄
  reasonBg: '#FFFBEC',     // 더 옅은 노랑
  solutionBg: '#F0FAF8',
  text: '#333333',
  textSub: '#666666',
  textLight: '#9E9E9E',
  accent: '#F4A98C',
  coachAvatar: '#FFEEE3',
  border: '#EFEFF1',
  white: '#FFFFFF',
};

 
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

export function getCheckinOptions(t: TFunction) {
  return [
    { icon: require('../../assets/mood-good.png') as number, label: t('components.checkinOptions.good'), mood: 'good' },
    { icon: require('../../assets/mood-normal.png') as number, label: t('components.checkinOptions.normal'), mood: 'normal' },
    { icon: require('../../assets/mood-bad.png') as number, label: t('components.checkinOptions.bad'), mood: 'bad' },
  ];
}


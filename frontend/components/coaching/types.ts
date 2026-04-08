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

export const CONCERN_CATEGORIES = [
  { emoji: '😭', label: '울음', key: 'crying' },
  { emoji: '😴', label: '수면', key: 'sleep' },
  { emoji: '🍽', label: '식사', key: 'eating' },
  { emoji: '💩', label: '대변', key: 'poop' },
  { emoji: '🏫', label: '사회성', key: 'social' },
  { emoji: '📏', label: '성장', key: 'growth' },
  { emoji: '😤', label: '행동', key: 'behavior' },
  { emoji: '💬', label: '기타', key: 'etc' },
] as const;

export const CHECKIN_OPTIONS = [
  { emoji: '😊', label: '좋아요', mood: 'good' },
  { emoji: '😐', label: '보통이에요', mood: 'normal' },
  { emoji: '😢', label: '안 좋아요', mood: 'bad' },
] as const;

export interface CoachingMessage {
  id: string;
  isCoach: boolean;
  text: string;
  reason?: string;
  solutions?: string[];
  source?: 'knowledge' | 'ai' | 'learned';
  detailPrompt?: string;
  imageUri?: string;
  createdAt: string;
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
  { emoji: '\uD83D\uDE2D', label: '\uC6B8\uC74C', key: 'crying' },
  { emoji: '\uD83D\uDE34', label: '\uC218\uBA74', key: 'sleep' },
  { emoji: '\uD83C\uDF7D', label: '\uC2DD\uC0AC', key: 'eating' },
  { emoji: '\uD83D\uDCA9', label: '\uB300\uBCC0', key: 'poop' },
  { emoji: '\uD83C\uDFEB', label: '\uC0AC\uD68C\uC131', key: 'social' },
  { emoji: '\uD83D\uDCCF', label: '\uC131\uC7A5', key: 'growth' },
  { emoji: '\uD83D\uDE24', label: '\uD589\uB3D9', key: 'behavior' },
  { emoji: '\uD83D\uDCAC', label: '\uAE30\uD0C0', key: 'etc' },
] as const;

export const CHECKIN_OPTIONS = [
  { emoji: '\uD83D\uDE0A', label: '\uC88B\uC544\uC694', mood: 'good' },
  { emoji: '\uD83D\uDE10', label: '\uBCF4\uD1B5\uC774\uC5D0\uC694', mood: 'normal' },
  { emoji: '\uD83D\uDE22', label: '\uC548 \uC88B\uC544\uC694', mood: 'bad' },
] as const;

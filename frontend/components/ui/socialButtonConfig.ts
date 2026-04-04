import { SocialProvider } from '../../services/social-auth';

export interface SocialButtonConfig {
  provider: SocialProvider;
  label: string;
  letter: string;
  bg: string;
  color: string;
  letterBg: string;
  letterColor: string;
  border?: string;
}

export const SOCIAL_BUTTON_LIST: SocialButtonConfig[] = [
  {
    provider: 'GOOGLE',
    label: 'Google로 계속하기',
    letter: 'G',
    bg: '#FFFFFF',
    color: '#3C4043',
    letterBg: 'transparent',
    letterColor: '#4285F4',
    border: '#DADCE0',
  },
  {
    provider: 'NAVER',
    label: '네이버로 계속하기',
    letter: 'N',
    bg: '#03C75A',
    color: '#FFFFFF',
    letterBg: 'rgba(255,255,255,0.2)',
    letterColor: '#FFFFFF',
  },
  {
    provider: 'KAKAO',
    label: '카카오로 계속하기',
    letter: 'K',
    bg: '#FEE500',
    color: '#191919',
    letterBg: 'rgba(0,0,0,0.08)',
    letterColor: '#191919',
  },
];

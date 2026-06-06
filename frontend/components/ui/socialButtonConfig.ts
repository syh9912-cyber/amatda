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
  iosOnly?: boolean; // Apple 로그인은 iOS 에서만 노출 (App Store 정책 + 표준)
}

export const SOCIAL_BUTTON_LIST: SocialButtonConfig[] = [
  {
    // App Store 정책 4.8 — iOS 에서 타사 소셜로그인 제공 시 Apple 로그인 필수, 상단 노출 권장.
    provider: 'APPLE',
    label: 'Apple로 계속하기',
    letter: '\u{F8FF}', // iOS 에서 Apple 로고 글리프로 렌더
    bg: '#000000',
    color: '#FFFFFF',
    letterBg: 'transparent',
    letterColor: '#FFFFFF',
    iosOnly: true,
  },
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

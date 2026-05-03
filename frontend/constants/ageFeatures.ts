/**
 * 연령별 기능 활성/비활성 매핑
 * - 아이 월령에 따라 트래커 항목, AI 코칭 카테고리, 메뉴가 자동 조정
 * - infant(0-24개월) / toddler(25-72개월) / elementary(73개월+)
 */

import { AgeGroupKey } from './ageGroups';

// ─── 트래커 탭 ───

export type TrackerTab = 'diaper' | 'feeding' | 'sleep';

export interface TrackerTabConfig {
  key: TrackerTab;
  label: string;
  icon: string;
}

const ALL_TRACKER_TABS: Record<TrackerTab, TrackerTabConfig> = {
  diaper: { key: 'diaper', label: '배변', icon: 'diaper' },
  feeding: { key: 'feeding', label: '수유/식사', icon: 'feeding' },
  sleep: { key: 'sleep', label: '수면', icon: 'sleep' },
};

// 연령별 활성 트래커 탭
const TRACKER_TABS_BY_AGE: Record<AgeGroupKey, TrackerTab[]> = {
  pregnant: ['feeding', 'sleep'],               // 임산부: 영양/수면만
  infant: ['diaper', 'feeding', 'sleep'],
  toddler: ['diaper', 'feeding', 'sleep'],    // 배변훈련 시기라 유지
  elementary: ['feeding', 'sleep'],             // 기저귀 제거
};

export function getTrackerTabs(ageGroup: AgeGroupKey): TrackerTabConfig[] {
  return TRACKER_TABS_BY_AGE[ageGroup].map((k) => ALL_TRACKER_TABS[k]);
}

// ─── 수유 서브타입 (연령별) ───

export interface FeedingType {
  key: string;
  label: string;
}

const FEEDING_TYPES_BY_AGE: Record<AgeGroupKey, FeedingType[]> = {
  pregnant: [
    { key: 'meal', label: '식사' },
    { key: 'snack', label: '간식' },
    { key: 'supplement', label: '영양제' },
  ],
  infant: [
    { key: 'breast', label: '모유' },
    { key: 'formula', label: '분유' },
    { key: 'baby_food', label: '이유식' },
    { key: 'snack', label: '간식' },
  ],
  toddler: [
    { key: 'baby_food', label: '유아식' },
    { key: 'meal', label: '밥' },
    { key: 'snack', label: '간식' },
    { key: 'milk', label: '우유' },
  ],
  elementary: [
    { key: 'meal', label: '식사' },
    { key: 'snack', label: '간식' },
  ],
};

export function getFeedingTypes(ageGroup: AgeGroupKey): FeedingType[] {
  return FEEDING_TYPES_BY_AGE[ageGroup];
}

// ─── AI 코칭 카테고리 ───

export interface CoachingCategory {
  key: string;
  label: string;
  emoji: string;
}

const COACHING_CATEGORIES_BY_AGE: Record<AgeGroupKey, CoachingCategory[]> = {
  pregnant: [
    { key: 'symptoms', label: '증상/입덧', emoji: '🤢' },
    { key: 'nutrition', label: '영양', emoji: '🥗' },
    { key: 'checkup', label: '검진', emoji: '🏥' },
    { key: 'exercise', label: '운동', emoji: '🧘' },
    { key: 'emotion', label: '감정/심리', emoji: '💭' },
    { key: 'birth_prep', label: '출산준비', emoji: '🍼' },
    { key: 'etc', label: '기타', emoji: '💬' },
  ],
  infant: [
    { key: 'crying', label: '울음', emoji: '😢' },
    { key: 'sleep', label: '수면', emoji: '😴' },
    { key: 'eating', label: '수유/이유식', emoji: '🍼' },
    { key: 'poop', label: '대변/배변', emoji: '💩' },
    { key: 'growth', label: '성장발달', emoji: '📏' },
    { key: 'behavior', label: '행동', emoji: '🧸' },
    { key: 'etc', label: '기타', emoji: '💬' },
  ],
  toddler: [
    { key: 'sleep', label: '수면', emoji: '😴' },
    { key: 'eating', label: '식사/편식', emoji: '🍽' },
    { key: 'poop', label: '배변훈련', emoji: '🚽' },
    { key: 'behavior', label: '행동/훈육', emoji: '🧸' },
    { key: 'social', label: '사회성/친구', emoji: '👫' },
    { key: 'growth', label: '성장발달', emoji: '📏' },
    { key: 'etc', label: '기타', emoji: '💬' },
  ],
  elementary: [
    { key: 'eating', label: '식사/영양', emoji: '🍽' },
    { key: 'sleep', label: '수면', emoji: '😴' },
    { key: 'behavior', label: '생활습관', emoji: '📋' },
    { key: 'social', label: '교우관계', emoji: '👫' },
    { key: 'learning', label: '학습/집중', emoji: '📖' },
    { key: 'emotion', label: '감정/심리', emoji: '💭' },
    { key: 'growth', label: '성장', emoji: '📏' },
    { key: 'etc', label: '기타', emoji: '💬' },
  ],
};

export function getCoachingCategories(ageGroup: AgeGroupKey): CoachingCategory[] {
  return COACHING_CATEGORIES_BY_AGE[ageGroup];
}

// ─── 홈 화면 빠른 메뉴 ───

export interface QuickMenu {
  key: string;
  label: string;
  route: string;
  emoji: string;
}

const HOME_MENUS_BY_AGE: Record<AgeGroupKey, QuickMenu[]> = {
  pregnant: [
    { key: 'tracker', label: '임신앨범', route: '/(main)/pregnancy', emoji: '📝' },
    { key: 'growth', label: '주수별 발달', route: '/(main)/pregnancy', emoji: '📊' },
    { key: 'clinic', label: '산부인과', route: '/(main)/clinic', emoji: '🏥' },
  ],
  infant: [
    { key: 'tracker', label: '육아기록', route: '/(main)/baby-tracker', emoji: '📝' },
    { key: 'vaccine', label: '접종달력', route: '/(main)/vaccination', emoji: '💉' },
    { key: 'cry', label: '울음분석', route: '/(main)/cry-analyzer', emoji: '😢' },
    { key: 'poop', label: '대변분석', route: '/(main)/poop-analyzer', emoji: '💩' },
    { key: 'growth', label: '성장통계', route: '/(main)/growth-stats', emoji: '📊' },
    { key: 'play', label: '놀이추천', route: '/(main)/play-learning', emoji: '🎨' },
  ],
  toddler: [
    { key: 'tracker', label: '육아기록', route: '/(main)/baby-tracker', emoji: '📝' },
    { key: 'vaccine', label: '접종달력', route: '/(main)/vaccination', emoji: '💉' },
    { key: 'poop', label: '배변분석', route: '/(main)/poop-analyzer', emoji: '🚽' },
    { key: 'growth', label: '성장통계', route: '/(main)/growth-stats', emoji: '📊' },
    { key: 'play', label: '놀이/학습', route: '/(main)/play-learning', emoji: '🎨' },
    { key: 'academy', label: '학원추천', route: '/(main)/academy', emoji: '🏫' },
  ],
  elementary: [
    { key: 'tracker', label: '생활기록', route: '/(main)/baby-tracker', emoji: '📝' },
    { key: 'growth', label: '성장통계', route: '/(main)/growth-stats', emoji: '📊' },
    { key: 'play', label: '활동추천', route: '/(main)/play-learning', emoji: '🎯' },
    { key: 'academy', label: '학원추천', route: '/(main)/academy', emoji: '🏫' },
    { key: 'clinic', label: '소아과', route: '/(main)/clinic', emoji: '🏥' },
  ],
};

export function getHomeMenus(ageGroup: AgeGroupKey): QuickMenu[] {
  return HOME_MENUS_BY_AGE[ageGroup];
}

// ─── 화면 접근 가능 여부 ───

const SCREEN_ACCESS: Record<string, AgeGroupKey[]> = {
  'cry-analyzer': ['infant'],
  'poop-analyzer': ['infant', 'toddler'],
};

export function isScreenAvailable(screen: string, ageGroup: AgeGroupKey): boolean {
  const allowed = SCREEN_ACCESS[screen];
  if (!allowed) return true; // 제한 없으면 모든 연령 접근 가능
  return allowed.includes(ageGroup);
}

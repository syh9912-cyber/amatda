import type { TFunction } from 'i18next';
import {
  type SurveyQuestion,
  LIKERT_OPTIONS,
  getTranslatedQuestionsByAgeGroup,
  getAgeGroupFromMonths,
} from './onboardingQuestions';

export type { SurveyQuestion };
export { LIKERT_OPTIONS };

/** Backend-compatible question shape (legacy API fallback) */
export interface OnboardingQuestion {
  id: string;
  text: string;
  category: string;
  options: string[];
}

export type AgeGroup = 'm0' | 'm6' | 'm12' | 'm24' | 'm48' | 'm84';

/** Map months to the 3-tier age group used by the survey */
export function getAgeGroup(months: number): AgeGroup {
  return getAgeGroupFromMonths(months);
}

/** Get the 20 survey questions (translated) for a given age group */
export function getSurveyQuestions(t: TFunction, ageGroup: AgeGroup): SurveyQuestion[] {
  return getTranslatedQuestionsByAgeGroup(t, ageGroup);
}

/** Convert SurveyQuestion[] to legacy OnboardingQuestion[] for API fallback compat */
export function toLegacyQuestions(questions: SurveyQuestion[]): OnboardingQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    text: q.question,
    category: q.category,
    options: LIKERT_OPTIONS.map((o) => o.label),
  }));
}

/**
 * Legacy fallback questions kept very minimal.
 * Real questions now come from constants/onboardingQuestions.ts.
 */
export const FALLBACK_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'q1',
    category: '기질',
    text: '새로운 장소에 가면 아이의 반응은?',
    options: [
      '매우 그렇다',
      '그렇다',
      '보통이다',
      '아니다',
      '전혀 아니다',
    ],
  },
];

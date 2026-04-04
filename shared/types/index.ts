// ===== API 응답 표준 포맷 =====
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===== 사주/기질 관련 =====
export interface FiveElements {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
}

export type DominantType = '탐구형' | '활동형' | '조화형' | '분석형' | '감성형';

export interface Pillars {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export interface InnateData {
  pillars: Pillars;
  fiveElements: FiveElements;
  dominantType: DominantType;
  label: string;
}

/** 프론트엔드에서 사용하는 기질 데이터 (pillars 제외) */
export interface InnateDataPublic {
  fiveElements: FiveElements;
  dominantType: DominantType;
  label: string;
}

// ===== 연령 구간 =====
export type AgeGroup = 'infant' | 'toddler' | 'elementary';

export interface AgeInfo {
  months: number;
  group: AgeGroup;
  label: string;
}

// ===== User =====
export interface UserDto {
  id: string;
  email: string | null;
  authProvider: string;
  subscriptionTier: string;
}

// ===== Child =====
export interface ChildDto {
  id: string;
  name: string;
  gender: 'M' | 'F';
  birthDate: string;
  birthTime: string;
  innateData: InnateDataPublic;
  baseline: Record<string, unknown> | null;
  observedTraits: Record<string, unknown> | null;
  ageInfo: AgeInfo;
}

export interface CreateChildInput {
  name: string;
  gender: 'M' | 'F';
  birthDate: string;
  birthTime: string;
}

// ===== QuestionBank =====
export interface QuestionDto {
  id: string;
  targetAgeMin: number;
  targetAgeMax: number;
  sajuType: string;
  questionText: string;
  options: string[];
}

// ===== FoodGuide =====
export interface FoodGuideDto {
  id: string;
  targetAgeMin: number;
  targetAgeMax: number;
  suitableType: string;
  foods: FoodItem[];
}

export interface FoodItem {
  name: string;
  benefit: string;
  caution?: string;
}

// ===== Auth =====
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

// ===== Observation (Phase 4) =====
export interface ObservationDto {
  id: string;
  childId: string;
  type: 'TEXT' | 'VOICE';
  rawContent: string;
  extractedTraits: Record<string, unknown>;
  createdAt: string;
}

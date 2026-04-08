// ─── AI 응답 구조 ───

export interface CoachingAIResponse {
  redFlag?: string;
  judgement: string;
  reasons: string[];
  actions: string[];
  medical?: string;
  personalNote: string;
  followupQuestion?: string;
}

// ─── 프롬프트 컨텍스트 ───

export interface PromptContext {
  category: string;
  userMessage: string;
  childName: string;
  ageInfo: string;
  gender: string;
  temperament: string;
  specialNotes: string;
  sleepSummary: string;
  mealSummary: string;
  poopSummary: string;
  conditionSummary: string;
  recentChangeSummary: string;
  conversationSummary: string;
  recentChatTurns: string;
  dbCandidates: string[];
  cryAnalysisInput: string;
  poopAnalysisInput: string;
}

// ─── 레드 플래그 ───

export type RedFlagUrgency = 'emergency' | 'urgent' | 'monitor' | 'none';

export interface RedFlagResult {
  detected: boolean;
  flags: string[];
  urgency: RedFlagUrgency;
  message?: string;
}

// ─── 쓸모없는 질문 필터 ───

export interface FilterResult {
  isUseless: boolean;
  rejectionType?: 'vague' | 'irrelevant' | 'joke';
  rejectionMessage?: string;
}

// ─── DB 검색 결과 ───

export interface DBCandidate {
  id: string;
  category: string;
  generalAdvice: string;
  traitAdvice: string;
  reason: string;
  solutions: string[];
  score: number;
}

// ─── 아이 컨텍스트 ───

export interface ChildContext {
  name: string;
  ageInfo: string;
  ageMonths: number;
  gender: string;
  temperament: string;
  temperamentDetail: string;
  specialNotes: string;
  baseline: string;
  observedTraits: string;
}

export interface TrackingSummary {
  sleepSummary: string;
  mealSummary: string;
  poopSummary: string;
  conditionSummary: string;
  recentChangeSummary: string;
}

// ─── 대화 컨텍스트 ───

export interface ConversationTurn {
  role: 'parent' | 'coach';
  text: string;
  timestamp: string;
}

export interface ConversationContext {
  summary: string;
  recentTurns: ConversationTurn[];
  turnCount: number;
}

// ─── 사용자 티어 ───

export type UserTier = 'free' | 'paid';

export interface TierConfig {
  maxOutputTokens: number;
  dbCandidateCount: number;
  summaryLines: number;
  contextDays: number;
  dailyLimit: number;
}

export const TIER_CONFIGS: Record<UserTier, TierConfig> = {
  free: {
    maxOutputTokens: 800,
    dbCandidateCount: 2,
    summaryLines: 3,
    contextDays: 1,
    dailyLimit: 200,
  },
  paid: {
    maxOutputTokens: 1000,
    dbCandidateCount: 4,
    summaryLines: 8,
    contextDays: 7,
    dailyLimit: 999,
  },
};

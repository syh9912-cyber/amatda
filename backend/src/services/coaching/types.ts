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
  temperamentDetail: string;
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
  parentEmotion: string;
  emotionToneGuide: string;
  redFlagContext: string;
  observedTraits: string;
  timeEmpathyHint: string;
  milestoneContext: string;
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
  // ─── 임산부 전용 ───
  isPregnant: boolean;
  pregnancyWeeks?: number;
  dueDate?: string;
  babyNickname?: string;    // 태명
  pregnancyNotes?: string;  // 임신 특이사항
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
    maxOutputTokens: 900,
    dbCandidateCount: 4,      // 무료도 DB 전체 참고 (유료 전환을 위해 무료 경험 강화)
    summaryLines: 5,
    contextDays: 7,
    dailyLimit: 10,            // 레벨업으로 증가 가능
  },
  paid: {
    maxOutputTokens: 1200,
    dbCandidateCount: 4,
    summaryLines: 8,
    contextDays: 7,
    dailyLimit: 999,
  },
};

// ─── 무료 사용자 코칭 일일 한도 (단일 값) ───
// 이전: USER_LEVELS 시스템 (연속접속 streak 기반 레벨업 → 레벨별 dailyLimit)
// 정책 변경: 모든 무료 사용자 일일 10회 단일 정책으로 통일.
export const FREE_DAILY_LIMIT = 10;

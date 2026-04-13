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

// ─── 레벨업 시스템 (무료 사용자 연속 기록 보상) ───

export interface UserLevel {
  level: number;
  name: string;
  minDays: number;
  dailyLimit: number;        // 해당 레벨의 하루 상담 횟수
  badge: string;
}

export const USER_LEVELS: UserLevel[] = [
  { level: 1, name: '새싹 부모', minDays: 0, dailyLimit: 10, badge: 'sprout' },
  { level: 2, name: '줄기 부모', minDays: 7, dailyLimit: 15, badge: 'stem' },
  { level: 3, name: '꽃봉오리 부모', minDays: 14, dailyLimit: 20, badge: 'bud' },
  { level: 4, name: '만개 부모', minDays: 30, dailyLimit: 30, badge: 'bloom' },
  { level: 5, name: '열매 부모', minDays: 60, dailyLimit: 50, badge: 'fruit' },
];

export function getLevelByStreak(streakDays: number): UserLevel {
  for (let i = USER_LEVELS.length - 1; i >= 0; i--) {
    if (streakDays >= USER_LEVELS[i].minDays) return USER_LEVELS[i];
  }
  return USER_LEVELS[0];
}

export function getNextLevel(current: UserLevel): UserLevel | null {
  const idx = USER_LEVELS.findIndex((l) => l.level === current.level);
  return idx < USER_LEVELS.length - 1 ? USER_LEVELS[idx + 1] : null;
}

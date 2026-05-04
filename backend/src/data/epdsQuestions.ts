/**
 * EPDS (Edinburgh Postnatal Depression Scale) 한국어 문항 데이터.
 *
 * - 표준 10문항: 산전·산후 우울 자가검사 도구. 공개 임상 자료 기반 한국어 번역.
 * - 채점:
 *   - 문항 1, 2 = 긍정 문항 (역채점) → score = 3 - answer
 *   - 문항 3~10 = 부정 문항 (정채점) → score = answer
 *   - 총점 0~30
 * - 사용자 응답은 모두 0~3 (전혀 그렇지 않다 / 가끔 / 자주 / 항상).
 * - 문항 10 (자해 생각) 이 1점 이상이면 무조건 urgent.
 *
 * stage 별 extra 문항: 임신/산후 단계 특화 보조 문항. 점수 합산엔 포함하지 않고
 * Firestore 에 별도 저장 (분석/추후 코칭 활용).
 */

export interface EpdsQuestion {
  id: number;
  text: string;
}

/** EPDS 표준 10문항 (모든 stage 공통, 채점 대상) */
export const EPDS_QUESTIONS: EpdsQuestion[] = [
  { id: 1, text: '우스운 것을 보고 웃을 수 있었고 그 상황을 즐길 수 있었다' },
  { id: 2, text: '어떤 일들에 대해 즐거운 마음으로 기대하였다' },
  { id: 3, text: '일이 잘못될 때면 지나치게 자신을 탓했다' },
  { id: 4, text: '별 이유 없이 불안해지거나 걱정이 되었다' },
  { id: 5, text: '별 이유 없이 무섭거나 안절부절 못하였다' },
  { id: 6, text: '여러 가지 일들이 힘에 부치게 느껴졌다' },
  { id: 7, text: '너무 불행하다고 느껴서 잠을 잘 못 잤다' },
  { id: 8, text: '슬프거나 비참하다고 느꼈다' },
  { id: 9, text: '너무 불행하다고 느껴서 울었다' },
  { id: 10, text: '자해를 하고 싶다는 생각이 들었다' },
];

/** stage 별 보조(extra) 문항 — 채점엔 포함 X, 분석 보조용 */
export const EPDS_EXTRA_BY_STAGE: Record<string, EpdsQuestion[]> = {
  prenatal: [
    { id: 101, text: '태동·태아 건강에 대한 걱정이 계속 떠오른다' },
    { id: 102, text: '출산이 가까워질수록 두려움이 커진다' },
  ],
  postpartum_early: [
    { id: 201, text: '수면 부족으로 일상이 무너지는 느낌이 든다' },
    { id: 202, text: '모유수유나 분유 결정에 대한 압박감이 크다' },
  ],
  postpartum_mid: [
    { id: 301, text: '나 자신이 사라지고 엄마 역할만 남은 느낌이 든다' },
    { id: 302, text: '주변과 단절된 듯한 외로움을 자주 느낀다' },
  ],
  postpartum_late: [
    { id: 401, text: '복직 또는 가사 분담에 대한 불안이 크다' },
    { id: 402, text: '아이 발달이 또래보다 늦은 것 같아 자주 비교한다' },
  ],
  general: [],
};

/** 문항 ID 가 긍정 채점(역채점) 대상인지 — 1, 2 번만 해당 */
export function isReverseScored(questionId: number): boolean {
  return questionId === 1 || questionId === 2;
}

/**
 * EPDS 점수 계산.
 * @param answers 길이 10, 각 0~3 (사용자 입력)
 * @returns 0~30 총점
 */
export function calcEpdsScore(answers: number[]): number {
  if (!Array.isArray(answers) || answers.length !== EPDS_QUESTIONS.length) {
    throw new Error(`EPDS answers 길이 오류 — 기대 ${EPDS_QUESTIONS.length}, 실제 ${answers?.length}`);
  }
  let total = 0;
  for (let i = 0; i < EPDS_QUESTIONS.length; i++) {
    const raw = Number(answers[i] ?? 0);
    const clamped = Math.max(0, Math.min(3, raw));
    const q = EPDS_QUESTIONS[i];
    total += isReverseScored(q.id) ? 3 - clamped : clamped;
  }
  return total;
}

export type EpdsRiskLevel = 'low' | 'mild' | 'moderate' | 'high' | 'urgent';

/**
 * 5단계 위험도 분류.
 * - 문항 10 (자해 생각) 이 1점 이상이면 무조건 urgent (안전 우선).
 * - 그 외엔 총점 기반.
 */
export function classifyRiskLevel(totalScore: number, answers: number[]): EpdsRiskLevel {
  // 문항 10 자해 생각 — index 9
  const selfHarm = Number(answers[9] ?? 0);
  if (selfHarm >= 1) return 'urgent';

  if (totalScore >= 20) return 'urgent';
  if (totalScore >= 16) return 'high';
  if (totalScore >= 13) return 'moderate';
  if (totalScore >= 10) return 'mild';
  return 'low';
}

/** 위험도별 사용자 안내 메시지 */
export function riskMessage(level: EpdsRiskLevel): string {
  switch (level) {
    case 'low':
      return '지금은 안정적인 상태로 보여요. 꾸준히 자신을 돌봐주세요.';
    case 'mild':
      return '약간의 스트레스가 있어요. 충분히 쉬고 가족과 대화를 나누세요.';
    case 'moderate':
      return '경미한 우울감이 있어요. 가까운 보건소 산모정신건강 상담을 권장해요.';
    case 'high':
      return '뚜렷한 우울감이 있어요. 산후우울 전문기관 상담을 권합니다 (보건소 모자보건사업 1644-7414).';
    case 'urgent':
      return '지금 많이 힘들어 보여요. 혼자 견디지 말고 즉시 도움을 받으세요. — 정신건강 위기상담 ☎ 1577-0199 / 자살예방 ☎ 1393 / 응급 시 119';
  }
}

/**
 * 다음 권장 검사 일자 — 위험도 따라 간격 조절.
 * urgent/high 는 1주, moderate 는 2주, mild 는 3주, low 는 4주.
 */
export function nextRecommendedDate(level: EpdsRiskLevel, base: Date = new Date()): string {
  const days = level === 'urgent' || level === 'high' ? 7 : level === 'moderate' ? 14 : level === 'mild' ? 21 : 28;
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

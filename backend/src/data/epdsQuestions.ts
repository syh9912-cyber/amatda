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

/* ─── 비한국어 로케일 EPDS 문항 (추가형) — 위 한국어 원본/채점 로직은 무변경 ───
 * id는 한국어판과 동일하게 유지 (채점은 id 순서 기반이 아니라 배열 index 기반이므로
 * EPDS_QUESTIONS 와 EPDS_QUESTIONS_JA/ZH 는 반드시 같은 길이·같은 순서를 유지해야 함). */
export const EPDS_QUESTIONS_JA: EpdsQuestion[] = [
  { id: 1, text: '面白いことを見て笑うことができ、物事を楽しむことができた' },
  { id: 2, text: '物事を楽しみに待つことができた' },
  { id: 3, text: '物事がうまくいかないとき、必要以上に自分を責めた' },
  { id: 4, text: 'これといった理由もないのに不安になったり、心配になったりした' },
  { id: 5, text: 'これといった理由もないのに恐怖に襲われたり、パニックになったりした' },
  { id: 6, text: 'いろいろなことが重荷に感じられた' },
  { id: 7, text: 'とても不幸せなので、眠れないことがあった' },
  { id: 8, text: '悲しくなったり、惨めになったりした' },
  { id: 9, text: 'とても不幸せなので、泣けてきた' },
  { id: 10, text: '自分自身を傷つけたいと思ったことがあった' },
];

export const EPDS_QUESTIONS_ZH: EpdsQuestion[] = [
  { id: 1, text: '我能看到事情有趣的一面，並笑得出來' },
  { id: 2, text: '我會很期待地想著一些事情' },
  { id: 3, text: '事情出錯時，我會不必要地責怪自己' },
  { id: 4, text: '我會無緣無故地感到焦慮或擔心' },
  { id: 5, text: '我會無緣無故地感到害怕或驚慌' },
  { id: 6, text: '很多事情讓我感到喘不過氣來' },
  { id: 7, text: '我因為太不快樂，以至於難以入睡' },
  { id: 8, text: '我感到難過或悲慘' },
  { id: 9, text: '我因為太不快樂而哭泣' },
  { id: 10, text: '我曾有過傷害自己的念頭' },
];

export const EPDS_EXTRA_BY_STAGE_JA: Record<string, EpdsQuestion[]> = {
  prenatal: [
    { id: 101, text: '胎動や胎児の健康について心配が絶えない' },
    { id: 102, text: '出産が近づくにつれて不安が大きくなる' },
  ],
  postpartum_early: [
    { id: 201, text: '睡眠不足で日常生活が崩れているように感じる' },
    { id: 202, text: '母乳やミルクの選択についてプレッシャーを強く感じる' },
  ],
  postpartum_mid: [
    { id: 301, text: '自分自身が消えて、母親役割だけが残った感じがする' },
    { id: 302, text: '周囲から孤立しているような孤独感をよく感じる' },
  ],
  postpartum_late: [
    { id: 401, text: '職場復帰や家事分担について不安が大きい' },
    { id: 402, text: '子どもの発達が周りより遅れているようで、つい比較してしまう' },
  ],
  general: [],
};

export const EPDS_EXTRA_BY_STAGE_ZH: Record<string, EpdsQuestion[]> = {
  prenatal: [
    { id: 101, text: '一直很擔心胎動或胎兒的健康' },
    { id: 102, text: '隨著預產期接近，恐懼感越來越強烈' },
  ],
  postpartum_early: [
    { id: 201, text: '因為睡眠不足，感覺日常生活快要撐不住了' },
    { id: 202, text: '對於哺餵母乳或配方奶的選擇感到很大壓力' },
  ],
  postpartum_mid: [
    { id: 301, text: '感覺自己消失了，只剩下媽媽這個角色' },
    { id: 302, text: '常常感到與周遭隔絕般的孤獨' },
  ],
  postpartum_late: [
    { id: 401, text: '對於復職或家務分擔感到很不安' },
    { id: 402, text: '常拿孩子的發展跟其他孩子比較，覺得比較慢' },
  ],
  general: [],
};

/** 로케일에 맞는 EPDS 표준 10문항 반환 (기본: 한국어) */
export function getEpdsQuestions(locale?: string): EpdsQuestion[] {
  if (locale === 'ja') return EPDS_QUESTIONS_JA;
  if (locale === 'zh-Hant') return EPDS_QUESTIONS_ZH;
  return EPDS_QUESTIONS;
}

/** 로케일에 맞는 stage별 보조 문항 반환 (기본: 한국어) */
export function getEpdsExtraByStage(stage: string, locale?: string): EpdsQuestion[] {
  if (locale === 'ja') return EPDS_EXTRA_BY_STAGE_JA[stage] ?? [];
  if (locale === 'zh-Hant') return EPDS_EXTRA_BY_STAGE_ZH[stage] ?? [];
  return EPDS_EXTRA_BY_STAGE[stage] ?? [];
}

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

// 비한국어 로케일 위기상담 연락처 (추가형) — 실존 확인된 공공 연락처만 사용
const RISK_MESSAGE_JA: Record<EpdsRiskLevel, string> = {
  low: '今は安定した状態のようです。これからも自分を大切にしてくださいね。',
  mild: '少しストレスが溜まっているようです。十分に休んで、ご家族と話す時間を持ってください。',
  moderate: '軽い落ち込みが見られます。お住まいの地域の保健センターや産婦人科への相談をおすすめします。',
  high: 'はっきりとした落ち込みが見られます。産後うつの専門機関への相談をおすすめします（よりそいホットライン ☎ 0120-279-338・24時間対応）。',
  urgent: '今、とてもつらい状態のようです。一人で抱え込まず、すぐに助けを求めてください。— よりそいホットライン ☎ 0120-279-338（24時間）／ 緊急時は119',
};

const RISK_MESSAGE_ZH: Record<EpdsRiskLevel, string> = {
  low: '目前狀態看起來很穩定，請持續好好照顧自己。',
  mild: '有一些壓力累積，請充分休息並多和家人聊聊。',
  moderate: '有輕微的憂鬱情緒，建議諮詢當地的衛生所或婦產科。',
  high: '有明顯的憂鬱情緒，建議尋求產後憂鬱專業機構協助（安心專線 ☎ 1925・24小時）。',
  urgent: '現在似乎很辛苦，請不要獨自承受，立即尋求協助。— 安心專線 ☎ 1925（24小時）／ 如遇緊急狀況請撥打當地緊急電話',
};

/** 위험도별 사용자 안내 메시지 (기본: 한국어) */
export function riskMessage(level: EpdsRiskLevel, locale?: string): string {
  if (locale === 'ja') return RISK_MESSAGE_JA[level];
  if (locale === 'zh-Hant') return RISK_MESSAGE_ZH[level];
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

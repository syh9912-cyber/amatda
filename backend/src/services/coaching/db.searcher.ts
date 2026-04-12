import { DBCandidate } from './types';
import { COACHING_KNOWLEDGE, CoachingEntry } from '../coaching.knowledge';
import { COACHING_KNOWLEDGE_ELEM_LOW } from '../coaching.knowledge.elementary-low';
import { COACHING_KNOWLEDGE_ELEM_LOW2 } from '../coaching.knowledge.elementary-low2';
import { COACHING_KNOWLEDGE_ELEM_LOW3 } from '../coaching.knowledge.elementary-low3';
import { COACHING_KNOWLEDGE_ELEM_HIGH } from '../coaching.knowledge.elementary-high';
import { COACHING_KNOWLEDGE_ELEM_HIGH2 } from '../coaching.knowledge.elementary-high2';
import { COACHING_KNOWLEDGE_ELEM_HIGH3 } from '../coaching.knowledge.elementary-high3';

/** 연령대별 DB 선택 */
function getKnowledgeByAge(ageMonths: number): CoachingEntry[] {
  if (ageMonths <= 72) {
    // 0~6세: 영유아 DB (기존 140개)
    return COACHING_KNOWLEDGE;
  }
  if (ageMonths <= 108) {
    // 7~9세: 초등 저학년 DB (135개)
    return [
      ...COACHING_KNOWLEDGE_ELEM_LOW,
      ...COACHING_KNOWLEDGE_ELEM_LOW2,
      ...COACHING_KNOWLEDGE_ELEM_LOW3,
    ];
  }
  // 10~12세: 초등 고학년 DB (135개)
  return [
    ...COACHING_KNOWLEDGE_ELEM_HIGH,
    ...COACHING_KNOWLEDGE_ELEM_HIGH2,
    ...COACHING_KNOWLEDGE_ELEM_HIGH3,
  ];
}

const CATEGORY_MAP: Record<string, string> = {
  crying: '울음', sleep: '수면', eating: '식사', poop: '대변',
  social: '사회성', growth: '성장', behavior: '행동', etc: '기타',
};

function isValidMatch(message: string, keyword: string): boolean {
  if (keyword.length > 2) return message.includes(keyword);
  const idx = message.indexOf(keyword);
  if (idx < 0) return false;
  const before = idx > 0 ? message.charCodeAt(idx - 1) : 0;
  const isKorean = (c: number) => c >= 0xAC00 && c <= 0xD7AF;
  if (isKorean(before)) return false;
  return true;
}

function scoreEntry(
  entry: CoachingEntry,
  message: string,
  categoryHint?: string,
  dominantType?: string,
): number {
  let score = 0;
  for (const keyword of entry.keywords) {
    if (keyword.length < 2) continue;
    if (isValidMatch(message, keyword)) {
      score += keyword.length * 2;
    } else if (keyword.includes(' ')) {
      const parts = keyword.split(/\s+/).filter((w) => w.length >= 1);
      const matched = parts.filter((p) => isValidMatch(message, p));
      if (matched.length === parts.length) {
        score += keyword.length;
      }
    }
  }

  // 카테고리 일치 보너스 (3 → 8로 강화)
  const hintKo = categoryHint ? (CATEGORY_MAP[categoryHint] ?? categoryHint) : null;
  if (hintKo && entry.category === hintKo) {
    score += 8;
  }

  // 기질별 맞춤 조언이 있으면 보너스
  if (dominantType && entry.traitAdvice[dominantType]) {
    score += 4;
  }

  return score;
}

/** DB에서 상위 N개 유사 엔트리 검색 (연령대별 자동 분기) */
export function findTopCoachingEntries(
  message: string,
  category?: string,
  dominantType?: string,
  limit = 3,
  ageMonths = 12
): DBCandidate[] {
  const db = getKnowledgeByAge(ageMonths);
  const scored: Array<{ entry: CoachingEntry; score: number }> = [];

  for (const entry of db) {
    const score = scoreEntry(entry, message, category, dominantType);
    if (score >= 4) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  return top.map(({ entry, score }) => ({
    id: entry.id,
    category: entry.category,
    generalAdvice: entry.generalAdvice,
    traitAdvice: dominantType
      ? (entry.traitAdvice[dominantType] ?? entry.generalAdvice)
      : entry.generalAdvice,
    reason: entry.reason,
    solutions: entry.solution,
    score,
  }));
}

/** DB 후보를 프롬프트용 텍스트로 포맷 */
export function formatCandidatesForPrompt(candidates: DBCandidate[]): string[] {
  return candidates.map((c, i) => {
    const sols = c.solutions.slice(0, 3).join(' / ');
    return `[참고${i + 1}] (${c.category}) ${c.traitAdvice} | 이유: ${c.reason} | 방법: ${sols}`;
  });
}

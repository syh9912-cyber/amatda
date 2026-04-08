import { collections } from '../firestore';
import { ConversationContext, ConversationTurn, UserTier, TIER_CONFIGS } from './types';
import { env } from '../../config/env';

const SUMMARIZE_THRESHOLD = 5;

/** 대화 컨텍스트 조회 (요약 + 최근 3턴) */
export async function getConversationContext(
  userId: string,
  childId: string,
  tier: UserTier = 'free'
): Promise<ConversationContext> {
  const docId = `${userId}_${childId}`;
  const config = TIER_CONFIGS[tier];

  try {
    const doc = await collections.conversationSummaries.doc(docId).get();
    if (!doc.exists) {
      return { summary: '', recentTurns: [], turnCount: 0 };
    }

    const data = doc.data() as Record<string, unknown>;
    const summary = (data.summary as string) || '';
    const recentTurns = (data.recentTurns as ConversationTurn[]) || [];
    const turnCount = (data.totalTurnCount as number) || 0;

    // 티어에 따라 요약 길이 제한
    const trimmedSummary = trimSummary(summary, config.summaryLines);

    return {
      summary: trimmedSummary,
      recentTurns: recentTurns.slice(-3),
      turnCount,
    };
  } catch {
    return { summary: '', recentTurns: [], turnCount: 0 };
  }
}

/** 새 턴 추가 + 필요시 요약 갱신 */
export async function updateConversationSummary(
  userId: string,
  childId: string,
  parentMessage: string,
  coachResponse: string
): Promise<void> {
  const docId = `${userId}_${childId}`;
  const now = new Date().toISOString();

  try {
    const doc = await collections.conversationSummaries.doc(docId).get();

    const newTurns: ConversationTurn[] = [
      { role: 'parent', text: parentMessage, timestamp: now },
      { role: 'coach', text: coachResponse, timestamp: now },
    ];

    if (!doc.exists) {
      await collections.conversationSummaries.doc(docId).set({
        userId,
        childId,
        summary: '',
        recentTurns: newTurns,
        totalTurnCount: 2,
        lastSummarizedAt: now,
        updatedAt: now,
      });
      return;
    }

    const data = doc.data() as Record<string, unknown>;
    const existingTurns = (data.recentTurns as ConversationTurn[]) || [];
    const totalCount = ((data.totalTurnCount as number) || 0) + 2;
    const allTurns = [...existingTurns, ...newTurns];

    // 5턴 이상이면 오래된 턴을 요약으로 압축
    if (allTurns.length >= SUMMARIZE_THRESHOLD) {
      const oldTurns = allTurns.slice(0, -3);
      const keepTurns = allTurns.slice(-3);
      const existingSummary = (data.summary as string) || '';
      const newSummary = await compressTurns(existingSummary, oldTurns);

      await collections.conversationSummaries.doc(docId).set({
        userId,
        childId,
        summary: newSummary,
        recentTurns: keepTurns,
        totalTurnCount: totalCount,
        lastSummarizedAt: now,
        updatedAt: now,
      });
    } else {
      await collections.conversationSummaries.doc(docId).update({
        recentTurns: allTurns,
        totalTurnCount: totalCount,
        updatedAt: now,
      });
    }
  } catch {
    // 요약 실패해도 상담은 계속
  }
}

/** 오래된 턴을 요약으로 압축 */
async function compressTurns(
  existingSummary: string,
  turns: ConversationTurn[]
): Promise<string> {
  const turnsText = turns
    .map((t) => `${t.role === 'parent' ? '부모' : '코치'}: ${t.text.slice(0, 80)}`)
    .join('\n');

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey || env.MOCK_AI) {
    return compressFallback(existingSummary, turns);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `아래 육아 상담 대화를 5~8줄 핵심 요약으로 압축하세요. 한국어로, 불릿 포인트 형식으로.

기존 요약:
${existingSummary || '(없음)'}

새 대화:
${turnsText}

요약 (5~8줄, - 로 시작):`,
            }],
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
        }),
      }
    );

    const data = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text
      ?? compressFallback(existingSummary, turns);
  } catch {
    return compressFallback(existingSummary, turns);
  }
}

/** Gemini 없을 때 단순 키워드 기반 압축 */
function compressFallback(
  existingSummary: string,
  turns: ConversationTurn[]
): string {
  const parentMsgs = turns
    .filter((t) => t.role === 'parent')
    .map((t) => `- 부모 질문: ${t.text.slice(0, 40)}`)
    .slice(-3);
  const coachMsgs = turns
    .filter((t) => t.role === 'coach')
    .map((t) => `- 코치 답변: ${t.text.slice(0, 40)}`)
    .slice(-3);

  const lines = [
    ...(existingSummary ? [existingSummary.split('\n').slice(-3).join('\n')] : []),
    ...parentMsgs,
    ...coachMsgs,
  ];
  return lines.slice(-8).join('\n');
}

/** 요약을 N줄로 제한 */
function trimSummary(summary: string, maxLines: number): string {
  if (!summary) return '';
  const lines = summary.split('\n').filter((l) => l.trim());
  return lines.slice(-maxLines).join('\n');
}

/** 대화 턴을 프롬프트용 텍스트로 포맷 */
export function formatRecentTurns(turns: ConversationTurn[]): string {
  if (turns.length === 0) return '(이전 대화 없음)';
  return turns
    .map((t) => `${t.role === 'parent' ? '부모' : '코치'}: ${t.text.slice(0, 150)}`)
    .join('\n');
}

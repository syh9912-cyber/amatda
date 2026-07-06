import * as admin from 'firebase-admin';
import { collections } from '../services/firestore';
import { getContextUserId } from './requestContext';
import { logger } from './logger';

/**
 * $ / 1M tokens. 2026-07 기준 공식 요금(각 제공사 pricing 페이지 확인) — 변동 시 이 값만 갱신.
 * gemini-3.1-flash-lite(과부하 폴백)는 공식 요금 미확인 — gemini.client.ts 주석 기준
 * "비슷한 비용"으로 2.5-flash-lite 와 동일하게 추정.
 */
const PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-3.1-flash-lite': { input: 0.10, output: 0.40 },
  'gpt-5-nano': { input: 0.05, output: 0.40 },
};

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING_USD_PER_1M[model];
  if (!p) return 0; // 미등록 모델 — 무단 추정 금지, 0으로 기록(요금표 갱신 필요 신호)
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

/** KST(UTC+9) 기준 오늘 날짜 문자열. rateLimit.ts 의 날짜 경계 기준과 동일. */
function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

interface RecordUsageInput {
  provider: 'gemini' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * AI 호출 1건의 토큰 사용량/비용을 기록. userId 는 요청 컨텍스트(AsyncLocalStorage)에서
 * 자동으로 가져옴 — gemini.client.ts/openai.client.ts 가 userId 를 몰라도 됨.
 * fire-and-forget: Firestore 쓰기 실패가 AI 응답 경로를 절대 막지 않는다.
 */
export function recordApiUsage(input: RecordUsageInput): void {
  const userId = getContextUserId();
  if (!userId) return; // 인증 컨텍스트 밖(스윕/웹훅 등)은 추적 대상 아님

  const { provider, model, inputTokens, outputTokens } = input;
  const totalTokens = inputTokens + outputTokens;
  const costUsd = estimateCostUsd(model, inputTokens, outputTokens);
  const date = todayKST();

  void (async () => {
    try {
      await collections.apiUsageLogs.doc().set({
        userId,
        provider,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        costUsd,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await collections.apiUsageDaily.doc(`${userId}_${date}`).set(
        {
          userId,
          date,
          callCount: admin.firestore.FieldValue.increment(1),
          inputTokens: admin.firestore.FieldValue.increment(inputTokens),
          outputTokens: admin.firestore.FieldValue.increment(outputTokens),
          totalTokens: admin.firestore.FieldValue.increment(totalTokens),
          costUsd: admin.firestore.FieldValue.increment(costUsd),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      logger.error('apiUsage/record', err instanceof Error ? err : new Error(String(err)));
    }
  })();
}

export interface UsageSummary {
  callCount: number;
  totalTokens: number;
  costUsd: number;
}

/**
 * 유저별 누적 사용량 맵(관리자 대시보드용). sinceDate('YYYY-MM-DD') 제공 시 그 이후만 집계.
 * apiUsageDaily 는 유저 수와 무관하게 쿼리 1회로 전체 집계(N+1 방지).
 */
export async function getUsageSummaryMap(sinceDate?: string): Promise<Map<string, UsageSummary>> {
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = collections.apiUsageDaily;
  if (sinceDate) query = query.where('date', '>=', sinceDate);

  const snap = await query.get();
  const map = new Map<string, UsageSummary>();
  snap.docs.forEach((doc) => {
    const v = doc.data();
    const uid = v.userId as string | undefined;
    if (!uid) return;
    const prev = map.get(uid) ?? { callCount: 0, totalTokens: 0, costUsd: 0 };
    prev.callCount += (v.callCount as number) || 0;
    prev.totalTokens += (v.totalTokens as number) || 0;
    prev.costUsd += (v.costUsd as number) || 0;
    map.set(uid, prev);
  });
  return map;
}

import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
    safetyRatings?: unknown;
  }[];
  promptFeedback?: { blockReason?: string; safetyRatings?: unknown };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number; // implicit cache hit token 수
  };
  error?: { message?: string };
}

export interface GeminiCallOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  mediaData?: { mimeType: string; base64: string };
  /** 'application/json' 지정 시 Gemini가 JSON 출력 보장 */
  responseMimeType?: string;
  /** controlled generation — 스키마 강제로 구조 100% 보장 (responseMimeType=application/json 와 함께) */
  responseSchema?: Record<string, unknown>;
}

/** Gemini API 사용 가능 여부 */
export function isGeminiAvailable(): boolean {
  return !!env.GEMINI_API_KEY && !env.MOCK_AI;
}

// ─── 과부하/일시 오류 재시도 (Gemini "high demand" 503 등) ───
// 운영 로그상 flash-lite 가 간헐적으로 "high demand" 에러를 반환 → 재시도 없이
// 즉시 mock 폴백되던 문제. 짧은 backoff 로 2회까지 재시도해 폴백 빈도를 낮춘다.
const GEMINI_MAX_ATTEMPTS = 3;

function isRetryableGeminiError(status: number, message: string): boolean {
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  return /high demand|overload|temporarily|try again later|unavailable|resource[_ ]?exhausted|rate limit/i.test(
    message,
  );
}

function geminiBackoffMs(attempt: number): number {
  return attempt === 1 ? 600 : 1400; // 1차 600ms, 2차 1400ms
}

function geminiSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Gemini API를 호출하고 텍스트 응답을 반환 */
export async function callGeminiText(
  prompt: string,
  options: GeminiCallOptions = {}
): Promise<string> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey || env.MOCK_AI) {
    throw new Error('MOCK_MODE');
  }

  const { systemPrompt, temperature = 0.4, maxTokens = 500, mediaData, responseMimeType, responseSchema } = options;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (mediaData) {
    parts.push({ inline_data: { mime_type: mediaData.mimeType, data: mediaData.base64 } });
  }

  const generationConfig: Record<string, unknown> = {
    temperature,
    maxOutputTokens: maxTokens,
  };
  if (responseMimeType) {
    generationConfig.responseMimeType = responseMimeType;
  }
  if (responseSchema) {
    generationConfig.responseSchema = responseSchema;
  }

  const body: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig,
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  let lastError: Error = new Error('Gemini 호출 실패');
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s 타임아웃
    let response: Response;
    try {
      response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (netErr) {
      // 네트워크/타임아웃 — 일시 오류로 보고 재시도
      clearTimeout(timeoutId);
      lastError = netErr instanceof Error ? netErr : new Error(String(netErr));
      if (attempt < GEMINI_MAX_ATTEMPTS) {
        logger.warn('gemini/retry', `attempt ${attempt} 네트워크 오류 → 재시도: ${lastError.message.slice(0, 80)}`);
        await geminiSleep(geminiBackoffMs(attempt));
        continue;
      }
      logger.error('gemini/network', lastError);
      throw lastError;
    } finally {
      clearTimeout(timeoutId);
    }

    const rawBody = await response.text();
    let data: GeminiResponse;
    try {
      data = JSON.parse(rawBody) as GeminiResponse;
    } catch {
      // 503 등에서 HTML 에러 페이지가 오는 경우 — HTTP 실패면 일시 오류로 보고 재시도
      lastError = new Error('Gemini response not JSON');
      if (!response.ok && attempt < GEMINI_MAX_ATTEMPTS) {
        logger.warn('gemini/retry', `attempt ${attempt} non-JSON(HTTP ${response.status}) → 재시도`);
        await geminiSleep(geminiBackoffMs(attempt));
        continue;
      }
      logger.error('gemini/parse', lastError, { rawPreview: rawBody.substring(0, 200) });
      throw lastError;
    }

    if (data.error) {
      const msg = data.error.message ?? '';
      lastError = new Error('Gemini API error: ' + msg);
      if (isRetryableGeminiError(response.status, msg) && attempt < GEMINI_MAX_ATTEMPTS) {
        logger.warn('gemini/retry', `attempt ${attempt} 과부하/일시오류 → 재시도: ${msg.slice(0, 80)}`);
        await geminiSleep(geminiBackoffMs(attempt));
        continue;
      }
      logger.error('gemini/api', lastError);
      throw lastError;
    }

    // ★ implicit cache hit 모니터링 — Gemini 2.5 자동 cache 효율 측정
    // promptTokenCount 중 cachedContentTokenCount 비율이 cache hit ratio
    const usage = data.usageMetadata;
    if (usage?.promptTokenCount && usage.promptTokenCount > 0) {
      const cached = usage.cachedContentTokenCount ?? 0;
      const total = usage.promptTokenCount;
      const ratio = total > 0 ? Math.round((cached / total) * 100) : 0;
      logger.info('gemini/usage', `prompt=${total} cached=${cached} (${ratio}%) output=${usage.candidatesTokenCount ?? 0}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) {
      const finishReason = data.candidates?.[0]?.finishReason ?? 'UNKNOWN';
      const blockReason = data.promptFeedback?.blockReason ?? 'NONE';
      logger.error(
        'gemini/empty',
        new Error(`Gemini empty response (finishReason=${finishReason}, blockReason=${blockReason})`),
        { finishReason, blockReason, fullPreview: JSON.stringify(data).substring(0, 500) },
      );
      throw new Error(`Gemini empty response (finishReason=${finishReason}, blockReason=${blockReason})`);
    }

    return text;
  }

  throw lastError;
}

/** Gemini API를 호출하고 JSON 응답을 파싱하여 반환 */
export async function callGeminiJSON<T = Record<string, unknown>>(
  prompt: string,
  options: GeminiCallOptions = {}
): Promise<T> {
  const text = await callGeminiText(prompt, options);

  // markdown 코드펜스 제거
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  let jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // 잘린 JSON 복구 시도
    const openIdx = cleaned.indexOf('{');
    if (openIdx >= 0) {
      let truncated = cleaned.substring(openIdx);
      const opens = (truncated.match(/\{/g) || []).length;
      const closes = (truncated.match(/\}/g) || []).length;
      for (let i = 0; i < opens - closes; i++) truncated += '}';
      truncated = truncated.replace(/,\s*$/, '');
      truncated = truncated.replace(/"[^"]*$/, '"');
      truncated = truncated.replace(/\[\s*("[^"]*",?\s*)*$/, (m) =>
        m.endsWith(']') ? m : m.replace(/,\s*$/, '') + ']'
      );
      jsonMatch = truncated.match(/\{[\s\S]*\}/);
    }
    if (!jsonMatch) {
      logger.error('gemini/no-json', new Error('JSON parse failed'), { textPreview: text.substring(0, 300) });
      throw new Error('JSON parse failed');
    }
  }

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    logger.error('gemini/json-parse', new Error('JSON parse failed'), { rawPreview: jsonMatch[0].substring(0, 300) });
    throw new Error('JSON parse failed');
  }
}

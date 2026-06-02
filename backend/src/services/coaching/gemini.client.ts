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
}

/** Gemini API 사용 가능 여부 */
export function isGeminiAvailable(): boolean {
  return !!env.GEMINI_API_KEY && !env.MOCK_AI;
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

  const { systemPrompt, temperature = 0.4, maxTokens = 500, mediaData, responseMimeType } = options;

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

  const body: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig,
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

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
  } finally {
    clearTimeout(timeoutId);
  }

  const rawBody = await response.text();
  let data: GeminiResponse;
  try {
    data = JSON.parse(rawBody) as GeminiResponse;
  } catch {
    logger.error('gemini/parse', new Error('Gemini response not JSON'), { rawPreview: rawBody.substring(0, 200) });
    throw new Error('Gemini response not JSON');
  }

  if (data.error) {
    logger.error('gemini/api', new Error('Gemini API error: ' + data.error.message));
    throw new Error('Gemini API error: ' + data.error.message);
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

import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { recordApiUsage } from '../../utils/apiUsage';

// 타사(OpenAI) 크로스 폴백 — Gemini 전체 실패(과부하) 시에만 사용.
// gpt-5-nano: 최저가($0.05/$0.40), 구조화출력(strict json_schema) 지원, reasoning minimal.
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-5-nano';

/** OpenAI 키가 설정되어 폴백 사용 가능한지 */
export function isOpenAIAvailable(): boolean {
  return !!env.OPENAI_API_KEY;
}

interface OpenAIJSONOptions {
  systemPrompt: string;
  /** OpenAI strict json_schema 의 schema 필드 (모든 키 required + additionalProperties:false) */
  responseSchema: Record<string, unknown>;
  maxTokens?: number;
}

interface OpenAIResponseShape {
  error?: { message?: string };
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** OpenAI Chat Completions(structured outputs)로 JSON 응답을 받아 파싱 */
export async function callOpenAIJSON<T = Record<string, unknown>>(
  prompt: string,
  options: OpenAIJSONOptions,
): Promise<T> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_NO_KEY');

  const { systemPrompt, responseSchema, maxTokens = 1100 } = options;

  const body = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    reasoning_effort: 'minimal', // 추론 최소화 → 저비용·저지연·잘림 방지
    max_completion_tokens: maxTokens,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'coaching_response', strict: true, schema: responseSchema },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const rawBody = await response.text();
  let data: OpenAIResponseShape;
  try {
    data = JSON.parse(rawBody) as OpenAIResponseShape;
  } catch {
    logger.error('openai/parse', new Error('OpenAI response not JSON'), { rawPreview: rawBody.substring(0, 200) });
    throw new Error('OpenAI response not JSON');
  }

  if (data.error) {
    logger.error('openai/api', new Error('OpenAI API error: ' + (data.error.message ?? '')));
    throw new Error('OpenAI API error: ' + (data.error.message ?? ''));
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('OpenAI empty response');
  }

  // 유저별 호출횟수/비용 기록 — API 호출 자체는 완료되어 과금 대상이므로 여기서 기록
  recordApiUsage({
    provider: 'openai',
    model: OPENAI_MODEL,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  });

  try {
    return JSON.parse(content) as T;
  } catch {
    logger.error('openai/json-parse', new Error('OpenAI JSON parse failed'), { preview: content.substring(0, 200) });
    throw new Error('OpenAI JSON parse failed');
  }
}

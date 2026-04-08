import { env } from '../../config/env';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export interface GeminiCallOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
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

  const { systemPrompt, temperature = 0.4, maxTokens = 500 } = options;

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const rawBody = await response.text();
  let data: GeminiResponse;
  try {
    data = JSON.parse(rawBody) as GeminiResponse;
  } catch {
    console.error('Gemini raw response not JSON:', rawBody.substring(0, 200));
    throw new Error('Gemini response not JSON');
  }

  if (data.error) {
    console.error('Gemini API error:', data.error.message);
    throw new Error('Gemini API error: ' + data.error.message);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) {
    console.error('Gemini empty response, full:', JSON.stringify(data).substring(0, 300));
    throw new Error('Gemini empty response');
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
      console.error('Gemini no JSON in response:', text.substring(0, 300));
      throw new Error('JSON parse failed');
    }
  }

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    console.error('Gemini JSON parse error, raw:', jsonMatch[0].substring(0, 300));
    throw new Error('JSON parse failed');
  }
}

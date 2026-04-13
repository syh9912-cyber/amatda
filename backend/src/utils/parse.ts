/** Firestore JSON 필드 안전 파싱 */
export function safeParse(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as Record<string, unknown>; } catch { return null; }
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

/** innateData 필드를 파싱하고 pillars를 제외한 public 데이터 반환 */
export function parseInnateData(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  const innate = typeof raw === 'string' ? JSON.parse(raw) as Record<string, unknown> : raw as Record<string, unknown>;
  const { pillars, ...publicInnate } = innate;
  return publicInnate;
}

/** innateData 필드를 파싱 (pillars 포함, 내부 서비스용) */
export function parseInnateDataFull(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'string') return JSON.parse(raw) as Record<string, unknown>;
  return raw as Record<string, unknown>;
}

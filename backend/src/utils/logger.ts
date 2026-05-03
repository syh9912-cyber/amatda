// Cloud Functions에서 console.error는 자동으로 Cloud Logging에 기록됨
// 운영 장애 추적을 위한 공통 로거
function safeStringify(v: unknown): string {
  if (v instanceof Error) return v.message;
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return String(v);
  try {
    // 일반 객체 — JSON.stringify (순환 참조 방지)
    return JSON.stringify(v, (_k, val) =>
      typeof val === 'bigint' ? val.toString() : val,
    );
  } catch {
    return String(v); // fallback
  }
}

export const logger = {
  error: (context: string, err: unknown, extra?: Record<string, unknown>) => {
    const message = safeStringify(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[${context}]`, message, { stack, ...extra });
  },
  warn: (context: string, msg: string, extra?: Record<string, unknown>) => {
    console.warn(`[${context}]`, msg, extra ?? {});
  },
  info: (context: string, msg: string, extra?: Record<string, unknown>) => {
    console.info(`[${context}]`, msg, extra ?? {});
  },
};

// Cloud Functions에서 console.error는 자동으로 Cloud Logging에 기록됨
// 운영 장애 추적을 위한 공통 로거
export const logger = {
  error: (context: string, err: unknown, extra?: Record<string, unknown>) => {
    const message = err instanceof Error ? err.message : String(err);
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

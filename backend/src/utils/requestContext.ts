import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  userId?: string;
}

/**
 * 요청 전역에 userId 를 전파하기 위한 Node 공식 AsyncLocalStorage 패턴.
 * (Sentry 등도 요청 컨텍스트 전파에 동일 API 사용 — 표준 방식)
 *
 * authMiddleware 가 req.userId 설정 직후 setContextUserId() 호출 →
 * 그 요청의 비동기 체인 어디서든(예: gemini.client.ts) getContextUserId() 로
 * "지금 이 호출이 어느 유저의 요청인지"를 파라미터 전달 없이 알 수 있다.
 * 호출부 17곳을 전부 고치지 않고 AI 사용량 기록 지점(2곳)만 수정하기 위한 설계.
 */
const als = new AsyncLocalStorage<RequestContext>();

/** 현재 비동기 컨텍스트의 userId. 인증된 요청 처리 도중이 아니면 undefined(스윕/웹훅 등). */
export function getContextUserId(): string | undefined {
  return als.getStore()?.userId;
}

/** authMiddleware 전용 — 이 시점 이후 같은 요청의 모든 비동기 체인에 userId 전파. */
export function setContextUserId(userId: string): void {
  als.enterWith({ userId });
}

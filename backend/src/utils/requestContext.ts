import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  userId?: string;
}

/**
 * 요청 전역에 userId 를 전파하기 위한 Node 공식 AsyncLocalStorage 패턴.
 *
 * authMiddleware 가 downstream 전체(next)를 runWithUserId() 로 감싸면, 그 요청의
 * 비동기 체인 어디서든(예: gemini.client.ts) getContextUserId() 로 "지금 이 호출이
 * 어느 유저의 요청인지"를 파라미터 전달 없이 알 수 있다. 호출부 17곳을 전부 고치지 않고
 * AI 사용량 기록 지점(2곳)만 수정하기 위한 설계.
 *
 * ⚠️ enterWith() 가 아니라 run() 을 쓴다: enterWith 는 현재 async 프레임을 복원 없이
 * in-place 변경하는 API 로, Node 공식 문서가 비권장하며(store leak 위험) keep-alive
 * 소켓에서 다음 요청의 pre-auth 구간에 이전 userId 컨텍스트가 잔존할 수 있다. run() 은
 * 콜백(=next) 실행 범위로 컨텍스트를 한정하고 종료 시 자동 복원하므로 요청 간 격리가
 * 보장된다 — 사용량/비용이 엉뚱한 유저에게 귀속되는 것을 원천 차단.
 */
const als = new AsyncLocalStorage<RequestContext>();

/** 현재 비동기 컨텍스트의 userId. 인증된 요청 처리 도중이 아니면 undefined(스윕/웹훅 등). */
export function getContextUserId(): string | undefined {
  return als.getStore()?.userId;
}

/**
 * authMiddleware 전용 — next(및 그 downstream 비동기 체인 전체)를 userId 컨텍스트로
 * 감싼다. 요청 종료 시 컨텍스트 자동 복원.
 */
export function runWithUserId(userId: string, next: () => void): void {
  als.run({ userId }, next);
}

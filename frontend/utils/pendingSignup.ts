/**
 * 회원가입 분리 흐름 임시 자격증명 보관소.
 *
 * register.tsx 가 이메일/비번/parentRole 수집 → 모듈 변수에 임시 저장 →
 * /onboarding/consent 로 이동 → consent 화면에서 약관 동의 후 authApi.register 최종 호출.
 *
 * 모듈 변수 사용 이유:
 *   - URL 파라미터에 비밀번호 노출 금지 (history, deep-link 위험)
 *   - AsyncStorage 에 비밀번호 평문 저장 금지
 *   - Zustand 같은 영구 store 도 비밀번호 보관 X — 메모리 휘발 변수만.
 *
 * 라이프사이클:
 *   - register 제출 시 set()
 *   - consent 화면에서 read 후 즉시 clear()
 *   - 가입 실패 시도 clear() — 다음 시도에서 stale 데이터 방지.
 */

interface PendingSignup {
  email: string;
  password: string;
  parentRole: string;
}

let cache: PendingSignup | null = null;

export const pendingSignup = {
  set(data: PendingSignup): void {
    cache = data;
  },
  get(): PendingSignup | null {
    return cache;
  },
  clear(): void {
    cache = null;
  },
  has(): boolean {
    return cache !== null;
  },
};

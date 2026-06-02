/**
 * 소셜 로그인 사용자 조회/생성 — race condition 방어.
 *
 * 배경:
 *  /social, /social-code, /kakao/callback 세 엔드포인트가 각각
 *  "socialId로 user 검색 → 없으면 email 검색 → 없으면 새로 생성" 흐름을 갖고 있었음.
 *  동일 사용자가 50ms 내 두 번 소셜 로그인하면 둘 다 "없음"으로 보고 user 두 개 생성됨.
 *
 * 해결:
 *  socialIdIndex/{provider}_{socialId} 결정적 ID 인덱스 컬렉션을 도입.
 *  Firestore transaction 안에서 이 인덱스 문서를 read → 없으면 user + index 동시 set.
 *  두 동시 요청이 같은 인덱스 ID에 set 시도하면 transaction이 retry → 한쪽이
 *  재시도 시 인덱스 문서가 이미 있어 기존 user 반환.
 *
 * 호환성:
 *  배포 시점 이전에 가입한 user 는 인덱스 문서가 없음. 이들이 다시 로그인하면
 *  email 매칭 또는 socialId 직접 query 로 찾고, 그때 인덱스 문서를 lazy 생성한다.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { db, collections, genId } from './firestore';
import type { SocialProvider, SocialUserInfo } from './social.auth';

function indexDocId(provider: SocialProvider, socialId: string): string {
  return `${provider}_${socialId}`;
}

export interface FindOrCreateSocialUserResult {
  userId: string;
  email: string | null;
  nickname: string | null;
  isNewUser: boolean;
}

/**
 * 소셜 사용자 조회 or 생성을 race-safe하게 처리.
 *
 * 흐름:
 *  1) 인덱스 문서 read (deterministic id)
 *     - 있고 user 문서도 있음 → 기존 user 반환
 *     - 있지만 user 삭제됨 → 인덱스만 남은 고아 케이스, 새로 생성
 *  2) socialId 로 직접 query (인덱스 없는 legacy user 호환)
 *     - 발견 → user 반환 + 인덱스 lazy 생성
 *  3) email 로 매칭 (LOCAL 가입자가 소셜 추가 연결)
 *     - 발견 → user.socialId/authProvider 갱신 + 인덱스 생성
 *  4) 모두 실패 → 새 user 생성 + 인덱스 생성
 */
export async function findOrCreateSocialUser(
  provider: SocialProvider,
  socialUser: SocialUserInfo,
): Promise<FindOrCreateSocialUserResult> {
  const indexRef = collections.socialIdIndex.doc(indexDocId(provider, socialUser.socialId));

  return db.runTransaction(async (tx) => {
    // 1) 인덱스 hit
    const indexSnap = await tx.get(indexRef);
    if (indexSnap.exists) {
      const idxUserId = (indexSnap.data() as { userId?: string }).userId;
      if (idxUserId) {
        const userSnap = await tx.get(collections.users.doc(idxUserId));
        if (userSnap.exists) {
          const data = userSnap.data() as Record<string, unknown>;
          return {
            userId: idxUserId,
            email: (data.email as string | null | undefined) ?? socialUser.email,
            nickname: (data.nickname as string | null | undefined) ?? null,
            isNewUser: false,
          };
        }
        // 인덱스만 남고 user 가 사라진 케이스 → 인덱스 덮어쓰기로 새 user 생성
      }
    }

    // 2) legacy: socialId 직접 query
    const bySocialQuery = collections.users
      .where('socialId', '==', socialUser.socialId)
      .where('authProvider', '==', provider)
      .limit(1);
    const bySocialSnap = await tx.get(bySocialQuery);
    if (!bySocialSnap.empty) {
      const doc = bySocialSnap.docs[0];
      const data = doc.data();
      // 인덱스 lazy 생성
      tx.set(indexRef, {
        userId: doc.id,
        provider,
        socialId: socialUser.socialId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return {
        userId: doc.id,
        email: (data.email as string | null | undefined) ?? null,
        nickname: (data.nickname as string | null | undefined) ?? null,
        isNewUser: false,
      };
    }

    // 3) email 매칭 — LOCAL 계정이 있으면 자동 연결 안 함 (CRITICAL takeover 방지).
    //
    // 보안 점검 (2026-05-04): 카카오 email 등 소셜 제공 email 로 기존 LOCAL 계정에
    // 자동 연결하던 코드는 다음 시나리오로 takeover 가능:
    //   1) 피해자가 abc@kakao.com 으로 LOCAL 가입
    //   2) 공격자가 abc@kakao.com 인증 안 된 카카오 계정 생성
    //   3) 공격자가 카카오 로그인 → 우리 백엔드가 이메일 매칭 → 피해자 LOCAL 계정에 socialId 덮어씀
    //   4) 공격자는 카카오로 피해자 계정 침입 가능
    //
    // 이제 email 만으로는 자동 연결 X. 같은 email LOCAL 계정이 있으면 새 user 생성하지 않고
    // 명시적 연결 동의 흐름 필요 (현재는 안내 후 차단).
    if (socialUser.email) {
      const byEmailQuery = collections.users
        .where('email', '==', socialUser.email)
        .limit(1);
      const byEmailSnap = await tx.get(byEmailQuery);
      if (!byEmailSnap.empty) {
        const doc = byEmailSnap.docs[0];
        const data = doc.data();
        const existingProvider = (data.authProvider as string | undefined) ?? 'LOCAL';
        // 같은 provider 면 안전한 매칭 (예: 카카오 사용자가 이메일은 같은데 이전에 socialId 가
        // 다른 카카오 계정으로 가입한 케이스 — 보통 발생 안 하나 안전)
        if (existingProvider === provider) {
          tx.update(doc.ref, { socialId: socialUser.socialId });
          tx.set(indexRef, {
            userId: doc.id,
            provider,
            socialId: socialUser.socialId,
            createdAt: FieldValue.serverTimestamp(),
          });
          return {
            userId: doc.id,
            email: (data.email as string | null | undefined) ?? socialUser.email,
            nickname: (data.nickname as string | null | undefined) ?? null,
            isNewUser: false,
          };
        }
        // 다른 provider (LOCAL 또는 다른 소셜) 와는 자동 연결 차단
        const conflictErr = new Error(
          `이미 ${existingProvider === 'LOCAL' ? '이메일/비밀번호' : existingProvider} 로 가입된 이메일이에요. ` +
          `해당 방법으로 로그인 후 설정에서 ${provider} 계정을 연결해주세요.`,
        );
        // 사용자 오류 (409) — 라우트에서 500 분류 방지 마커
        (conflictErr as Error & { statusCode?: number }).statusCode = 409;
        throw conflictErr;
      }
    }

    // 4) 새 user 생성
    const newUserId = genId();
    tx.set(collections.users.doc(newUserId), {
      email: socialUser.email,
      passwordHash: null,
      authProvider: provider,
      socialId: socialUser.socialId,
      subscriptionTier: 'FREE',
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(indexRef, {
      userId: newUserId,
      provider,
      socialId: socialUser.socialId,
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      userId: newUserId,
      email: socialUser.email,
      nickname: null,
      isNewUser: true,
    };
  });
}

/**
 * 사용자 cascade 삭제 — 회원 탈퇴(즉시) + 휴면 자동 삭제(스케줄러) 양쪽이 공유.
 *
 * Firestore 모든 관련 컬렉션 + 자녀 cascade + Storage 파일까지 모두 정리.
 * PIPA 21조(파기 의무) 및 Google Play / Apple App Store 컴플라이언스 충족.
 *
 * 사용처:
 *   - DELETE /api/auth/account  (사용자 본인 요청)
 *   - dormantUserSweep         (1년 휴면 + 30일 경고 후 자동 삭제)
 *
 * 호출자가 책임질 부분:
 *   - 인증/권한 체크 (이 함수는 userId 만 받음)
 *   - 소셜 unlink (선택) — `tryUnlink: true` 시 best-effort 시도
 *   - refreshToken family revoke 는 본 함수가 자동 처리
 */
import { collections, db } from '../services/firestore';
import { deleteUserStorageFiles } from './storageCleanup';
import { unlinkSocialAccount, SocialProvider } from '../services/social.auth';
import { decryptToken } from './crypto';
import { logger } from './logger';

const COLLECTION_FETCH_LIMIT = 5000;
const BATCH_LIMIT = 500;

export interface CascadeDeleteOptions {
  /** true 면 소셜 연결 해제(unlink) 시도. 실패해도 데이터 삭제는 진행. */
  tryUnlink?: boolean;
  /** 호출 컨텍스트 (로그용) — 'user-request' | 'dormant-sweep' 등 */
  reason?: string;
}

export interface CascadeDeleteResult {
  deletedRefs: number;
  unlinkAttempted: boolean;
  unlinkSucceeded: boolean;
}

/**
 * userId 의 모든 데이터를 Firestore + Storage 에서 영구 삭제.
 *
 * 멱등성: 같은 userId 로 두 번 호출해도 안전 (이미 없는 문서는 silently skip).
 * best-effort: Storage 정리가 실패해도 Firestore 삭제는 완료된 상태로 유지.
 */
export async function cascadeDeleteUserData(
  userId: string,
  options: CascadeDeleteOptions = {},
): Promise<CascadeDeleteResult> {
  if (!userId) {
    throw new Error('cascadeDeleteUserData: userId is required');
  }
  const reason = options.reason ?? 'unspecified';

  // 0) 사용자 정보 사전 조회 — unlink 와 socialIdIndex 삭제에 모두 필요
  const userDocBeforeDelete = await collections.users.doc(userId).get();
  const userData = userDocBeforeDelete.data() as Record<string, unknown> | undefined;
  const provider = userData?.authProvider as SocialProvider | undefined;
  const socialId = userData?.socialId as string | undefined;

  // 1) 소셜 unlink (옵션) — 실패해도 다음 단계 진행
  let unlinkAttempted = false;
  let unlinkSucceeded = false;
  if (options.tryUnlink && provider && socialId) {
    unlinkAttempted = true;
    try {
      const storedToken = userData?.lastSocialAccessToken as string | undefined;
      let lastToken: string | null = null;
      if (storedToken) {
        try {
          lastToken = decryptToken(storedToken);
        } catch (decErr) {
          logger.warn(
            'cascadeDelete/decrypt',
            decErr instanceof Error ? decErr.message : String(decErr),
          );
        }
      }
      await unlinkSocialAccount(provider, socialId, lastToken);
      unlinkSucceeded = true;
      logger.info('cascadeDelete', `unlink OK provider=${provider} reason=${reason}`);
    } catch (e) {
      logger.error('cascadeDelete/unlink', e);
    }
  }

  // 2) 삭제 대상 ref 모으기
  const refs: FirebaseFirestore.DocumentReference[] = [];

  // 자녀 → 자녀 관련 데이터 cascade
  const childrenSnap = await collections.children.where('userId', '==', userId).limit(100).get();
  const childIds = childrenSnap.docs.map((d) => d.id);
  childrenSnap.docs.forEach((d) => refs.push(d.ref));

  for (const childId of childIds) {
    const childSnaps = await Promise.all([
      collections.observations.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.dailyTracking.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.subscriptions.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.coachingSessions.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.followups.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.learnedKnowledge.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.pregnancyRecords.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.albumPhotos.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.milestonePhotos.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.growthAlbums.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.momHealthChecks.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.gdmRecords.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.gdmFoodLogs.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.vaccinations.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.dailyTraits.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.milestoneChecks.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.sleepPredictions.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.autoDiaries.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.recommendationCache.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.analysisUsage.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      // 임산부 모드 — 태동 / 마음 진단 / 일일 미션
      collections.kickSessions.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.momMentalChecks.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.dailyMissions.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      // baby-tracker 서버 sync (2026-05-08 신규)
      collections.babyTrackerDays.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
      collections.babyTrackerSessions.where('childId', '==', childId).limit(COLLECTION_FETCH_LIMIT).get(),
    ]);
    for (const snap of childSnaps) {
      snap.docs.forEach((d) => refs.push(d.ref));
    }
  }

  // 사용자 단위 데이터
  const userSnaps = await Promise.all([
    collections.chatLogs.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    collections.posts.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    collections.postLikes.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    collections.postComments.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    collections.pushSchedules.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    collections.familyMembers.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    collections.conversationSummaries.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    collections.clinicReviews.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    // 맘스톡(mom-group) — 글/댓글/북마크 모두 사용자 발화 데이터
    collections.momGroupPosts.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    collections.momGroupComments.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    collections.momGroupBookmarks.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    // 차단 목록 — 양방향(내가 차단 / 나를 차단)
    collections.userBlocks.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    collections.userBlocks.where('blockedUserId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    // 자동결제 토큰 — 탈퇴 후 결제 시도 차단 (payments 영수증은 회계 의무로 별도 보관)
    collections.billingKeys.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
    // 모든 refresh token revoke — stale token 으로 재진입 불가
    collections.refreshTokens.where('userId', '==', userId).limit(COLLECTION_FETCH_LIMIT).get(),
  ]);
  for (const snap of userSnaps) {
    snap.docs.forEach((d) => refs.push(d.ref));
  }

  // payments 컬렉션은 의도적으로 cascade 제외 — 전자상거래법 21조 결제 기록 5년 보관 의무.
  // 향후 PII 익명화(email/주소) 별도 정책으로 처리 예정.

  // user 문서 + socialIdIndex (재가입 시 깨끗한 상태)
  refs.push(collections.users.doc(userId));
  if (provider && socialId) {
    refs.push(collections.socialIdIndex.doc(`${provider}_${socialId}`));
  }

  // 3) 500건 단위 batch commit
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const chunk = refs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  // 4) Storage 파일 정리 — best-effort, 실패해도 Firestore 삭제는 이미 완료
  try {
    await deleteUserStorageFiles(userId);
  } catch (storageErr) {
    logger.error('cascadeDelete/storage', storageErr);
  }

  logger.info(
    'cascadeDelete',
    `userId=${userId} reason=${reason} deletedRefs=${refs.length} unlinkAttempted=${unlinkAttempted} unlinkSucceeded=${unlinkSucceeded}`,
  );

  return {
    deletedRefs: refs.length,
    unlinkAttempted,
    unlinkSucceeded,
  };
}

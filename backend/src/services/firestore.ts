import * as admin from 'firebase-admin';
import type { Bucket } from '@google-cloud/storage';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const storage: Bucket = admin.storage().bucket('amatda-parenting.firebasestorage.app');

// 컬렉션 레퍼런스
export const collections = {
  users: db.collection('users'),
  children: db.collection('children'),
  observations: db.collection('observations'),
  questions: db.collection('questions'),
  foodGuides: db.collection('foodGuides'),
  subscriptions: db.collection('subscriptions'),
  chatLogs: db.collection('chatLogs'),
  onboardingQuestions: db.collection('onboardingQuestions'),
  dailyTracking: db.collection('dailyTracking'),
  dailyTraits: db.collection('dailyTraits'),
  posts: db.collection('posts'),
  postLikes: db.collection('postLikes'),
  postComments: db.collection('postComments'),
  coachingSessions: db.collection('coachingSessions'),
  followups: db.collection('followups'),
  learnedKnowledge: db.collection('learnedKnowledge'),
  conversationSummaries: db.collection('conversationSummaries'),
  clinics: db.collection('clinics'),
  clinicReviews: db.collection('clinicReviews'),
  pushSchedules: db.collection('pushSchedules'),
  recommendationCache: db.collection('recommendationCache'),
  analysisUsage: db.collection('analysisUsage'),
  milestoneChecks: db.collection('milestoneChecks'),
  sleepPredictions: db.collection('sleepPredictions'),
  familyMembers: db.collection('familyMembers'),
  autoDiaries: db.collection('autoDiaries'),
  pregnancyRecords: db.collection('pregnancyRecords'),
  momHealthChecks: db.collection('momHealthChecks'),
  vaccinations: db.collection('vaccinations'),
  gdmRecords: db.collection('gdmRecords'),
  gdmFoodLogs: db.collection('gdmFoodLogs'),
  kickSessions: db.collection('kickSessions'),
  momMentalChecks: db.collection('momMentalChecks'),
  momGroupPosts: db.collection('momGroupPosts'),
  momGroupComments: db.collection('momGroupComments'),
  momGroupBookmarks: db.collection('momGroupBookmarks'),
  milestonePhotos: db.collection('milestonePhotos'),

  // 통합 앨범 컬렉션 (2026-05-01 마이그레이션) — 임신 + 출생후 사진을 단일 컬렉션에 통합
  // phase: 'pregnancy' | 'baby' 로 구분
  // 옛 milestonePhotos + pregnancyRecords의 read 대상 — dual-write 기간엔 양쪽 모두 쓰기
  albumPhotos: db.collection('albumPhotos'),
  // 코칭 하루 상담 횟수 카운터 (문서 ID: {userId}_{YYYY-MM-DD})
  // getTodaySessionCount() 전체 컬렉션 쿼리 대체 → 단일 문서 읽기로 성능 개선
  rateLimits: db.collection('rateLimits'),

  // 성장 앨범 — 생성된 PDF 앨범 목록
  // 문서: { userId, childId, title, dateFrom, dateTo, pdfUrl, status, pageCount, photoCount, createdAt, completedAt }
  growthAlbums: db.collection('growthAlbums'),

  // 임산부 데일리 미션 (물 마시기 / 영양제 / ...)
  // 문서 ID: {childId}_{YYYY-MM-DD}  → 하루 1문서
  // {
  //   userId, childId, date,
  //   water: number (잔 수, 0~20),
  //   supplements: boolean,  // 영양제 챙겼는지
  //   updatedAt: ISO,
  // }
  dailyMissions: db.collection('dailyMissions'),

  // 결제 영수증 — 모든 유료 결제 1건당 문서 1개 (회계/환불용 영구 보관)
  // 문서: {
  //   userId, platform: 'portone'|'google'|'apple',
  //   productId: 'premium_monthly'|'premium_yearly',
  //   amount: number, currency: 'KRW',
  //   status: 'PAID'|'CANCELLED'|'REFUNDED'|'FAILED'|'PENDING',
  //   paymentKey?: string,         // PortOne paymentId
  //   purchaseToken?: string,      // Google purchase token
  //   originalTransactionId?: string,  // Apple
  //   billingKey?: string,         // PortOne 자동결제용 (정기결제)
  //   paymentMethod?: string,      // 'card'|'kakaopay'|'naverpay'|...
  //   paidAt: ISO, expiresAt: ISO,
  //   webhookVerifiedAt?: ISO,
  //   raw?: object,                // PortOne/Google/Apple raw 응답 (디버깅용)
  //   createdAt, updatedAt
  // }
  payments: db.collection('payments'),

  // 빌링키(자동결제 토큰) — 사용자당 1개
  // 문서 ID: userId
  // {
  //   userId, billingKey, channelKey, customerId,
  //   issuedAt: ISO, status: 'ACTIVE'|'REVOKED',
  //   cardName?: string, cardNumberMasked?: string,
  // }
  billingKeys: db.collection('billingKeys'),

  // 소셜 가입 race condition 방어용 결정적 인덱스.
  // 문서 ID: `${provider}_${socialId}` (예: KAKAO_1234567890)
  // 같은 socialId 로 동시에 두 요청이 와도 transaction이 retry → 한쪽만 user 생성.
  // 문서: { userId, provider, socialId, createdAt }
  socialIdIndex: db.collection('socialIdIndex'),

  // Refresh token 가족(family) — RFC 6819 OAuth2 best practice (#2 보안 강화)
  //   refresh 시마다 jti 회전 (rotation), 사용된 jti 는 used=true 마킹.
  //   탈취당한 토큰 재사용 시 used=true 인 jti가 재시도되면 → 같은 familyId의 모든 토큰 무효화.
  //   logout / 계정삭제 시 해당 사용자 모든 토큰 revoke.
  //
  //   문서 ID: jti (UUID)
  //   { jti, familyId, userId, used: boolean, revoked: boolean,
  //     issuedAt: ISO, expiresAt: ISO, replacedBy?: jti, revokedReason?: string }
  refreshTokens: db.collection('refreshTokens'),

  // 사용자 차단 목록 — UGC 정책(Apple 1.2 / Google) 충족용.
  // 문서 ID: `${userId}_${blockedUserId}`
  // { userId, blockedUserId, createdAt }
  userBlocks: db.collection('userBlocks'),

  // ─── baby-tracker 서버 sync (2026-05-08 신규) ───
  //
  // 기존 baby-tracker 는 AsyncStorage 만 사용 → 데이터 삭제 / 재설치 시 영구 손실.
  // PIPA 관점이 아닌 사용자 데이터 보존 관점에서 출시 차단 사항이라 서버 sync 추가.
  //
  // babyTrackerDays — day 단위 records 저장
  //   문서 ID: `${childId}_${YYYY-MM-DD}`
  //   { userId, childId, date, records: TrackerRecord[], updatedAt }
  babyTrackerDays: db.collection('babyTrackerDays'),

  // babyTrackerSessions — 진행 중인 sleep/breast 세션 저장 (앱 재시작 시 복구)
  //   문서 ID: childId
  //   { userId, childId, sleepSession?: {...} | null, breastSession?: {...} | null, updatedAt }
  babyTrackerSessions: db.collection('babyTrackerSessions'),

  // announcements — 앱 시작 공지 팝업 (콘솔/관리자에서 작성)
  //   { title, body, imageUrl?, active, startAt?, endAt?, priority?, createdAt }
  announcements: db.collection('announcements'),

  // promoCodes — 프로모 코드 (인플루언서 팔로워 대상 무료 이용권 등)
  //   문서 ID: 코드 문자열(대문자 정규화)
  //   { months: number, maxRedemptions: number(0=무제한), redeemedCount: number,
  //     active: boolean, label?: string, expiresAt?: ISO, createdAt }
  promoCodes: db.collection('promoCodes'),

  // promoRedemptions — 프로모 코드 사용 기록 (유저당 코드 1회 중복 방지)
  //   문서 ID: `${userId}_${CODE}`
  //   { userId, code, months, grantedAt: ISO }
  promoRedemptions: db.collection('promoRedemptions'),

  // apiUsageLogs — AI(Gemini/OpenAI) 호출 1건당 문서 1개(원본 로그, 감사용)
  //   { userId, provider:'gemini'|'openai', model, inputTokens, outputTokens,
  //     totalTokens, costUsd, createdAt }
  apiUsageLogs: db.collection('apiUsageLogs'),

  // apiUsageDaily — 유저별 일별 AI 사용량 집계 (관리자 대시보드 빠른 조회용)
  //   문서 ID: `${userId}_${YYYY-MM-DD}` (KST)
  //   { userId, date, callCount, inputTokens, outputTokens, totalTokens, costUsd, updatedAt }
  apiUsageDaily: db.collection('apiUsageDaily'),

  // screenActivity — 유저별 최근 화면 열람(조회) 추적 (관리자 대시보드 "무엇을 봤나" 표시용)
  //   문서 ID: userId (유저당 1문서). { userId, recentScreens: [{s,t}] (최근 30개 상한),
  //   updatedAt, expireAt(30일 후 — TTL 정책 후보) }. 화면명(경로)만 저장 — 콘텐츠/PII 없음.
  screenActivity: db.collection('screenActivity'),
};

/** 문서 ID 생성 */
export function genId(): string {
  return db.collection('_').doc().id;
}

/** Firestore 타임스탬프 → ISO 문자열 */
export function toISO(ts: admin.firestore.Timestamp | Date | string): string {
  if (ts instanceof admin.firestore.Timestamp) return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return ts;
}

/** 문서 데이터 + id 합치기 */
export function withId<T>(doc: admin.firestore.DocumentSnapshot): T & { id: string } {
  return { id: doc.id, ...(doc.data() as T) };
}

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
  academies: db.collection('academies'),
  faq: db.collection('faq'),
  ads: db.collection('ads'),
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
  sleepKnowledgeCache: db.collection('sleepKnowledgeCache'),
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
  // 코칭 하루 상담 횟수 카운터 (문서 ID: {userId}_{YYYY-MM-DD})
  // getTodaySessionCount() 전체 컬렉션 쿼리 대체 → 단일 문서 읽기로 성능 개선
  rateLimits: db.collection('rateLimits'),

  // 성장 앨범 — 생성된 PDF 앨범 목록
  // 문서: { userId, childId, title, dateFrom, dateTo, pdfUrl, status, pageCount, photoCount, createdAt, completedAt }
  growthAlbums: db.collection('growthAlbums'),
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

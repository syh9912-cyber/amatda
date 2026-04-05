import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();

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

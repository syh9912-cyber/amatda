/**
 * grant-premium.cjs
 *
 * 사용자 이메일로 프리미엄 N개월 수동 부여 (테스트 계정 / 보상용).
 *
 * 실행:
 *   cd backend
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/grant-premium.cjs <email> [months]
 *
 * 예시:
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/grant-premium.cjs syh9912@gmail.com 12
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'amatda-parenting' });
}

const db = admin.firestore();

async function main() {
  const email = process.argv[2];
  const months = parseInt(process.argv[3] || '12', 10);

  if (!email) {
    console.error('Usage: node grant-premium.cjs <email> [months=12]');
    process.exit(1);
  }

  console.log(`[grant-premium] target=${email} months=${months}`);

  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) {
    console.error(`User not found for email: ${email}`);
    process.exit(2);
  }

  const userDoc = snap.docs[0];
  const userId = userDoc.id;
  const user = userDoc.data();
  console.log(`[grant-premium] found userId=${userId} current tier=${user.subscriptionTier || 'FREE'}`);

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  await userDoc.ref.update({
    subscriptionTier: 'PAID',
    premiumStartedAt: now.toISOString(),
    premiumExpiresAt: expiresAt.toISOString(),
    // trialStartedAt 은 그대로 — 이미 체험 사용 처리도 유지
  });

  console.log(`[grant-premium] DONE userId=${userId}`);
  console.log(`  subscriptionTier: PAID`);
  console.log(`  premiumStartedAt: ${now.toISOString()}`);
  console.log(`  premiumExpiresAt: ${expiresAt.toISOString()} (+${months}m)`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(99);
});

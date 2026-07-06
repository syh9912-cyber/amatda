/**
 * grant-premium.cjs
 *
 * 사용자 이메일로 프리미엄 N개월 수동 부여 (테스트 계정 / 보상용).
 *
 * 실행:
 *   cd backend
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/grant-premium.cjs <email> [months]
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/grant-premium.cjs --uid <userId> [months]
 *
 * 예시:
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/grant-premium.cjs syh9912@gmail.com 12
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/grant-premium.cjs --uid abc123 3
 *
 * 소셜 로그인(카카오 등)은 이메일이 없을 수 있음 → --uid 모드 사용.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'amatda-parenting' });
}

const db = admin.firestore();

// email 모드 / --uid 모드 공통으로 유저 문서 + months 를 해석한다.
async function resolveTarget() {
  if (process.argv[2] === '--uid') {
    const uid = process.argv[3];
    const months = parseInt(process.argv[4] || '12', 10);
    if (!uid) {
      console.error('Usage: node grant-premium.cjs --uid <userId> [months=12]');
      process.exit(1);
    }
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
      console.error(`User not found for uid: ${uid}`);
      process.exit(2);
    }
    return { userDoc: doc, months, label: `uid=${uid}` };
  }

  const email = process.argv[2];
  const months = parseInt(process.argv[3] || '12', 10);
  if (!email) {
    console.error('Usage: node grant-premium.cjs <email> [months=12]');
    console.error('   or: node grant-premium.cjs --uid <userId> [months=12]');
    process.exit(1);
  }
  // limit(2) 로 이메일 중복 여부까지 확인 — 중복이면 --uid 로 지정하도록 중단
  const snap = await db.collection('users').where('email', '==', email).limit(2).get();
  if (snap.empty) {
    console.error(`User not found for email: ${email} (소셜 로그인은 이메일이 없을 수 있음 → --uid 사용)`);
    process.exit(2);
  }
  if (snap.size > 1) {
    console.error(`이메일 중복: ${email} — --uid <userId> 로 지정하세요`);
    process.exit(2);
  }
  return { userDoc: snap.docs[0], months, label: `email=${email}` };
}

async function main() {
  const { userDoc, months, label } = await resolveTarget();
  const userId = userDoc.id;
  const user = userDoc.data();
  console.log(`[grant-premium] target=${label} months=${months}`);
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

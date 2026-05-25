/**
 * revoke-premium.cjs
 *
 * 사용자 이메일로 프리미엄을 회수 (grant-premium 의 반대).
 * 결제 데이터는 보존, 사용자 권한 필드만 FREE 로 되돌림.
 *
 * 실행:
 *   cd backend
 *   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/revoke-premium.cjs <email>
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'amatda-parenting' });
}

const db = admin.firestore();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: node revoke-premium.cjs <email>');
    process.exit(1);
  }

  console.log(`[revoke-premium] target=${email}`);

  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) {
    console.error(`User not found for email: ${email}`);
    process.exit(2);
  }

  const userDoc = snap.docs[0];
  const userId = userDoc.id;
  const user = userDoc.data();
  console.log(`[revoke-premium] found userId=${userId}`);
  console.log(`  before tier=${user.subscriptionTier || 'FREE'}`);
  console.log(`  before premiumExpiresAt=${user.premiumExpiresAt || 'null'}`);
  console.log(`  before premiumStartedAt=${user.premiumStartedAt || 'null'}`);

  await userDoc.ref.update({
    subscriptionTier: 'FREE',
    premiumStartedAt: admin.firestore.FieldValue.delete(),
    premiumExpiresAt: admin.firestore.FieldValue.delete(),
    subscriptionAutoRenew: false,
  });

  console.log(`[revoke-premium] DONE userId=${userId}`);
  console.log(`  subscriptionTier: FREE`);
  console.log(`  premiumStartedAt / premiumExpiresAt: deleted`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(99);
});
